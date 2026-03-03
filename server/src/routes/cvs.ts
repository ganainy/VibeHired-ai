// server/src/routes/cvs.ts
/**
 * Unified CV Routes
 * 
 * Handles all CV operations using the unified CV model.
 * Replaces the old cv.ts routes that stored the master CV in the User model.
 */
import express, { Router, Request, Response, RequestHandler } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import authMiddleware from '../middleware/authMiddleware';
import { usageLimiter } from '../middleware/usageLimiter';
import CV, { ICV } from '../models/CV';
import User from '../models/User';
import JobApplication from '../models/JobApplication';
import { generateContentWithFile } from '../utils/aiService';
import { generateDescriptorFromJson, improveDynamicSectionWithAi } from '../services/generatorService';
import { GoogleGenerativeAIError } from '@google/generative-ai';
import { NotFoundError, ValidationError } from '../utils/errors/AppError';
import { JsonResumeSchema } from '../types/jsonresume';
import { generateCvPdfBuffer } from '../utils/pdfGenerator';
import { CVTemplate } from '../utils/cvTemplates';
import { asyncHandler } from '../utils/asyncHandler';
import fs from 'fs';
import path from 'path';

const router: Router = express.Router();

// Configure Multer for in-memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/rtf', 'text/rtf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
            'text/plain'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed types: PDF, RTF, DOCX, TXT.'));
        }
    }
});

// Apply auth middleware to all routes
router.use(authMiddleware as RequestHandler);

/**
 * Helper: Parse AI response to JSON Resume schema
 */
function parseJsonResponseToSchema(responseText: string): JsonResumeSchema | null {
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const jsonMatch = responseText.match(jsonRegex);

    if (jsonMatch && jsonMatch[1]) {
        const extractedJsonString = jsonMatch[1].trim();
        try {
            console.log('--- EXTRACTED JSON STRING ---');
            console.log(extractedJsonString);
            const parsedObject = JSON.parse(extractedJsonString);
            if (typeof parsedObject === 'object' && parsedObject !== null) {
                return parsedObject as JsonResumeSchema;
            }
            throw new Error('AI response was not a valid object structure.');
        } catch (parseError: any) {
            console.error('JSON.parse failed:', parseError.message);
            throw new Error('AI response was not valid JSON.');
        }
    }
    throw new Error('AI failed to return CV data in expected format.');
}

/**
 * Helper: Parse uploaded CV file using AI
 */
