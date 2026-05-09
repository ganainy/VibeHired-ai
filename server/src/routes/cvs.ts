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
import { improveDynamicSectionWithAi } from '../services/generatorService';
import { GoogleGenerativeAIError } from '@google/generative-ai';
import { NotFoundError, ValidationError } from '../utils/errors/AppError';
import { JsonResumeSchema } from '../types/jsonresume';
import { generateCvPdfBuffer } from '../utils/pdfGenerator';
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
    // Try extracting from code fence first
    const jsonRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
    const jsonMatch = responseText.match(jsonRegex);

    let jsonString: string | null = null;

    if (jsonMatch && jsonMatch[1]) {
        jsonString = jsonMatch[1].trim();
    } else {
        // Fallback: try to find raw JSON object in the response
        const braceStart = responseText.indexOf('{');
        const braceEnd = responseText.lastIndexOf('}');
        if (braceStart !== -1 && braceEnd > braceStart) {
            jsonString = responseText.slice(braceStart, braceEnd + 1);
        }
    }

    if (jsonString) {
        try {
            const parsedObject = JSON.parse(jsonString);
            if (typeof parsedObject === 'object' && parsedObject !== null) {
                return parsedObject as JsonResumeSchema;
            }
            throw new Error('AI response was not a valid object structure.');
        } catch (parseError: any) {
            console.error('JSON.parse failed:', parseError.message);
            console.error('Attempted to parse (first 500 chars):', jsonString.slice(0, 500));
            throw new Error('AI response was not valid JSON.');
        }
    }
    console.error('AI response did not contain recognizable JSON. Response (first 500 chars):', responseText.slice(0, 500));
    throw new Error('AI failed to return CV data in expected format.');
}

