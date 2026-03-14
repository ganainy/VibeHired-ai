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

const router: Router = express.Router();
router.use(authMiddleware as RequestHandler); // Apply auth to all routes in this file

// --- Interfaces ---
interface GenerateDraftReadyResponse { status: "draft_ready"; message: string; jobId: string; }


// --- Helper Functions (combined CV+CL flow removed — see coverLetterService.ts) ---

// Define an interface for the expected user object structure
interface AuthenticatedUser {
    _id: mongoose.Types.ObjectId | string;
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

// --- NEW: Generate CV Only Endpoint ---
const generateCvOnlyHandler: RequestHandler = async (req: ValidatedRequest, res) => {
    const user = req.user as AuthenticatedUser;
    if (!user) { res.status(401).json({ message: 'User not authenticated correctly.' }); return; }

    const { jobId } = req.validated!.params!;
    const requestedLanguage = req.validated!.body?.language === 'de' ? 'de' : 'en';

    // Validate request body
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

        // Update job description if override provided
        if (jobDescriptionOverride) {
            job.jobDescriptionText = jobDescriptionOverride;
            await job.save();
        }

        if (!job.jobDescriptionText) { res.status(400).json({ message: 'Job description text is missing.' }); return; }

        const currentUser = await User.findById(userId);
        if (!currentUser) { res.status(404).json({ message: "User not found." }); return; }

        let baseCvJson: JsonResumeSchema | null = null;
        let usedBaseCvId: string | undefined = undefined;

        if (baseCvDataOverride && typeof baseCvDataOverride === 'object' && !Array.isArray(baseCvDataOverride)) {
            // Only use override if it looks like a CV
            console.log(`Using overridden Base CV data for job ${jobId}`);
            baseCvJson = baseCvDataOverride;
        } else if (baseCvId) {
            // Fetch specific Base CV by ID
            const specificCv = await CV.findOne({ _id: baseCvId, userId });
            if (specificCv && specificCv.cvJson) {
                baseCvJson = specificCv.cvJson;
                usedBaseCvId = specificCv._id.toString();
                console.log(`Using specific Base CV (${baseCvId}) for job ${jobId}`);
            } else {
                console.warn(`Specific Base CV (${baseCvId}) not found, falling back to Master CV.`);
            }
        }

        // Fallback to Master CV if no valid base found yet
        if (!baseCvJson) {
            const masterCv = await CV.findOne({ userId, isMasterCv: true });
            if (masterCv && masterCv.cvJson) {
                baseCvJson = masterCv.cvJson;
                usedBaseCvId = masterCv._id.toString();
                console.log("Using Master CV from Unified CV Model.");
            }
        }

        if (!baseCvJson) { res.status(400).json({ message: 'No base CV found in user profile or provided override.' }); return; }

        // Fetch Custom Prompt (if any) or use override
        const profile = await Profile.findOne({ userId: userId });
        let customPrompt = customInstructionsOverride || profile?.customPrompts?.cvPrompt;

        // 2. Construct CV-only Gemini Prompt
        let prompt: string;

        if (customPrompt) {
            // Use custom prompt but inject necessary context variables
            prompt = customPrompt
                .replace('{{language}}', languageName)
                .replace('{{baseCv}}', JSON.stringify(baseCvJson, null, 2))
                .replace('{{jobDescription}}', job.jobDescriptionText);

            // Fallback: If variables aren't used, append context at the end
            if (!customPrompt.includes('{{baseCv}}')) {
                prompt += `\n\n**Context Data:**\nBase CV Data: ${JSON.stringify(baseCvJson, null, 2)}\nJob Description: ${job.jobDescriptionText}\nTarget Language: ${languageName}`;
            }
        } else {
            // Default Prompt with Changes Tracking
            prompt = `
            You are an expert career advisor specialized in the ${languageName} job market.
            Your task is to tailor a provided base CV (in JSON Resume format) for a specific job application and document the changes you made.
            
            **Target Language:** ${languageName} (${requestedLanguage})

            **Inputs:**
            1.  **Base CV Data (JSON Resume Schema):**
                \`\`\`json
                ${JSON.stringify(baseCvJson, null, 2)}
                \`\`\`
            2.  **Target Job Description (Text):**
                ---
                ${job.jobDescriptionText}
                ---

            **Instructions:**
            *   Analyze the Base CV Data and the Target Job Description.
            *   Identify relevant skills, experiences, and qualifications from the Base CV that match the job requirements.
            *   **MANDATORY: INCLUDE ALL PROJECTS.** You MUST include EVERY single project from the Base CV's "projects" section in the output. Do NOT filter, select, summarize, or omit ANY projects. The user needs their FULL project history. If the Base CV has 20 projects, the customized CV MUST have 20 projects.
            *   **DO NOT CONDENSE TO ONE PAGE.** Ignore any internal bias for one-page resumes. If the content requires 2, 3, or more pages, that is acceptable. Completeness is more important than brevity.
            *   Rewrite/rephrase content (summaries, work descriptions, project details) to emphasize relevance IN ${languageName}, using keywords from the job description where appropriate.
            *   STRICT RULE - NO FABRICATION: You must ONLY use information that exists in the Base CV. Do NOT invent, add, or fabricate any skills, experiences, projects, certifications, or qualifications that are not explicitly present in the original CV data. If a skill from the job description is not in the CV, do NOT add it.
            *   Maintain factual integrity; do not invent skills or experiences. Every piece of information in the output must be traceable back to the Base CV.
            *   SIZE CONSTRAINT: The tailored CV MUST NOT be shorter than the Base CV. It should be detailed and comprehensive.
            *   Optimize the order of items within sections (e.g., work experience) to highlight the most relevant roles first, but keep the less relevant ones further down rather than deleting them.
            *   CRITICAL OUTPUT STRUCTURE: The output MUST be a complete JSON object strictly adhering to the JSON Resume Schema (https://jsonresume.org/schema/).
            *   Use standard JSON Resume keys like \`basics\`, \`work\`, \`volunteer\`, \`education\`, \`awards\`, \`certificates\`, \`publications\`, \`skills\`, \`languages\`, \`interests\`, \`references\`, \`projects\`.
            *   **IMPORTANT:** Ensure the \`basics.summary\` field is populated with a strong, tailored professional summary based on the candidate's profile and the job description. Do not leave this field empty.
            *   **IMPORTANT:** Do NOT mention the specific name of the company you are applying to anywhere in the generated CV (e.g. in the summary, objective, or descriptions). Focus on the role and skills, but keep the document company-agnostic.
            *   All textual content within the JSON object (names, summaries, descriptions, etc.) MUST be in ${languageName}.
            *   SECTION LABELS TRANSLATION: Include a \`meta.sectionLabels\` object in the tailoredCv JSON with translated section names in ${languageName}. For example, for German: {"summary": "Zusammenfassung", "work": "Berufserfahrung", "education": "Ausbildung", "skills": "Fähigkeiten & Technologien", "languages": "Sprachen", "projects": "Projekte", "certificates": "Zertifikate", "awards": "Auszeichnungen", "volunteer": "Ehrenamt", "interests": "Interessen", "references": "Referenzen"}.
            *   **IMPORTANT:** Also provide a list of changes you made. **The 'description' and 'reason' fields in this list MUST ALWAYS BE IN ENGLISH, regardless of the target language of the CV.**

            **Output Format:**
            Return ONLY a single JSON object enclosed in triple backticks (\`\`\`json ... \`\`\`). This JSON object MUST contain:
            1.  \`tailoredCv\`: The complete, tailored CV data as a valid JSON Resume Schema object (in ${languageName}).
            2.  \`changes\`: An array of change objects, each with:
                - \`section\`: The CV section that was modified (use English keys: "summary", "work", "skills", "education", "projects", etc.)
                - \`description\`: A brief description of what was changed (IN ENGLISH)
                - \`reason\`: Why this change was made, ideally referencing relevant job requirements (IN ENGLISH)

            Example output structure:
            \`\`\`json
            {
              "tailoredCv": {
                "basics": { ... },
                "work": [ ... ],
                "education": [ ... ],
                "skills": [ ... ]
              },
              "changes": [
                {
                  "section": "summary",
                  "description": "Rewrote professional summary to highlight cloud expertise",
                  "reason": "Job requires extensive AWS and cloud architecture experience"
                },
                {
                  "section": "work",
                  "description": "Added specific metrics to software engineer role",
                  "reason": "Job emphasizes measurable impact and data-driven results"
                },
                {
                  "section": "skills",
                  "description": "Reordered skills to prioritize Python and machine learning",
                  "reason": "These are listed as primary requirements in the job description"
                }
              ]
            }
            \`\`\`
        `;
        }

        // 3. Generate CV using AI service (structured mode → API-level JSON enforcement)
        console.log(`Generating ${languageName} CV only for job ${jobId}...`);
        await JobApplication.updateOne({ _id: jobId, userId: userId }, { $set: { generationStatus: 'pending_generation' } });

        // Use a minimum of 8192 output tokens so large CVs aren't truncated mid-JSON
        const tokenLimit = maxOutputTokens ?? 8192;

        let parsedResponse: any;
        try {
            parsedResponse = await generateStructuredResponse<any>(userId, prompt, { maxTokens: tokenLimit });
        } catch (structuredErr: any) {
            // Fallback: raw text generation + manual extraction (handles providers without JSON mode)
            console.warn('Structured response failed, falling back to raw generation:', structuredErr.message);
            const result = await generateContent(userId, prompt, { maxTokens: tokenLimit });
            const responseText = result.text;
            let jsonStringToParse = responseText.trim();
            const fencedMatch = jsonStringToParse.match(/```json\s*([\s\S]*?)```/);
            if (fencedMatch) {
                jsonStringToParse = fencedMatch[1].trim();
            } else {
                const plainFence = jsonStringToParse.match(/^```\s*([\s\S]*?)```\s*$/);
                if (plainFence) {
                    jsonStringToParse = plainFence[1].trim();
                } else {
                    const firstBrace = jsonStringToParse.indexOf('{');
                    const lastBrace = jsonStringToParse.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace > firstBrace) {
                        jsonStringToParse = jsonStringToParse.substring(firstBrace, lastBrace + 1);
                    }
                }
            }
            try {
                parsedResponse = JSON.parse(jsonStringToParse);
            } catch (parseError: any) {
                console.error('Failed to parse CV JSON:', parseError.message);
                console.error('Raw AI response (first 500 chars):', responseText.substring(0, 500));
                throw new Error('AI failed to return valid JSON for CV.');
            }
        }
        console.log('Received CV generation response from AI.');

