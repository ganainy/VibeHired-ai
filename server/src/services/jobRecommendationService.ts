import mongoose from 'mongoose';
import JobApplication, { IJobApplication } from '../models/JobApplication';
import CV from '../models/CV';
import { analyzeWithGemini } from './atsGeminiService';
import { JsonResumeSchema } from '../types/jsonresume';

export interface KeywordAnalysis {
    matchedKeywords: string[];
    missingKeywords: string[];
}

export interface JobRecommendation {
    shouldApply: boolean;
    score: number | null;
    reason: string;
    cached: boolean;
    cachedAt?: Date;
    error?: string;
    keywordAnalysis?: KeywordAnalysis;
}

export async function getJobRecommendation(
    userId: string | mongoose.Types.ObjectId,
    jobId: string | mongoose.Types.ObjectId,
    forceRefresh: boolean = false
): Promise<JobRecommendation> {
    try {
        const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
        const jobIdObj = typeof jobId === 'string' ? new mongoose.Types.ObjectId(jobId) : jobId;

        const job = await JobApplication.findOne({ _id: jobIdObj, userId: userIdObj });
        if (!job) {
            return {
                shouldApply: false,
                score: null,
                reason: 'Job application not found',
                cached: false,
                error: 'Job application not found'
            };
        }

        if (!forceRefresh && job.recommendation) {
            return {
                shouldApply: job.recommendation.shouldApply,
                score: job.recommendation.score,
                reason: job.recommendation.reason,
                cached: true,
                cachedAt: job.recommendation.cachedAt,
                keywordAnalysis: (job.recommendation as any).keywordAnalysis
            };
        }

        // Use the Base CV selected for this job (baseCvId field)
        let cvToUse: { cvJson?: JsonResumeSchema | null } | null = null;

        if (job.baseCvId) {
            // Use the specific Base CV selected for this job
            const baseCv = await CV.findOne({ _id: job.baseCvId, userId: userIdObj });
            if (baseCv && baseCv.cvJson && Object.keys(baseCv.cvJson).length > 0) {
                cvToUse = baseCv;
                console.log(`[Recommendation] Using Base CV (${baseCv.displayName || job.baseCvId}) for job ${jobId}`);
            }
        }

        if (!cvToUse || !cvToUse.cvJson) {
            return {
                shouldApply: false,
                score: null,
                reason: 'No Base CV selected for this job',
                cached: false,
                error: 'No Base CV selected - please select a Base CV for this job to calculate match'
            };
        }

        if (!job.jobDescriptionText || job.jobDescriptionText.trim().length === 0) {
            return {
                shouldApply: false,
                score: null,
                reason: 'Job description not available',
                cached: false,
                error: 'Job description not available'
            };
        }

        const analysisResult = await analyzeWithGemini(
            userIdObj.toString(),
            cvToUse.cvJson as JsonResumeSchema,
            job.jobDescriptionText
        );

        if (analysisResult.error || analysisResult.score === null) {
            const errorMsg = analysisResult.error || 'Failed to analyze job match';
            const recommendationWithError = {
                score: null,
                shouldApply: false,
                reason: errorMsg,
                cachedAt: new Date(),
                error: errorMsg
            };

            // Store error in recommendation field
            await JobApplication.findByIdAndUpdate(
                jobIdObj,
                { $set: { recommendation: recommendationWithError } },
                { new: true }
            );

            return {
                shouldApply: false,
                score: null,
                reason: errorMsg,
                cached: false,
                error: errorMsg
            };
        }

        const score = analysisResult.score;
        let shouldApply: boolean;
        let reason: string;

        // Extract keyword analysis from ATS results
        const matchedKeywords = analysisResult.details.complianceDetails?.keywordsMatched || [];
        const missingKeywords = analysisResult.details.complianceDetails?.keywordsMissing || [];
        const keywordAnalysis: KeywordAnalysis = {
            matchedKeywords,
            missingKeywords
        };

        if (score >= 70) {
            shouldApply = true;
            const matchedSkills = analysisResult.details.skillMatchDetails?.matchedSkills || [];
            const skillCount = matchedSkills.length;
            reason = `Strong match (${score}% compatibility). ${skillCount > 0 ? `Matched ${skillCount} key skills. ` : ''}Good alignment with job requirements.`;
        } else if (score >= 50) {
            shouldApply = false;
            const missingSkills = analysisResult.details.skillMatchDetails?.missingSkills || [];
            const skillCount = missingSkills.length;
            reason = `Moderate match (${score}% compatibility). ${skillCount > 0 ? `${skillCount} important skills missing. ` : ''}Consider applying after addressing key gaps.`;
        } else {
            shouldApply = false;
            const missingSkills = analysisResult.details.skillMatchDetails?.missingSkills || [];
            const skillCount = missingSkills.length;
            reason = `Weak match (${score}% compatibility). ${skillCount > 0 ? `Missing ${skillCount} critical skills. ` : ''}Significant gaps in requirements. Not recommended.`;
        }

        const recommendation = {
            score,
            shouldApply,
            reason,
            cachedAt: new Date(),
            keywordAnalysis
        };

        await JobApplication.findByIdAndUpdate(
            jobIdObj,
            { $set: { recommendation } },
            { new: true }
        );

        return {
            shouldApply,
            score,
            reason,
            cached: false,
            cachedAt: recommendation.cachedAt,
            keywordAnalysis
        };

    } catch (error: any) {
        console.error('Error getting job recommendation:', error);
        return {
            shouldApply: false,
            score: null,
            reason: 'Failed to generate recommendation',
            cached: false,
            error: error.message || 'Unknown error'
        };
    }
}

