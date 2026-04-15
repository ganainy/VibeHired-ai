import express, { Router, Request, Response, RequestHandler } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import authMiddleware from '../middleware/authMiddleware';
import JobApplication from '../models/JobApplication';
import User, { IUser } from '../models/User'; // Import IUser interface
import Profile from '../models/Profile';
import { generateContent, generateStructuredResponse } from '../utils/aiService';
import { GoogleGenerativeAIError } from '@google/generative-ai';
import { JsonResumeSchema } from '../types/jsonresume';
import mongoose from 'mongoose';
import CV from '../models/CV'; // Import Unified CV Model
import { generateCvPdfFromJsonResume, generateCoverLetterPdf } from '../utils/pdfGenerator'; // Import PDF generators
import { validateRequest, ValidatedRequest } from '../middleware/validateRequest';
import { usageLimiter } from '../middleware/usageLimiter';
import { generateDocumentsBodySchema, improveSectionBodySchema, applyAtsSuggestionBodySchema } from '../validations/generatorSchemas';
import { jobIdParamSchema, filenameParamSchema } from '../validations/commonSchemas';
import { improveCvSection, applyAtsSuggestion } from '../controllers/generatorController';
import { asyncHandler } from '../utils/asyncHandler';
import { generateDescriptorFromJson } from '../services/generatorService';
import { CvSectionDescriptor } from '../types/cvDescriptor';
import { normalizeFreeformCvTags } from '../utils/vhTagNormalizer';
import { normalizeCvFieldNames, normalizeSectionNames } from '../utils/cvNormalizer';
import {
    TailoringChange,
    TailoringResponse,
    tailoringResponseJsonSchema,
    changesOnlyJsonSchema,
} from '../schemas/cvTailoring.schema';

const router: Router = express.Router();
router.use(authMiddleware as RequestHandler); // Apply auth to all routes in this file

// --- Interfaces ---
interface GenerateDraftReadyResponse { status: "draft_ready"; message: string; jobId: string; }


// --- Helper Functions (combined CV+CL flow removed — see coverLetterService.ts) ---

// Define an interface for the expected user object structure
interface AuthenticatedUser {
    _id: mongoose.Types.ObjectId | string;
}

function isNonEmptyObject(value: unknown): value is Record<string, any> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value as Record<string, any>).length > 0);
}

function isJsonResumeLike(value: unknown): boolean {
    if (!isNonEmptyObject(value)) return false;
    return ['basics', 'work', 'education', 'skills', 'projects', 'languages'].some((k) => k in value);
}

function stringifyCompact(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
    if (Array.isArray(value)) return value.map((v) => stringifyCompact(v)).filter(Boolean).join(' | ').trim();
    if (typeof value === 'object') {
        return Object.values(value as Record<string, unknown>)
            .map((v) => stringifyCompact(v))
            .filter(Boolean)
            .join(' | ')
            .trim();
    }
    return String(value).trim();
}

function normalizeTailoringChanges(raw: unknown): TailoringChange[] | null {
    if (!Array.isArray(raw)) return null;

    const normalized = raw
        .map((item): TailoringChange | null => {
            if (!item || typeof item !== 'object') return null;
            const obj = item as Record<string, unknown>;

            const section = String(obj.section ?? obj.sectionKey ?? obj.key ?? '').trim();
            const description = String(obj.description ?? obj.explanation ?? obj.change ?? '').trim();
            const reason = String(obj.reason ?? obj.why ?? 'Tailored to better match the job requirements.').trim();
            const before = String(obj.before ?? obj.from ?? obj.previous ?? '').trim();
            const after = String(obj.after ?? obj.to ?? obj.updated ?? '').trim();

            if (!section || !description) return null;

            return {
                section,
                description,
                reason,
                before: before || undefined,
                after: after || undefined,
            };
        })
        .filter((v): v is TailoringChange => v !== null);

    return normalized.length > 0 ? normalized : null;
}

async function generateAiTailoringChanges(
    userId: string,
    languageName: string,
    jobDescription: string,
    baseSnapshot: unknown,
    tailoredSnapshot: unknown,
): Promise<TailoringChange[] | null> {
    const prompt = `You are a CV comparison assistant.

Compare the ORIGINAL CV snapshot and the TAILORED CV snapshot and return concrete, section-level changes.

Target language of CV content: ${languageName}

Job description context:
---
${jobDescription.slice(0, 5000)}
---

ORIGINAL snapshot:
\`\`\`json
${JSON.stringify(baseSnapshot, null, 2).slice(0, 30000)}
\`\`\`

TAILORED snapshot:
\`\`\`json
${JSON.stringify(tailoredSnapshot, null, 2).slice(0, 30000)}
\`\`\`

Rules:
- Return 3-12 meaningful changes when possible.
- Use section names that are present in the CV.
- Each change must include a concise before and after snippet.
- Write description/reason/before/after in English.
- If very few true changes exist, still include the most important ones.`;

    try {
        const parsed = await generateStructuredResponse<{ changes: TailoringChange[] }>(userId, prompt, {
            maxTokens: 2500,
            responseJsonSchema: changesOnlyJsonSchema,
        });
        return normalizeTailoringChanges(parsed?.changes);
    } catch (err: any) {
        console.warn(`AI comparison changes fallback failed: ${err.message}`);
        return null;
    }
}