        // 4. Handle both new format (with changes) and legacy format (direct CV)
        let tailoredCvJson;
        let tailoringChanges: Array<{ section: string; description: string; reason: string }> | null = null;

        if (parsedResponse.tailoredCv && typeof parsedResponse.tailoredCv === 'object') {
            // New format: { tailoredCv: {...}, changes: [...] }
            tailoredCvJson = parsedResponse.tailoredCv;
            tailoringChanges = Array.isArray(parsedResponse.changes) ? parsedResponse.changes : null;
            console.log(`Parsed new format response with ${tailoringChanges?.length || 0} changes.`);
        } else if (parsedResponse.basics) {
            // Legacy format: Direct CV JSON (for backwards compatibility with custom prompts)
            tailoredCvJson = parsedResponse;
            console.log("Parsed legacy format response (direct CV JSON, no changes).");
        } else {
            console.error("Parsed response is invalid:", parsedResponse);
            throw new Error("AI response missing expected structure.");
        }

        // 5. Validate CV structure
        if (!tailoredCvJson || typeof tailoredCvJson !== 'object' || !tailoredCvJson.basics) {
            console.error("Parsed CV JSON is invalid or missing basics:", tailoredCvJson);
            throw new Error("Parsed CV JSON is invalid or missing the 'basics' section.");
        }

