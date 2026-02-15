// server/scripts/migrate-to-cv-branches.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CV from '../src/models/CV';
import JobApplication from '../src/models/JobApplication';
import User from '../src/models/User';

/**
 * Migration script to convert from master CV system to CV branch system
 *
 * This script:
 * 1. Migrates existing master CVs to primary CVs
 * 2. Sets displayName for existing job CVs
 * 3. Populates baseCvId for existing jobs
 *
 * Run this script once after deploying the new CV model changes.
 */

async function migrateToCvBranches() {
    console.log('Starting CV branch migration...');

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Step 1: Migrate existing master CVs to primary CVs
        console.log('Step 1: Migrating master CVs to primary CVs...');

        const masterCvs = await CV.find({ isMasterCv: true }).session(session);
        console.log(`Found ${masterCvs.length} master CVs to migrate`);

        for (const cv of masterCvs) {
            await CV.updateOne(
                { _id: cv._id },
                {
                    $set: {
                        isPrimary: true,
                        category: null,
                        displayName: 'Primary CV',
                        isMasterCv: false  // Explicitly set to false
                    }
                }
            ).session(session);
        }

        console.log('✅ Master CVs migrated to primary CVs');

        // Step 2: Set displayName for existing job CVs
        console.log('Step 2: Setting display names for job CVs...');

        const jobCvs = await CV.find({
            isMasterCv: false,
            jobApplicationId: { $ne: null }
        })
        .populate('jobApplicationId')
        .session(session);

        console.log(`Found ${jobCvs.length} job CVs to update`);

        for (const cv of jobCvs) {
            const job = (cv as any).jobApplicationId;
            if (job) {
                const displayName = `${job.jobTitle} - ${job.companyName}`;
                await CV.updateOne(
                    { _id: cv._id },
                    { $set: { displayName } }
                ).session(session);
            } else {
                // Fallback for orphaned CVs
                await CV.updateOne(
                    { _id: cv._id },
                    { $set: { displayName: 'Job CV' } }
                ).session(session);
            }
        }

        console.log('✅ Job CV display names set');

        // Step 3: Populate baseCvId for existing jobs
        console.log('Step 3: Populating baseCvId for existing jobs...');

        const users = await User.find({}).session(session);
        console.log(`Processing ${users.length} users`);

        for (const user of users) {
            try {
                // Find the primary CV for this user
                const primaryCv = await CV.findOne({
                    userId: user._id,
                    isPrimary: true
                }).session(session);

                if (primaryCv) {
                    // Update jobs one by one to avoid Atlas quota issues
                    const jobsWithoutBaseCvId = await JobApplication.find({
                        userId: user._id,
                        baseCvId: { $exists: false }
                    }).session(session);

                    console.log(`User ${user._id}: Found ${jobsWithoutBaseCvId.length} jobs to update`);

                    for (const job of jobsWithoutBaseCvId) {
                        await JobApplication.updateOne(
                            { _id: job._id },
                            { $set: { baseCvId: primaryCv._id } }
                        ).session(session);
                    }

                    console.log(`Updated ${jobsWithoutBaseCvId.length} jobs for user ${user._id}`);
                } else {
                    console.warn(`No primary CV found for user ${user._id}`);
                }
            } catch (userError) {
                console.error(`Error processing user ${user._id}:`, userError);
                // Continue with other users
            }
        }

        console.log('✅ baseCvId populated for existing jobs');

        // Step 4: Validation
        console.log('Step 4: Running validation checks...');

        // Check that no master CVs remain
        const remainingMasterCvs = await CV.countDocuments({ isMasterCv: true }).session(session);
        console.log(`Remaining master CVs: ${remainingMasterCvs}`);

        if (remainingMasterCvs > 0) {
            throw new Error(`Validation failed: ${remainingMasterCvs} master CVs still exist`);
        }

        // Check that all jobs with users who have primary CVs also have baseCvId
        const usersWithPrimaryCvs = await User.find({
            _id: { $in: await CV.distinct('userId', { isPrimary: true }) }
        }).session(session);

        let totalJobsChecked = 0;
        let totalJobsWithBaseCvId = 0;

        for (const user of usersWithPrimaryCvs) {
            const jobCount = await JobApplication.countDocuments({ userId: user._id }).session(session);
            const jobsWithBaseCvId = await JobApplication.countDocuments({
                userId: user._id,
                baseCvId: { $exists: true }
            }).session(session);

            totalJobsChecked += jobCount;
            totalJobsWithBaseCvId += jobsWithBaseCvId;

            if (jobCount > 0 && jobsWithBaseCvId !== jobCount) {
                throw new Error(`Validation failed: User ${user._id} has ${jobCount} jobs but only ${jobsWithBaseCvId} have baseCvId`);
            }
        }

        console.log(`Validated ${totalJobsChecked} jobs for ${usersWithPrimaryCvs.length} users with primary CVs`);

        // Check that primary CVs are unique per user
        const primaryCvGroups = await CV.aggregate([
            { $match: { isPrimary: true } },
            { $group: { _id: '$userId', count: { $sum: 1 } } },
            { $match: { count: { $gt: 1 } } }
        ]).session(session);

        if (primaryCvGroups.length > 0) {
            throw new Error(`Validation failed: ${primaryCvGroups.length} users have multiple primary CVs`);
        }

        console.log('✅ Validation passed');

        await session.commitTransaction();
        console.log('🎉 Migration completed successfully!');

    } catch (error) {
        await session.abortTransaction();
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        session.endSession();
    }
}

// Export for use in scripts
export default migrateToCvBranches;

// Allow running directly
if (require.main === module) {
    // Load environment variables
    dotenv.config({ path: '.env' });
    
    // Connect to database and run migration
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/job-app-assistant';

    mongoose.connect(mongoUri)
        .then(() => {
            console.log('Connected to MongoDB');
            return migrateToCvBranches();
        })
        .then(() => {
            console.log('Migration script completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration script failed:', error);
            process.exit(1);
        });
}