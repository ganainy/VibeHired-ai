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
import CV, { ICV } from '../models/CV'; // Import Unified CV Model
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
import { detectCvFormat } from '../utils/cvFormatDetector';


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
            const masterCv = await CV.findOne({ userId, isDefault: true });
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
        console.log(`  → Template: ATS-optimized (career-ops)`);
        console.log(`  → Language: ${language}`);
        console.log(`  → Paper format: ${language === 'en' ? 'letter' : 'a4'}`);
        console.log(`  → Sections: Summary, Competencies, Experience, Projects, Education, Certifications, Skills`);
        console.log(`  → Fonts: Space Grotesk (headings) + DM Sans (body), self-hosted`);
        console.log(`  → ATS normalization: em-dashes, smart quotes, zero-width chars, non-breaking spaces`);
        const generatedCvFilename = await generateCvPdfFromJsonResume(
            cvJsonData,
            `${cvFilenamePrefix}_${language}`,
            { lang: language, pageFormat: language === 'en' ? 'letter' : 'a4' }
        );
        console.log(`  → CV PDF saved: ${generatedCvFilename}`);

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
            const masterCv = await CV.findOne({ userId, isDefault: true });
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

        const generatedCvFilename = await generateCvPdfFromJsonResume(cvJsonData, cvFilenamePrefix, { lang: language, pageFormat: language === 'en' ? 'letter' : 'a4' });

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
            const masterCv = await CV.findOne({ userId, isDefault: true });
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