async function parseUploadedCv(reqFile: Express.Multer.File, userId: string): Promise<JsonResumeSchema> {
    // Save file temporarily for AI processing
    const tempDir = path.join(process.cwd(), 'temp_uploads');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFilePath = path.join(tempDir, `cv_${Date.now()}_${reqFile.originalname}`);
    fs.writeFileSync(tempFilePath, reqFile.buffer);

    try {
        const prompt = `
You are a CV data extraction tool. Your ONLY job is to read the attached CV file (${reqFile.originalname}) and faithfully transcribe its content into a JSON Resume Schema object.

=== PRIME DIRECTIVE — READ THIS FIRST ===
COPY EVERYTHING VERBATIM. Every piece of text you write into the JSON must be copied WORD-FOR-WORD from the CV.
- DO NOT paraphrase, reword, improve, or summarize any text.
- DO NOT add any content that is not explicitly written in the CV (no inferred skills, no guessed URLs, no assumed categories).
- DO NOT delete or omit any information that appears in the CV.
- DO NOT reorganize, reorder, or restructure content differently from how it appears in the CV.
- Your role is a TRANSCRIBER, not an editor or writer.

=== SCHEMA MAPPING — HOW TO PLACE CONTENT INTO FIELDS ===

**basics.name**
- The candidate's full name, copied exactly as it appears (including any spacing/capitalisation as written).
- If the PDF has run "JohnDoe" together due to rendering, insert a space at the obvious word boundary — but do NOT change the spelling.

**basics.label / basics.email / basics.phone / basics.url**
- Copy exactly as written in the CV.

**basics.summary**
- Copy the full text of the professional summary / profile section verbatim.
- Exclude only the section heading (e.g. "Professional Summary", "Berufsprofil") — that is a label, not content.

**basics.location**
- Copy address text as written. Map: city → "city", region/state → "region", country → "countryCode".
- If the country is written as a full name (e.g. "Germany") write it as-is into "countryCode"; do NOT silently convert to an ISO code.

**work[]**
- "name" = employer name, copied verbatim.
- "position" = job title, copied verbatim.
- "startDate" / "endDate" = dates as written in the CV (YYYY-MM or YYYY format preferred; if the CV writes "Jan 2020" convert to "2020-01"; if it writes just "2020" use "2020"). Use "Present" for current roles.
- "summary" = any introductory description of the role, copied verbatim.
- "highlights" = each bullet point copied verbatim as its own array element. Do NOT merge or split bullets.

**education[]**
- "studyType" = degree type copied verbatim (e.g. "Bachelor of Science", "Ausbildung").
- "area" = field of study copied verbatim.
- "institution" = institution name copied verbatim.
- "startDate" / "endDate" = as written. "score" = GPA/grade as written.
- "courses" = list of courses copied verbatim if present.

**skills[]**
- Use EXACTLY the skill groupings/categories as they appear in the CV. Do NOT invent new category names or collapse/merge categories.
- Each element: { "name": "<category name from CV>", "keywords": ["<skill1>", "<skill2>", ...] }
- Copy each skill/keyword verbatim from the CV. Do NOT split sentences into individual words; do NOT merge individual items into a paragraph.
- If the CV has no categories and just lists skills, use a single entry with "name" copied from the CV's section heading and "keywords" as the individual items.

**projects[]**
- Only include entries that are explicitly labelled as projects in the CV.
- "name" = project name verbatim. "description" = description verbatim. "highlights" = bullet points verbatim. "url" = URL exactly as written (only if explicitly present in the CV).

**languages[]**
- Each entry: { "language": "<language name>", "fluency": "<proficiency level>" }
- Copy language names and proficiency levels verbatim from the CV.
- If the CV writes "Deutsch C1" as one string, split into language = "Deutsch", fluency = "C1".

**certificates[] / awards[] / publications[] / volunteer[] / interests[] / references[]**
- Include any such sections that appear in the CV, copying all text verbatim into the appropriate schema fields.

**basics.profiles**
- Only include profiles/links that are explicitly written in the CV (e.g. "linkedin.com/in/username", "github.com/handle").
- DO NOT construct or guess any URL. If a social icon appears with no URL or handle, omit it.
- Copy the URL exactly as written. Map to "network": "LinkedIn" / "GitHub" / "Portfolio" / etc.

=== STRICT RULES ===
- Parse the ENTIRE document. Do not skip any section.
- Omit a field only if the information is genuinely absent from the CV — never set a field to null or "" for missing data, just omit the key.
- If an entire section is absent, omit that top-level key entirely.
- NEVER add section headings as field values (e.g. do not put "Work Experience" as a field value).
- DO NOT include any JavaScript/JSON comments (// or /* */).

=== OUTPUT FORMAT ===
Return ONLY a single valid JSON object enclosed in triple backticks (\`\`\`json ... \`\`\`).
No text, explanation, or commentary before or after the JSON block.
  `;

        console.log('Sending CV parsing request to AI...');
        const result = await generateContentWithFile(
            String(userId),
            prompt,
            tempFilePath,
            reqFile.mimetype
        );
        const responseText = result.text;
        console.log('Received CV parsing response from AI.');
        console.log('--- AI RAW RESPONSE ---');
        console.log(responseText);

        const cvJsonResume = parseJsonResponseToSchema(responseText);

        if (!cvJsonResume) {
            console.error('Failed to parse AI response into valid JSON Resume structure.');
            throw new Error('Failed to parse AI response into valid JSON Resume structure.');
        }

        console.log('--- PARSED CV JSON ---');
        console.log(JSON.stringify(cvJsonResume, null, 2));
        console.log('--- END OF CV LOGS ---');

        return cvJsonResume;
    } finally {
        // Clean up temp file
        try {
            fs.unlinkSync(tempFilePath);
        } catch (err) {
            console.error('Error deleting temp file:', err);
        }
    }
}

/**
 * GET /api/cvs/branches
 * Get all CV branches for the current user
 */