function extractPageMarkerBase(value: string): string | null {
    const text = value.trim();
    const match = text.match(/^([A-Z][A-Z0-9 _.'&/()+]{1,60})\s*-\s*(\d{1,3})$/);
    if (!match) return null;
    return match[1].trim().replace(/\s+/g, ' ');
}

function collectPageMarkerBaseCounts(value: unknown, counts: Map<string, number>) {
    if (Array.isArray(value)) {
        for (const item of value) collectPageMarkerBaseCounts(item, counts);
        return;
    }

    if (value && typeof value === 'object') {
        for (const v of Object.values(value as Record<string, unknown>)) {
            collectPageMarkerBaseCounts(v, counts);
        }
        return;
    }

    if (typeof value === 'string') {
        const base = extractPageMarkerBase(value);
        if (base) counts.set(base, (counts.get(base) ?? 0) + 1);
    }
}

function sanitizeParsedCvJson(value: unknown, markerBaseCounts: Map<string, number>): unknown {
    if (Array.isArray(value)) {
        const cleaned = value
            .map((item) => sanitizeParsedCvJson(item, markerBaseCounts))
            .filter((item) => item !== undefined);
        return cleaned;
    }

    if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const out: Record<string, unknown> = {};

        for (const [key, raw] of Object.entries(obj)) {
            if (/^(?:footer|header)(?:[_\s-].*)?$/i.test(key) && typeof raw === 'string') {
                continue;
            }

            const cleanedValue = sanitizeParsedCvJson(raw, markerBaseCounts);
            if (cleanedValue === undefined) continue;

            if (
                typeof cleanedValue === 'string'
                && /^footer[_\s-]*page[_\s-]*\d+$/i.test(key)
            ) {
                continue;
            }

            out[key] = cleanedValue;
        }

        return out;
    }

    if (typeof value === 'string') {
        const text = value.trim();
        if (!text) return value;

        const base = extractPageMarkerBase(text);
        if (base && (markerBaseCounts.get(base) ?? 0) >= 2) {
            return undefined;
        }
        return value;
    }

    return value;
}

/**
 * Helper: Parse uploaded CV file using AI
 */
async function parseUploadedCv(
    reqFile: Express.Multer.File,
    userId: string,
): Promise<JsonResumeSchema> {
    // Save file temporarily for AI processing
    const tempDir = path.join(process.cwd(), 'temp_uploads');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempFilePath = path.join(tempDir, `cv_${Date.now()}_${reqFile.originalname}`);
    fs.writeFileSync(tempFilePath, reqFile.buffer);

        try {
    const strictFreeformPrompt = `
You are a CV transcription tool. Your ONLY job is to read the attached CV file (${reqFile.originalname}) and return a JSON Resume format representation.

=== NON-NEGOTIABLE RULES ===
- Return valid JSON Resume schema with standard keys: basics, work, education, skills, languages, certificates, projects, awards, volunteer, interests, references, publications.
- Preserve text exactly as written, including punctuation, casing, and wording.
- Do NOT normalize dates, names, locations, or formatting words.
- Do NOT infer, synthesize, reword, summarize, or clean up content.
- Do NOT merge/split bullets except where the source clearly defines bullet boundaries.
- Do NOT omit sections. If a section exists, include it.
- Ignore running headers/footers/page markers that repeat across pages.

=== STRUCTURE INSTRUCTIONS ===
- basics: { name, email, phone, url, location: { city, country }, profiles: [{ network, url }] }
- work: [{ name (company), position, startDate, endDate, summary, highlights: [bullets] }]
- education: [{ institution, studyType, area, startDate, endDate, score }]
- skills: [{ name, keywords: [skill1, skill2] }]
- languages: [{ language, fluency }]
- certificates: [{ name, issuer, date, url }]
- projects: [{ name, description, highlights: [bullets], url }]
- For date ranges, use YYYY-MM format where possible (e.g., "2020-01", "2023-12"). Use "Present" for current positions.
- For bullets/content fields that are strings, keep them as strings.
- LANGUAGE SECTIONS: Each language entry MUST be its own separate object.
- NEVER include leading bullet characters (•, -, –) in stored strings. Strip them before storing.

=== OUTPUT FORMAT ===
Return ONLY a single valid JSON object enclosed in triple backticks (\`\`\`json ... \`\`\`).
No text, explanation, or commentary before or after the JSON block.
`;
    const prompt = strictFreeformPrompt;

        console.log('Sending CV parsing request to AI...');
        const result = await generateContentWithFile(
            String(userId),
            prompt,
            tempFilePath,
            reqFile.mimetype
        );
        const responseText = result.text;
        console.log('Received CV parsing response from AI.');

        const cvJsonResume = parseJsonResponseToSchema(responseText);

        if (!cvJsonResume) {
            console.error('Failed to parse AI response into valid JSON Resume structure.');
            throw new Error('Failed to parse AI response into valid JSON Resume structure.');
        }

        const markerBaseCounts = new Map<string, number>();
        collectPageMarkerBaseCounts(cvJsonResume, markerBaseCounts);
        const sanitizedCvJsonResume = sanitizeParsedCvJson(cvJsonResume, markerBaseCounts) as JsonResumeSchema;

        console.log('--- PARSED CV JSON ---');
        console.log(JSON.stringify(sanitizedCvJsonResume, null, 2));
        console.log('--- END OF CV LOGS ---');

        return sanitizedCvJsonResume;
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
    const lite = req.query.lite === '1' || req.query.lite === 'true';

    const branches = await CV.getBaseCvs(userId);

    // Get all job CVs to count usage per base CV
    const allJobCvs = await CV.find({ userId, jobApplicationId: { $ne: null } });
    const usageByBaseCv = new Map<string, number>();

    // Count how many job CVs reference each base CV (via baseCvId in JobApplication)
    const jobIds = allJobCvs.map(cv => cv.jobApplicationId);
    const jobs = jobIds.length > 0
        ? await JobApplication.find({ _id: { $in: jobIds } })
        : [];

    jobs.forEach(job => {
        if (job.baseCvId) {
            const baseCvId = String(job.baseCvId);
            usageByBaseCv.set(baseCvId, (usageByBaseCv.get(baseCvId) || 0) + 1);
        }
    });

        res.json({
            branches: branches.map(cv => ({
                _id: cv._id,
                isDefault: cv.isDefault,
                category: cv.category,
                displayName: cv.displayName,
                jobApplicationId: cv.jobApplicationId,
                cvJson: lite ? undefined : cv.cvJson,
                hasOriginalCvJson: Boolean(cv.originalCvJson),
                extractionMode: cv.extractionMode ?? null,
                extractionTimestamp: cv.extractionTimestamp ?? null,
                cvDescriptor: lite ? null : (cv.cvDescriptor ?? null),
                cvData: lite ? null : (cv.cvData ?? null),
                templateId: cv.templateId,
                filename: cv.filename,
                analysisCache: lite ? null : cv.analysisCache,
                isStarred: cv.isStarred ?? false,
                usedByJobCount: usageByBaseCv.get(String(cv._id)) || 0,
                createdAt: cv.createdAt,
                updatedAt: cv.updatedAt,
            }))
        });
}));

/**
 * GET /api/cvs/:cvId/usage
 * Get jobs that use a specific base CV
 */
router.get('/:cvId/usage', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id as string;
    const { cvId } = req.params;

    // Verify the CV belongs to this user and is a base CV
    const cv = await CV.findOne({ _id: cvId, userId, jobApplicationId: null });
    if (!cv) {
        res.status(404).json({ error: 'Base CV not found' });
        return;
    }

    // Find all jobs that reference this base CV
    const jobs = await JobApplication.find({ userId, baseCvId: cvId })
        .select('_id jobTitle companyName status')
        .sort({ createdAt: -1 });

    res.json({
        jobs: jobs.map(job => ({
            _id: job._id,
            jobTitle: job.jobTitle,
            companyName: job.companyName,
            status: job.status,
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
            isDefault: baseCv.isDefault,
            cvJson: baseCv.cvJson,
            cvDescriptor: baseCv.cvDescriptor ?? null,
            cvData: baseCv.cvData ?? null,
            templateId: effectiveTemplate,
            filename: baseCv.filename,
            analysisCache: baseCv.analysisCache,
            isStarred: baseCv.isStarred ?? false,
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
        isDefault: false,
        category,
        displayName,
        cvJson: JSON.parse(JSON.stringify(sourceCv.cvJson)), // Deep copy
        originalCvJson: sourceCv.originalCvJson ? JSON.parse(JSON.stringify(sourceCv.originalCvJson)) : null,
        extractionMode: sourceCv.extractionMode ?? null,
        extractionTimestamp: sourceCv.extractionTimestamp ?? null,
        cvDescriptor: sourceCv.cvDescriptor ? JSON.parse(JSON.stringify(sourceCv.cvDescriptor)) : null,
        cvData: sourceCv.cvData ? JSON.parse(JSON.stringify(sourceCv.cvData)) : null,
        templateId: sourceCv.templateId,
    });

    res.status(201).json({
        message: 'CV branch created successfully.',
        branch: {
            _id: newBranch._id,
            isDefault: newBranch.isDefault,
            category: newBranch.category,
            displayName: newBranch.displayName,
            cvJson: newBranch.cvJson,
            hasOriginalCvJson: Boolean(newBranch.originalCvJson),
            extractionMode: newBranch.extractionMode ?? null,
            extractionTimestamp: newBranch.extractionTimestamp ?? null,
            cvDescriptor: newBranch.cvDescriptor ?? null,
            cvData: newBranch.cvData ?? null,
            templateId: newBranch.templateId,
            isStarred: newBranch.isStarred ?? false,
            createdAt: newBranch.createdAt,
            updatedAt: newBranch.updatedAt,
        }
    });
}));

/**
 * PATCH /api/cvs/:id/set-primary
 * Set a base CV as default
 */
router.patch('/:id/set-primary', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id as string;
    const cvId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(cvId)) {
        throw new ValidationError('Invalid CV ID');
    }

    const result = await CV.setAsDefault(cvId, userId);

    res.json({
        message: 'CV set as default successfully.',
        branch: {
            _id: result._id,
            isDefault: result.isDefault,
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
            isDefault: cv.isDefault,
            jobApplicationId: cv.jobApplicationId,
            jobApplication: (cv as any).jobApplication || null,
            cvJson: cv.cvJson,
            hasOriginalCvJson: Boolean(cv.originalCvJson),
            extractionMode: cv.extractionMode ?? null,
            extractionTimestamp: cv.extractionTimestamp ?? null,
            cvDescriptor: cv.cvDescriptor ?? null,
            cvData: cv.cvData ?? null,
            templateId: effectiveTemplate,
            filename: cv.filename,
            analysisCache: cv.analysisCache,
            isStarred: cv.isStarred ?? false,
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
            isDefault: cv.isDefault,
            jobApplicationId: cv.jobApplicationId,
            cvJson: cv.cvJson,
            cvDescriptor: cv.cvDescriptor ?? null,
            cvData: cv.cvData ?? null,
            templateId: effectiveTemplate,
            filename: cv.filename,
            tailoringChanges: cv.tailoringChanges || null,
            isStarred: cv.isStarred ?? false,
            createdAt: cv.createdAt,
            updatedAt: cv.updatedAt,
        }
    });
}));

