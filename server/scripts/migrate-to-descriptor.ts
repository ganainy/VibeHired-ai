// server/scripts/migrate-to-descriptor.ts
/**
 * One-time migration script: Back-fill cvDescriptor + cvData for all existing
 * CV documents that have a cvJson but no cvDescriptor.
 *
 * Usage:
 *   cd server
 *   npx ts-node scripts/migrate-to-descriptor.ts [--dry-run] [--user-id <userId>]
 *
 * Options:
 *   --list-users              Print all users (id + email) and exit. Use this
 *                             to find the userId to pass to --user-id / --fallback-user-id.
 *   --dry-run                 Print stats without making any changes.
 *   --user-id <id>            Run AI under this userId for all CVs (for usage tracking).
 *                             Falls back to the CV's own userId field when omitted.
 *   --fallback-user-id <id>   If a CV's own user's provider is unavailable/invalid,
 *                             retry once using this userId. Useful when some users
 *                             have broken/expired API keys.
 *   --limit <n>               Process at most n CVs (useful for staged rollouts).
 *   --delay <ms>              Milliseconds to wait between AI calls (default 500).
 *
 * The script is safe to re-run: it skips CVs that already have cvDescriptor.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import CV from '../src/models/CV';
import User from '../src/models/User';
// Must be imported before any AI calls so all providers self-register into ProviderRegistry
import '../src/providers';
import { generateDescriptorFromJson } from '../src/services/generatorService';

// Load env from server root
dotenv.config({ path: path.join(__dirname, '../.env') });

// ─── Parse CLI flags ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const fallbackUserId = (() => {
    const idx = args.indexOf('--user-id');
    return idx !== -1 ? args[idx + 1] : null;
})();
/** When a CV's own user AI call fails, retry once using this userId instead */
const fallbackOnFailUserId = (() => {
    const idx = args.indexOf('--fallback-user-id');
    return idx !== -1 ? args[idx + 1] : null;
})();
const userLimit = (() => {
    const idx = args.indexOf('--limit');
    return idx !== -1 ? parseInt(args[idx + 1], 10) : Infinity;
})();
const delayMs = (() => {
    const idx = args.indexOf('--delay');
    return idx !== -1 ? parseInt(args[idx + 1], 10) : 500;
})();

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ─── List-users helper ───────────────────────────────────────────────────────
async function listUsers() {
    if (!process.env.MONGODB_URI) {
        console.error('❌  MONGODB_URI is not set. Check your .env file.');
        process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    const users = await User.find({}, '_id email').lean();
    console.log(`\nFound ${users.length} user(s):\n`);
    for (const u of users) {
        console.log(`  ${String(u._id)}  ${(u as any).email}`);
    }
    console.log();
    await mongoose.disconnect();
}

if (args.includes('--list-users')) {
    listUsers().catch(err => { console.error(err); process.exit(1); });
} else {
    migrateToDescriptor().catch(err => { console.error('Unhandled error:', err); process.exit(1); });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function migrateToDescriptor() {
    if (!process.env.MONGODB_URI) {
        console.error('❌  MONGODB_URI is not set. Check your .env file.');
        process.exit(1);
    }

    console.log('🔌  Connecting to MongoDB…');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅  Connected to MongoDB\n');

    // Find CVs that need back-filling
    const query = {
        cvJson: { $ne: null, $exists: true },
        $or: [
            { cvDescriptor: null },
            { cvDescriptor: { $exists: false } },
        ],
    };

    const total = await CV.countDocuments(query);
    console.log(`Found ${total} CV(s) missing a descriptor.`);

    if (isDryRun) {
        console.log('DRY RUN – no changes will be made.');
        await mongoose.disconnect();
        return;
    }

    if (total === 0) {
        console.log('Nothing to do. All CVs already have descriptors.');
        await mongoose.disconnect();
        return;
    }

    const cursor = CV.find(query).cursor();

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for await (const cv of cursor) {
        if (processed >= userLimit) break;
        processed++;

        const userId = fallbackUserId || String((cv as any).userId || 'system');
        const label = `[${processed}/${Math.min(total, userLimit)}] CV ${cv._id}`;

        try {
            console.log(`${label} – generating descriptor…`);
            const payload = await generateDescriptorFromJson(cv.cvJson as any, userId);

            await CV.updateOne(
                { _id: cv._id },
                { $set: { cvDescriptor: payload.descriptor, cvData: payload.data } },
            );

            succeeded++;
            console.log(`${label} – ✅ done (${payload.descriptor.length} sections)`);
        } catch (err: any) {
            // If a fallback userId is provided, retry once with it
            if (fallbackOnFailUserId && fallbackOnFailUserId !== userId) {
                try {
                    console.log(`${label} – retrying with fallback user…`);
                    const payload = await generateDescriptorFromJson(cv.cvJson as any, fallbackOnFailUserId);

                    await CV.updateOne(
                        { _id: cv._id },
                        { $set: { cvDescriptor: payload.descriptor, cvData: payload.data } },
                    );

                    succeeded++;
                    console.log(`${label} – ✅ done via fallback (${payload.descriptor.length} sections)`);
                    continue;
                } catch (retryErr: any) {
                    console.error(`${label} – ❌ fallback also failed: ${retryErr.message}`);
                }
            }
            failed++;
            console.error(`${label} – ❌ failed: ${err.message}`);
        }

        // Throttle to avoid hammering the AI provider
        if (processed < Math.min(total, userLimit)) {
            await sleep(delayMs);
        }
    }

    console.log(`\n--- Migration complete ---`);
    console.log(`Processed : ${processed}`);
    console.log(`Succeeded : ${succeeded}`);
    console.log(`Failed    : ${failed}`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
}
