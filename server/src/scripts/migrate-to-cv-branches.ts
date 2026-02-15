// server/src/scripts/migrate-to-cv-branches.ts
import mongoose from 'mongoose';
import CV from '../models/CV';
import JobApplication from '../models/JobApplication';
import User from '../models/User';

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
                        displayName: 'Primary CV'
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
            // Find the primary CV for this user
            const primaryCv = await CV.findOne({
                userId: user._id,
                isPrimary: true
            }).session(session);

            if (primaryCv) {
                // Update all jobs for this user that don't have baseCvId set
                const result = await JobApplication.updateMany(
                    {
                        userId: user._id,
                        baseCvId: { $exists: false }
                    },
                    { $set: { baseCvId: primaryCv._id } }
                ).session(session);

                console.log(`Updated ${result.modifiedCount} jobs for user ${user._id}`);
            } else {
                console.warn(`No primary CV found for user ${user._id}`);
            }
        }

        console.log('✅ baseCvId populated for existing jobs');

        // Step 4: Validation
        console.log('Step 4: Running validation checks...');

        const primaryCvCount = await CV.countDocuments({ isPrimary: true }).session(session);
        const totalUsers = await User.countDocuments().session(session);

        console.log(`Found ${primaryCvCount} primary CVs for ${totalUsers} users`);

        if (primaryCvCount !== totalUsers) {
            throw new Error(`Validation failed: Expected ${totalUsers} primary CVs, found ${primaryCvCount}`);
        }

        const jobsWithoutBaseCvId = await JobApplication.countDocuments({
            baseCvId: { $exists: false }
        }).session(session);

        if (jobsWithoutBaseCvId > 0) {
            throw new Error(`Validation failed: ${jobsWithoutBaseCvId} jobs still missing baseCvId`);
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