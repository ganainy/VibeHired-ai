import { Response } from 'express';
import { Types } from 'mongoose';
import CvAnalysis, { ICvAnalysis } from '../models/CvAnalysis';
import JobApplication, { IJobApplication } from '../models/JobApplication';
import CV from '../models/CV'; // Import Unified CV Model
import { performAtsAnalysis } from '../services/analysisService';
import { JsonResumeSchema } from '../types/jsonresume';
import { ValidatedRequest } from '../middleware/validateRequest';
import { NotFoundError, AuthorizationError, ValidationError } from '../utils/errors/AppError';

/**
 * Trigger ATS scan for current user's CV
 * POST /api/ats/scan
 */
export const scanAts = async (req: ValidatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new AuthorizationError('User not authenticated');
    }

    const { jobApplicationId, analysisId: providedAnalysisId, excludeSuggestions } = req.validated!.body!;
    let cvJson: JsonResumeSchema;

    // If jobApplicationId is provided, fetch job description and potentially the tailored CV
    let jobDescription: string | undefined;
    let jobApplicationObjectId: string | undefined;

    if (jobApplicationId) {
        const jobApplication: IJobApplication | null = await JobApplication.findOne({
            _id: jobApplicationId,
            userId: new Types.ObjectId(userId)
        });

        if (!jobApplication) {
            throw new NotFoundError('Job application not found');
        }

        jobDescription = jobApplication.jobDescriptionText;
        // Use Mongoose document's id getter (virtual property that returns _id as string)
        jobApplicationObjectId = jobApplication.id;

        if (!jobDescription) {
            throw new ValidationError('Job application does not have a job description. Please scrape the job description first.');
        }

        // Prefer tailored CV from Unified Model over master CV
        const jobCv = await CV.findOne({ jobApplicationId: jobApplicationObjectId, userId: new Types.ObjectId(userId) });

        if (jobCv && jobCv.cvJson && Object.keys(jobCv.cvJson).length > 0) {
            cvJson = jobCv.cvJson;
            console.log('[ATS] Using unified CV model (job specific) for ATS analysis');
        } else if (jobApplication.draftCvJson && Object.keys(jobApplication.draftCvJson).length > 0) {
            cvJson = jobApplication.draftCvJson as JsonResumeSchema;
            console.log('[ATS] Using legacy tailored CV (draftCvJson) for ATS analysis');
        } else {
            // Fallback to master CV if no tailored CV exists
            const masterCv = await CV.findOne({ userId: new Types.ObjectId(userId), isDefault: true });

            if (masterCv && masterCv.cvJson) {
                cvJson = masterCv.cvJson;
                console.log('[ATS] Using unified CV model (Master) for ATS analysis');
            } else {
                throw new ValidationError('No CV found. Please upload a CV or generate a tailored CV first.');
            }
        }
    } else {
        // No job application - use master CV
        const masterCv = await CV.findOne({ userId: new Types.ObjectId(userId), isDefault: true });

        if (masterCv && masterCv.cvJson) {
            cvJson = masterCv.cvJson;
            console.log('[ATS] Using unified CV model (Master) for general ATS analysis');
        } else {
            throw new ValidationError('No CV found. Please upload a CV first.');
        }
    }

    // If analysisId is provided, use existing analysis; otherwise create new one
    let analysis: ICvAnalysis;
    if (providedAnalysisId) {
        const foundAnalysis = await CvAnalysis.findById(providedAnalysisId);
        if (!foundAnalysis) {
            throw new NotFoundError('Analysis not found');
        }
        if (foundAnalysis.userId.toString() !== userId) {
            throw new AuthorizationError('Unauthorized access to analysis');
        }
        analysis = foundAnalysis;
    } else {
        // Create a new analysis document for ATS scores
        analysis = await CvAnalysis.create({
            userId: new Types.ObjectId(userId),
            status: 'pending',
            overallScore: 0,
            issueCount: 0,
            categoryScores: {},
            detailedResults: {}
        });
    }

    // Start ATS analysis in background
    // Convert _id to ObjectId - handle both ObjectId and string types
    const analysisObjectId = (analysis._id as any) instanceof Types.ObjectId
        ? (analysis._id as Types.ObjectId)
        : new Types.ObjectId(String(analysis._id));

    performAtsAnalysis(
        userId,
        cvJson,
        analysisObjectId,
        jobDescription,
        jobApplicationObjectId,
        excludeSuggestions
    ).catch(error => {
        console.error('Background ATS analysis failed:', error);
    });

    res.json({
        message: 'ATS analysis started',
        analysisId: String(analysis._id)
    });
};

