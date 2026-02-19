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
import { generateContentWithFile, getProviderStrategy } from '../utils/aiService';
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
You are a precise CV/resume data extractor. Analyze the attached CV file (${reqFile.originalname}) and extract ALL information into a strictly valid JSON Resume Schema object.

=== CRITICAL FIELD-BY-FIELD RULES ===

**basics.name**
- Extract the candidate's full name EXACTLY as it appears, preserving proper word spacing.
- If the name appears as a concatenated string (e.g. "JohnDoe" due to PDF rendering), reconstruct the correct spacing by inserting a space at the camelCase boundary (e.g. "John Doe").
- NEVER output the name without a space between first and last name.

**basics.summary**
- Extract ONLY the body/paragraph text of the professional summary or profile section.
- NEVER include the section heading (e.g. "Professional Summary", "Berufsprofil", "Über mich") as part of the value.
- The value must be plain prose text only.

**basics.location**
- Map city → "city", state/region → "region", country → "countryCode" (ISO 2-letter code, e.g. "DE", "EG").

**work[].name / work[].position**
- "name" = the employer/company name only.
- "position" = the job title only.
- "highlights" = array of individual bullet point strings (each bullet is one separate array element, NOT a single concatenated paragraph).
- "startDate" / "endDate" = YYYY-MM or YYYY. Use "Present" for current roles.

**education[].studyType / education[].area / education[].institution**
- "studyType" = the degree type (e.g. "Bachelor of Science", "Master of Science", "Ausbildung").
- "area" = the field of study (e.g. "Computer Science", "Internet Security").
- "institution" = the university or school name only.

**skills[]**
- Group skills into meaningful categories. Each element MUST be an object: { "name": "<Category>", "keywords": ["skill1", "skill2", ...] }
- "keywords" MUST be an array of individual short skill/technology names — NEVER a single long paragraph string.
- Each keyword is ONE skill (e.g. "Windows 10/11", "Active Directory", "TCP/IP") — not a sentence.
- Example of CORRECT skills entry:
  { "name": "Networking", "keywords": ["TCP/IP", "DNS", "DHCP", "HTTP/HTTPS", "WLAN"] }
- Example of INCORRECT skills entry (DO NOT do this):
  { "name": "Skills", "keywords": ["Kenntnisse in TCP/IP, DNS, DHCP, HTTP/HTTPS sowie grundlegender Netzwerkdiagnose"] }
- If the CV lists skills as a long paragraph, split each individual skill/term into its own keyword string.
- **DEDUPLICATION**: If the CV has both a compact skills list (e.g. a tag cloud or comma-separated bar) AND a detailed skills section with bullet-point descriptions, extract skills ONLY ONCE. Prefer the detailed version. Do NOT create two separate skill groups containing the same technologies.

**projects[] vs skills[] — CRITICAL DISTINCTION**
- A "Project" is a named block of work the candidate has done, described with bullet points explaining WHAT they did (actions, outcomes, responsibilities). These go into projects[].
- A "Skill" is a technology name, tool, or competency area. These go into skills[].
- If the CV has a section with titled blocks (e.g. "Technische Fehleranalyse & 1st-Level-Support", "Windows-Administration") each containing descriptive bullet points about what was done — those are PROJECTS, not skills. Extract them into projects[].
- Do NOT convert project titles into skill category names.
- Example: A block titled "Microsoft 365 & Benutzerverwaltung" with bullets like "Kenntnisse in Microsoft 365 (Outlook, Teams...)" is a PROJECT entry demonstrating that skill area — add it to projects[], and separately add "Microsoft 365", "Outlook", "Teams" etc. as keywords in skills[].

**projects[]**
- "name" = project title only.
- "description" = brief one-line description (plain text, no heading labels).
- "highlights" = array of individual bullet strings describing what was done.
- "url" = GitHub or live URL if present — ONLY if the URL contains a real path beyond the domain (e.g. "https://github.com/username/repo" is valid, "https://github.com/" is NOT). Omit the field entirely if no real URL is present.

**languages[]**
- EACH language entry MUST have exactly two separate fields:
  - "language": the language name ONLY (e.g. "Deutsch", "English", "Arabic", "Arabisch") — NO proficiency level here
  - "fluency": the proficiency level ONLY (e.g. "C1", "B2", "Native", "Fluent", "Conversational", "Basic") — NO language name here