router.get('/branches', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id as string;

    const branches = await CV.getBaseCvs(userId);

    res.json({
        branches: branches.map(cv => ({
            _id: cv._id,
            isPrimary: cv.isPrimary,
            isMasterCv: cv.isPrimary, // For backward compatibility
            category: cv.category,
            displayName: cv.displayName,
            jobApplicationId: cv.jobApplicationId,
            cvJson: cv.cvJson,
            cvDescriptor: cv.cvDescriptor ?? null,
            cvData: cv.cvData ?? null,
            templateId: cv.templateId,
            filename: cv.filename,
            analysisCache: cv.analysisCache,
            createdAt: cv.createdAt,
            updatedAt: cv.updatedAt,
        }))
    });
}));

/**
 * GET /api/cvs/master
 * Get the most recently created base CV for the current user
 */
router.get('/master', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id as string;

    // Return most recently created base CV (no job association)
    const baseCv = await CV.findOne({ userId, jobApplicationId: null }).sort({ createdAt: -1 });

    if (!baseCv) {
        res.json({
            cv: null,
            message: 'No base CV found'
        });
        return;
    }

    // Get user's default template if CV doesn't have one
    const user = await User.findById(userId).select('selectedTemplate');
    const effectiveTemplate = baseCv.templateId || user?.selectedTemplate || 'modern-clean';

    res.json({
        cv: {
            _id: baseCv._id,
            isPrimary: baseCv.isPrimary,
            isMasterCv: true, // Keep for backward compatibility
            cvJson: baseCv.cvJson,
            cvDescriptor: baseCv.cvDescriptor ?? null,
            cvData: baseCv.cvData ?? null,
            templateId: effectiveTemplate,
            filename: baseCv.filename,
            analysisCache: baseCv.analysisCache,
            createdAt: baseCv.createdAt,
            updatedAt: baseCv.updatedAt,
        }
    });
}));

/**
 * POST /api/cvs/create-branch
 * Create a new CV branch
 */
router.post('/create-branch', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id as string;
    const { sourceCvId, category, displayName } = req.body;

    if (!mongoose.Types.ObjectId.isValid(sourceCvId)) {
        throw new ValidationError('Invalid source CV ID');
    }

    if (!category || typeof category !== 'string' || category.trim().length === 0) {
        throw new ValidationError('Category is required');
    }

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
        throw new ValidationError('Display name is required');
    }

    // Verify source CV exists and belongs to user
    const sourceCv = await CV.findOne({ _id: sourceCvId, userId });
    if (!sourceCv) {
        throw new NotFoundError('Source CV not found');
    }

    // Create new branch (deep-copy descriptor + data as well)
    const newBranch = await CV.create({
        userId,
        isPrimary: false,
        category,
        displayName,
        cvJson: JSON.parse(JSON.stringify(sourceCv.cvJson)), // Deep copy
        cvDescriptor: sourceCv.cvDescriptor ? JSON.parse(JSON.stringify(sourceCv.cvDescriptor)) : null,
        cvData: sourceCv.cvData ? JSON.parse(JSON.stringify(sourceCv.cvData)) : null,
        templateId: sourceCv.templateId,
    });

    res.status(201).json({
        message: 'CV branch created successfully.',
        branch: {
            _id: newBranch._id,
            isPrimary: newBranch.isPrimary,
            category: newBranch.category,
            displayName: newBranch.displayName,
            cvJson: newBranch.cvJson,
            cvDescriptor: newBranch.cvDescriptor ?? null,
            cvData: newBranch.cvData ?? null,
            templateId: newBranch.templateId,
            createdAt: newBranch.createdAt,
            updatedAt: newBranch.updatedAt,
        }
    });
}));

/**
 * PATCH /api/cvs/:id/set-primary
 * Set a CV as primary
 */
router.patch('/:id/set-primary', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id as string;
    const cvId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(cvId)) {
        throw new ValidationError('Invalid CV ID');
    }

    const result = await CV.setAsPrimary(cvId, userId);

    res.json({
        message: 'CV set as primary successfully.',
        branch: {
            _id: result._id,
            isPrimary: result.isPrimary,
            category: result.category,
            displayName: result.displayName,
            updatedAt: result.updatedAt,
        }
    });
}));

