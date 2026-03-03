// server/src/services/parallelJobProcessor.ts
import mongoose from 'mongoose';
import JobApplication from '../models/JobApplication';
import Profile from '../models/Profile';
import { analyzeJobCompanyAndRelevance } from './jobAnalysisService';
// Cover letter generation is now ON-DEMAND (not during batch processing)
import { processBatchWithErrors, calculateBatchDelay } from '../utils/batchProcessor';
import { generateContent } from '../utils/aiService';
import { GEMINI_FLASH } from '../constants/geminiModels';

/**
 * Process a single job with provider-aware AI operations
 * @param job - Raw job data
 * @param userId - User ID
 * @param runId - Workflow run ID
 * @param profile - User profile
 * @param structuredResume - Structured resume data
 * @param provider - AI provider to use
 * @param models - Model configuration for each task type
 * @returns Processed job application
 */
async function processSingleJob(
    job: any,
    userId: string,
    runId: string,
    profile: any,
    structuredResume: any,
    provider: string | undefined,
    models: { analysis?: string; relevance?: string; generation?: string }
): Promise<{ success: boolean; stats: any; jobApplication?: any; error?: Error }> {
    const stats = {
        analyzed: 0,
        relevant: 0,
        notRelevant: 0,
        generated: 0,
        errors: 0
    };

    try {
        // Create JobApplication entry
        const jobApplication = new JobApplication({
            userId: new mongoose.Types.ObjectId(userId),
            workflowRunId: new mongoose.Types.ObjectId(runId),
            jobId: job.jobId,
            jobTitle: job.jobTitle,
            companyName: job.companyName,
            jobUrl: job.jobUrl,
            jobDescriptionText: job.jobDescriptionText,
            status: 'Not Applied',
            isAutoJob: true,
            showInDashboard: false,
            processingStatus: 'pending',
            discoveredAt: new Date()
        });
        await jobApplication.save();

        // Skip if no description
        if (!job.jobDescriptionText || job.jobDescriptionText.length < 50) {
            console.log(`  ✗ Skipping: Job description empty or too short`);
            jobApplication.processingStatus = 'error';
            jobApplication.errorMessage = 'Job description missing from source';
            await jobApplication.save();
            stats.errors++;
            return { success: false, stats, error: new Error('No description') };
        }

        // Step 1: Merged analysis (job extraction + company analysis + relevance check)
        // This combines what was previously 2 separate AI calls into 1
        const analysis = await analyzeJobCompanyAndRelevance(
            job.jobDescriptionText,
            job.companyName,
            structuredResume,
            userId,
            job.structuredData,
            50 // Threshold: >=50% match is considered relevant
        );

        jobApplication.extractedData = analysis.job.extractedData;
        jobApplication.companyInsights = analysis.company;
        jobApplication.processingStatus = 'analyzed';
        jobApplication.processedAt = new Date();
        await jobApplication.save();
        stats.analyzed++;

        // Build recommendation object from merged analysis
        const recommendation = {
            score: analysis.relevance.score ?? null,
            shouldApply: analysis.relevance.isRelevant,
            reason: analysis.relevance.reason,
            cachedAt: new Date()
        };

        jobApplication.recommendation = recommendation;

        if (!analysis.relevance.isRelevant) {
            jobApplication.processingStatus = 'not_relevant';
            await jobApplication.save();
            stats.notRelevant++;
            console.log(`  ✗ Not relevant: ${analysis.relevance.reason}`);
            return { success: true, stats, jobApplication };
        }

        jobApplication.processingStatus = 'relevant';
        await jobApplication.save();
        stats.relevant++;
        console.log(`  ✓ Relevant: ${analysis.relevance.reason} (${analysis.relevance.score ?? 'N/A'}% match)`);

        // NOTE: Cover letter generation is now ON-DEMAND
        // Cover letters will be generated when the user clicks "Apply" or "Generate Cover Letter"
        // This saves ~50% of AI calls during batch processing

        return { success: true, stats, jobApplication };

    } catch (error: any) {
        console.error(`  ✗ Error processing job:`, error.message);
        stats.errors++;
        return { success: false, stats, error };
    }
}

/**
 * Process jobs in parallel batches with provider-aware AI operations
 * @param jobs - Array of raw job data
 * @param userId - User ID
 * @param runId - Workflow run ID
 * @param structuredResume - Structured resume data
 * @param batchSize - Number of jobs to process concurrently
 * @param provider - AI provider to use
 * @param models - Model configuration for each task type
 * @returns Aggregated statistics
 */
export async function processJobsInParallel(
    jobs: any[],
    userId: string,
    runId: string,
    structuredResume: any,
    batchSize: number = 5,
    provider: string | undefined = 'gemini',
    models: { analysis?: string; relevance?: string; generation?: string } = {}
): Promise<{
    analyzed: number;
    relevant: number;
    notRelevant: number;
    generated: number;
    errors: number;
}> {
    // Get user profile for API keys
    const profile = await Profile.findOne({ userId: new mongoose.Types.ObjectId(userId) });
    if (!profile) {
        throw new Error('User profile not found');
    }

    // Calculate rate limit delay (hardcoded for Gemini)
    const rateLimitDelay = 4500;

    console.log(`\n→ Processing ${jobs.length} jobs in parallel (batch size: ${batchSize})`);
    console.log(`  Provider: Gemini (Flash)`);
    console.log(`  Models: Analysis=${models.analysis || GEMINI_FLASH}, Relevance=${models.relevance || GEMINI_FLASH}, Generation=${models.generation || 'gemini-1.5-pro'}`);
    console.log(`  Rate limit delay: ${rateLimitDelay}ms between batches\n`);

    // Aggregate stats
    const totalStats = {
        analyzed: 0,
        relevant: 0,
        notRelevant: 0,
        generated: 0,
        errors: 0
    };

    // Process jobs in batches
    const { results, errors } = await processBatchWithErrors(
        jobs,
        batchSize,
        async (job, index) => {
            console.log(`[${index + 1}/${jobs.length}] Processing: ${job.jobTitle} at ${job.companyName}`);

            const result = await processSingleJob(
                job,
                userId,
                runId,
                profile,
                structuredResume,
                provider,
                models
            );

            // Aggregate stats
            totalStats.analyzed += result.stats.analyzed;
            totalStats.relevant += result.stats.relevant;
            totalStats.notRelevant += result.stats.notRelevant;
            totalStats.generated += result.stats.generated;
            totalStats.errors += result.stats.errors;

            return result;
        },
        rateLimitDelay
    );

    console.log(`\n✓ Parallel processing complete:`);
    console.log(`  Analyzed: ${totalStats.analyzed}`);
    console.log(`  Relevant: ${totalStats.relevant}`);
    console.log(`  Not Relevant: ${totalStats.notRelevant}`);
    console.log(`  Generated: ${totalStats.generated}`);
    console.log(`  Errors: ${totalStats.errors}`);

    return totalStats;
}