// --- NEW: Render Final PDFs Endpoint ---
const renderFinalPdfsHandler: RequestHandler = async (req: ValidatedRequest, res): Promise<void> => {
    console.log("--- Render Final PDFs Endpoint Hit ---");
    const user = req.user as IUser;
    if (!user || !user._id) {
        res.status(401).json({ message: 'Authentication required.' });
        return;
    }
    const userId = user._id;
    const { jobId } = req.validated!.params!;
    const TEMP_PDF_DIR = path.join(__dirname, '..', '..', 'temp_pdfs'); // Define PDF directory path

    try {
        // 1. Fetch Saved Draft/Finalized Job
        const job = await JobApplication.findOne({ _id: jobId, userId: userId });

        // 2. Validate Job and Draft Data
        if (!job) {
            res.status(404).json({ message: 'Job application not found or access denied.' });
            return;
        }
        if (job.generationStatus !== 'draft_ready' && job.generationStatus !== 'finalized') {
            res.status(400).json({ message: 'Draft documents must be ready or previously finalized before rendering.', currentStatus: job.generationStatus });
            return;
        }

        // Fetch CV from unified model
        const jobCv = await CV.findOne({ jobApplicationId: jobId, userId: userId });

        let cvJsonData: JsonResumeSchema | null = null;
        if (jobCv && jobCv.cvJson) {
            cvJsonData = jobCv.cvJson;
        } else if (job.draftCvJson && typeof job.draftCvJson === 'object' && Object.keys(job.draftCvJson).length > 0) {
            // Fallback to legacy field
            cvJsonData = job.draftCvJson as JsonResumeSchema;
        }

        if (!cvJsonData || Object.keys(cvJsonData).length === 0) {
            res.status(400).json({ message: 'Missing or invalid draft CV data.' });
            return;
        }

        // --- MODIFICATION: Ensure name is available for filenames (check Master CV fallback) ---
        const currentName1 = cvJsonData.basics?.name;
        if (!currentName1 || currentName1 === 'Applicant') {
            const masterCv = await CV.findOne({ userId, isMasterCv: true });
            const masterName = masterCv?.cvJson?.basics?.name;
            if (masterName) {
                if (!cvJsonData.basics) {
                    cvJsonData.basics = { name: masterName, profiles: [] } as any;
                } else {
                    cvJsonData.basics.name = masterName;
                }
                console.log(`Using name from Master CV for filenames: ${cvJsonData.basics?.name}`);
            }
        }

        if (!job.draftCoverLetterText || typeof job.draftCoverLetterText !== 'string') {
            res.status(400).json({ message: 'Missing or invalid draft cover letter text.' });
            return;
        }
        if (!job.language || (job.language !== 'en' && job.language !== 'de')) {
            console.warn(`Job ${jobId} missing valid language for PDF naming. Defaulting to 'en'.`);
            // Optionally update the job document here if language is missing
            // await JobApplication.updateOne({ _id: jobId, userId: userId }, { $set: { language: 'en' } });
            // job.language = 'en'; // Update local copy too
            // For now, we'll just use 'en' if missing, but ideally it should be set during draft finalization
        }
        const language = (job.language === 'en' || job.language === 'de') ? job.language : 'en'; // Ensure language is 'en' or 'de'

        // --- MODIFICATION START: Delete Old PDFs Before Generating New Ones ---
        const oldCvFilename = job.generatedCvFilename;
        const oldClFilename = job.generatedCoverLetterFilename;

        if (oldCvFilename) {
            const oldCvPath = path.join(TEMP_PDF_DIR, path.basename(oldCvFilename)); // Sanitize filename
            try {
                await fs.promises.unlink(oldCvPath);
                console.log(`Deleted old CV PDF: ${oldCvPath}`);
            } catch (err: any) {
                // Log error but continue - maybe file was already deleted manually
                if (err.code !== 'ENOENT') { // ENOENT = file not found, which is okay here
                    console.warn(`Could not delete old CV PDF ${oldCvPath}: ${err.message}`);
                } else {
                    console.log(`Old CV PDF ${oldCvPath} not found, skipping deletion.`);
                }
            }
        }
        if (oldClFilename) {
            const oldClPath = path.join(TEMP_PDF_DIR, path.basename(oldClFilename)); // Sanitize filename
            try {
                await fs.promises.unlink(oldClPath);
                console.log(`Deleted old Cover Letter PDF: ${oldClPath}`);
            } catch (err: any) {
                if (err.code !== 'ENOENT') {
                    console.warn(`Could not delete old Cover Letter PDF ${oldClPath}: ${err.message}`);
                } else {
                    console.log(`Old Cover Letter PDF ${oldClPath} not found, skipping deletion.`);
                }
            }
        }
        // --- MODIFICATION END ---

        // 3. Prepare Filenames for New PDFs
        const sanitize = (str: string) => str?.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_') || 'Unknown';

        // Use AI-suggested filename (stored when cover letter was generated)
        const aiFilename = (job.coverLetterFileName || job.suggestedCoverLetterFilename || '').replace(/\.pdf$/i, '');
        const clFilenamePrefix = aiFilename || sanitize(job.companyName + '_Anschreiben');
        console.log(`Cover letter PDF filename prefix: ${clFilenamePrefix}`);

        const langSuffix = language.toUpperCase();
        const cvFilenamePrefix = `CV_${sanitize(job.companyName)}_${langSuffix}`;

        // 4. Call PDF Generators
        console.log(`Generating final CV PDF for job ${jobId}...`);
        const generatedCvFilename = await generateCvPdfFromJsonResume(
            cvJsonData,
            `${cvFilenamePrefix}_${language}`
        );

        console.log(`Generating final Cover Letter PDF for job ${jobId}...`);
        const generatedClFilename = await generateCoverLetterPdf(
            job.draftCoverLetterText!, // Add non-null assertion as it was validated
            cvJsonData,
            clFilenamePrefix
        );

        // 5. Update Job Status and Store NEW Filenames
        await JobApplication.updateOne({ _id: jobId, userId: userId }, {
            $set: {
                generationStatus: 'finalized',
                generatedCvFilename: generatedCvFilename, // Store new CV filename
                generatedCoverLetterFilename: generatedClFilename, // Store new CL filename
            }
        });
        console.log(`Job ${jobId} status updated to 'finalized' and latest filenames stored.`);

        // 6. Return Success
        res.status(200).json({
            status: "success",
            message: "Final CV and Cover Letter PDFs generated successfully.",
            cvFilename: generatedCvFilename,
            coverLetterFilename: generatedClFilename
        });
        return;

    } catch (error: any) {
        // 7. Error Handling
        console.error(`Error rendering final PDFs for job ${jobId}:`, error);
        // Use a non-blocking call for the error status update
        JobApplication.updateOne({ _id: jobId, userId: userId }, { $set: { generationStatus: 'error' } })
            .catch(err => console.error("Failed to update job status to error:", err));

        res.status(500).json({ message: `Failed to render final PDFs: ${error.message || 'Internal server error'}` });
        return;
    }
};