/**
 * POST /api/cvs/upload
 * Upload and parse a new CV file (creates/replaces the default CV)
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
        const originalCvJson = JSON.parse(JSON.stringify(cvJsonResume));

        // Generate AI-driven descriptor + structured data in one additional call.
        // Errors here are non-fatal: the CV is still created with the legacy cvJson.
        const cvDescriptor = null;
        const cvData = null;

        const newCv = await CV.create({
            userId,
            isDefault: false,
            category: 'General',
            displayName: req.file.originalname.replace(/\.[^.]+$/, '') || 'Uploaded CV',
            cvJson: cvJsonResume,
            originalCvJson,
            extractionMode: 'strict',
            extractionTimestamp: new Date(),
            cvDescriptor,
            cvData,
            filename: req.file.originalname,
            originalPdf: req.file.buffer,
            templateId: null,
        });

        console.log(`Primary CV created for user ${req.user!.email}`);

        res.status(200).json({
            message: 'CV uploaded and parsed successfully.',
            cv: {
                _id: newCv._id,
                isDefault: false,
                category: newCv.category,
                displayName: newCv.displayName,
                cvJson: cvJsonResume,
                hasOriginalCvJson: Boolean(newCv.originalCvJson),
                extractionMode: newCv.extractionMode ?? null,
                cvDescriptor: newCv.cvDescriptor ?? null,
                cvData: newCv.cvData ?? null,
                filename: newCv.filename,
                isStarred: newCv.isStarred ?? false,
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
    let originalCvJson: JsonResumeSchema | null = null;
    let extractionMode: 'strict' | 'standard' | null = null;
    let extractionTimestamp: Date | null = null;
    if (req.body.cvJson) {
        cvJson = req.body.cvJson;
        originalCvJson = JSON.parse(JSON.stringify(req.body.cvJson));
        extractionMode = 'standard';
        extractionTimestamp = new Date();
    } else {
        // Copy from primary CV
        const primaryCv = await CV.getDefaultCv(userId as string);
        if (!primaryCv) {
            throw new ValidationError('No primary CV found. Please upload a CV first.');
        }
        cvJson = JSON.parse(JSON.stringify(primaryCv.cvJson)); // Deep copy
        originalCvJson = primaryCv.originalCvJson ? JSON.parse(JSON.stringify(primaryCv.originalCvJson)) : null;
        extractionMode = primaryCv.extractionMode ?? null;
        extractionTimestamp = primaryCv.extractionTimestamp ?? null;
    }

    const newCv = await CV.create({
        userId,
        isDefault: false,
        displayName: `Job CV - ${job.jobTitle} at ${job.companyName}`,
        jobApplicationId: new mongoose.Types.ObjectId(jobId),
        cvJson,
        originalCvJson,
        extractionMode,
        extractionTimestamp,
        templateId: req.body.templateId || null,
    });

    res.status(201).json({
        message: 'Job CV created successfully.',
        cv: {
            _id: newCv._id,
            jobApplicationId: newCv.jobApplicationId,
            cvJson: newCv.cvJson,
            templateId: newCv.templateId,
            isStarred: newCv.isStarred ?? false,
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
        const originalCvJson = JSON.parse(JSON.stringify(cvJsonResume));

        const branchCvDescriptor = null;
        const branchCvData = null;

        const newCv = await CV.create({
            userId,
            isDefault: false,
            category: category.trim(),
            displayName: displayName.trim(),
            cvJson: cvJsonResume,
            originalCvJson,
            extractionMode: 'strict',
            extractionTimestamp: new Date(),
            cvDescriptor: branchCvDescriptor,
            cvData: branchCvData,
            filename: req.file.originalname,
            originalPdf: req.file.buffer,
            templateId: null,
        });

        console.log(`Branch CV created for user ${req.user!.email}`);

        res.status(201).json({
            message: 'CV branch uploaded and parsed successfully.',
            branch: {
                _id: newCv._id,
                isDefault: false,
                category: newCv.category,
                displayName: newCv.displayName,
                cvJson: cvJsonResume,
                hasOriginalCvJson: Boolean(newCv.originalCvJson),
                extractionMode: newCv.extractionMode ?? null,
                cvDescriptor: newCv.cvDescriptor ?? null,
                cvData: newCv.cvData ?? null,
                filename: newCv.filename,
                isStarred: newCv.isStarred ?? false,
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
        const primary = await CV.getDefaultCv(userId as string);
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
        isDefault: false,
        displayName: `Job CV – ${job.jobTitle} at ${job.companyName}`,
        jobApplicationId: new mongoose.Types.ObjectId(jobId),
        cvJson: JSON.parse(JSON.stringify(sourceCv.cvJson)), // deep-copy JSON
        originalCvJson: sourceCv.originalCvJson ? JSON.parse(JSON.stringify(sourceCv.originalCvJson)) : null,
        extractionMode: sourceCv.extractionMode ?? null,
        extractionTimestamp: sourceCv.extractionTimestamp ?? null,
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
            isStarred: jobCv.isStarred ?? false,
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
            isDefault: false,
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
                isStarred: jobCv.isStarred ?? false,
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

    if (
        Object.prototype.hasOwnProperty.call(req.body, 'originalCvJson') ||
        Object.prototype.hasOwnProperty.call(req.body, 'extractionMode') ||
        Object.prototype.hasOwnProperty.call(req.body, 'extractionTimestamp') ||
        Object.prototype.hasOwnProperty.call(req.body, 'originalPdf')
    ) {
        throw new ValidationError('Original extraction fields are read-only. Use reset-from-source for recovery.');
    }

    const { cvJson, cvDescriptor, cvData, templateId, isStarred } = req.body;

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

    if (isStarred !== undefined) {
        cv.isStarred = Boolean(isStarred);
    }

    await cv.save();

    console.log(`CV ${cvId} updated for user ${req.user!.email}`);

    res.json({
        message: 'CV updated successfully.',
        cv: {
            _id: cv._id,
            isDefault: cv.isDefault,
            jobApplicationId: cv.jobApplicationId,
            cvJson: cv.cvJson,
            hasOriginalCvJson: Boolean(cv.originalCvJson),
            extractionMode: cv.extractionMode ?? null,
            extractionTimestamp: cv.extractionTimestamp ?? null,
            cvDescriptor: cv.cvDescriptor ?? null,
            cvData: cv.cvData ?? null,
            templateId: cv.templateId,
            isStarred: cv.isStarred ?? false,
            updatedAt: cv.updatedAt,
        }
    });
}));

/**
 * PATCH /api/cvs/:id/star
 * Toggle star status for a CV
 */