/**
 * GET /api/cvs/:id
 * Get a specific CV by ID
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const cvId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(cvId)) {
        throw new ValidationError('Invalid CV ID');
    }

    const cv = await CV.findOne({ _id: cvId, userId })
        .populate('jobApplication', 'jobTitle companyName status jobUrl');

    if (!cv) {
        throw new NotFoundError('CV not found');
    }

    // Get user's default template if CV doesn't have one
    const user = await User.findById(userId).select('selectedTemplate');
    const effectiveTemplate = cv.templateId || user?.selectedTemplate || 'modern-clean';

    res.json({
        cv: {
            _id: cv._id,
            isMasterCv: cv.isMasterCv,
            jobApplicationId: cv.jobApplicationId,
            jobApplication: (cv as any).jobApplication || null,
            cvJson: cv.cvJson,
            cvDescriptor: cv.cvDescriptor ?? null,
            cvData: cv.cvData ?? null,
            templateId: effectiveTemplate,
            filename: cv.filename,
            analysisCache: cv.analysisCache,
            createdAt: cv.createdAt,
            updatedAt: cv.updatedAt,
        }
    });
}));

/**
 * DELETE /api/cvs/job/:jobId
 * Remove the CV attached to a specific job (deletes by jobApplicationId, not by CV _id).
 * More robust than deleting by _id when the client state may be stale.
 */
router.delete('/job/:jobId', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const { jobId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
        throw new ValidationError('Invalid job ID');
    }

    // Verify job belongs to user
    const job = await JobApplication.findOne({ _id: jobId, userId });
    if (!job) throw new NotFoundError('Job application not found.');

    const result = await CV.deleteOne({ jobApplicationId: jobId, userId });

    if (result.deletedCount === 0) {
        // Already gone — treat as success
        return res.json({ message: 'No CV was attached to this job.', deletedCount: 0 });
    }

    console.log(`Job CV detached for job ${jobId} by user ${req.user!.email}`);
    return res.json({ message: 'Job CV removed successfully.', deletedCount: result.deletedCount });
}));

/**
 * GET /api/cvs/job/:jobId
 * Get the CV for a specific job application
 */
router.get('/job/:jobId', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const jobId = req.params.jobId;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
        throw new ValidationError('Invalid job ID');
    }

    // Verify job belongs to user
    const job = await JobApplication.findOne({ _id: jobId, userId });
    if (!job) {
        throw new NotFoundError('Job application not found');
    }

    const cv = await CV.getJobCv(jobId);

    if (!cv) {
        res.json({
            cv: null,
            message: 'No CV found for this job'
        });
        return;
    }

    // Get user's default template if CV doesn't have one
    const user = await User.findById(userId).select('selectedTemplate');
    const effectiveTemplate = cv.templateId || user?.selectedTemplate || 'modern-clean';

    res.json({
        cv: {
            _id: cv._id,
            isMasterCv: cv.isMasterCv,
            jobApplicationId: cv.jobApplicationId,
            cvJson: cv.cvJson,
            cvDescriptor: cv.cvDescriptor ?? null,
            cvData: cv.cvData ?? null,
            templateId: effectiveTemplate,
            filename: cv.filename,
            tailoringChanges: cv.tailoringChanges || null,
            createdAt: cv.createdAt,
            updatedAt: cv.updatedAt,
        }
    });
}));

/**
 * POST /api/cvs/upload
 * Upload and parse a new CV file (creates/replaces the primary CV)
 */
