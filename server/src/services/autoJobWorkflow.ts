// server/src/services/autoJobWorkflow.ts
import JobApplication from '../models/JobApplication';
import Profile from '../models/Profile';
import User from '../models/User';
import CV from '../models/CV';
import WorkflowRun from '../models/WorkflowRun';
import { retrieveJobs, extractJobId, JobSearchOptions } from './jobAcquisitionService';
import { analyzeJobCompanyAndRelevance } from './jobAnalysisService';
import { getOrStructureResume } from './resumeCacheService';
import { waitForRateLimit } from '../utils/rateLimiter';
import { decrypt } from '../utils/encryption';
import { convertJsonResumeToText } from '../utils/cvTextExtractor';
import { GEMINI_FLASH, GEMINI_PRO } from '../constants/geminiModels';
import mongoose from 'mongoose';
import { processJobsInParallel } from './parallelJobProcessor';

/**
 * Interface for workflow execution statistics
 */
export interface WorkflowStats {
    jobsFound: number;
    newJobs: number;
    duplicates: number;
    analyzed: number;
    relevant: number;
    notRelevant: number;
    generated: number;
    errors: number;
}

/**
 * Get user's base resume text
 * Fetches from CV model (Master CV) and converts to text
 */
const getUserResumeText = async (userId: string): Promise<string> => {
    try {
        // Fetch master CV from unified CV model
        const masterCv = await CV.findOne({
            userId: new mongoose.Types.ObjectId(userId),
            isDefault: true
        });

        if (!masterCv || !masterCv.cvJson) {
            throw new Error('User has not uploaded a Master CV. Please upload your CV in the CV Management section before using Auto Jobs.');
        }

        // Convert JSON Resume to text format
        const resumeText = convertJsonResumeToText(masterCv.cvJson as any);
        return resumeText;
    } catch (error: any) {
        console.error(`Error retrieving resume for user ${userId}:`, error.message);
        throw error;
    }
};

/**
 * Main automated job workflow
 * Creates a WorkflowRun entry and returns runId immediately
 * Executes workflow asynchronously with progress tracking
 */
export const runAutoJobWorkflow = async (userId: string, isManual: boolean = false): Promise<string> => {
    // Create WorkflowRun entry
    const workflowRun = new WorkflowRun({
        userId: new mongoose.Types.ObjectId(userId),
        status: 'running',
        isManual,
        progress: {
            currentStep: 'Initializing...',
            currentStepIndex: 0,
            totalSteps: 6,
            percentage: 0
        },
        steps: [
            { name: 'Initialize', status: 'running' },
            { name: 'Retrieve Jobs', status: 'pending' },
            { name: 'Deduplicate', status: 'pending' },
            { name: 'Structure Resume', status: 'pending' },
            { name: 'Process Jobs', status: 'pending' },
            { name: 'Complete', status: 'pending' }
        ],
        stats: {
            jobsFound: 0,
            newJobs: 0,
            duplicates: 0,
            analyzed: 0,
            relevant: 0,
            notRelevant: 0,
            errors: 0
        }
    });

    await workflowRun.save();
    const runId = (workflowRun as any)._id.toString();

    console.log(`\n========================================`);
    console.log(`Starting Auto Job Workflow for user: ${userId} (Manual: ${isManual})`);
    console.log(`Run ID: ${runId}`);
    console.log(`========================================\n`);

    // Execute workflow asynchronously (don't await)
    executeWorkflow(runId, userId, isManual).catch(error => {
        console.error(`Workflow ${runId} failed:`, error);
    });

    // Return runId immediately
    return runId;
};

/**
 * Execute workflow asynchronously with progress tracking
 * This function contains the actual workflow logic
 */