// --- Generate CV Only Endpoint (multi-call pipeline) ---
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
        let baseCvDocument: (ICV & { _id: mongoose.Types.ObjectId }) | null = null;

        if (baseCvDataOverride && typeof baseCvDataOverride === 'object' && !Array.isArray(baseCvDataOverride)) {
            baseCvJson = baseCvDataOverride;
        } else if (baseCvId) {
            const specificCv = await CV.findOne({ _id: baseCvId, userId });
            if (specificCv && specificCv.cvJson) {
                baseCvJson = specificCv.cvJson;
                usedBaseCvId = specificCv._id.toString();
                baseCvDocument = specificCv;
            } else {
                console.warn(`Specific Base CV (${baseCvId}) not found, falling back to primary CV.`);
            }
        }

        if (!baseCvJson) {
            const primaryCv = await CV.findOne({ userId, isDefault: true });
            if (primaryCv && primaryCv.cvJson) {
                baseCvJson = primaryCv.cvJson;
                usedBaseCvId = primaryCv._id.toString();
                baseCvDocument = primaryCv;
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

        // Detect freeform BEFORE normalization.
        // Prefer the stored cvFormat flag set at upload time.
        // For legacy CVs (cvFormat === null), fall back to key-ratio detection.
        let isFreeformCv: boolean;
        if (baseCvDocument?.cvFormat === 'freeform') {
            isFreeformCv = true;
        } else if (baseCvDocument?.cvFormat === 'json-resume') {
            isFreeformCv = false;
        } else {
            // No stored format (legacy or override data) — detect from raw JSON
            isFreeformCv = detectCvFormat(baseCvJson as Record<string, any>) === 'freeform';
        }

        // STEP 1: Normalize section names ONLY for non-freeform CVs
        if (!isFreeformCv) {
            baseCvJson = normalizeSectionNames(baseCvJson as Record<string, any>) as JsonResumeSchema;
            console.log('=== After section name normalization ===');
            console.log('Top-level keys:', Object.keys(baseCvJson));
        } else {
            console.log('=== Skipping section name normalization for freeform CV ===');
        }

        // STEP 2: Normalize field names within sections (company → subtitle, etc.)
        baseCvJson = normalizeCvFieldNames(baseCvJson as Record<string, any>) as JsonResumeSchema;
        console.log('=== After field name normalization ===');
        console.log('Top-level keys:', Object.keys(baseCvJson));

        // Validate that base CV has meaningful content
        const hasBasics = baseCvJson.basics && typeof baseCvJson.basics === 'object' && Object.keys(baseCvJson.basics).length > 0;
        const hasWork = Array.isArray(baseCvJson.work) && baseCvJson.work.length > 0;
        const hasEducation = Array.isArray(baseCvJson.education) && baseCvJson.education.length > 0;
        const hasSkills = Array.isArray(baseCvJson.skills) && baseCvJson.skills.length > 0;
        // For freeform CVs, check for any non-empty, non-tag array/object section
        const hasFreeformContent = isFreeformCv && Object.entries(baseCvJson as Record<string, any>)
            .filter(([k]) => k !== '__vh_tags')
            .some(([, v]) => (Array.isArray(v) && v.length > 0) || (v && typeof v === 'object' && Object.keys(v).length > 0) || (typeof v === 'string' && v.trim().length > 0));

        console.log('=== DEBUG: After normalization ===');
        console.log('Top-level keys:', Object.keys(baseCvJson));
        console.log('isFreeformCv:', isFreeformCv, 'hasBasics:', hasBasics, 'hasWork:', hasWork, 'hasEducation:', hasEducation, 'hasSkills:', hasSkills, 'hasFreeformContent:', hasFreeformContent);

        if (!hasBasics && !hasWork && !hasEducation && !hasSkills && !hasFreeformContent) {
            console.error('Base CV is empty or has no meaningful content. CV ID:', usedBaseCvId);
            console.error('All keys:', JSON.stringify(Object.keys(baseCvJson)));
            res.status(400).json({
                message: 'The base CV has no meaningful content. Please upload a properly formatted CV or use the CV editor to add your information first.'
            });
            return;
        }

        if (!hasBasics && !isFreeformCv) {
            console.warn('Base CV has empty "basics" section. CV ID:', usedBaseCvId);
        }

        console.log(`Base CV validation - isFreeform: ${isFreeformCv}, basics: ${hasBasics ? '✓' : '✗'}, work: ${(baseCvJson.work as any)?.length || 0}, education: ${(baseCvJson.education as any)?.length || 0}, skills: ${(baseCvJson.skills as any)?.length || 0}`);

        // 3. Fetch Custom Prompt (if any) or use override
        const profile = await Profile.findOne({ userId: userId });
        let customPrompt = customInstructionsOverride || profile?.customPrompts?.cvPrompt;

        // 4. Generate — multi-call pipeline (career-ops style)
        const tokenLimit = maxOutputTokens ?? 16384;
        console.log(`Generating ${languageName} CV only for job ${jobId}...`);
        console.log(`  → Pipeline: 3 sequential AI calls (analysis → content → changes)`);
        console.log(`  → Max output tokens per call: ${tokenLimit}`);
        await JobApplication.updateOne({ _id: jobId, userId: userId }, { $set: { generationStatus: 'pending_generation' } });

        const { runTailoringPipeline } = await import('../services/cvTailoringService');
        const pipelineResult = await runTailoringPipeline(
            userId,
            baseCvJson,
            job.jobDescriptionText,
            languageName,
            isFreeformCv,
        );

        const tailoredCvJson = pipelineResult.tailoredCv;
        const tailoringChanges = pipelineResult.changes;
        const jdAnalysis = pipelineResult.jdAnalysis;
        const patch = pipelineResult.patch;

        // Reject if pipeline returned empty tailoredCv
        if (!isNonEmptyObject(tailoredCvJson)) {
            console.error('Pipeline returned an empty tailoredCv. Aborting.');
            throw new Error('AI failed to produce tailored CV content. Please try again.');
        }

let finalCvJson = tailoredCvJson;

        if (!isFreeformCv) {
            // For JSON Resume CVs: copy any missing standard sections from base CV
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
        } else {
            // For freeform CVs: verify all original top-level sections are present in the patch result
            const finalCvAny = finalCvJson as Record<string, any>;
            const baseCvAny = baseCvJson as Record<string, any>;
            const baseKeys = Object.keys(baseCvAny).filter(k => k !== '__vh_tags');

            for (const key of baseKeys) {
                if (!(key in finalCvAny)) {
                    console.log(`Freeform section "${key}" missing from tailored CV — restoring from base`);
                    finalCvAny[key] = JSON.parse(JSON.stringify(baseCvAny[key]));
                }
            }
            // Always preserve the original __vh_tags from base CV for freeform
            finalCvAny.__vh_tags = baseCvAny.__vh_tags;
            finalCvJson = finalCvAny as JsonResumeSchema;
        }

        // Safety-net normalizers: only run on JSON Resume CVs.
        // Freeform CVs must preserve their original section keys exactly
        // because __vh_tags paths are keyed to those exact names.
        if (!isFreeformCv) {
            finalCvJson = normalizeSectionNames(finalCvJson as Record<string, any>) as JsonResumeSchema;
            finalCvJson = normalizeCvFieldNames(finalCvJson as Record<string, any>) as JsonResumeSchema;
        }
        // Tag enrichment runs on all CVs
        normalizeFreeformCvTags(finalCvJson);

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
        const tailoringDetailsData = {
            extractedKeywords: jdAnalysis.extractedKeywords,
            summaryRewrite: '',
            reorderedExperience: [],
            selectedProjects: [],
            omittedProjects: [],
            competencyGrid: jdAnalysis.competencyGrid,
            keywordInjections: jdAnalysis.keywordInjections.map(i => ({ original: i.cvConcept, jdKeyword: i.jdKeyword, tailored: '' })),
        };

        // Extract summary from patch for logging
        const summaryKey = Object.keys(patch).find(k => /summary|profil/i.test(k));
        if (summaryKey && typeof patch[summaryKey] === 'string') {
            tailoringDetailsData.summaryRewrite = patch[summaryKey];
        }

        if (jobCv) {
            jobCv.cvJson = finalCvJson;
            jobCv.cvFormat = isFreeformCv ? 'freeform' : 'json-resume';
            jobCv.tailoringChanges = tailoringChanges;
            jobCv.tailoringDetails = tailoringDetailsData;
            await jobCv.save();
        } else {
            const jobInfo = await JobApplication.findById(jobId).select('jobTitle companyName');
            const displayName = jobInfo
                ? `Tailored CV - ${jobInfo.jobTitle} at ${jobInfo.companyName}`
                : 'Tailored CV';

            jobCv = await CV.create({
                userId,
                jobApplicationId: jobId,
                isDefault: false,
                displayName,
                cvJson: finalCvJson,
                cvFormat: isFreeformCv ? 'freeform' : 'json-resume',
                tailoringChanges,
                tailoringDetails: tailoringDetailsData,
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
            tailoringSummary: {
                keywordsCount: jdAnalysis.extractedKeywords?.length || 0,
                competencyCount: jdAnalysis.competencyGrid?.length || 0,
                patchedSectionsCount: Object.keys(patch).length,
                keywordInjectionsCount: jdAnalysis.keywordInjections?.length || 0,
            },
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
