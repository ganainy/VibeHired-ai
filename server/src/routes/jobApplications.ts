// server/src/routes/jobApplications.ts
import express, { Router, Request, Response, RequestHandler } from 'express';
import JobApplication from '../models/JobApplication';
import CV from '../models/CV';
import authMiddleware from '../middleware/authMiddleware'; // Import the middleware
import { ScraperService } from '../services/scraperService';
import { extractJobDataFromUrl, extractJobDataFromText, ExtractedJobData } from '../utils/aiExtractor';
import mongoose from 'mongoose'; // Import mongoose for ObjectId type
import { JsonResumeSchema } from '../types/jsonresume'; // Import if needed for validation
import { validateRequest, ValidatedRequest } from '../middleware/validateRequest';
import { getJobRecommendation } from '../services/jobRecommendationService';
import {
  createJobBodySchema,
  updateJobBodySchema,
  scrapeJobBodySchema,
  createJobFromUrlBodySchema,
  createJobFromTextBodySchema,
  updateDraftBodySchema,
  checkDuplicateQuerySchema,
} from '../validations/jobApplicationSchemas';
import { objectIdParamSchema, jobIdParamSchema, filenameParamSchema } from '../validations/commonSchemas';

const router: Router = express.Router();

/**
 * Helper: After a job is saved, fire-and-forget an independent CV copy from the base CV.
 * This ensures each job always has its own isolated CV document in the CV collection.
 */
async function autoCreateJobCvCopy(
    userId: string,
    jobId: string,
    baseCvId: string
): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(baseCvId)) return;

    // Load source CV (including original binary)
    const sourceCv = await CV.findOne({ _id: baseCvId, userId }).select('+originalPdf');
    if (!sourceCv) {
        // Fall back to most recent base CV if the specified base is not found
        const fallbackCv = await CV.findOne({ userId, jobApplicationId: null }).sort({ createdAt: -1 }).select('+originalPdf');
        if (!fallbackCv) return;
        await CV.create({
            userId,
            isMasterCv: false,
            isPrimary: false,
            displayName: `Job CV (auto-copy)`,
            jobApplicationId: new mongoose.Types.ObjectId(jobId),
            cvJson: JSON.parse(JSON.stringify(fallbackCv.cvJson)),
            originalPdf: (fallbackCv as any).originalPdf ? Buffer.from((fallbackCv as any).originalPdf) : null,
            filename: fallbackCv.filename,
            templateId: fallbackCv.templateId || null,
        });
        return;
    }

    await CV.create({
        userId,
        isMasterCv: false,
        isPrimary: false,
        displayName: `Job CV (copy of ${sourceCv.displayName})`,
        jobApplicationId: new mongoose.Types.ObjectId(jobId),
        // Deep-copy JSON so edits to the base CV won't affect this copy
        cvJson: JSON.parse(JSON.stringify(sourceCv.cvJson)),
        // Deep-copy binary so the file is fully independent
        originalPdf: (sourceCv as any).originalPdf ? Buffer.from((sourceCv as any).originalPdf) : null,
        filename: sourceCv.filename,
        templateId: sourceCv.templateId || null,
    });
}

// --- Apply authMiddleware to all routes defined AFTER this line ---
// Explicitly cast to RequestHandler to potentially resolve type inference issues
router.use(authMiddleware as RequestHandler);

// --- Routes are now protected ---

// GET /api/jobs - Retrieve job applications FOR THE LOGGED-IN USER
const getJobsHandler: RequestHandler = async (req, res) => {
  try {
    // req.user should be populated by authMiddleware
    if (!req.user) {
      // Should theoretically not be reached if middleware runs correctly, but good safeguard
      res.status(401).json({ message: 'User not authenticated correctly.' });
      return;
    }
    const userId = req.user._id; // Get user ID from the authenticated user
    // Only show jobs that should be displayed in dashboard
    const jobs = await JobApplication.find({
      userId: userId,
      showInDashboard: true
    }).sort({ createdAt: -1 });
    res.status(200).json(jobs);
  } catch (error) {
    console.error("Error fetching jobs:", error);
    // Avoid sending detailed error object to client in production
    res.status(500).json({ message: 'Error fetching job applications' });
  }
};
router.get('/', getJobsHandler);