router.post(
    '/upload',
    usageLimiter('cvParsing'),
    upload.single('cvFile'),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user!._id;

        if (!req.file) {
            throw new ValidationError('No CV file uploaded.');
        }

        // Guard: PDF/file parsing requires Gemini — other providers don't support file input
        // (Simplified since Gemini is the only provider now)

        console.log(`Processing CV file: ${req.file.originalname}, MIME Type: ${req.file.mimetype}`);

        const cvJsonResume = await parseUploadedCv(req.file, String(userId));

        // Generate AI-driven descriptor + structured data in one additional call.
        // Errors here are non-fatal: the CV is still created with the legacy cvJson.
        let cvDescriptor = null;
        let cvData = null;
        try {
            const payload = await generateDescriptorFromJson(cvJsonResume as Record<string, any>, String(userId));
            cvDescriptor = payload.descriptor;
            cvData = payload.data;
        } catch (descErr: any) {
            console.warn('Descriptor generation failed (non-fatal):', descErr.message);
        }

        const newCv = await CV.create({
            userId,
            isPrimary: false,
            category: 'General',
            displayName: req.file.originalname.replace(/\.[^.]+$/, '') || 'Uploaded CV',
            cvJson: cvJsonResume,
            cvDescriptor,
            cvData,
            filename: req.file.originalname,
            // Store the original binary so job copies are fully isolated
            originalPdf: req.file.buffer,
            templateId: null, // Will inherit from user settings
        });

        console.log(`Primary CV created for user ${req.user!.email}`);

        res.status(200).json({
            message: 'CV uploaded and parsed successfully.',
            cv: {
                _id: newCv._id,
                isPrimary: false,
                category: newCv.category,
                displayName: newCv.displayName,
                cvJson: cvJsonResume,
                cvDescriptor: newCv.cvDescriptor ?? null,
                cvData: newCv.cvData ?? null,
                filename: newCv.filename,
                createdAt: newCv.createdAt,
                updatedAt: newCv.updatedAt,
            }
        });
    })
);

/**
 * POST /api/cvs/job/:jobId
 * Create a job-specific CV (copies from the primary CV if no body provided)
 */
router.post('/job/:jobId', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const jobId = req.params.jobId;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
        throw new ValidationError('Invalid job ID');
    }

    // Verify job belongs to user
    const job = await JobApplication.findOne({ _id: jobId, userId });
    if (!job) {
        throw new NotFoundError('Job application not found');
    }

    // Check if CV already exists for this job
    const existingCv = await CV.getJobCv(jobId);
    if (existingCv) {
        throw new ValidationError('CV already exists for this job. Use PUT to update.');
    }

    // Get CV data from body or copy from primary CV
    let cvJson: JsonResumeSchema;
    if (req.body.cvJson) {
        cvJson = req.body.cvJson;
    } else {
        // Copy from primary CV
        const primaryCv = await CV.getPrimaryCv(userId as string);
        if (!primaryCv) {
            throw new ValidationError('No primary CV found. Please upload a CV first.');
        }
        cvJson = JSON.parse(JSON.stringify(primaryCv.cvJson)); // Deep copy
    }

    const newCv = await CV.create({
        userId,
        isMasterCv: false,
        isPrimary: false,
        displayName: `Job CV - ${job.jobTitle} at ${job.companyName}`,
        jobApplicationId: new mongoose.Types.ObjectId(jobId),
        cvJson,
        templateId: req.body.templateId || null,
    });

    res.status(201).json({
        message: 'Job CV created successfully.',
        cv: {
            _id: newCv._id,
            isMasterCv: false,
            jobApplicationId: newCv.jobApplicationId,
            cvJson: newCv.cvJson,
            templateId: newCv.templateId,
            createdAt: newCv.createdAt,
            updatedAt: newCv.updatedAt,
        }
    });
}));

/**
 * POST /api/cvs/upload-branch
 * Upload and parse a new CV file as a branch (non-primary CV)
 */
router.post(
    '/upload-branch',
    usageLimiter('cvParsing'),
    upload.single('cvFile'),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user!._id;
        const { category, displayName } = req.body;

        if (!req.file) {
            throw new ValidationError('No CV file uploaded.');
        }

        if (!category || !displayName) {
            throw new ValidationError('Category and display name are required.');
        }

        // Guard: PDF/file parsing requires Gemini — other providers don't support file input
        // (Simplified since Gemini is the only provider now)

        console.log(`Processing branch CV file: ${req.file.originalname}, MIME Type: ${req.file.mimetype}`);

        const cvJsonResume = await parseUploadedCv(req.file, String(userId));

        let branchCvDescriptor = null;
        let branchCvData = null;
        try {
            const payload = await generateDescriptorFromJson(cvJsonResume as Record<string, any>, String(userId));
            branchCvDescriptor = payload.descriptor;
            branchCvData = payload.data;
        } catch (descErr: any) {
            console.warn('Descriptor generation failed for branch (non-fatal):', descErr.message);
        }

        const newCv = await CV.create({
            userId,
            isPrimary: false,
            category: category.trim(),
            displayName: displayName.trim(),
            cvJson: cvJsonResume,
            cvDescriptor: branchCvDescriptor,
            cvData: branchCvData,
            filename: req.file.originalname,
            // Store original binary for isolation
            originalPdf: req.file.buffer,
            templateId: null, // Will inherit from user settings
        });

        console.log(`Branch CV created for user ${req.user!.email}`);

        res.status(201).json({
            message: 'CV branch uploaded and parsed successfully.',
            branch: {
                _id: newCv._id,
                isPrimary: false,
                category: newCv.category,
                displayName: newCv.displayName,
                cvJson: cvJsonResume,
                cvDescriptor: newCv.cvDescriptor ?? null,
                cvData: newCv.cvData ?? null,
                filename: newCv.filename,
                createdAt: newCv.createdAt,
                updatedAt: newCv.updatedAt,
            }
        });
    })
);

