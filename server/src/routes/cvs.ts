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
import CV, { ICV } from '../models/CV';
import User from '../models/User';
import JobApplication from '../models/JobApplication';
import { generateContentWithFile } from '../utils/aiService';
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
    Analyze the content of the attached CV file (${reqFile.originalname}).
    Your task is to extract information and structure it precisely according to the JSON Resume Schema (details at https://jsonresume.org/schema/).

    Instructions:
    - Parse the entire document.
    - Populate the standard JSON Resume fields: basics, work, education, skills, projects, languages, etc., based *only* on the content found in the file.
    - For 'basics.profiles', extract common profiles like LinkedIn, GitHub, Portfolio, etc.
    - For 'work.highlights' or 'work.description', use bullet points (array of strings for highlights) or a single description string. Prioritize 'highlights' if possible.
    - For 'skills', try to group them under relevant 'name' properties (e.g., "Programming Languages", "Frameworks", "Tools") with specific skills listed in 'keywords'. If grouping isn't clear, create a single skill entry with a general name and list all skills under its 'keywords'.
    - Format dates as YYYY-MM-DD, YYYY-MM, or YYYY where possible. Use "Present" for ongoing roles/studies.
    - If a standard section (like 'awards' or 'volunteer') is not present in the CV, omit that key entirely from the JSON output.
    - If a specific field within a section (like 'work.location') is not found, omit that field or set it to null.

    **CRITICAL: Do NOT include any comments (e.g., // or /* */) within the JSON output.**

    Output Format:
    Return ONLY a single, valid JSON object enclosed in triple backticks (\`\`\`json ... \`\`\`) that strictly adheres to the JSON Resume Schema structure. Do not include any explanatory text before or after the JSON block.
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

        const cvJsonResume = parseJsonResponseToSchema(responseText);

        if (!cvJsonResume) {
            throw new Error('Failed to parse AI response into valid JSON Resume structure.');
        }

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
 * Get the primary CV for the current user (formerly master CV)
 */
router.get('/master', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id as string;

    const primaryCv = await CV.getPrimaryCv(userId);

    if (!primaryCv) {
        res.json({
            cv: null,
            message: 'No primary CV found'
        });
        return;
    }

    // Get user's default template if CV doesn't have one
    const user = await User.findById(userId).select('selectedTemplate');
    const effectiveTemplate = primaryCv.templateId || user?.selectedTemplate || 'modern-clean';

    res.json({
        cv: {
            _id: primaryCv._id,
            isPrimary: true,
            isMasterCv: true, // Keep for backward compatibility
            cvJson: primaryCv.cvJson,
            templateId: effectiveTemplate,
            filename: primaryCv.filename,
            analysisCache: primaryCv.analysisCache,
            createdAt: primaryCv.createdAt,
            updatedAt: primaryCv.updatedAt,
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

    // Create new branch
    const newBranch = await CV.create({
        userId,
        isPrimary: false,
        category,
        displayName,
        cvJson: JSON.parse(JSON.stringify(sourceCv.cvJson)), // Deep copy
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
            templateId: effectiveTemplate,
            filename: cv.filename,
            analysisCache: cv.analysisCache,
            createdAt: cv.createdAt,
            updatedAt: cv.updatedAt,
        }
    });
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
    upload.single('cvFile'),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user!._id;

        if (!req.file) {
            throw new ValidationError('No CV file uploaded.');
        }

        console.log(`Processing CV file: ${req.file.originalname}, MIME Type: ${req.file.mimetype}`);

        const cvJsonResume = await parseUploadedCv(req.file, String(userId));

        // Set all existing CVs as non-primary and create new primary CV
        await CV.updateMany({ userId }, { isPrimary: false });

        const newCv = await CV.create({
            userId,
            isPrimary: true,
            category: 'General',
            displayName: 'Primary CV',
            cvJson: cvJsonResume,
            filename: req.file.originalname,
            templateId: null, // Will inherit from user settings
        });

        console.log(`Primary CV created for user ${req.user!.email}`);

        res.status(200).json({
            message: 'CV uploaded and parsed successfully.',
            cv: {
                _id: newCv._id,
                isPrimary: true,
                category: newCv.category,
                displayName: newCv.displayName,
                cvJson: cvJsonResume,
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

        console.log(`Processing branch CV file: ${req.file.originalname}, MIME Type: ${req.file.mimetype}`);

        const cvJsonResume = await parseUploadedCv(req.file, String(userId));

        const newCv = await CV.create({
            userId,
            isPrimary: false,
            category: category.trim(),
            displayName: displayName.trim(),
            cvJson: cvJsonResume,
            filename: req.file.originalname,
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
                filename: newCv.filename,
                createdAt: newCv.createdAt,
                updatedAt: newCv.updatedAt,
            }
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

    const { cvJson, templateId } = req.body;

    if (cvJson) {
        if (typeof cvJson !== 'object' || !cvJson.basics) {
            throw new ValidationError('CV data must be a valid object with a basics section.');
        }
        cv.cvJson = cvJson;
        cv.analysisCache = null; // Invalidate cache when CV changes
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

export default router;