// --- Download Endpoint (Keep as is - still needed AFTER final rendering step) ---
const downloadFileHandler: RequestHandler = async (req: ValidatedRequest, res) => {
    if (!req.user) { res.status(401).json({ message: 'Authentication required to download.' }); return; }
    const { filename } = req.validated!.params!;
    const safeFilename = path.basename(filename);
    const TEMP_PDF_DIR = path.join(__dirname, '..', '..', 'temp_pdfs');
    const filePath = path.join(TEMP_PDF_DIR, safeFilename);

    try {
        await fs.promises.access(filePath);
        console.log(`Serving file for download: ${filePath}`);
        // Create a user-friendly filename by removing the timestamp (e.g. "_1766957547866")
        // Logic: Replace the last underscore followed by digits and extension with just the extension
        let downloadFilename = safeFilename;
        const timestampRegex = /_\d+\.pdf$/;
        if (timestampRegex.test(safeFilename)) {
            downloadFilename = safeFilename.replace(timestampRegex, '.pdf');
        }

        res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
        res.setHeader('Content-Type', 'application/pdf');
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

        fileStream.on('close', () => {
            console.log(`Finished streaming ${filePath}. File remains in temp directory.`);
        });

        fileStream.on('error', (e: NodeJS.ErrnoException) => {
            console.error(`Stream error ${filePath}`, e);
            if (!res.headersSent) {
                res.status(500).json({ message: 'Error streaming file.' });
            } else {
                res.end();
            }
        });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') { res.status(404).json({ message: 'File not found or already deleted.' }); return; }
        console.error(`Download prep error ${filePath}`, error);
        res.status(500).json({ message: 'Server error preparing download.' });
    }
};

