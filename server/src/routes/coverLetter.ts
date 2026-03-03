// server/src/routes/coverLetter.ts
import express, { Router, Request, Response, RequestHandler } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import JobApplication from '../models/JobApplication';
import User, { IUser } from '../models/User';
import CV from '../models/CV';
import Profile from '../models/Profile';
import { generateCoverLetter, CoverLetterResponse } from '../services/coverLetterService';
import { JsonResumeSchema } from '../types/jsonresume';
import mongoose from 'mongoose';
import { usageLimiter } from '../middleware/usageLimiter';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse') as (buffer: Buffer, options?: object) => Promise<{ text: string }>;

/**
 * Extract plain text from a PDF buffer using pdf-parse.
 */
async function extractTextFromPdf(buffer: Buffer): Promise<string> {
    const data = await pdfParse(buffer);
    return data.text.trim();
}

const router: Router = express.Router();
router.use(authMiddleware as RequestHandler); // Apply auth to all routes in this file

// Define an interface for the expected user object structure
interface AuthenticatedUser {
    _id: mongoose.Types.ObjectId | string;
}

/**
 * POST /api/cover-letter/:jobId
 * Generate a cover letter for a specific job application
 * Returns structured data including email subject, body, and filename
 */
const generateCoverLetterHandler: RequestHandler = async (req, res) => {
    const user = req.user as AuthenticatedUser;
    if (!user) {
        res.status(401).json({ message: 'User not authenticated correctly.' });
        return;
    }

    const { jobId } = req.params;
    const requestedLanguage = req.body.language === 'de' ? 'de' : 'en';
    const userId = user._id.toString();

    try {
        // 1. Fetch Job Application
        const job = await JobApplication.findOne({ _id: jobId, userId: userId });
        if (!job) {
            res.status(404).json({ message: 'Job application not found or access denied.' });
            return;
        }

        if (!job.jobDescriptionText) {
            res.status(400).json({ message: 'Job description text is missing. Please scrape the job description first.' });
            return;
        }

        // 2. Fetch User's Base CV (or use override)
        const currentUser = await User.findById(userId);
        if (!currentUser) {
            res.status(404).json({ message: 'User not found.' });
            return;
        }

        let baseCvJson: JsonResumeSchema | null = null;

        if (req.body.baseCvData) {
            console.log(`Using overridden Base CV data for cover letter (Job: ${jobId})`);
            baseCvJson = req.body.baseCvData;
        } else {
            // Fetch Base CV from Unified CV Model
            const masterCv = await CV.findOne({ userId, isMasterCv: true });
            if (masterCv && masterCv.cvJson) {
                baseCvJson = masterCv.cvJson;
            }
        }

        let rawCvText: string | undefined;

        if (!baseCvJson?.basics) {
            // Try to extract plain text from a stored raw PDF (job CV or master CV)
            let pdfBuffer: Buffer | null = null;

            // Check job-specific CV first
            const jobCv = await CV.findOne({ jobApplicationId: jobId, userId }).select('+originalPdf');
            if (jobCv?.originalPdf) {
                pdfBuffer = Buffer.from(jobCv.originalPdf as Buffer);
            }

            // Fall back to master CV's original PDF
            if (!pdfBuffer) {
                const masterCvWithPdf = await CV.findOne({ userId, isMasterCv: true }).select('+originalPdf');
                if (masterCvWithPdf?.originalPdf) {
                    pdfBuffer = Buffer.from(masterCvWithPdf.originalPdf as Buffer);
                }
            }

            if (!pdfBuffer) {
                res.status(400).json({ message: 'Valid base CV with basics section not found. Please create a CV first or provide base CV data.' });
                return;
            }

            try {
                rawCvText = await extractTextFromPdf(pdfBuffer);
                console.log(`Extracted ${rawCvText.length} chars of plain text from stored PDF for cover letter (Job: ${jobId})`);
            } catch (pdfErr) {
                console.error('Failed to extract text from stored PDF:', pdfErr);
                res.status(400).json({ message: 'Could not extract text from the attached PDF. Please attach a text-based (non-scanned) PDF or create a structured CV.' });
                return;
            }

            // Use null cvJson — the service will use rawCvText instead
            baseCvJson = null;
        }

        // 3. Fetch Custom Prompt (if any)
        const profile = await Profile.findOne({ userId: userId });
        const customPrompt = profile?.customPrompts?.coverLetterPrompt;

        // 4. Generate Cover Letter with structured response
        console.log(`Generating cover letter for job ${jobId}...`);
        const coverLetterData: CoverLetterResponse = await generateCoverLetter(
            userId,
            baseCvJson,
            job.jobDescriptionText,
            job.jobTitle,
            job.companyName,
            requestedLanguage,
            customPrompt,
            rawCvText
        );

        // 5. Update Job with all cover letter data
        await JobApplication.updateOne({ _id: jobId, userId: userId }, {
            $set: {
                draftCoverLetterText: coverLetterData.coverLetterText,
                coverLetterFileName: coverLetterData.fileName,
                coverLetterEmailSubject: coverLetterData.emailSubject,
                coverLetterEmailBody: coverLetterData.emailBody,
                coverLetterEmailRecipient: coverLetterData.emailRecipient || null,
                suggestedCoverLetterFilename: coverLetterData.fileName // Keep for backward compatibility
            }
        });

        // 6. Return the structured cover letter data
        res.status(200).json({
            success: true,
            coverLetterText: coverLetterData.coverLetterText,
            fileName: coverLetterData.fileName,
            emailSubject: coverLetterData.emailSubject,
            emailBody: coverLetterData.emailBody,
            emailRecipient: coverLetterData.emailRecipient,
            // Keep for backward compatibility
            suggestedFilename: coverLetterData.fileName,
            language: requestedLanguage
        });

    } catch (error: any) {
        console.error(`Error generating cover letter for job ${jobId}:`, error);

        let statusCode = 500;
        let errorMessage = 'Failed to generate cover letter.';

        if (error.message) {
            if (error.message.includes('not found') || error.message.includes('access denied')) {
                statusCode = 404;
            } else if (error.message.includes('missing') || error.message.includes('not found')) {
                statusCode = 400;
            } else if (error.message.includes('Gemini API Error') || error.message.includes('AI content generation')) {
                statusCode = 502; // Bad Gateway - upstream error
            }
            errorMessage = error.message;
        }

        res.status(statusCode).json({
            success: false,
            message: errorMessage,
            error: error.message
        });
    }
};

// Route definition
router.post('/:jobId', usageLimiter('coverLetter'), generateCoverLetterHandler);

export default router;