/**
 * POST /api/cvs/job/:jobId/from-base
 * Attach a base CV to a job as a fully independent copy.
 * If a job CV already exists, it is replaced.
 * Selecting from the base CV list copies both JSON and the original binary.
 */
router.post('/job/:jobId/from-base', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const { jobId } = req.params;
    const { baseCvId, templateId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
        throw new ValidationError('Invalid job ID');
    }

    const job = await JobApplication.findOne({ _id: jobId, userId });
    if (!job) throw new NotFoundError('Job application not found');

    // Determine source CV: explicit baseCvId or the user\'s primary CV
    let sourceId = baseCvId;
    if (!sourceId || !mongoose.Types.ObjectId.isValid(sourceId)) {
        const primary = await CV.getPrimaryCv(userId as string);
        if (!primary) throw new ValidationError('No primary CV found. Please upload a CV first.');
        sourceId = String(primary._id);
    }

    // Load source CV including original binary (select: false field)
    const sourceCv = await CV.findOne({ _id: sourceId, userId }).select('+originalPdf');
    if (!sourceCv) throw new NotFoundError('Source CV not found.');

    // Remove existing job CV if present
    await CV.deleteOne({ jobApplicationId: jobId });

    // Create fully independent copy
    const jobCv = await CV.create({
        userId,
        isMasterCv: false,
        isPrimary: false,
        displayName: `Job CV – ${job.jobTitle} at ${job.companyName}`,
        jobApplicationId: new mongoose.Types.ObjectId(jobId),
        cvJson: JSON.parse(JSON.stringify(sourceCv.cvJson)), // deep-copy JSON
        cvDescriptor: sourceCv.cvDescriptor ? JSON.parse(JSON.stringify(sourceCv.cvDescriptor)) : null,
        cvData: sourceCv.cvData ? JSON.parse(JSON.stringify(sourceCv.cvData)) : null,
        // Deep-copy binary so job CV is independent of the source file
        originalPdf: sourceCv.originalPdf ? Buffer.from(sourceCv.originalPdf) : null,
        filename: sourceCv.filename,
        templateId: templateId || sourceCv.templateId || null,
    });

    // Update baseCvId reference on the job
    await JobApplication.updateOne({ _id: jobId }, { $set: { baseCvId: sourceId } });

    res.status(201).json({
        message: 'Base CV copied to job as independent document.',
        cv: {
            _id: jobCv._id,
            jobApplicationId: jobCv.jobApplicationId,
            displayName: jobCv.displayName,
            cvJson: jobCv.cvJson,
            filename: jobCv.filename,
            templateId: jobCv.templateId,
            createdAt: jobCv.createdAt,
        },
    });
}));

/**
 * POST /api/cvs/job/:jobId/upload
 * Attach a PDF/DOCX CV file to a specific job as-is (no AI parsing).
 * The raw binary is stored so the original file is always downloadable.
 */