export async function getAllJobRecommendations(
    userId: string | mongoose.Types.ObjectId
): Promise<Record<string, JobRecommendation>> {
    try {
        const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

        const jobs = await JobApplication.find({ userId: userIdObj }).select('_id recommendation jobDescriptionText') as IJobApplication[];

        const recommendations: Record<string, JobRecommendation> = {};
        const jobsToGenerate: Array<{ jobId: mongoose.Types.ObjectId; jobIdString: string }> = [];

        for (const job of jobs) {
            const jobId = job._id as mongoose.Types.ObjectId;
            const jobIdString = jobId.toString();

            if (job.recommendation) {
                recommendations[jobIdString] = {
                    shouldApply: job.recommendation.shouldApply,
                    score: job.recommendation.score,
                    reason: job.recommendation.reason,
                    cached: true,
                    cachedAt: job.recommendation.cachedAt
                };
            } else {
                if (job.jobDescriptionText && job.jobDescriptionText.trim().length > 0) {
                    jobsToGenerate.push({ jobId, jobIdString });
                } else {
                    recommendations[jobIdString] = {
                        shouldApply: false,
                        score: null,
                        reason: 'Job description not available',
                        cached: false
                    };
                }
            }
        }

        for (const { jobId, jobIdString } of jobsToGenerate) {
            try {
                const recommendation = await getJobRecommendation(userIdObj, jobId, true);
                recommendations[jobIdString] = recommendation;
            } catch (error: any) {
                console.error(`Error generating recommendation for job ${jobIdString}:`, error);
                recommendations[jobIdString] = {
                    shouldApply: false,
                    score: null,
                    reason: 'Failed to generate recommendation',
                    cached: false,
                    error: error.message || 'Unknown error'
                };
            }
        }

        return recommendations;
    } catch (error: any) {
        console.error('Error getting all job recommendations:', error);
        return {};
    }
}

export async function regenerateAllJobRecommendations(
    userId: string | mongoose.Types.ObjectId
): Promise<Record<string, JobRecommendation>> {
    try {
        const userIdObj = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;

        const jobs = await JobApplication.find({ userId: userIdObj }) as IJobApplication[];

        const recommendations: Record<string, JobRecommendation> = {};

        for (const job of jobs) {
            const jobId = job._id as mongoose.Types.ObjectId;
            const jobIdString = jobId.toString();

            const recommendation = await getJobRecommendation(userIdObj, jobId, true);
            recommendations[jobIdString] = recommendation;
        }

        return recommendations;
    } catch (error: any) {
        console.error('Error regenerating all job recommendations:', error);
        return {};
    }
}