// POST /api/jobs - Create a new job application FOR THE LOGGED-IN USER
const createJobHandler: RequestHandler = async (req: ValidatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'User not authenticated correctly.' });
    return;
  }
  const { jobTitle, companyName, status, jobUrl, notes, jobDescriptionText, salary, contact, contactEmail, contactPhone, hiringManagerName, applicationUrl, language, baseCvId, createdAt } = req.validated!.body!;

  try {
    const jobData: any = {
      userId: req.user._id, // Assign the user ID from the request
      jobTitle,
      companyName,
      status: status || 'Not Applied',
      jobUrl,
      notes,
      salary,
      contact,
      contactEmail,
      contactPhone,
      hiringManagerName,
      applicationUrl,
      language,
      jobDescriptionText, // Pass scraped text if provided
      baseCvId: baseCvId || null, // Store the base CV ID if provided
      isAutoJob: false, // Manual job
      showInDashboard: true // Manual jobs always show in dashboard
    };

    // Allow setting custom createdAt date
    if (createdAt) {
      jobData.createdAt = new Date(createdAt);
    }

    const newJob = new JobApplication(jobData);

    const savedJob = await newJob.save();

    // Auto-create an independent job CV copy from the selected base CV (fire-and-forget)
    if (baseCvId && mongoose.Types.ObjectId.isValid(baseCvId)) {
      autoCreateJobCvCopy(
        (req.user._id as mongoose.Types.ObjectId).toString(),
        (savedJob._id as mongoose.Types.ObjectId).toString(),
        baseCvId
      ).catch(err => console.error(`Failed to auto-create job CV for job ${savedJob._id}:`, err));
    }

    if (savedJob.jobDescriptionText && savedJob.jobDescriptionText.trim().length > 0) {
      const userId = req.user._id as mongoose.Types.ObjectId;
      const jobId = savedJob._id as mongoose.Types.ObjectId;
      getJobRecommendation(userId, jobId, true).catch(error => {
        console.error(`Failed to generate recommendation for new job ${jobId}:`, error);
      });
    }

    res.status(201).json(savedJob);
  } catch (error) {
    console.error("Error creating job:", error);
    if (error instanceof Error && error.name === 'ValidationError') {
      // Consider sending specific validation errors if needed for frontend
      res.status(400).json({ message: 'Validation failed', errors: error.message }); // Send message
      return;
    }
    res.status(500).json({ message: 'Error creating job application' });
  }
};
router.post('/', validateRequest({ body: createJobBodySchema }), createJobHandler);

// GET /api/jobs/:id - Retrieve a single job application (ensure it belongs to user)
// --- Get All Job Recommendations Endpoint ---
// GET /api/job-applications/recommendations
const getAllJobRecommendationsHandler: RequestHandler = async (req, res) => {
  const user = req.user as { _id: mongoose.Types.ObjectId | string };
  if (!user) {
    res.status(401).json({ message: 'User not authenticated correctly.' });
    return;
  }

  const userId = user._id;

  try {
    const { getAllJobRecommendations } = await import('../services/jobRecommendationService');
    const recommendations = await getAllJobRecommendations(userId);

    res.status(200).json(recommendations);
  } catch (error: any) {
    console.error(`Error fetching all recommendations for user ${userId}:`, error);
    res.status(500).json({
      message: 'Server error fetching recommendations.',
      error: error.message || 'Unknown error'
    });
  }
};
router.get('/recommendations', getAllJobRecommendationsHandler);