// --- Render CV PDF Only Endpoint ---
const renderCvPdfHandler: RequestHandler = async (req: ValidatedRequest, res): Promise<void> => {
    const user = req.user as IUser;
    if (!user || !user._id) {
        res.status(401).json({ message: 'Authentication required.' });
        return;
    }
    const userId = user._id;
    const { jobId } = req.validated!.params!;
    const TEMP_PDF_DIR = path.join(__dirname, '..', '..', 'temp_pdfs');

    try {
        const job = await JobApplication.findOne({ _id: jobId, userId: userId });
        if (!job) {
            res.status(404).json({ message: 'Job application not found or access denied.' });
            return;
        }

        // Fetch CV from unified model
        const jobCv = await CV.findOne({ jobApplicationId: jobId, userId: userId });

        // Use CV logic:
        let cvJsonData: JsonResumeSchema | null = null;
        if (jobCv && jobCv.cvJson) {
            cvJsonData = jobCv.cvJson;
        } else if (job.draftCvJson && typeof job.draftCvJson === 'object' && Object.keys(job.draftCvJson).length > 0) {
            // Fallback to legacy field
            cvJsonData = job.draftCvJson as JsonResumeSchema;
        }

        if (!cvJsonData || Object.keys(cvJsonData).length === 0) {
            res.status(400).json({ message: 'Missing or invalid draft CV data.' });
            return;
        }

        // --- MODIFICATION: Ensure name is available for filenames (check Master CV fallback) ---
        const currentName2 = cvJsonData.basics?.name;
        if (!currentName2 || currentName2 === 'Applicant') {
            const masterCv = await CV.findOne({ userId, isMasterCv: true });
            const masterName = masterCv?.cvJson?.basics?.name;
            if (masterName) {
                if (!cvJsonData.basics) {
                    cvJsonData.basics = { name: masterName, profiles: [] } as any;
                } else {
                    cvJsonData.basics.name = masterName;
                }
                console.log(`Using name from Master CV for filenames: ${cvJsonData.basics?.name}`);
            }
        }

        const language = (job.language === 'en' || job.language === 'de') ? job.language : 'en';

        // Delete old CV PDF if exists
        if (job.generatedCvFilename) {
            const oldCvPath = path.join(TEMP_PDF_DIR, path.basename(job.generatedCvFilename));
            try {
                await fs.promises.unlink(oldCvPath);
                console.log(`Deleted old CV PDF: ${oldCvPath}`);
            } catch (err: any) {
                if (err.code !== 'ENOENT') {
                    console.warn(`Could not delete old CV PDF ${oldCvPath}: ${err.message}`);
                }
            }
        }

        // Generate new CV PDF
        const sanitize = (str: string) => str?.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_') || 'Unknown';
        // cvJsonData is already set output
        // const applicantName = sanitize(cvJsonData?.basics?.name || 'Applicant');
        const companySanitized = sanitize(job.companyName);
        // const titleSanitized = sanitize(job.jobTitle);
        const langSuffix = language.toUpperCase();
        const cvFilenamePrefix = `CV_${companySanitized}_${langSuffix}`;

        const generatedCvFilename = await generateCvPdfFromJsonResume(cvJsonData, cvFilenamePrefix);

        // Update job with new CV filename
        await JobApplication.updateOne({ _id: jobId, userId: userId }, {
            $set: {
                generatedCvFilename: generatedCvFilename,
                generationStatus: 'finalized'
            }
        });

        res.status(200).json({
            status: "success",
            message: "CV PDF generated successfully.",
            cvFilename: generatedCvFilename
        });
    } catch (error: any) {
        console.error(`Error rendering CV PDF for job ${jobId}:`, error);
        JobApplication.updateOne({ _id: jobId, userId: userId }, { $set: { generationStatus: 'error' } })
            .catch(err => console.error("Failed to update job status to error:", err));
        res.status(500).json({ message: `Failed to render CV PDF: ${error.message || 'Internal server error'}` });
    }
};

