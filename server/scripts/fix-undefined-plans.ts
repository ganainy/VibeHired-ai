// server/scripts/fix-undefined-plans.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../src/models/User';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * One-time migration: set plan = 'free' for all users where plan is
 * undefined, null, or any value not in the valid plan enum.
 *
 * Run via:
 *   cd server && npx ts-node scripts/fix-undefined-plans.ts
 */
async function fixUndefinedPlans() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        console.error('MONGODB_URI is not set in .env');
        process.exit(1);
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected.\n');

    const validPlans = ['free', 'starter', 'pro', 'premium'];

    // Find users with missing or invalid plan
    const affected = await User.find({
        $or: [
            { plan: { $exists: false } },
            { plan: null },
            { plan: { $nin: validPlans } },
        ],
    }).select('_id email username plan');

    console.log(`Found ${affected.length} user(s) with missing/invalid plan:\n`);

    for (const u of affected) {
        console.log(`  - ${u.username || '(no username)'} <${u.email}>  plan=${JSON.stringify((u as any).plan)}`);
    }

    if (affected.length === 0) {
        console.log('Nothing to fix. All users already have a valid plan.');
        await mongoose.disconnect();
        return;
    }

    const result = await User.updateMany(
        {
            $or: [
                { plan: { $exists: false } },
                { plan: null },
                { plan: { $nin: validPlans } },
            ],
        },
        { $set: { plan: 'free' } }
    );

    console.log(`\nUpdated ${result.modifiedCount} user(s) → plan = 'free'`);

    await mongoose.disconnect();
    console.log('Done. Disconnected from MongoDB.');
}

fixUndefinedPlans().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