// --- Regenerate All Job Recommendations Endpoint ---
// POST /api/job-applications/recommendations/regenerate
const regenerateAllRecommendationsHandler: RequestHandler = async (req, res) => {
  const user = req.user as { _id: mongoose.Types.ObjectId | string };
  if (!user) {
    res.status(401).json({ message: 'User not authenticated correctly.' });
    return;
  }

  const userId = user._id;

  try {
    const { regenerateAllJobRecommendations } = await import('../services/jobRecommendationService');
    const recommendations = await regenerateAllJobRecommendations(userId);

    res.status(200).json(recommendations);
  } catch (error: any) {
    console.error(`Error regenerating all recommendations for user ${userId}:`, error);
    res.status(500).json({
      message: 'Server error regenerating recommendations.',
      error: error.message || 'Unknown error'
    });
  }
};
router.post('/recommendations/regenerate', regenerateAllRecommendationsHandler);

// GET /api/jobs/:id - Retrieve a single job application (ensure it belongs to user)
const getJobByIdHandler: RequestHandler = async (req: ValidatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'User not authenticated correctly.' });
    return;
  }

  try {
    const job = await JobApplication.findOne({ _id: req.validated!.params!.id, userId: req.user._id }); // Filter by userId
    if (!job) {
      // Respond with 404 even if job exists but belongs to another user for security
      res.status(404).json({ message: 'Job application not found' });
      return;
    }
    res.status(200).json(job);
  } catch (error) {
    console.error("Error fetching job by id:", error);
    res.status(500).json({ message: 'Error fetching job application' });
  }
};
router.get('/:id', validateRequest({ params: objectIdParamSchema }), getJobByIdHandler);

// PUT /api/jobs/:id - Update a job application (ensure it belongs to user)
const updateJobHandler: RequestHandler = async (req: ValidatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'User not authenticated correctly.' });
    return;
  }
  try {
    // Prepare update data
    const updateData: any = { ...req.validated!.body! };

    // Check if createdAt is being updated
    const isUpdatingCreatedAt = updateData.createdAt !== undefined;

    // Convert date strings to Date objects if present
    if (updateData.createdAt && typeof updateData.createdAt === 'string') {
      updateData.createdAt = new Date(updateData.createdAt);
    }
    if (updateData.dateApplied && typeof updateData.dateApplied === 'string') {
      updateData.dateApplied = new Date(updateData.dateApplied);
    }

    let updatedJob;

    if (isUpdatingCreatedAt) {
      // Use native MongoDB driver to bypass Mongoose's timestamp protection
      // Manually set updatedAt since we're bypassing Mongoose
      updateData.updatedAt = new Date();

      const result = await JobApplication.collection.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(req.validated!.params!.id), userId: req.user._id },
        { $set: updateData },
        { returnDocument: 'after' }
      );
      updatedJob = result ? await JobApplication.findById(req.validated!.params!.id) : null;
    } else {
      // Use normal Mongoose update for other fields
      updatedJob = await JobApplication.findOneAndUpdate(
        { _id: req.validated!.params!.id, userId: req.user._id },
        { $set: updateData },
        { new: true, runValidators: true }
      );
    }

    if (!updatedJob) {
      res.status(404).json({ message: 'Job application not found or not authorized to update' });
      return;
    }
    res.status(200).json(updatedJob);
  } catch (error) {
    console.error("Error updating job:", error);
    if (error instanceof Error && error.name === 'ValidationError') {
      res.status(400).json({ message: 'Validation failed', errors: error.message });
      return;
    }
    if (error instanceof Error && error.name === 'CastError') {
      res.status(400).json({ message: 'Invalid job ID format' });
      return;
    }
    res.status(500).json({ message: 'Error updating job application' });
  }
};
router.put('/:id', validateRequest({ params: objectIdParamSchema, body: updateJobBodySchema }), updateJobHandler);

// DELETE /api/jobs/:id - Delete a job application (ensure it belongs to user)
const deleteJobHandler: RequestHandler = async (req: ValidatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'User not authenticated correctly.' });
    return;
  }
  try {
    const deletedJob = await JobApplication.findOneAndDelete({ _id: req.validated!.params!.id, userId: req.user._id }); // Find by ID and userId
    if (!deletedJob) {
      res.status(404).json({ message: 'Job application not found or not authorized to delete' });
      return;
    }

    res.status(200).json({ message: 'Job application deleted successfully', id: deletedJob._id });

  } catch (error) {
    console.error("Error deleting job:", error);
    if (error instanceof Error && error.name === 'CastError') {
      res.status(400).json({ message: 'Invalid job ID format' });
      return;
    }
    res.status(500).json({ message: 'Error deleting job application' });
  }
};
router.delete('/:id', validateRequest({ params: objectIdParamSchema }), deleteJobHandler);