// --- Render Cover Letter PDF Only Endpoint ---
const renderCoverLetterPdfHandler: RequestHandler = async (req: ValidatedRequest, res): Promise<void> => {
    const user = req.user as IUser;
    if (!user || !user._id) {
        res.status(401).json({ message: 'Authentication required.' });
        return;
    }
    const userId = user._id;
    const { jobId } = req.validated!.params!;
    const TEMP_PDF_DIR = path.join(__dirname, '..', '..', 'temp_pdfs');

    try {
        const job = await JobApplication.findOne({ _id: jobId, userId: userId });
        if (!job) {
            res.status(404).json({ message: 'Job application not found or access denied.' });
            return;
        }
        if (!job.draftCoverLetterText || typeof job.draftCoverLetterText !== 'string') {
            res.status(400).json({ message: 'Missing or invalid draft cover letter text.' });
            return;
        }
        const language = (job.language === 'en' || job.language === 'de') ? job.language : 'en';

        // Fetch CV from unified model for header data
        const jobCv = await CV.findOne({ jobApplicationId: jobId, userId: userId });

        let cvJsonData: JsonResumeSchema | null = null;
        if (jobCv && jobCv.cvJson) {
            cvJsonData = jobCv.cvJson;
        } else if (job.draftCvJson && typeof job.draftCvJson === 'object' && Object.keys(job.draftCvJson).length > 0) {
            // Fallback to legacy field
            cvJsonData = job.draftCvJson as JsonResumeSchema;
        }

        // If no CV data, use empty object (cover letter might not need much from CV except header)
        // But generateCoverLetterPdf expects it.
        if (!cvJsonData) cvJsonData = {} as JsonResumeSchema;

        // --- MODIFICATION: Ensure name is available for filenames (check Master CV fallback) ---
        const currentName3 = cvJsonData.basics?.name;
        if (!currentName3 || currentName3 === 'Applicant') {
            const masterCv = await CV.findOne({ userId, isMasterCv: true });
            const masterName = masterCv?.cvJson?.basics?.name;
            if (masterName) {
                if (!cvJsonData.basics) {
                    cvJsonData.basics = { name: masterName, profiles: [] } as any;
                } else {
                    cvJsonData.basics.name = masterName;
                }
                console.log(`Using name from Master CV for filenames: ${cvJsonData.basics?.name}`);
            }
        }

        // Delete old Cover Letter PDF if exists
        if (job.generatedCoverLetterFilename) {
            const oldClPath = path.join(TEMP_PDF_DIR, path.basename(job.generatedCoverLetterFilename));
            try {
                await fs.promises.unlink(oldClPath);
                console.log(`Deleted old Cover Letter PDF: ${oldClPath}`);
            } catch (err: any) {
                if (err.code !== 'ENOENT') {
                    console.warn(`Could not delete old Cover Letter PDF ${oldClPath}: ${err.message}`);
                }
            }
        }

        // Generate new Cover Letter PDF
        const sanitize = (str: string) => str?.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_') || 'Unknown';

        // Use AI-suggested filename (stored when cover letter was generated)
        const aiFilename = (job.coverLetterFileName || job.suggestedCoverLetterFilename || '').replace(/\.pdf$/i, '');
        const clFilenamePrefix = aiFilename || sanitize(job.companyName + '_Anschreiben');
        console.log(`Cover letter PDF filename prefix: ${clFilenamePrefix}`);

        const generatedClFilename = await generateCoverLetterPdf(
            job.draftCoverLetterText,
            cvJsonData || {},
            clFilenamePrefix
        );

        // Update job with new Cover Letter filename
        await JobApplication.updateOne({ _id: jobId, userId: userId }, {
            $set: {
                generatedCoverLetterFilename: generatedClFilename,
                generationStatus: 'finalized'
            }
        });

        res.status(200).json({
            status: "success",
            message: "Cover Letter PDF generated successfully.",
            coverLetterFilename: generatedClFilename
        });
    } catch (error: any) {
        console.error(`Error rendering Cover Letter PDF for job ${jobId}:`, error);
        JobApplication.updateOne({ _id: jobId, userId: userId }, { $set: { generationStatus: 'error' } })
            .catch(err => console.error("Failed to update job status to error:", err));
        res.status(500).json({ message: `Failed to render Cover Letter PDF: ${error.message || 'Internal server error'}` });
    }
};

// --- Prompt builders (concise, schema-aligned — no output format examples needed) ---

function buildJsonResumePrompt(
    baseCvJson: Record<string, any>,
    jobDescription: string,
    languageName: string,
    requestedLanguage: string,
): string {
    return `
You are an expert career advisor specialized in the ${languageName} job market.
Tailor the provided base CV (JSON Resume format) for the specific job below.

**Target Language:** ${languageName}

**Base CV (JSON Resume):**
\`\`\`json
${JSON.stringify(baseCvJson, null, 2)}
\`\`\`

**Job Description:**
---
${jobDescription}
---

**Instructions:**
- Rewrite content to emphasize relevance to the job, using keywords from the description.
- Include ALL projects from the base CV — never filter, summarize, or omit any.
- Do NOT condense to one page; 2+ pages is fine if the content requires it.
- STRICT: Do NOT invent skills, experiences, or qualifications not present in the base CV.
- Optimize ordering of items within sections for relevance; do not delete less relevant ones.
- Populate basics.summary with a strong tailored professional summary.
- Do NOT mention the target company name anywhere in the CV.
- All CV text must be in ${languageName}.
- Include meta.sectionLabels with translated section names in ${languageName}.
- The changes array descriptions/reasons/before/after must ALWAYS be in ENGLISH.
`.trim();
}

function buildFreeformCvPrompt(
    baseCvJson: Record<string, any>,
    jobDescription: string,
    languageName: string,
    requestedLanguage: string,
): string {
    return `
You are an expert career advisor specialized in the ${languageName} job market.
Tailor the provided freeform CV JSON for the specific job below.

**Target Language:** ${languageName}

**Base CV (freeform JSON):**
\`\`\`json
${JSON.stringify(baseCvJson, null, 2)}
\`\`\`

**Job Description:**
---
${jobDescription}
---

**Instructions:**
- Keep the CV as freeform JSON, preserving the same top-level keys and structure.
- Preserve and return __vh_tags if present; if missing, create one mapping important fields.
- Use only canonical tags: name, email, phone, url, location, address, city, linkedin, github, website, portfolio, date, date_range, title, subtitle, paragraph, bullets, key_value, contact_block, personal_info.
- The base CV uses these canonical field names within array entries:
  - "title" for job title / degree name
  - "subtitle" for company / institution
  - "dates" for date ranges
  - "bullets" for bullet point arrays
  - "content" for key-value content
  - "category" for category labels
  You MUST use exactly these field names in the tailored output.
- Do NOT invent skills, experiences, or qualifications not present in the base CV.
- You may reorder items for relevance but do not drop important sections.
- All CV text must be in ${languageName}.
- The tailored CV must be detailed and not shorter than the base CV.
- The changes array descriptions/reasons/before/after must ALWAYS be in ENGLISH.
`.trim();
}

