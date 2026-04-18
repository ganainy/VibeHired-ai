// server/src/scripts/migrate-rename-isPrimary-to-isDefault.ts
import mongoose from 'mongoose';
import CV from '../models/CV';

/**
 * Migration script: rename isPrimary → isDefault on all CV documents.
 *
 * Also drops the old unique index and creates the new one, and removes
 * the legacy isMasterCv field entirely.
 *
 * Run this script once after deploying the code changes.
 */
async function migrateRenameIsPrimaryToIsDefault() {
    console.log('Starting isPrimary → isDefault migration...');

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Rename field on all documents
        const renameResult = await CV.updateMany(
            { isPrimary: { $exists: true } },
            { $rename: { isPrimary: 'isDefault' } }
        ).session(session);
        console.log(`Renamed isPrimary → isDefault on ${renameResult.matchedCount} documents`);

        // 2. Remove legacy isMasterCv field
        const unsetResult = await CV.updateMany(
            { isMasterCv: { $exists: true } },
            { $unset: { isMasterCv: '' } }
        ).session(session);
        console.log(`Removed isMasterCv field from ${unsetResult.modifiedCount} documents`);

        // 3. Drop old unique index
        try {
            await CV.db.collection('cvs').dropIndex('unique_primary_cv_per_user');
            console.log('Dropped old index: unique_primary_cv_per_user');
        } catch {
            console.log('Old index unique_primary_cv_per_user not found (already dropped?)');
        }

        // 4. Create new unique partial index
        await CV.db.collection('cvs').createIndex(
            { userId: 1, isDefault: 1 },
            {
                unique: true,
                partialFilterExpression: { isDefault: true },
                name: 'unique_default_cv_per_user',
            }
        );
        console.log('Created new index: unique_default_cv_per_user');

        await session.commitTransaction();
        console.log('Migration completed successfully.');
    } catch (error) {
        await session.abortTransaction();
        console.error('Migration failed:', error);
        throw error;
    } finally {
        session.endSession();
    }
}

// ── CLI entry point ──
if (require.main === module) {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/job-app-assistant';

    mongoose.connect(mongoUri)
        .then(() => migrateRenameIsPrimaryToIsDefault())
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('Fatal error:', err);
            process.exit(1);
        });
}

export default migrateRenameIsPrimaryToIsDefault;
