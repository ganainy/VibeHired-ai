/**
 * tag-existing-jobs.ts
 *
 * One-time script that assigns field/industry tags to existing job applications.
 * It uses Gemini AI to generate 2–4 concise tags per job based on title and description.
 *
 * Usage (run from the `server/` directory):
 *   npx ts-node scripts/tag-existing-jobs.ts
 *   npx ts-node scripts/tag-existing-jobs.ts --dry-run
 *   npx ts-node scripts/tag-existing-jobs.ts --email user@example.com
 *   npx ts-node scripts/tag-existing-jobs.ts --overwrite
 *   npx ts-node scripts/tag-existing-jobs.ts --limit 50
 *
 * Requirements in server/.env:
 *   MONGODB_URI=...
 *   GEMINI_API_KEY=...  (or the key is stored encrypted in your Profile)
 *   ENCRYPTION_KEY=...  (only needed when reading key from Profile)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ── 1. Load .env ─────────────────────────────────────────────────────────────
const possibleEnvPaths = [
  path.join(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../server/.env'),
];
for (const p of possibleEnvPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    console.log(`Loaded .env from: ${p}`);
    break;
  }
}

// ── 2. Parse CLI arguments ───────────────────────────────────────────────────
function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const isDryRun = process.argv.includes('--dry-run');
const overwriteExisting = process.argv.includes('--overwrite');
const emailArg = getArg('--email');
const limitArg = getArg('--limit');
const limit = limitArg ? Number(limitArg) : undefined;

if (isDryRun) console.log('⚠️  DRY RUN — no changes will be saved to the database.');
if (overwriteExisting) console.log('⚠️  Overwrite mode enabled — existing tags will be replaced.');

// ── 3. Minimal Mongoose models ───────────────────────────────────────────────
const JobApplicationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  jobTitle: String,
  companyName: String,
  jobType: String,
  jobDescriptionText: String,
  jobPrerequisites: String,
  jobCategory: String,
  jobTags: [String],
  showInDashboard: Boolean,
  extractedData: {
    location: String,
    keyDetails: mongoose.Schema.Types.Mixed,
  },
}, { timestamps: true });

const JobAppModel: mongoose.Model<mongoose.Document & Record<string, any>> =
  (mongoose.models['JobApplication'] as any) ||
  mongoose.model('JobApplication', JobApplicationSchema);

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true },
  username: String,
}, { timestamps: true });

const UserModel: mongoose.Model<mongoose.Document & Record<string, any>> =
  (mongoose.models['User'] as any) ||
  mongoose.model('User', UserSchema);

const ProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  integrations: {
    gemini: { accessToken: String },
  },
  aiProviderSettings: {
    defaultModel: String,
  },
}, { timestamps: true });

const ProfileModel: mongoose.Model<mongoose.Document & Record<string, any>> =
  (mongoose.models['Profile'] as any) ||
  mongoose.model('Profile', ProfileSchema);

// ── 4. Encryption helper ─────────────────────────────────────────────────────
function decryptKey(encrypted: string): string | null {
  try {
    const rawKey = process.env.ENCRYPTION_KEY;
    if (!rawKey) return null;
    const crypto = require('crypto') as typeof import('crypto');
    const keyBuffer = rawKey.length === 32
      ? Buffer.from(rawKey, 'utf8')
      : crypto.createHash('sha256').update(rawKey).digest();
    const parts = encrypted.split(':');
    if (parts.length !== 3) return null;
    const [ivB64, authTagB64, cipherB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(cipherB64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

// ── 5. Resolve Gemini API key ────────────────────────────────────────────────
async function resolveGeminiKey(userId: string): Promise<string> {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const profile = await ProfileModel.findOne({ userId }).lean();
  const encrypted = (profile as any)?.integrations?.gemini?.accessToken;
  if (encrypted) {
    const key = decryptKey(encrypted);
    if (key) return key;
  }
  throw new Error(
    'Gemini API key not found.\n' +
    'Add GEMINI_API_KEY=<key> to server/.env or configure Gemini in the app Settings.'
  );
}

// ── 6. Tag extraction ────────────────────────────────────────────────────────
const normalizeTagValue = (value: string): string => value.trim().replace(/\s+/g, ' ');

const normalizeTags = (tags: string[], maxTags: number = 6): string[] => {
  const normalized = tags
    .map(tag => normalizeTagValue(tag))
    .filter(Boolean)
    .map(tag => tag.length > 32 ? tag.slice(0, 32).trim() : tag);

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const tag of normalized) {
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(tag);
    }
  }

  return deduped.slice(0, maxTags);
};

async function generateTags(job: any, gemini: GoogleGenerativeAI, modelName: string): Promise<string[] | null> {
  const model = gemini.getGenerativeModel({ model: modelName });

  const lines: string[] = [];
  lines.push(`Job Title: ${job.jobTitle || 'Unknown'}`);
  lines.push(`Company: ${job.companyName || 'Unknown'}`);
  if (job.jobType) lines.push(`Employment Type: ${job.jobType}`);
  if (job.extractedData?.location) lines.push(`Location: ${job.extractedData.location}`);

  const kd = job.extractedData?.keyDetails;
  if (kd && Array.isArray(kd) && kd.length > 0) {
    const kdStr = kd.map((item: any) => `${item.key}: ${item.value}`).join(', ');
    lines.push(`Key Details: ${kdStr}`);
  }

  if (job.jobDescriptionText) {
    lines.push(`\nJob Description (excerpt):\n${job.jobDescriptionText.slice(0, 2500)}`);
  } else if (job.jobPrerequisites) {
    lines.push(`\nRequirements:\n${job.jobPrerequisites.slice(0, 1200)}`);
  }

  const prompt = `You are a job taxonomy assistant.
Based on the job details below, return 2-4 concise field/industry tags.
Use Title Case, avoid duplicates, and keep each tag under 32 characters.
Examples: "Cybersecurity", "Network Security", "SOC", "Threat Detection", "Cloud Security".

Job Details:
${lines.join('\n')}

Return ONLY a JSON object in this exact format, nothing else:
{"jobTags": ["Tag 1", "Tag 2", "Tag 3"]}`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.jobTags)) return null;
    const tags = parsed.jobTags.filter((tag: any) => typeof tag === 'string');
    const normalized = normalizeTags(tags, 6);
    return normalized.length > 0 ? normalized : null;
  } catch (err: any) {
    console.warn(`  ⚠️  AI tag extraction failed: ${err.message}`);
    return null;
  }
}

// ── 7. Main ─────────────────────────────────────────────────────────────────
async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set in .env');

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected\n');

  let userIds: mongoose.Types.ObjectId[];
  if (emailArg) {
    const user = await UserModel.findOne({ email: emailArg }).lean();
    if (!user) throw new Error(`User with email "${emailArg}" not found.`);
    userIds = [(user as any)._id];
    console.log(`Targeting user: ${emailArg}`);
  } else {
    const users = await UserModel.find({}).lean();
    userIds = users.map((u: any) => u._id);
    console.log(`Found ${userIds.length} user(s) in database`);
  }

  const query: Record<string, any> = {
    userId: { $in: userIds },
  };

  if (!overwriteExisting) {
    query.$or = [
      { jobTags: { $exists: false } },
      { jobTags: { $size: 0 } },
      { jobTags: null },
    ];
  }

  const jobQuery = JobAppModel.find(query).lean();
  if (limit && Number.isFinite(limit)) {
    jobQuery.limit(limit);
  }

  const jobs = await jobQuery;

  if (jobs.length === 0) {
    console.log('✅ No jobs found that need tagging.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${jobs.length} job(s) to tag.\n`);

  const byUser = new Map<string, any[]>();
  for (const job of jobs) {
    const uid = job.userId.toString();
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid)!.push(job);
  }

  let updated = 0;
  let failed = 0;

  for (const [userId, userJobs] of byUser) {
    let gemini: GoogleGenerativeAI;
    let modelName: string;

    try {
      const apiKey = await resolveGeminiKey(userId);
      gemini = new GoogleGenerativeAI(apiKey);
      const profile = await ProfileModel.findOne({ userId }).lean();
      modelName = (profile as any)?.aiProviderSettings?.defaultModel || 'gemini-2.5-flash';
      console.log(`  Using model: ${modelName}`);
    } catch (err: any) {
      console.error(`❌ Skipping ${userJobs.length} job(s) for user ${userId} — ${err.message}`);
      failed += userJobs.length;
      continue;
    }

    for (const job of userJobs) {
      const label = `"${job.jobTitle || '?'}" @ "${job.companyName || '?'}"`;
      process.stdout.write(`  Tagging ${label}... `);

      const aiTags = await generateTags(job, gemini, modelName);
      if (!aiTags) {
        console.log('SKIPPED (no tags returned)');
        failed++;
        continue;
      }

      const existingTags = Array.isArray(job.jobTags) ? job.jobTags : [];
      const combined = overwriteExisting
        ? aiTags
        : normalizeTags([...(existingTags || []), ...(job.jobCategory ? [job.jobCategory] : []), ...aiTags], 6);

      if (combined.length === 0) {
        console.log('SKIPPED (no tags after normalization)');
        failed++;
        continue;
      }

      console.log(`→ ${combined.join(', ')}`);

      if (!isDryRun) {
        await JobAppModel.updateOne(
          { _id: job._id },
          { $set: { jobTags: combined } }
        );
      }
      updated++;

      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }

  console.log('\n─────────────────────────────────────────');
  if (isDryRun) {
    console.log(`✅ DRY RUN complete. Would have updated ${updated} job(s). ${failed} skipped.`);
  } else {
    console.log(`✅ Done. Updated ${updated} job(s). ${failed} skipped.`);
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
