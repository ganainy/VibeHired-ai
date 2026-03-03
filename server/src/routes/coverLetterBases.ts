// server/src/routes/coverLetterBases.ts
/**
 * Cover Letter Bases Routes
 *
 * Manages base (template) cover letters and job-specific cover letter documents.
 * Every job-specific CL is a fully independent copy – editing or deleting a base
 * CL will never affect CLs already attached to jobs.
 *
 * Endpoints:
 *   GET    /api/cover-letter-bases              – list all base CLs for the user
 *   POST   /api/cover-letter-bases              – create a base CL from text
 *   POST   /api/cover-letter-bases/upload       – upload & parse a PDF/DOCX as a base CL
 *   PUT    /api/cover-letter-bases/:id          – update a base CL
 *   DELETE /api/cover-letter-bases/:id          – delete a base CL
 *   GET    /api/cover-letter-bases/job/:jobId   – get the CL document for a job
 *   POST   /api/cover-letter-bases/job/:jobId/from-base/:clId  – copy base → job (isolated)
 *   POST   /api/cover-letter-bases/job/:jobId/upload           – upload file as job CL
 *   POST   /api/cover-letter-bases/job/:jobId/save-current     – snapshot current draftCoverLetterText
 */

import express, { Router, Request, Response } from 'express';
import multer from 'multer';
import mongoose from 'mongoose';
import authMiddleware from '../middleware/authMiddleware';
import CoverLetter from '../models/CoverLetter';
import JobApplication from '../models/JobApplication';
import { asyncHandler } from '../utils/asyncHandler';
import { NotFoundError, ValidationError } from '../utils/errors/AppError';
import { generateContentWithFile } from '../utils/aiService';
import fs from 'fs';
import path from 'path';

const router: Router = express.Router();
router.use(authMiddleware as any);

// Multer: in-memory storage for PDF/DOCX uploads (max 10 MB)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
        ];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and DOCX files are accepted for cover letters.'));
        }
    },
});

// ---------------------------------------------------------------------------
// Helper: extract plain text from uploaded CL file using AI
// ---------------------------------------------------------------------------
async function extractTextFromClFile(
    file: Express.Multer.File,
    userId: string
): Promise<string> {

    const tempDir = path.join(process.cwd(), 'temp_uploads');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const tempPath = path.join(tempDir, `cl_${Date.now()}_${file.originalname}`);
    fs.writeFileSync(tempPath, file.buffer);

    try {
        const prompt = `Extract the complete cover letter text from the attached document.
Return ONLY the plain text of the cover letter, preserving paragraph breaks with newlines.
Do NOT include any meta-commentary, explanations, or additional text.`;

        const result = await generateContentWithFile(userId, prompt, tempPath, file.mimetype);
        return result.text.trim();
    } finally {
        try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
    }
}

// ---------------------------------------------------------------------------
// GET /api/cover-letter-bases
// List all base cover letters for the current user
// ---------------------------------------------------------------------------
router.get('/', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const cls = await CoverLetter.find({ userId, jobApplicationId: null }).sort({ createdAt: -1 });

    res.json({
        coverLetters: cls.map(cl => ({
            _id: cl._id,
            displayName: cl.displayName,
            language: cl.language,
            coverLetterText: cl.coverLetterText,
            filename: cl.filename,
            fileMimeType: cl.fileMimeType,
            hasFile: !!cl.filename,
            emailSubject: cl.emailSubject,
            emailBody: cl.emailBody,
            emailRecipient: cl.emailRecipient,
            createdAt: cl.createdAt,
            updatedAt: cl.updatedAt,
        })),
    });
}));

// ---------------------------------------------------------------------------
// POST /api/cover-letter-bases
// Create a base cover letter from text
// ---------------------------------------------------------------------------
router.post('/', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const { displayName, coverLetterText, language, emailSubject, emailBody, emailRecipient } = req.body;

    if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
        throw new ValidationError('displayName is required.');
    }
    if (!coverLetterText || typeof coverLetterText !== 'string' || !coverLetterText.trim()) {
        throw new ValidationError('coverLetterText is required.');
    }

    const cl = await CoverLetter.create({
        userId,
        displayName: displayName.trim(),
        coverLetterText: coverLetterText.trim(),
        language: language === 'de' ? 'de' : 'en',
        jobApplicationId: null,
        emailSubject: emailSubject || null,
        emailBody: emailBody || null,
        emailRecipient: emailRecipient || null,
    });

    res.status(201).json({
        message: 'Base cover letter created.',
        coverLetter: {
            _id: cl._id,
            displayName: cl.displayName,
            language: cl.language,
            coverLetterText: cl.coverLetterText,
            emailSubject: cl.emailSubject,
            emailBody: cl.emailBody,
            emailRecipient: cl.emailRecipient,
            createdAt: cl.createdAt,
        },
    });
}));