router.post(
    '/job/:jobId/upload',
    upload.single('cvFile'),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user!._id;
        const { jobId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(jobId)) {
            throw new ValidationError('Invalid job ID');
        }

        if (!req.file) throw new ValidationError('No CV file uploaded.');

        const job = await JobApplication.findOne({ _id: jobId, userId });
        if (!job) throw new NotFoundError('Job application not found.');

        // Replace existing job CV if present
        await CV.deleteOne({ jobApplicationId: jobId });

        // Store raw file only — no AI parsing
        const jobCv = await CV.create({
            userId,
            isMasterCv: false,
            isPrimary: false,
            displayName: `Job CV – ${job.jobTitle} at ${job.companyName}`,
            jobApplicationId: new mongoose.Types.ObjectId(jobId),
            cvJson: null,
            cvDescriptor: null,
            cvData: null,
            filename: req.file.originalname,
            originalPdf: req.file.buffer,
            templateId: req.body.templateId || null,
        });

        res.status(201).json({
            message: 'CV file attached to job.',
            cv: {
                _id: jobCv._id,
                jobApplicationId: jobCv.jobApplicationId,
                displayName: jobCv.displayName,
                cvJson: null,
                filename: jobCv.filename,
                createdAt: jobCv.createdAt,
            },
        });
    })
);

/**
 * PUT /api/cvs/:id
 * Update a CV by ID
 */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const cvId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(cvId)) {
        throw new ValidationError('Invalid CV ID');
    }

    const cv = await CV.findOne({ _id: cvId, userId });
    if (!cv) {
        throw new NotFoundError('CV not found');
    }

    const { cvJson, cvDescriptor, cvData, templateId } = req.body;

    if (cvJson) {
        if (typeof cvJson !== 'object' || Array.isArray(cvJson)) {
            throw new ValidationError('CV data must be a valid object.');
        }
        if (!cvJson.basics) {
            console.warn(`CV ${cvId} saved without a basics section — allowing save.`);
        }
        cv.cvJson = cvJson;
        cv.analysisCache = null; // Invalidate cache when CV changes
    }

    // Persist dynamic descriptor + data when provided
    if (cvDescriptor !== undefined) {
        cv.cvDescriptor = Array.isArray(cvDescriptor) ? cvDescriptor : null;
    }
    if (cvData !== undefined) {
        cv.cvData = cvData && typeof cvData === 'object' && !Array.isArray(cvData) ? cvData : null;
    }

    if (templateId !== undefined) {
        cv.templateId = templateId;
    }

    await cv.save();

    console.log(`CV ${cvId} updated for user ${req.user!.email}`);

    res.json({
        message: 'CV updated successfully.',
        cv: {
            _id: cv._id,
            isMasterCv: cv.isMasterCv,
            jobApplicationId: cv.jobApplicationId,
            cvJson: cv.cvJson,
            cvDescriptor: cv.cvDescriptor ?? null,
            cvData: cv.cvData ?? null,
            templateId: cv.templateId,
            updatedAt: cv.updatedAt,
        }
    });
}));

/**
 * DELETE /api/cvs/:id
 * Delete a CV by ID
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const cvId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(cvId)) {
        throw new ValidationError('Invalid CV ID');
    }

    const cv = await CV.findOne({ _id: cvId, userId });
    if (!cv) {
        throw new NotFoundError('CV not found');
    }

    await CV.deleteOne({ _id: cvId });

    console.log(`CV ${cvId} deleted for user ${req.user!.email}`);

    res.json({
        message: cv.isMasterCv ? 'Master CV deleted successfully.' : 'Job CV deleted successfully.',
        deletedCvId: cvId,
    });
}));

/**
 * POST /api/cvs/:id/promote
 * Promote a job CV to become the primary CV
 */
router.post('/:id/promote', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id as string;
    const cvId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(cvId)) {
        throw new ValidationError('Invalid CV ID');
    }

    const promotedCv = await CV.promoteToMaster(cvId, userId);

    console.log(`CV ${cvId} promoted to primary for user ${req.user!.email}`);

    res.json({
        message: 'CV promoted to primary successfully.',
        cv: {
            _id: promotedCv._id,
            isMasterCv: true,
            cvJson: promotedCv.cvJson,
            templateId: promotedCv.templateId,
            updatedAt: promotedCv.updatedAt,
        }
    });
}));

/**
 * POST /api/cvs/:id/preview
 * Generate PDF preview for a CV
 */