async function executeWorkflow(runId: string, userId: string, isManual: boolean): Promise<void> {
    const stats: WorkflowStats = {
        jobsFound: 0,
        newJobs: 0,
        duplicates: 0,
        analyzed: 0,
        relevant: 0,
        notRelevant: 0,
        generated: 0,
        errors: 0
    };

    try {
        // Helper to check if workflow has been cancelled
        const checkCancellation = async (): Promise<boolean> => {
            const run = await WorkflowRun.findById(runId);
            return run?.status === 'cancelled';
        };

        // Helper to update progress
        const updateProgress = async (stepName: string, status: 'running' | 'completed' | 'failed', stepIndex: number, message?: string) => {
            // Check if cancelled before updating
            if (await checkCancellation()) {
                throw new Error('Workflow cancelled by user');
            }

            await WorkflowRun.findByIdAndUpdate(runId, {
                'progress.currentStep': message || stepName,
                'progress.currentStepIndex': stepIndex,
                'progress.percentage': Math.round((stepIndex / 6) * 100),
                [`steps.${stepIndex}.status`]: status,
                [`steps.${stepIndex}.${status === 'running' ? 'startedAt' : 'completedAt'}`]: new Date()
            });
        };

        // Step 1: Initialize - Retrieve user profile and settings
        await updateProgress('Initialize', 'running', 0, 'Retrieving profile and settings...');

        let profile = await Profile.findOne({ userId: new mongoose.Types.ObjectId(userId) });

        if (!profile) {
            console.log('Profile not found in workflow, creating default...');
            // Create default profile if it doesn't exist
            profile = new Profile({
                userId: new mongoose.Types.ObjectId(userId),
                autoJobSettings: {
                    keywords: '',
                    location: ''
                }
            });
            await profile.save();
        }

        // AI provider will be retrieved by aiService when needed

        const apifyToken = process.env.APIFY_API_KEY;

        // Get auto-job settings
        const autoJobSettings = (profile as any).autoJobSettings;

        const keywords = autoJobSettings.keywords || '';
        const location = autoJobSettings.location || '';

        // Require keywords or location
        if (!keywords && !location) {
            throw new Error('Keywords or location must be configured');
        }

        if (!apifyToken) {
            throw new Error('Apify API token is not configured on the server');
        }

        const maxJobs = autoJobSettings.maxJobs || 100;
        await updateProgress('Initialize', 'completed', 0, 'Settings loaded');

        // Check for cancellation before retrieving jobs
        if (await checkCancellation()) {
            console.log('Workflow cancelled before retrieving jobs');
            return;
        }

        // Step 2: Retrieve Jobs
        const searchDescription = location && keywords
            ? `keywords: "${keywords}", location: "${location}"`
            : keywords
                ? `keywords: "${keywords}"`
                : `location: "${location}"`;
        await updateProgress('Retrieve Jobs', 'running', 1, `Retrieving jobs - ${searchDescription}`);
        console.log(`→ Retrieving jobs - ${searchDescription}`);
        console.log(`→ Requesting ${maxJobs} jobs`);

        // Build job search options
        // Map invalid "past hour" to valid "past 24 hours"
        let datePosted = autoJobSettings.datePosted || 'any time';
        if (datePosted === 'past hour') {
            datePosted = 'past 24 hours';
        }

        const jobSearchOptions = {
            keywords: keywords || undefined,
            location: location || undefined,
            jobType: autoJobSettings.jobType && autoJobSettings.jobType.length > 0 ? autoJobSettings.jobType : undefined,
            experienceLevel: autoJobSettings.experienceLevel && autoJobSettings.experienceLevel.length > 0 ? autoJobSettings.experienceLevel : undefined,
            datePosted: datePosted,
            maxJobs: maxJobs,
            avoidDuplicates: autoJobSettings.avoidDuplicates || false
        };

        const rawJobs = await retrieveJobs(apifyToken, jobSearchOptions);
        stats.jobsFound = rawJobs.length;
        console.log(`✓ Found ${stats.jobsFound} jobs`);
        await updateProgress('Retrieve Jobs', 'completed', 1, `Found ${stats.jobsFound} jobs`);

        if (rawJobs.length === 0) {
            console.log('No jobs found, workflow complete');
            await updateProgress('Complete', 'completed', 5, 'No jobs found');
            await WorkflowRun.findByIdAndUpdate(runId, { status: 'completed', stats });
            return;
        }

        // Step 3: Deduplicate
        await updateProgress('Deduplicate', 'running', 2, 'Checking for duplicates...');
        console.log(`\n→ Checking for duplicates...`);

        // Batch deduplication: Single query instead of N sequential queries
        // This reduces 100 DB round-trips to just 1 query
        const jobIds = rawJobs.map(job => job.jobId);
        const existingJobs = await JobApplication.find({
            userId: new mongoose.Types.ObjectId(userId),
            jobId: { $in: jobIds }
        }).select('jobId').lean();

        const existingJobIds = new Set(existingJobs.map(job => job.jobId));

        const newJobs = rawJobs.filter(job => {
            if (existingJobIds.has(job.jobId)) {
                stats.duplicates++;
                return false;
            }
            return true;
        });
        stats.newJobs = newJobs.length;
        console.log(`✓ ${stats.newJobs} new jobs, ${stats.duplicates} duplicates`);
        await updateProgress('Deduplicate', 'completed', 2, `${stats.newJobs} new jobs, ${stats.duplicates} duplicates`);

        if (newJobs.length === 0) {
            console.log('No new jobs to process, workflow complete');
            await updateProgress('Complete', 'completed', 5, 'No new jobs to process');
            await WorkflowRun.findByIdAndUpdate(runId, { status: 'completed', stats });
            return;
        }

        // Check for cancellation before structuring resume
        if (await checkCancellation()) {
            console.log('Workflow cancelled before structuring resume');
            return;
        }

        // Step 4: Structure Resume
        await updateProgress('Structure Resume', 'running', 3, 'Structuring resume...');
        console.log(`\n→ Retrieving and structuring resume...`);

        const resumeText = await getUserResumeText(userId);
        const structuredResume = await getOrStructureResume(userId, resumeText);
        console.log(`✓ Resume structured`);
        await updateProgress('Structure Resume', 'completed', 3, 'Resume structured');

        // Step 5: Process Jobs in Parallel
        await updateProgress('Process Jobs', 'running', 4, `Processing ${newJobs.length} jobs...`);

        // Gemini defaults are now used exclusively
        const provider = 'gemini';
        const batchSize = 5;
        const models = {
            analysis: GEMINI_FLASH,
            relevance: GEMINI_FLASH,
            generation: GEMINI_PRO
        };

        console.log(`\n→ Using parallel processing with provider: ${provider}`);
        console.log(`  Batch size: ${batchSize} concurrent jobs`);
        console.log(`  Models: Analysis=${models.analysis}, Relevance=${models.relevance}, Generation=${models.generation}\n`);

        // Process jobs in parallel batches
        const parallelStats = await processJobsInParallel(
            newJobs,
            userId,
            runId,
            structuredResume,
            batchSize,
            provider,
            models
        );

        // Update stats from parallel processing
        stats.analyzed = parallelStats.analyzed;
        stats.relevant = parallelStats.relevant;
        stats.notRelevant = parallelStats.notRelevant;
        stats.generated = parallelStats.generated;
        stats.errors = parallelStats.errors;

        await updateProgress('Process Jobs', 'completed', 4, `Processed ${newJobs.length} jobs`);

        // Step 6: Complete
        console.log(`\n========================================`);
        console.log(`Workflow Complete`);
        console.log(`========================================`);

        await updateProgress('Complete', 'completed', 5, 'Workflow completed successfully');
        await WorkflowRun.findByIdAndUpdate(runId, {
            status: 'completed',
            stats,
            completedAt: new Date()
        });

    } catch (error: any) {
        // Check if error is due to cancellation
        if (error.message === 'Workflow cancelled by user') {
            console.log('Workflow cancelled successfully');
            await WorkflowRun.findByIdAndUpdate(runId, {
                status: 'cancelled',
                'progress.currentStep': 'Cancelled by user',
                completedAt: new Date()
            });
        } else {
            console.error('Workflow execution failed:', error);
            await WorkflowRun.findByIdAndUpdate(runId, {
                status: 'failed',
                errorMessage: error.message,
                completedAt: new Date()
            });
        }
    }
}