// ---  Scrape Job Description Endpoint ---
// PATCH /api/jobs/:id/scrape - Using PATCH as we're partially updating
const scrapeJobHandler: RequestHandler = async (req: ValidatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'User not authenticated correctly.' });
    return;
  }
  const { id: jobId } = req.validated!.params!; // Get jobId from validated params
  const userId = req.user._id as mongoose.Types.ObjectId; // Keep as ObjectId for DB operations
  const userIdString = userId.toString(); // Convert to string for function calls
  let jobUrlToScrape = req.validated!.body?.url; // Optionally allow passing URL in body

  try {
    // 1. Find the job application
    const job = await JobApplication.findOne({ _id: jobId, userId: userId });
    if (!job) {
      res.status(404).json({ message: 'Job application not found or access denied.' });
      return;
    }

    // 2. Determine URL to scrape (use stored URL if not provided in body)
    if (!jobUrlToScrape) {
      jobUrlToScrape = job.jobUrl;
    }
    if (!jobUrlToScrape) {
      res.status(400).json({ message: 'No Job URL found for this application to scrape.' });
      return;
    }

    // Optional: Validate if the provided URL matches the stored one if both exist?

    // 3. Call the scraper service
    console.log(`Attempting to scrape description for job ${jobId} from URL: ${jobUrlToScrape}`);
    const scraper = ScraperService.getJobDescriptionScraper();
    const extractedText = await scraper.scrapeJobDescription(jobUrlToScrape, userIdString); // This can throw errors

    // 4. Update the job application in the database
    const updatedJob = await JobApplication.findOneAndUpdate(
      { _id: jobId, userId: userId },
      { $set: { jobDescriptionText: extractedText, jobUrl: jobUrlToScrape } }, // Update description AND URL (if passed in body)
      { new: true, runValidators: true }
    );

    if (!updatedJob) {
      // Should not happen if findOne worked, but good safeguard
      res.status(404).json({ message: 'Job application could not be updated after scraping.' });
      return;
    }

    console.log(`Successfully scraped and updated job description for job ${jobId}`);
    res.status(200).json({
      message: 'Job description scraped and updated successfully.',
      job: updatedJob // Send back the updated job object
    });

  } catch (error: any) {
    console.error(`Scraping failed for job ${jobId}:`, error);
    // Send back specific error message from scraper or generic one
    res.status(500).json({
      message: 'Failed to scrape job description.',
      error: error.message || 'Unknown scraping error.'
    });
  }
};
router.patch('/:id/scrape', validateRequest({ params: objectIdParamSchema, body: scrapeJobBodySchema }), scrapeJobHandler);