// ---------------------------------------------------------------------------
// POST /api/cover-letter-bases/upload
// Upload a PDF/DOCX cover letter file as a new base CL
// The binary is stored for future isolation; text is extracted via AI.
// ---------------------------------------------------------------------------
router.post(
    '/upload',
    upload.single('clFile'),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = String(req.user!._id);
        const { displayName, language } = req.body;

        if (!req.file) throw new ValidationError('No file uploaded.');
        if (!displayName || !displayName.trim()) {
            throw new ValidationError('displayName is required.');
        }

        const extractedText = await extractTextFromClFile(req.file, userId);

        const cl = await CoverLetter.create({
            userId,
            displayName: displayName.trim(),
            coverLetterText: extractedText,
            language: language === 'de' ? 'de' : 'en',
            jobApplicationId: null,
            filename: req.file.originalname,
            fileBuffer: req.file.buffer,
            fileMimeType: req.file.mimetype,
        });

        res.status(201).json({
            message: 'Cover letter file uploaded and parsed.',
            coverLetter: {
                _id: cl._id,
                displayName: cl.displayName,
                language: cl.language,
                coverLetterText: cl.coverLetterText,
                filename: cl.filename,
                createdAt: cl.createdAt,
            },
        });
    })
);

// ---------------------------------------------------------------------------
// PUT /api/cover-letter-bases/:id
// Update a base cover letter's text/name
// ---------------------------------------------------------------------------
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) throw new ValidationError('Invalid ID.');

    const cl = await CoverLetter.findOne({ _id: id, userId, jobApplicationId: null });
    if (!cl) throw new NotFoundError('Base cover letter not found.');

    const { displayName, coverLetterText, language, emailSubject, emailBody, emailRecipient } = req.body;

    if (displayName !== undefined) cl.displayName = String(displayName).trim();
    if (coverLetterText !== undefined) cl.coverLetterText = String(coverLetterText);
    if (language === 'en' || language === 'de') cl.language = language;
    if (emailSubject !== undefined) cl.emailSubject = emailSubject || null;
    if (emailBody !== undefined) cl.emailBody = emailBody || null;
    if (emailRecipient !== undefined) cl.emailRecipient = emailRecipient || null;

    await cl.save();

    res.json({
        message: 'Cover letter updated.',
        coverLetter: {
            _id: cl._id,
            displayName: cl.displayName,
            language: cl.language,
            coverLetterText: cl.coverLetterText,
            updatedAt: cl.updatedAt,
        },
    });
}));

// ---------------------------------------------------------------------------
// DELETE /api/cover-letter-bases/:id
// Delete a base cover letter. Job-specific CLs are NOT affected.
// ---------------------------------------------------------------------------
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) throw new ValidationError('Invalid ID.');

    const cl = await CoverLetter.findOne({ _id: id, userId, jobApplicationId: null });
    if (!cl) throw new NotFoundError('Base cover letter not found.');

    await CoverLetter.deleteOne({ _id: id });

    res.json({ message: 'Base cover letter deleted.', deletedId: id });
}));

// ---------------------------------------------------------------------------
// GET /api/cover-letter-bases/job/:jobId
// Get the job-specific CoverLetter document (independent copy) for a job
// ---------------------------------------------------------------------------
router.get('/job/:jobId', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const { jobId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(jobId)) throw new ValidationError('Invalid job ID.');

    const job = await JobApplication.findOne({ _id: jobId, userId });
    if (!job) throw new NotFoundError('Job application not found.');

    const cl = await CoverLetter.findOne({ jobApplicationId: jobId });

    res.json({
        coverLetter: cl
            ? {
                _id: cl._id,
                displayName: cl.displayName,
                language: cl.language,
                coverLetterText: cl.coverLetterText,
                filename: cl.filename,
                fileMimeType: cl.fileMimeType,
                hasFile: !!cl.filename,
                emailSubject: cl.emailSubject,
                emailBody: cl.emailBody,
                emailRecipient: cl.emailRecipient,
                createdAt: cl.createdAt,
                updatedAt: cl.updatedAt,
            }
            : null,
        message: cl ? undefined : 'No dedicated cover letter document for this job.',
    });
}));