router.patch('/:id/star', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const cvId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(cvId)) {
        throw new ValidationError('Invalid CV ID');
    }

    const cv = await CV.findOne({ _id: cvId, userId });
    if (!cv) {
        throw new NotFoundError('CV not found');
    }

    cv.isStarred = Boolean(req.body?.isStarred);
    await cv.save();

    res.json({
        message: 'CV star status updated.',
        cv: {
            _id: cv._id,
            isStarred: cv.isStarred ?? false,
            updatedAt: cv.updatedAt,
        }
    });
}));

/**
 * POST /api/cvs/:id/reset-from-source
 * Restore editable cvJson from immutable originalCvJson snapshot.
 */
router.post('/:id/reset-from-source', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const cvId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(cvId)) {
        throw new ValidationError('Invalid CV ID');
    }

    const cv = await CV.findOne({ _id: cvId, userId });
    if (!cv) throw new NotFoundError('CV not found');
    if (!cv.originalCvJson) {
        throw new ValidationError('No original extraction snapshot is available for this CV.');
    }

    cv.cvJson = JSON.parse(JSON.stringify(cv.originalCvJson));
    cv.cvDescriptor = null;
    cv.cvData = null;
    cv.analysisCache = null;
    cv.lastEditedAt = new Date();
    cv.snapshotVersion = (cv.snapshotVersion || 0) + 1;

    await cv.save();

    res.json({
        message: 'CV has been reset to the original extracted version.',
        cv: {
            _id: cv._id,
            isDefault: cv.isDefault,
            jobApplicationId: cv.jobApplicationId,
            cvJson: cv.cvJson,
            hasOriginalCvJson: Boolean(cv.originalCvJson),
            extractionMode: cv.extractionMode ?? null,
            extractionTimestamp: cv.extractionTimestamp ?? null,
            cvDescriptor: cv.cvDescriptor ?? null,
            cvData: cv.cvData ?? null,
            templateId: cv.templateId,
            isStarred: cv.isStarred ?? false,
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
        message: 'CV deleted successfully.',
        deletedCvId: cvId,
    });
}));