// ---  Extract Job Data from Text for Existing Job Endpoint ---
// PATCH /api/jobs/:id/extract-from-text
const extractFromTextHandler: RequestHandler = async (req: ValidatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'User not authenticated.' });
    return;
  }
  const { id: jobId } = req.validated!.params!;
  const { text } = req.validated!.body!; // Expect text in the validated request body

  const userId = req.user._id as mongoose.Types.ObjectId;
  const userIdString = userId.toString();

  try {
    // 1. Verify the job exists and belongs to the user
    const existingJob = await JobApplication.findOne({ _id: jobId, userId: userId });
    if (!existingJob) {
      res.status(404).json({ message: 'Job application not found or access denied.' });
      return;
    }

    console.log(`Extracting job data from text for job ${jobId} (length: ${text.length})`);

    // 2. Call the AI extractor for text
    const extractedData: ExtractedJobData = await extractJobDataFromText(text, userIdString);

    // 3. Update the existing job with extracted data
    const existingExtractedData = existingJob.extractedData as any || {};
    const updateData: any = {
      jobDescriptionText: extractedData.jobDescriptionText,
      language: extractedData.language,
      jobPrerequisites: extractedData.jobPrerequisites || undefined,
      jobType: extractedData.jobType || undefined, // Include AI-extracted job type
      // Contact information from AI extraction
      contactEmail: extractedData.contactEmail || undefined,
      contactPhone: extractedData.contactPhone || undefined,
      hiringManagerName: extractedData.hiringManagerName || undefined,
      applicationUrl: extractedData.applicationUrl || undefined,
      extractedData: {
        ...existingExtractedData,
        location: extractedData.location || existingExtractedData.location,
        salaryRaw: extractedData.salary || existingExtractedData.salaryRaw,
        keyDetails: extractedData.keyDetails || existingExtractedData.keyDetails
      }
    };

    // Only update job title and company if they were successfully extracted
    // and are different from existing values (allow AI to fill in blanks)
    if (extractedData.jobTitle && extractedData.jobTitle !== 'Unknown Position') {
      updateData.jobTitle = extractedData.jobTitle;
    }
    if (extractedData.companyName && extractedData.companyName !== 'Unknown Company') {
      updateData.companyName = extractedData.companyName;
    }
    if (extractedData.notes) {
      updateData.notes = existingJob.notes
        ? `${existingJob.notes}\n\n${extractedData.notes}`
        : extractedData.notes;
    }

    const updatedJob = await JobApplication.findOneAndUpdate(
      { _id: jobId, userId: userId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedJob) {
      res.status(404).json({ message: 'Job application could not be updated.' });
      return;
    }

    console.log(`Successfully extracted and updated job data for job ${jobId}`);

    // 4. Trigger recommendation generation in background
    if (updatedJob.jobDescriptionText && updatedJob.jobDescriptionText.trim().length > 0) {
      getJobRecommendation(userId, updatedJob._id as mongoose.Types.ObjectId, true).catch(error => {
        console.error(`Failed to generate recommendation for job ${jobId}:`, error);
      });
    }

    res.status(200).json(updatedJob);

  } catch (error: any) {
    console.error(`Failed to extract job data for job ${jobId}:`, error);

    if (error?.statusCode && error?.isOperational) {
      res.status(error.statusCode).json({
        message: error.message || 'Failed to extract job data from text.'
      });
      return;
    }

    res.status(500).json({
      message: error?.message || 'Failed to extract job data from text. Unknown server error.'
    });
  }
};
router.patch('/:id/extract-from-text', validateRequest({ params: objectIdParamSchema, body: createJobFromTextBodySchema }), extractFromTextHandler);


// POST /api/jobs/create-from-url
const createJobFromUrlHandler: RequestHandler = async (req: ValidatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'User not authenticated.' });
    return;
  }
  const { url } = req.validated!.body!; // Expect URL in the validated request body

  const userId = req.user._id as mongoose.Types.ObjectId; // Keep as ObjectId for DB operations
  const userIdString = userId.toString(); // Convert to string for function calls

  try {
    console.log(`Attempting to create job from URL for user ${userIdString}: ${url}`);
    // 1. Call the AI extractor utility
    const extractedData: ExtractedJobData = await extractJobDataFromUrl(url, userIdString);

    // 2. Create a new JobApplication document
    // Note: We trust the extractor threw an error if essential fields were null

    const newJob = new JobApplication({
      userId: userId,
      jobTitle: extractedData.jobTitle,
      companyName: extractedData.companyName,
      jobDescriptionText: extractedData.jobDescriptionText,
      language: extractedData.language,
      jobPrerequisites: extractedData.jobPrerequisites || undefined,
      notes: extractedData.notes || '',
      jobUrl: url, // Save the original URL
      status: 'Not Applied', // Default status
      // Contact information from AI extraction
      contactEmail: extractedData.contactEmail || undefined,
      contactPhone: extractedData.contactPhone || undefined,
      hiringManagerName: extractedData.hiringManagerName || undefined,
      applicationUrl: extractedData.applicationUrl || undefined,
      isAutoJob: false, // Manual job
      showInDashboard: true, // Manual jobs always show in dashboard
      extractedData: {
        location: extractedData.location || undefined,
        salaryRaw: extractedData.salary || undefined,
        keyDetails: extractedData.keyDetails || undefined
      }
    });

    // 3. Save the document
    const savedJob = await newJob.save();
    console.log(`Successfully created job ${savedJob._id} from URL ${url}`);

    if (savedJob.jobDescriptionText && savedJob.jobDescriptionText.trim().length > 0) {
      const jobId = savedJob._id as mongoose.Types.ObjectId;
      getJobRecommendation(userId, jobId, true).catch(error => {
        console.error(`Failed to generate recommendation for new job ${jobId}:`, error);
      });
    }

    // 4. Return the created job
    res.status(201).json(savedJob);

  } catch (error: any) {
    console.error(`Failed to create job from URL ${url}:`, error);

    // Preserve the original error message and status code if it's an AppError
    if (error?.statusCode && error?.isOperational) {
      res.status(error.statusCode).json({
        message: error.message || 'Failed to create job from URL.'
      });
      return;
    }

    // For other errors, provide more specific feedback
    res.status(500).json({
      message: error?.message || 'Failed to create job from URL. Unknown server error during URL processing.'
    });
  }
};
router.post('/create-from-url', validateRequest({ body: createJobFromUrlBodySchema }), createJobFromUrlHandler); // Add the new route


