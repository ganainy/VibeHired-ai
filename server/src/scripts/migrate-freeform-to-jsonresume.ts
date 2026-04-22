#!/usr/bin/env ts-node
/**
 * Batch migration script: converts existing freeform CVs to JsonResume format.
 *
 * Usage:
 *   cd server
 *   npx ts-node src/scripts/migrate-freeform-to-jsonresume.ts
 *   npx ts-node src/scripts/migrate-freeform-to-jsonresume.ts --dry-run
 */

import '../config/env';
import mongoose from 'mongoose';
import CV from '../models/CV';
import { compactFreeformToJsonResume } from '../utils/cvNormalizer';
import { detectCvFormat } from '../utils/cvFormatDetector';

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 100;

async function migrate() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('FATAL: MONGODB_URI is not defined.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('MongoDB connected.');

  let migrated = 0;
  let unchanged = 0;
  let errors = 0;
  let skipped = 0;
  let batchNum = 0;

  // Find candidate CVs: explicitly freeform, or null/undefined format
  const query = {
    $or: [
      { cvFormat: 'freeform' },
      { cvFormat: null },
      { cvFormat: { $exists: false } },
    ],
    cvJson: { $ne: null },
  };

  const totalCandidates = await CV.countDocuments(query);
  console.log(`Found ${totalCandidates} candidate CV(s) to evaluate.`);

  if (DRY_RUN) {
    console.log('DRY RUN mode — no changes will be saved.\n');
  }

  let lastId: mongoose.Types.ObjectId | null = null;

  while (true) {
    batchNum++;
    const batchQuery: any = { ...query };
    if (lastId) {
      batchQuery._id = { $gt: lastId };
    }

    const batch = await CV.find(batchQuery)
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .lean();

    if (batch.length === 0) break;

    console.log(`--- Batch ${batchNum} (${batch.length} document(s)) ---`);

    for (const doc of batch) {
      const cvId = String(doc._id);
      try {
        if (!doc.cvJson || typeof doc.cvJson !== 'object') {
          console.log(`  [SKIP] ${cvId} — cvJson is null or not an object`);
          skipped++;
          continue;
        }

        const currentFormat = detectCvFormat(doc.cvJson as Record<string, any>);

        // If already classified as json-resume, skip unless compaction would change data
        if (currentFormat === 'json-resume') {
          console.log(`  [SKIP] ${cvId} — already json-resume`);
          skipped++;
          continue;
        }

        const compacted = compactFreeformToJsonResume(doc.cvJson as Record<string, any>);
        const newFormat = detectCvFormat(compacted);

        // Only update if compaction actually improved things
        if (
          newFormat === 'json-resume' ||
          JSON.stringify(compacted) !== JSON.stringify(doc.cvJson)
        ) {
          if (DRY_RUN) {
            console.log(
              `  [DRY-RUN] ${cvId} — would migrate to ${newFormat} ` +
                `(keys before: ${Object.keys(doc.cvJson as Record<string, any>).length}, ` +
                `after: ${Object.keys(compacted).length})`
            );
          } else {
            await CV.updateOne(
              { _id: doc._id },
              { $set: { cvJson: compacted, cvFormat: newFormat } }
            );
            console.log(`  [MIGRATED] ${cvId} → ${newFormat}`);
          }
          migrated++;
        } else {
          console.log(`  [UNCHANGED] ${cvId} — compaction produced same data`);
          unchanged++;
        }
      } catch (err: any) {
        console.error(`  [ERROR] ${cvId} — ${err.message}`);
        errors++;
      }
    }

    lastId = batch[batch.length - 1]._id as mongoose.Types.ObjectId;
  }

  console.log('\n========== MIGRATION SUMMARY ==========');
  console.log(`Total candidates: ${totalCandidates}`);
  console.log(`Migrated:         ${migrated}`);
  console.log(`Unchanged:        ${unchanged}`);
  console.log(`Skipped:          ${skipped}`);
  console.log(`Errors:           ${errors}`);
  console.log('=======================================\n');

  await mongoose.disconnect();
  console.log('MongoDB disconnected.');
  process.exit(DRY_RUN ? 0 : errors > 0 ? 1 : 0);
}

migrate().catch((err) => {
  console.error('Unexpected migration error:', err);
  process.exit(1);
});