/**
 * POST /api/cvs/:id/promote
 * Promote a job CV to become the default base CV
 */
router.post('/:id/promote', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id as string;
    const cvId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(cvId)) {
        throw new ValidationError('Invalid CV ID');
    }

    const promotedCv = await CV.setAsDefault(cvId, userId);

    console.log(`CV ${cvId} promoted to default for user ${req.user!.email}`);

    res.json({
        message: 'CV promoted to default base CV successfully.',
        cv: {
            _id: promotedCv._id,
            isDefault: promotedCv.isDefault,
            cvJson: promotedCv.cvJson,
            templateId: promotedCv.templateId,
            isStarred: promotedCv.isStarred ?? false,
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
    const templateId = template || cv.templateId || 'ats-optimized';

    if (!cv.cvJson) {
        return res.status(400).json({ message: 'This CV has no JSON data to generate a PDF preview from.' });
    }

    try {
        const pdfBuffer = await generateCvPdfBuffer(cv.cvJson, { lang: 'en', pageFormat: 'a4' });
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
    const { displayName, category } = req.body;

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
    if (category !== undefined) {
        if (typeof category !== 'string') {
            throw new ValidationError('Category must be a string');
        }
        const trimmed = category.trim();
        cv.category = trimmed.length ? trimmed : null;
    }
    await cv.save();

    res.json({
        message: 'CV branch renamed successfully',
        branch: {
            _id: cv._id,
            displayName: cv.displayName,
            category: cv.category ?? null,
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
 * PUT /api/cvs/:id/edited-pdf
 * Save an edited PDF back to the CV document.
 * Body: { pdfBase64: string } - base64-encoded PDF binary
 */
router.put('/:id/edited-pdf', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id as string;
    const cvId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(cvId)) {
        throw new ValidationError('Invalid CV ID');
    }

    const { pdfBase64 } = req.body;
    if (!pdfBase64 || typeof pdfBase64 !== 'string') {
        throw new ValidationError('pdfBase64 is required');
    }

    const cv = await CV.findOne({ _id: cvId, userId }).select('+originalPdf');
    if (!cv) throw new NotFoundError('CV not found');
    if (!cv.originalPdf) {
        throw new ValidationError('This CV does not have an original PDF to update');
    }

    // Decode base64 and update the original PDF
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    cv.originalPdf = pdfBuffer;
    await cv.save();

    res.json({
        message: 'PDF updated successfully.',
        cv: {
            _id: cv._id,
            updatedAt: cv.updatedAt,
        }
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