// --- Generate CV Only Endpoint (schema-enforced) ---
const generateCvOnlyHandler: RequestHandler = async (req: ValidatedRequest, res) => {
    const user = req.user as AuthenticatedUser;
    if (!user) { res.status(401).json({ message: 'User not authenticated correctly.' }); return; }

    const { jobId } = req.validated!.params!;
    const requestedLanguage = req.validated!.body?.language === 'de' ? 'de' : 'en';

    const requestBody = req.validated!.body as {
        language?: string;
        baseCvData?: any;
        baseCvId?: string;
        jobDescription?: string;
        customInstructions?: string;
        maxOutputTokens?: number;
    };

    const baseCvDataOverride = requestBody?.baseCvData;
    const baseCvId = requestBody?.baseCvId;
    const jobDescriptionOverride = requestBody?.jobDescription;
    const customInstructionsOverride = requestBody?.customInstructions;
    const maxOutputTokens = requestBody?.maxOutputTokens;

    const languageName = requestedLanguage === 'de' ? 'German' : 'English';
    const userId = user._id.toString();

    try {
        // 1. Fetch Job & User data
        const job = await JobApplication.findOne({ _id: jobId, userId: userId });
        if (!job) { res.status(404).json({ message: 'Job application not found or access denied.' }); return; }

        if (jobDescriptionOverride) {
            job.jobDescriptionText = jobDescriptionOverride;
            await job.save();
        }

        if (!job.jobDescriptionText) { res.status(400).json({ message: 'Job description text is missing.' }); return; }

        const currentUser = await User.findById(userId);
        if (!currentUser) { res.status(404).json({ message: "User not found." }); return; }

        // 2. Resolve base CV
        let baseCvJson: JsonResumeSchema | null = null;
        let usedBaseCvId: string | undefined = undefined;

        if (baseCvDataOverride && typeof baseCvDataOverride === 'object' && !Array.isArray(baseCvDataOverride)) {
            baseCvJson = baseCvDataOverride;
        } else if (baseCvId) {
            const specificCv = await CV.findOne({ _id: baseCvId, userId });
            if (specificCv && specificCv.cvJson) {
                baseCvJson = specificCv.cvJson;
                usedBaseCvId = specificCv._id.toString();
            } else {
                console.warn(`Specific Base CV (${baseCvId}) not found, falling back to Master CV.`);
            }
        }

        if (!baseCvJson) {
            const masterCv = await CV.findOne({ userId, isMasterCv: true });
            if (masterCv && masterCv.cvJson) {
                baseCvJson = masterCv.cvJson;
                usedBaseCvId = masterCv._id.toString();
            }
        }

        if (!baseCvJson) { res.status(400).json({ message: 'No base CV found in user profile or provided override.' }); return; }

        // DEBUG: Log the raw CV structure before normalization
        console.log('=== DEBUG: Raw base CV structure ===');
        console.log('CV ID:', usedBaseCvId);
        console.log('Top-level keys:', Object.keys(baseCvJson));
        console.log('basics:', baseCvJson.basics ? JSON.stringify(baseCvJson.basics).substring(0, 100) : 'MISSING');
        console.log('work:', Array.isArray(baseCvJson.work) ? `${baseCvJson.work.length} items` : 'MISSING or not array');
        console.log('education:', Array.isArray(baseCvJson.education) ? `${baseCvJson.education.length} items` : 'MISSING or not array');
        console.log('skills:', Array.isArray(baseCvJson.skills) ? `${baseCvJson.skills.length} items` : 'MISSING or not array');
        
        // Check for alternative field names
        const alternativeFields = ['experience', 'jobs', 'employment', 'schools', 'qualifications', 'competencies', 'personalInfo', 'contact'];
        const foundAlternatives = alternativeFields.filter(f => (baseCvJson as any)[f]);
        if (foundAlternatives.length > 0) {
            console.log('Alternative fields found:', foundAlternatives);
        }

        // STEP 1: Normalize section names (German → English, non-standard → canonical)
        baseCvJson = normalizeSectionNames(baseCvJson as Record<string, any>) as JsonResumeSchema;
        console.log('=== After section name normalization ===');
        console.log('Top-level keys:', Object.keys(baseCvJson));

        // STEP 2: Normalize field names within sections (company → subtitle, etc.)
        baseCvJson = normalizeCvFieldNames(baseCvJson as Record<string, any>) as JsonResumeSchema;
        console.log('=== After field name normalization ===');
        console.log('Top-level keys:', Object.keys(baseCvJson));

        // Validate that base CV has meaningful content
        const hasBasics = baseCvJson.basics && typeof baseCvJson.basics === 'object' && Object.keys(baseCvJson.basics).length > 0;
        const hasWork = Array.isArray(baseCvJson.work) && baseCvJson.work.length > 0;
        const hasEducation = Array.isArray(baseCvJson.education) && baseCvJson.education.length > 0;
        const hasSkills = Array.isArray(baseCvJson.skills) && baseCvJson.skills.length > 0;

        console.log('=== DEBUG: After normalization ===');
        console.log('Top-level keys:', Object.keys(baseCvJson));
        console.log('hasBasics:', hasBasics, 'hasWork:', hasWork, 'hasEducation:', hasEducation, 'hasSkills:', hasSkills);

        if (!hasBasics && !hasWork && !hasEducation && !hasSkills) {
            console.error('Base CV is empty or has no meaningful content. CV ID:', usedBaseCvId);
            console.error('All keys:', JSON.stringify(Object.keys(baseCvJson)));
            res.status(400).json({
                message: 'The base CV has no meaningful content. Please upload a properly formatted CV or use the CV editor to add your information first.'
            });
            return;
        }

        if (!hasBasics) {
            console.warn('Base CV has empty "basics" section. CV ID:', usedBaseCvId);
        }

        console.log(`Base CV validation - basics: ${hasBasics ? '✓' : '✗'}, work: ${baseCvJson.work?.length || 0}, education: ${baseCvJson.education?.length || 0}, skills: ${baseCvJson.skills?.length || 0}`);

        // 3. Fetch Custom Prompt (if any) or use override
        const profile = await Profile.findOne({ userId: userId });
        let customPrompt = customInstructionsOverride || profile?.customPrompts?.cvPrompt;

        // 4. Pick the schema (single unified schema works for both JSON Resume and freeform)
        const responseSchema = tailoringResponseJsonSchema;

        // 5. Build a concise, schema-aligned prompt
        let prompt: string;

        if (customPrompt) {
            // User-provided custom prompt — inject context variables
            prompt = customPrompt
                .replace('{{language}}', languageName)
                .replace('{{baseCv}}', JSON.stringify(baseCvJson, null, 2))
                .replace('{{jobDescription}}', job.jobDescriptionText);

            if (!customPrompt.includes('{{baseCv}}')) {
                prompt += `\n\n**Context Data:**\nBase CV: ${JSON.stringify(baseCvJson, null, 2)}\nJob Description: ${job.jobDescriptionText}\nTarget Language: ${languageName}`;
            }
        } else if (isJsonResumeLike(baseCvJson)) {
            prompt = buildJsonResumePrompt(baseCvJson, job.jobDescriptionText, languageName, requestedLanguage);
        } else {
            prompt = buildFreeformCvPrompt(baseCvJson, job.jobDescriptionText, languageName, requestedLanguage);
        }

        // 6. Generate — schema-enforced, no fallback parsing needed
        console.log(`Generating ${languageName} CV only for job ${jobId}...`);
        await JobApplication.updateOne({ _id: jobId, userId: userId }, { $set: { generationStatus: 'pending_generation' } });

        const tokenLimit = maxOutputTokens ?? 8192;

        const parsedResponse = await generateStructuredResponse<TailoringResponse>(userId, prompt, {
            maxTokens: tokenLimit,
            responseJsonSchema: responseSchema,
        });

        console.log(`Received CV generation response. tailoredCv keys: ${parsedResponse.tailoredCv ? Object.keys(parsedResponse.tailoredCv).slice(0, 10).join(', ') : 'MISSING'}. Changes count: ${parsedResponse.changes?.length || 0}`);

        const tailoredCvJson = parsedResponse.tailoredCv;
        const tailoringChanges = parsedResponse.changes;

        // If tailoredCv is empty, fall back to base CV (Gemini may have returned unchanged content)
        let finalCvJson = tailoredCvJson;
        if (!isNonEmptyObject(tailoredCvJson)) {
            console.warn('Gemini returned an empty or missing tailoredCv. Using base CV as fallback.');
            if (isNonEmptyObject(baseCvJson)) {
                finalCvJson = { ...baseCvJson };
            } else {
                console.error('Both tailored and base CV are empty. Raw response keys:', parsedResponse ? Object.keys(parsedResponse) : 'N/A');
                throw new Error('AI returned an empty CV. The base CV is also unavailable.');
            }
        }

        // Validate that the final CV has all major sections - copy missing ones from base CV
        const majorSections = ['basics', 'summary', 'work', 'education', 'skills', 'languages', 'certifications', 'projects'];
        const finalCvAny = finalCvJson as Record<string, any>;
        const baseCvAny = baseCvJson as Record<string, any>;
        
        for (const section of majorSections) {
            const hasInFinal = finalCvAny[section] && (
                (Array.isArray(finalCvAny[section]) && finalCvAny[section].length > 0) ||
                (typeof finalCvAny[section] === 'object' && !Array.isArray(finalCvAny[section]) && Object.keys(finalCvAny[section]).length > 0)
            );
            
            if (!hasInFinal && baseCvAny[section]) {
                const hasInBase = Array.isArray(baseCvAny[section]) 
                    ? baseCvAny[section].length > 0 
                    : (typeof baseCvAny[section] === 'object' && Object.keys(baseCvAny[section]).length > 0);
                
                if (hasInBase) {
                    console.log(`Copying ${section} from base CV (missing in AI response)`);
                    finalCvAny[section] = JSON.parse(JSON.stringify(baseCvAny[section]));
                }
            }
        }
        
        finalCvJson = finalCvAny as JsonResumeSchema;

        normalizeFreeformCvTags(finalCvJson);
        // Safety-net: canonicalize section names (in case AI used non-standard names)
        finalCvJson = normalizeSectionNames(finalCvJson as Record<string, any>) as JsonResumeSchema;
        // Safety-net: canonicalize field names in case Gemini ignored the prompt contract
        finalCvJson = normalizeCvFieldNames(finalCvJson as Record<string, any>) as JsonResumeSchema;

        // Debug: Log final CV structure
        console.log('=== Final CV structure before saving ===');
        console.log('Top-level keys:', Object.keys(finalCvJson));
        console.log('basics:', finalCvJson.basics ? JSON.stringify(finalCvJson.basics).substring(0, 100) : 'MISSING');
        console.log('work:', Array.isArray(finalCvJson.work) ? `${finalCvJson.work.length} items` : 'MISSING');
        console.log('education:', Array.isArray(finalCvJson.education) ? `${finalCvJson.education.length} items` : 'MISSING');
        console.log('skills:', Array.isArray(finalCvJson.skills) ? `${finalCvJson.skills.length} items` : 'MISSING');

        // 8. Save CV draft
        await JobApplication.findOneAndUpdate(
            { _id: jobId, userId: userId },
            { $set: { language: requestedLanguage, generationStatus: 'draft_ready' } },
            { new: true }
        );

        let jobCv = await CV.findOne({ jobApplicationId: jobId, userId: userId });
        if (jobCv) {
            jobCv.cvJson = finalCvJson;
            jobCv.tailoringChanges = tailoringChanges;
            await jobCv.save();
        } else {
            const jobInfo = await JobApplication.findById(jobId).select('jobTitle companyName');
            const displayName = jobInfo
                ? `Tailored CV - ${jobInfo.jobTitle} at ${jobInfo.companyName}`
                : 'Tailored CV';

            jobCv = await CV.create({
                userId,
                jobApplicationId: jobId,
                isMasterCv: false,
                isPrimary: false,
                displayName,
                cvJson: finalCvJson,
                tailoringChanges,
            });
        }

        // Non-fatally generate dynamic descriptor for the review tab (only for non-JSON-Resume CVs)
        if (!isJsonResumeLike(finalCvJson)) {
            try {
                const descriptorPayload = await generateDescriptorFromJson(finalCvJson, userId);
                await CV.findOneAndUpdate(
                    { jobApplicationId: jobId, userId },
                    { $set: { cvDescriptor: descriptorPayload.descriptor, cvData: descriptorPayload.data } },
                );
            } catch (descErr: any) {
                console.warn(`Descriptor generation failed (non-fatal): ${descErr.message}`);
            }
        }

        res.status(200).json({
            status: "draft_ready",
            message: `CV generated successfully in ${languageName}. Ready for review.`,
            jobId,
            changesCount: tailoringChanges.length,
        });

    } catch (error: any) {
        console.error(`Error generating CV for job ${jobId}:`, error);
        const currentUserId = (req.user as AuthenticatedUser)?._id?.toString();
        if (currentUserId) {
            await JobApplication.updateOne(
                { _id: jobId, userId: currentUserId, generationStatus: { $ne: 'draft_ready' } },
                { $set: { generationStatus: 'error' } }
            ).catch(err => console.error("Failed to update job status to error:", err));
        }
        res.status(500).json({ message: error.message || 'Failed to generate CV.' });
    }
};