- NEVER merge language name and proficiency into a single string (e.g. "DeutschC1" or "ArabischNative" are WRONG).
- Example of CORRECT entry: { "language": "Deutsch", "fluency": "C1" }
- Example of INCORRECT entry: { "language": "DeutschC1", "fluency": "" }

**basics.profiles & basics.url**
- Extract common social/professional profiles like LinkedIn, GitHub, and Portfolio.
- **IMPORTANT**: Extract the FULL URL for each profile.
- **NEVER GUESS HANDLES**: DO NOT construct URLs based on the candidate's name. Only extract a profile if a specific username or link is explicitly written next to the icon/label.
- If the CV contains a specific handle (e.g. "@amrelg") next to an icon, construct the full URL (e.g. "github.com/amrelg").
- **STRICT NO PLACEHOLDERS**: NEVER extract generic URLs like "https://linkedin.com/", "https://github.com/", or URLs that obviously lack a unique handle.
- If no specific profile info is present, omit the field entirely.
- Map LinkedIn to "network": "LinkedIn", GitHub to "network": "GitHub", and Portfolio sites to "network": "Portfolio" or "Website".

**General rules**
- Parse the ENTIRE document — do not skip any section.
- NEVER include section heading labels (e.g. "Skills & Technologies", "Berufserfahrung") as field values.
- NEVER use generic placeholders for any field. If the information isn't in the CV, leave the field out.
- Format all dates as YYYY-MM or YYYY. Use "Present" for ongoing. Omit date fields that are not found.
- If an entire section is absent from the CV, omit that top-level key entirely.
- If a specific field is not found, omit it (do not set to null or empty string unless required).
- **DO NOT include any JavaScript/JSON comments (// or /* */) anywhere in the output.**

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

        // Guard: PDF/file parsing requires Gemini — other providers don't support file input
        const providerStrategy = await getProviderStrategy(String(userId));
        if (providerStrategy.getName().toLowerCase() !== 'gemini') {
            throw new ValidationError(
                'PDF upload requires Gemini. Please switch your AI provider to Gemini in Settings.'
            );
        }

        console.log(`Processing CV file: ${req.file.originalname}, MIME Type: ${req.file.mimetype}`);

        const cvJsonResume = await parseUploadedCv(req.file, String(userId));

        const newCv = await CV.create({
            userId,
            isPrimary: false,
            category: 'General',
            displayName: req.file.originalname.replace(/\.[^.]+$/, '') || 'Uploaded CV',
            cvJson: cvJsonResume,
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

        // Guard: PDF/file parsing requires Gemini — other providers don't support file input
        const branchProviderStrategy = await getProviderStrategy(String(userId));
        if (branchProviderStrategy.getName().toLowerCase() !== 'gemini') {
            throw new ValidationError(
                'PDF upload requires Gemini. Please switch your AI provider to Gemini in Settings.'
            );
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
 * Upload a PDF/DOCX CV file directly for a specific job.
 * Parses the file, stores JSON + binary as an independent job CV.
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

        const providerStrategy = await getProviderStrategy(String(userId));
        if (providerStrategy.getName().toLowerCase() !== 'gemini') {
            throw new ValidationError(
                'PDF upload requires Gemini. Please switch your AI provider to Gemini in Settings.'
            );
        }

        const job = await JobApplication.findOne({ _id: jobId, userId });
        if (!job) throw new NotFoundError('Job application not found.');

        console.log(`Parsing job CV file: ${req.file.originalname}`);
        const cvJson = await parseUploadedCv(req.file, String(userId));

        // Replace existing job CV if present
        await CV.deleteOne({ jobApplicationId: jobId });

        const jobCv = await CV.create({
            userId,
            isMasterCv: false,
            isPrimary: false,
            displayName: `Job CV – ${job.jobTitle} at ${job.companyName}`,
            jobApplicationId: new mongoose.Types.ObjectId(jobId),
            cvJson,
            filename: req.file.originalname,
            originalPdf: req.file.buffer, // Preserve raw file for isolation
            templateId: req.body.templateId || null,
        });

        res.status(201).json({
            message: 'CV file uploaded for job.',
            cv: {
                _id: jobCv._id,
                jobApplicationId: jobCv.jobApplicationId,
                displayName: jobCv.displayName,
                cvJson: jobCv.cvJson,
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

    const { cvJson, templateId } = req.body;

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