router.post('/:id/preview', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const cvId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(cvId)) {
        throw new ValidationError('Invalid CV ID');
    }

    const cv = await CV.findOne({ _id: cvId, userId });
    if (!cv) {
        throw new NotFoundError('CV not found');
    }

    const { template } = req.body;
    const templateId = template || cv.templateId || 'modern-clean';

    if (!cv.cvJson) {
        return res.status(400).json({ message: 'This CV has no JSON data to generate a PDF preview from.' });
    }

    try {
        const pdfBuffer = await generateCvPdfBuffer(cv.cvJson, templateId as CVTemplate);
        const pdfBase64 = pdfBuffer.toString('base64');

        res.json({
            message: 'PDF preview generated successfully.',
            pdfBase64,
            templateId,
        });
    } catch (error: any) {
        if (error instanceof GoogleGenerativeAIError) {
            throw new ValidationError('Failed to generate PDF: AI service error');
        }
        console.error('PDF generation error:', error);
        throw new ValidationError('Failed to generate PDF preview. Please try again.');
    }
}));

/**
 * PATCH /api/cvs/:id/rename
 * Rename a CV branch
 */
router.patch('/:id/rename', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const cvId = req.params.id;
    const { displayName } = req.body;

    if (!mongoose.Types.ObjectId.isValid(cvId)) {
        throw new ValidationError('Invalid CV ID');
    }

    if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
        throw new ValidationError('Display name is required');
    }

    // Verify CV exists and belongs to user
    const cv = await CV.findOne({ _id: cvId, userId });
    if (!cv) {
        throw new NotFoundError('CV not found');
    }

    cv.displayName = displayName.trim();
    await cv.save();

    res.json({
        message: 'CV branch renamed successfully',
        branch: {
            _id: cv._id,
            displayName: cv.displayName,
            updatedAt: cv.updatedAt,
        }
    });
}));

/**
 * GET /api/cvs/:id/original-pdf
 * Return the raw stored PDF binary as base64 for in-browser preview.
 */
router.get('/:id/original-pdf', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id as string;
    const cvId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(cvId)) {
        throw new ValidationError('Invalid CV ID');
    }

    const cv = await CV.findOne({ _id: cvId, userId }).select('+originalPdf');
    if (!cv) throw new NotFoundError('CV not found');
    if (!cv.originalPdf) {
        return res.status(404).json({ message: 'No original PDF stored for this CV.' });
    }

    const pdfBase64 = (cv.originalPdf as Buffer).toString('base64');
    return res.json({ pdfBase64 });
}));

/**
 * POST /api/cvs/:id/restructure
 * Re-generate the AI descriptor and data from the stored cvJson.
 * Useful for legacy CVs or when the user wants to re-analyse structure.
 */
router.post('/:id/restructure', usageLimiter('cvParsing'), asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id as string;
    const cvId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(cvId)) {
        throw new ValidationError('Invalid CV ID');
    }

    const cv = await CV.findOne({ _id: cvId, userId });
    if (!cv) throw new NotFoundError('CV not found');

    const payload = await generateDescriptorFromJson(cv.cvJson as Record<string, any>, userId);
    cv.cvDescriptor = payload.descriptor as any;
    cv.cvData = payload.data;
    await cv.save();

    res.json({
        message: 'CV restructured successfully.',
        cvDescriptor: cv.cvDescriptor,
        cvData: cv.cvData,
    });
}));

/**
 * POST /api/cvs/:id/improve-section-dynamic
 * Improve a specific section of a dynamic CV using AI.
 * Body: { descriptor: CvSectionDescriptor, sectionData: any, customInstructions?: string }
 */
router.post('/:id/improve-section-dynamic', usageLimiter('analysis'), asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id as string;
    const cvId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(cvId)) {
        throw new ValidationError('Invalid CV ID');
    }

    const cv = await CV.findOne({ _id: cvId, userId });
    if (!cv) throw new NotFoundError('CV not found');

    const { descriptor, sectionData, customInstructions } = req.body;

    if (!descriptor || !descriptor.key) {
        throw new ValidationError('Section descriptor is required');
    }

    const improved = await improveDynamicSectionWithAi(
        userId,
        descriptor,
        sectionData,
        customInstructions,
    );

    res.json({
        message: 'Section improved successfully.',
        improvedData: improved,
    });
}));

export default router;