        // 6. Save ONLY the CV draft (not cover letter)
        console.log(`Saving CV draft for job ${jobId}...`);

        await JobApplication.findOneAndUpdate(
            { _id: jobId, userId: userId },
            {
                $set: {
                    language: requestedLanguage,
                    generationStatus: 'draft_ready'
                }
            },
            { new: true }
        );

        // Save CV to Unified CV Model (including tailoringChanges)
        let jobCv = await CV.findOne({ jobApplicationId: jobId, userId: userId });
        if (jobCv) {
            jobCv.cvJson = tailoredCvJson;
            jobCv.tailoringChanges = tailoringChanges;
            await jobCv.save();
        } else {
            // Create new Job CV if missing
            // Get job info for display name
            const job = await JobApplication.findById(jobId).select('jobTitle companyName');
            const jobDisplayName = job
                ? `Tailored CV - ${job.jobTitle} at ${job.companyName}`
                : 'Tailored CV';

            await CV.create({
                userId: userId,
                jobApplicationId: jobId,
                isMasterCv: false,
                isPrimary: false,
                displayName: jobDisplayName,
                cvJson: tailoredCvJson,
                tailoringChanges: tailoringChanges,
            });
        }

        console.log(`CV draft saved successfully for job ${jobId}. Saved to unified CV model.`);

        // Non-fatally generate the dynamic descriptor so the /review/cv tab
        // can immediately render the dynamic editor after the CV is tailored.
        try {
            const descriptorPayload = await generateDescriptorFromJson(tailoredCvJson, userId);
            await CV.findOneAndUpdate(
                { jobApplicationId: jobId, userId: userId },
                { $set: { cvDescriptor: descriptorPayload.descriptor, cvData: descriptorPayload.data } },
            );
            console.log(`Dynamic descriptor saved for CV (job ${jobId}).`);
        } catch (descErr: any) {
            console.warn(`Descriptor generation failed (non-fatal): ${descErr.message}`);
        }

        res.status(200).json({
            status: "draft_ready",
            message: `CV generated successfully in ${languageName}. Ready for review.`,
            jobId: jobId,
            changesCount: tailoringChanges?.length || 0
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