// ---------------------------------------------------------------------------
// POST /api/cover-letter-bases/job/:jobId/from-base/:clId
// Copy a base cover letter to a job as a fully independent document.
// Also syncs the text to JobApplication.draftCoverLetterText.
// ---------------------------------------------------------------------------
router.post('/job/:jobId/from-base/:clId', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const { jobId, clId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(jobId)) throw new ValidationError('Invalid job ID.');
    if (!mongoose.Types.ObjectId.isValid(clId)) throw new ValidationError('Invalid cover letter ID.');

    const [job, baseCl] = await Promise.all([
        JobApplication.findOne({ _id: jobId, userId }),
        // Include fileBuffer so we can deep-copy it
        CoverLetter.findOne({ _id: clId, userId, jobApplicationId: null }).select('+fileBuffer'),
    ]);

    if (!job) throw new NotFoundError('Job application not found.');
    if (!baseCl) throw new NotFoundError('Base cover letter not found.');

    // Remove any existing job-specific CL for this job (replace it)
    await CoverLetter.deleteOne({ jobApplicationId: jobId });

    // Deep-copy the base CL as an independent job document
    const jobCl = await CoverLetter.create({
        userId,
        displayName: `${baseCl.displayName} – ${job.jobTitle} at ${job.companyName}`,
        coverLetterText: baseCl.coverLetterText,      // isolated copy of text
        language: baseCl.language,
        jobApplicationId: new mongoose.Types.ObjectId(jobId),
        filename: baseCl.filename,
        // Deep-copy binary if available so job CL is 100% independent
        fileBuffer: baseCl.fileBuffer ? Buffer.from(baseCl.fileBuffer) : null,
        fileMimeType: baseCl.fileMimeType,
        emailSubject: baseCl.emailSubject,
        emailBody: baseCl.emailBody,
        emailRecipient: baseCl.emailRecipient,
    });

    // Sync text into JobApplication so the existing editor works
    await JobApplication.updateOne({ _id: jobId }, {
        $set: {
            draftCoverLetterText: baseCl.coverLetterText,
            coverLetterFileName: baseCl.filename || null,
            coverLetterEmailSubject: baseCl.emailSubject || null,
            coverLetterEmailBody: baseCl.emailBody || null,
            coverLetterEmailRecipient: baseCl.emailRecipient || null,
        },
    });

    res.status(201).json({
        message: 'Base cover letter copied to job as independent document.',
        coverLetter: {
            _id: jobCl._id,
            displayName: jobCl.displayName,
            language: jobCl.language,
            coverLetterText: jobCl.coverLetterText,
            emailSubject: jobCl.emailSubject,
            emailBody: jobCl.emailBody,
            createdAt: jobCl.createdAt,
        },
    });
}));

// ---------------------------------------------------------------------------
// POST /api/cover-letter-bases/job/:jobId/upload
// Upload a PDF/DOCX cover letter file directly for a job.
// Stores binary + text as an independent job CL document.
// ---------------------------------------------------------------------------
router.post(
    '/job/:jobId/upload',
    upload.single('clFile'),
    asyncHandler(async (req: Request, res: Response) => {
        const userId = String(req.user!._id);
        const { jobId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(jobId)) throw new ValidationError('Invalid job ID.');
        if (!req.file) throw new ValidationError('No file uploaded.');

        const job = await JobApplication.findOne({ _id: jobId, userId });
        if (!job) throw new NotFoundError('Job application not found.');

        const extractedText = await extractTextFromClFile(req.file, userId);

        // Remove existing job CL if any
        await CoverLetter.deleteOne({ jobApplicationId: jobId });

        const jobCl = await CoverLetter.create({
            userId,
            displayName: req.file.originalname,
            coverLetterText: extractedText,
            language: (req.body.language === 'de') ? 'de' : 'en',
            jobApplicationId: new mongoose.Types.ObjectId(jobId),
            filename: req.file.originalname,
            fileBuffer: req.file.buffer, // Store binary for full isolation
            fileMimeType: req.file.mimetype,
        });

        // Sync extracted text to JobApplication editor field
        await JobApplication.updateOne({ _id: jobId }, {
            $set: { draftCoverLetterText: extractedText },
        });

        res.status(201).json({
            message: 'Cover letter file uploaded for job.',
            coverLetter: {
                _id: jobCl._id,
                displayName: jobCl.displayName,
                language: jobCl.language,
                coverLetterText: jobCl.coverLetterText,
                filename: jobCl.filename,
                createdAt: jobCl.createdAt,
            },
        });
    })
);

// ---------------------------------------------------------------------------
// POST /api/cover-letter-bases/job/:jobId/save-current
// Snapshot the job's current draftCoverLetterText into a CoverLetter document.
// Creates/updates the job-specific CL record for isolation tracking.
// ---------------------------------------------------------------------------
router.post('/job/:jobId/save-current', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!._id;
    const { jobId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(jobId)) throw new ValidationError('Invalid job ID.');

    const job = await JobApplication.findOne({ _id: jobId, userId });
    if (!job) throw new NotFoundError('Job application not found.');

    if (!job.draftCoverLetterText) {
        throw new ValidationError('No cover letter text to save. Generate a cover letter first.');
    }

    // Upsert: replace existing job CL if present
    await CoverLetter.deleteOne({ jobApplicationId: jobId });

    const jobCl = await CoverLetter.create({
        userId,
        displayName: `Cover Letter – ${job.jobTitle} at ${job.companyName}`,
        coverLetterText: job.draftCoverLetterText,
        language: (job.language === 'de') ? 'de' : 'en',
        jobApplicationId: new mongoose.Types.ObjectId(jobId),
        emailSubject: job.coverLetterEmailSubject || null,
        emailBody: job.coverLetterEmailBody || null,
        emailRecipient: job.coverLetterEmailRecipient || null,
    });

    res.status(201).json({
        message: 'Cover letter snapshot saved for job.',
        coverLetter: {
            _id: jobCl._id,
            displayName: jobCl.displayName,
            coverLetterText: jobCl.coverLetterText,
            createdAt: jobCl.createdAt,
        },
    });
}));

export default router;