// === ROUTE DEFINITIONS (Order Matters!) ===
router.post('/apply-ats-suggestion', usageLimiter('cvGeneration'), validateRequest({ body: applyAtsSuggestionBodySchema }), asyncHandler(applyAtsSuggestion)); // Apply ATS suggestion to CV
router.post('/improve-section', usageLimiter('cvGeneration'), validateRequest({ body: improveSectionBodySchema }), asyncHandler(improveCvSection)); // Improve CV section
router.post('/:jobId/render-pdf', validateRequest({ params: jobIdParamSchema }), renderFinalPdfsHandler); // Render both PDFs
router.post('/:jobId/render-cv-pdf', validateRequest({ params: jobIdParamSchema }), renderCvPdfHandler); // Render CV PDF only
router.post('/:jobId/render-cover-letter-pdf', validateRequest({ params: jobIdParamSchema }), renderCoverLetterPdfHandler); // Render Cover Letter PDF only
router.post('/:jobId/generate-cv', usageLimiter('cvGeneration'), validateRequest({ params: jobIdParamSchema, body: generateDocumentsBodySchema }), generateCvOnlyHandler); // Generate CV only
router.get('/download/:filename', validateRequest({ params: filenameParamSchema }), downloadFileHandler); // Download generated files

export default router;