/**
 * Trigger ATS scan for a specific analysis
 * POST /api/ats/scan/:analysisId
 */
export const scanAtsForAnalysis = async (req: ValidatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new AuthorizationError('User not authenticated');
    }

    const { analysisId } = req.validated!.params!;
    const { jobApplicationId } = req.validated!.body! || {};

    // Get the analysis
    const analysis = await CvAnalysis.findById(analysisId);
    if (!analysis) {
        throw new NotFoundError('Analysis not found');
    }

    if (analysis.userId.toString() !== userId) {
        throw new AuthorizationError('Unauthorized access to analysis');
    }

    // Initialize CV JSON variable - will be set based on data availability
    let cvJson: JsonResumeSchema;

    // If jobApplicationId is provided, fetch job description and potentially the tailored CV
    let jobDescription: string | undefined;
    let jobApplicationObjectId: string | undefined;

    if (jobApplicationId) {
        const jobApplication: IJobApplication | null = await JobApplication.findOne({
            _id: jobApplicationId,
            userId: new Types.ObjectId(userId)
        });

        if (!jobApplication) {
            throw new NotFoundError('Job application not found');
        }

        jobDescription = jobApplication.jobDescriptionText;
        // Use Mongoose document's id getter (virtual property that returns _id as string)
        jobApplicationObjectId = jobApplication.id;

        if (!jobDescription) {
            throw new ValidationError('Job application does not have a job description. Please scrape the job description first.');
        }

        // Prefer tailored CV from Unified Model over master CV
        const jobCv = await CV.findOne({ jobApplicationId: jobApplicationObjectId, userId: new Types.ObjectId(userId) });

        if (jobCv && jobCv.cvJson && Object.keys(jobCv.cvJson).length > 0) {
            cvJson = jobCv.cvJson;
            console.log('[ATS] Using unified CV model (job specific) for ATS analysis');
        } else if (jobApplication.draftCvJson && Object.keys(jobApplication.draftCvJson).length > 0) {
            cvJson = jobApplication.draftCvJson as JsonResumeSchema;
            console.log('[ATS] Using legacy tailored CV (draftCvJson) for ATS analysis');
        } else {
            // Fallback to master CV if no tailored CV exists
            const masterCv = await CV.findOne({ userId: new Types.ObjectId(userId), isDefault: true });

            if (masterCv && masterCv.cvJson) {
                cvJson = masterCv.cvJson;
                console.log('[ATS] Using unified CV model (Master) for ATS analysis');
            } else {
                throw new ValidationError('No CV found. Please upload a CV or generate a tailored CV first.');
            }
        }
    } else {
        // No job application - use master CV
        const masterCv = await CV.findOne({ userId: new Types.ObjectId(userId), isDefault: true });

        if (masterCv && masterCv.cvJson) {
            cvJson = masterCv.cvJson;
            console.log('[ATS] Using unified CV model (Master) for general ATS analysis');
        } else {
            throw new ValidationError('No CV found. Please upload a CV first.');
        }
    }

    // Start ATS analysis in background
    // Convert _id to ObjectId - handle both ObjectId and string types
    const analysisObjectId = (analysis._id as any) instanceof Types.ObjectId
        ? (analysis._id as Types.ObjectId)
        : new Types.ObjectId(String(analysis._id));

    performAtsAnalysis(
        userId,
        cvJson,
        analysisObjectId,
        jobDescription,
        jobApplicationObjectId
    ).catch(error => {
        console.error('Background ATS analysis failed:', error);
    });

    res.json({
        message: 'ATS analysis started',
        analysisId: String(analysis._id)
    });
};

/**
 * Get ATS scores for a specific analysis
 * GET /api/ats/scores/:analysisId
 */