// ---  Create Job From Text Endpoint ---
// POST /api/jobs/create-from-text
const createJobFromTextHandler: RequestHandler = async (req: ValidatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'User not authenticated.' });
    return;
  }
  const { text, baseCvId, jobUrl, status, jobType } = req.validated!.body!; // Extract all fields from request body

  const userId = req.user._id as mongoose.Types.ObjectId;
  const userIdString = userId.toString();

  try {
    console.log(`Attempting to create job from pasted text for user ${userIdString} (length: ${text.length})`);
    // 1. Call the AI extractor for text
    const extractedData: ExtractedJobData = await extractJobDataFromText(text, userIdString);

    // 1b. Duplicate check by company+title (unless force=true)
    const force = req.validated!.body!.force;
    if (!force && extractedData.companyName && extractedData.jobTitle) {
      // Normalize: lowercase, strip all non-alphanumeric chars, collapse spaces
      const normalize = (s: string) =>
        s.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').replace(/\s+/g, ' ').trim();

      // Word-overlap similarity: what fraction of words in `a` appear in `b`
      const wordOverlap = (a: string, b: string): number => {
        const wordsA = normalize(a).split(' ').filter(Boolean);
        const wordsB = new Set(normalize(b).split(' ').filter(Boolean));
        if (wordsA.length === 0) return 0;
        const matches = wordsA.filter(w => wordsB.has(w)).length;
        return matches / wordsA.length;
      };

      const extractedCompany = extractedData.companyName.trim();
      const extractedTitle   = extractedData.jobTitle.trim();

      // Escape for MongoDB regex (broad company-name fetch, refined in JS)
      const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const companyRegex = new RegExp(escapeRegex(extractedCompany), 'i');

      // Fetch candidates matching company first (broad), then filter by title in JS
      const candidates = await JobApplication.find({
        userId,
        showInDashboard: true,
        companyName: { $regex: companyRegex },
      }).select('_id jobTitle companyName status createdAt jobUrl').lean();

      // Require ≥70% word overlap on both company and title to call it a duplicate
      const existingByTitle = candidates.filter(job =>
        wordOverlap(extractedCompany, job.companyName) >= 0.7 &&
        wordOverlap(extractedTitle, job.jobTitle) >= 0.7
      );

      if (existingByTitle.length > 0) {
        res.status(409).json({
          code: 'DUPLICATE_JOB',
          message: `A job application for "${extractedData.jobTitle}" at "${extractedData.companyName}" already exists.`,
          duplicates: existingByTitle,
        });
        return;
      }
    }

    // 2. Create a new JobApplication document
    // Use provided values or AI-extracted values for jobType
    const finalJobType = jobType !== undefined ? jobType : extractedData.jobType;

    const newJob = new JobApplication({
      userId: userId,
      jobTitle: extractedData.jobTitle,
      companyName: extractedData.companyName,
      jobDescriptionText: extractedData.jobDescriptionText,
      language: extractedData.language,
      jobPrerequisites: extractedData.jobPrerequisites || undefined,
      notes: extractedData.notes || '',
      jobUrl: jobUrl || undefined, // Use provided job URL
      status: status || 'Not Applied', // Use provided status or default
      jobType: finalJobType, // Use provided or AI-extracted job type
      baseCvId: baseCvId || null, // Store the selected CV branch
      // Contact information from AI extraction
      contactEmail: extractedData.contactEmail || undefined,
      contactPhone: extractedData.contactPhone || undefined,
      hiringManagerName: extractedData.hiringManagerName || undefined,
      applicationUrl: extractedData.applicationUrl || undefined,
      isAutoJob: false,
      showInDashboard: true,
      extractedData: {
        location: extractedData.location || undefined,
        salaryRaw: extractedData.salary || undefined,
        keyDetails: extractedData.keyDetails || undefined
      }
    });

    // 3. Save the document
    const savedJob = await newJob.save();
    console.log(`Successfully created job ${savedJob._id} from pasted text`);

    // Auto-create an independent job CV copy from the selected base CV (fire-and-forget)
    if (baseCvId && mongoose.Types.ObjectId.isValid(String(baseCvId))) {
      autoCreateJobCvCopy(
        userIdString,
        (savedJob._id as mongoose.Types.ObjectId).toString(),
        String(baseCvId)
      ).catch(err => console.error(`Failed to auto-create job CV for job ${savedJob._id}:`, err));
    }

    if (savedJob.jobDescriptionText && savedJob.jobDescriptionText.trim().length > 0) {
      const jobId = savedJob._id as mongoose.Types.ObjectId;
      getJobRecommendation(userId, jobId, true).catch(error => {
        console.error(`Failed to generate recommendation for new job ${jobId}:`, error);
      });
    }

    // 4. Return the created job
    res.status(201).json(savedJob);

  } catch (error: any) {
    console.error(`Failed to create job from pasted text:`, error);

    // Preserve the original error message and status code if it's an AppError
    if (error?.statusCode && error?.isOperational) {
      res.status(error.statusCode).json({
        message: error.message || 'Failed to create job from text.'
      });
      return;
    }

    // For other errors, provide more specific feedback
    res.status(500).json({
      message: error?.message || 'Failed to create job from pasted text. Unknown server error.'
    });
  }
};
router.post('/create-from-text', validateRequest({ body: createJobFromTextBodySchema }), createJobFromTextHandler);


