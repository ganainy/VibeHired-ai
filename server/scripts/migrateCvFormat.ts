/**
 * One-time migration: sets cvFormat on all existing CVs that have cvFormat = null.
 * Run once after deploying the cvFormat field.
 *
 * Usage: npx ts-node server/scripts/migrateCvFormat.ts
 */
import mongoose from 'mongoose';
import CV from '../src/models/CV';
import { detectCvFormat } from '../src/utils/cvFormatDetector';

async function migrate() {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB');

    const cvs = await CV.find({ cvFormat: null, cvJson: { $ne: null } }).lean();
    console.log(`Found ${cvs.length} CVs to migrate`);

    let updated = 0;
    let skipped = 0;

    for (const cv of cvs) {
        if (!cv.cvJson || typeof cv.cvJson !== 'object') {
            skipped++;
            continue;
        }

        const format = detectCvFormat(cv.cvJson as Record<string, any>);
        await CV.updateOne({ _id: cv._id }, { $set: { cvFormat: format } });
        updated++;

        if (updated % 50 === 0) console.log(`Migrated ${updated}/${cvs.length}`);
    }

    console.log(`Done. Updated: ${updated}, Skipped: ${skipped}`);
    await mongoose.disconnect();
}

migrate().catch(err => { console.error(err); process.exit(1); });