export const getAtsScores = async (req: ValidatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new AuthorizationError('User not authenticated');
    }

    const { analysisId } = req.validated!.params!;

    const analysis: ICvAnalysis | null = await CvAnalysis.findById(analysisId);
    if (!analysis) {
        throw new NotFoundError('Analysis not found');
    }

    if (analysis.userId.toString() !== userId) {
        throw new AuthorizationError('Unauthorized access to analysis');
    }

    // Debug logging
    console.log(`[DEBUG] Fetching ATS scores for analysis ${analysisId}:`);
    console.log(`[DEBUG] - Has ATS scores: ${!!analysis.atsScores}`);
    if (analysis.atsScores) {
        console.log(`[DEBUG] - ATS scores (raw):`, analysis.atsScores);
        console.log(`[DEBUG] - ATS scores (JSON):`, JSON.stringify(analysis.atsScores, null, 2));
        console.log(`[DEBUG] - Score:`, analysis.atsScores.score);
        console.log(`[DEBUG] - SkillMatchDetails:`, analysis.atsScores.skillMatchDetails);
        console.log(`[DEBUG] - ComplianceDetails:`, analysis.atsScores.complianceDetails);
    } else {
        console.log(`[DEBUG] - No ATS scores found in database`);
    }

    // Convert to plain object to ensure proper serialization
    const atsScoresResponse = analysis.atsScores ? {
        score: analysis.atsScores.score ?? null,
        skillMatchDetails: analysis.atsScores.skillMatchDetails ?? null,
        complianceDetails: analysis.atsScores.complianceDetails ?? null,
        lastAnalyzedAt: analysis.atsScores.lastAnalyzedAt ?? null,
        jobApplicationId: analysis.atsScores.jobApplicationId ?? null,
        error: analysis.atsScores.error ?? null
    } : null;

    console.log(`[DEBUG] - Response being sent:`, JSON.stringify(atsScoresResponse, null, 2));

    res.json({
        analysisId: String(analysis._id),
        atsScores: atsScoresResponse
    });
};

/**
 * Find existing ATS analysis for a job application
 * GET /api/ats/job/:jobApplicationId
 */
export const getAtsForJob = async (req: ValidatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new AuthorizationError('User not authenticated');
    }

    const { jobApplicationId } = req.validated!.params!;

    // Find analyses that have ATS scores for this job application
    const analyses = await CvAnalysis.find({
        userId: new Types.ObjectId(userId),
        'atsScores.jobApplicationId': jobApplicationId,
        'atsScores': { $exists: true, $ne: null }
    }).sort({ 'atsScores.lastAnalyzedAt': -1 }).limit(1);

    if (analyses.length === 0) {
        res.json({
            analysisId: null,
            atsScores: null
        });
        return;
    }

    const analysis = analyses[0];
    res.json({
        analysisId: String(analysis._id),
        atsScores: analysis.atsScores || null
    });
};

/**
 * Get the latest general ATS analysis (without job application)
 * GET /api/ats/latest
 */
export const getLatestAts = async (req: ValidatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new AuthorizationError('User not authenticated');
    }

    // Find the latest analysis that has ATS scores and no jobApplicationId (general CV analysis)
    const analyses = await CvAnalysis.find({
        userId: new Types.ObjectId(userId),
        'atsScores': { $exists: true, $ne: null },
        $or: [
            { 'atsScores.jobApplicationId': null },
            { 'atsScores.jobApplicationId': { $exists: false } }
        ]
    }).sort({ 'atsScores.lastAnalyzedAt': -1 }).limit(1);

    if (analyses.length === 0) {
        res.json({
            analysisId: null,
            atsScores: null
        });
        return;
    }

    const analysis = analyses[0];

    // Convert to plain object to ensure proper serialization
    const atsScoresResponse = analysis.atsScores ? {
        score: analysis.atsScores.score ?? null,
        skillMatchDetails: analysis.atsScores.skillMatchDetails ?? null,
        complianceDetails: analysis.atsScores.complianceDetails ?? null,
        lastAnalyzedAt: analysis.atsScores.lastAnalyzedAt ?? null,
        jobApplicationId: analysis.atsScores.jobApplicationId ?? null,
        error: analysis.atsScores.error ?? null
    } : null;

    res.json({
        analysisId: String(analysis._id),
        atsScores: atsScoresResponse
    });
};

/**
 * Delete an ATS analysis
 * DELETE /api/ats/:analysisId
 */
export const deleteAts = async (req: ValidatedRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        throw new AuthorizationError('User not authenticated');
    }

    const { analysisId } = req.validated!.params!;

    const analysis = await CvAnalysis.findById(analysisId);
    if (!analysis) {
        throw new NotFoundError('Analysis not found');
    }

    if (analysis.userId.toString() !== userId) {
        throw new AuthorizationError('Unauthorized access to analysis');
    }

    await CvAnalysis.findByIdAndDelete(analysisId);

    res.json({ message: 'ATS analysis deleted successfully' });
};