// --- Check for Duplicate Jobs ---
// GET /api/job-applications/check-duplicate?jobUrl=...&companyName=...&jobTitle=...
const checkDuplicateHandler: RequestHandler = async (req: ValidatedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'User not authenticated.' });
    return;
  }
  const userId = req.user._id;
  const { jobUrl, companyName, jobTitle } = req.query as { jobUrl?: string; companyName?: string; jobTitle?: string };

  try {
    const conditions: any[] = [];

    if (jobUrl && jobUrl.trim()) {
      const escaped = jobUrl.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      conditions.push({ jobUrl: { $regex: new RegExp(`^${escaped}$`, 'i') } });
    }
    if (companyName && jobTitle) {
      const escapedCompany = companyName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      conditions.push({
        companyName: { $regex: new RegExp(escapedCompany, 'i') },
        jobTitle: { $regex: new RegExp(jobTitle.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      });
    }

    if (conditions.length === 0) {
      res.status(200).json({ duplicates: [] });
      return;
    }

    const duplicates = await JobApplication.find({
      userId,
      showInDashboard: true,
      $or: conditions,
    }).select('_id jobTitle companyName status createdAt jobUrl').lean();

    res.status(200).json({ duplicates });
  } catch (error: any) {
    console.error('Error checking for duplicate jobs:', error);
    res.status(500).json({ message: 'Error checking for duplicate jobs.' });
  }
};
router.get('/check-duplicate', checkDuplicateHandler);


// ---  Get Draft Data Endpoint ---
// GET /api/jobs/:id/draft
const getJobDraftHandler: RequestHandler = async (req: ValidatedRequest, res) => {
  const user = req.user as { _id: mongoose.Types.ObjectId | string };
  if (!user) {
    res.status(401).json({ message: 'User not authenticated correctly.' });
    return;
  }

  const { id: jobId } = req.validated!.params!;
  const userId = user._id;

  try {
    // Find the job, ensure it belongs to the user, and select only the draft fields + status
    const job = await JobApplication.findOne(
      { _id: jobId, userId: userId },
      'draftCvJson draftCoverLetterText generationStatus companyName jobTitle'
    );

    if (!job) {
      res.status(404).json({ message: 'Job application not found or access denied.' });
      return;
    }

    res.status(200).json({
      jobId: job._id,
      jobTitle: job.jobTitle,
      companyName: job.companyName,
      generationStatus: job.generationStatus,
      draftCvJson: job.draftCvJson || null,
      draftCoverLetterText: job.draftCoverLetterText || null,
    });

  } catch (error: any) {
    console.error(`Error fetching draft data for job ${jobId}:`, error);
    res.status(500).json({ message: 'Server error fetching draft data.' });
  }
};
// Define the route AFTER the generic /:id GET route to avoid conflict
// Or ensure it's distinct enough. Putting it here should be fine.
router.get('/:id/draft', validateRequest({ params: objectIdParamSchema }), getJobDraftHandler);


// ---  Update Draft Data Endpoint ---
// PUT /api/jobs/:id/draft
const updateJobDraftHandler: RequestHandler = async (req: ValidatedRequest, res) => {
  const user = req.user as { _id: mongoose.Types.ObjectId | string };
  if (!user) {
    res.status(401).json({ message: 'User not authenticated.' });
    return;
  }

  const { id: jobId } = req.validated!.params!;
  const userId = user._id;
  const { draftCvJson, draftCoverLetterText } = req.validated!.body!;

  try {
    const updateData: any = {
      generationStatus: 'draft_ready'
    };
    if (draftCvJson !== undefined) {
      updateData.draftCvJson = draftCvJson;
    }
    if (draftCoverLetterText !== undefined) {
      updateData.draftCoverLetterText = draftCoverLetterText;
    }

    const updatedJob = await JobApplication.findOneAndUpdate(
      { _id: jobId, userId: userId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedJob) {
      res.status(404).json({ message: 'Job application not found or access denied.' });
      return;
    }

    res.status(200).json({
      message: 'Draft updated successfully.',
    });

  } catch (error: any) {
    console.error(`Error updating draft for job ${jobId}:`, error);
    res.status(500).json({ message: 'Server error updating draft data.' });
  }
};
// Add the new route
router.put('/:id/draft', validateRequest({ params: objectIdParamSchema, body: updateDraftBodySchema }), updateJobDraftHandler);


// --- Get Job Recommendation Endpoint ---
// GET /api/job-applications/:id/recommendation
const getJobRecommendationHandler: RequestHandler = async (req: ValidatedRequest, res) => {
  const user = req.user as { _id: mongoose.Types.ObjectId | string };
  if (!user) {
    res.status(401).json({ message: 'User not authenticated correctly.' });
    return;
  }

  const { id: jobId } = req.validated!.params!;
  const userId = user._id;
  const forceRefresh = req.query.forceRefresh === 'true';

  try {
    const recommendation = await getJobRecommendation(userId, jobId, forceRefresh);

    res.status(200).json(recommendation);
  } catch (error: any) {
    console.error(`Error fetching recommendation for job ${jobId}:`, error);
    res.status(500).json({
      message: 'Server error fetching recommendation.',
      error: error.message || 'Unknown error'
    });
  }
};
router.get('/:id/recommendation', validateRequest({ params: objectIdParamSchema }), getJobRecommendationHandler);


export default router; // Export the configured router