/**
 * analyze-job-descriptions.ts
 *
 * Standalone script that fetches all job applications you've engaged with
 * (Applied / Interview / Assessment / Offer / Rejected) and uses Gemini AI
 * to produce a prioritised "what your CV should include" report.
 *
 * Usage (run from the `server/` directory):
 *   npx ts-node scripts/analyze-job-descriptions.ts
 *   npx ts-node scripts/analyze-job-descriptions.ts --email user@example.com
 *   npx ts-node scripts/analyze-job-descriptions.ts --email user@example.com --status Applied,Interview
 *   npx ts-node scripts/analyze-job-descriptions.ts --email user@example.com --output ./cv-gap-report.md
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

// ── 2. Parse CLI arguments ────────────────────────────────────────────────────
function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const emailArg    = getArg('--email');
const outputArg   = getArg('--output');
const statusArg   = getArg('--status');   // e.g. "Applied,Interview"

const ACTIVE_STATUSES = statusArg
  ? statusArg.split(',').map(s => s.trim())
  : ['Applied', 'Interview', 'Assessment', 'Offer', 'Rejected'];

// ── 3. Mongoose models (lightweight inline schemas) ──────────────────────────
// We define minimal schemas to avoid pulling in the full app dependency tree.

const JobApplicationSchema = new mongoose.Schema({
  userId:             { type: mongoose.Schema.Types.ObjectId, required: true },
  jobTitle:           String,
  companyName:        String,
  status:             String,
  jobDescriptionText: String,
  jobPrerequisites:   String,
  jobType:            String,
  extractedData: {
    skills:          [String],
    yearsExperience: Number,
    location:        String,
    keyDetails:      mongoose.Schema.Types.Mixed,
  },
}, { timestamps: true });

// Avoid "Cannot overwrite model once compiled" error if module is re-evaluated
const JobAppModel: mongoose.Model<mongoose.Document & Record<string, any>> =
  (mongoose.models['JobApplication'] as any) ||
  mongoose.model('JobApplication', JobApplicationSchema);

const UserSchema = new mongoose.Schema({
  email:    { type: String, required: true },
  username: String,
}, { timestamps: true });

const UserModel: mongoose.Model<mongoose.Document & Record<string, any>> =
  (mongoose.models['User'] as any) ||
  mongoose.model('User', UserSchema);

const ProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  integrations: {
    gemini: {
      accessToken: String,
    },
  },
}, { timestamps: true });

const ProfileModel: mongoose.Model<mongoose.Document & Record<string, any>> =
  (mongoose.models['Profile'] as any) ||
  mongoose.model('Profile', ProfileSchema);

// ── 4. Encryption helper (mirrors server/src/utils/encryption.ts) ─────────────
// Format: iv:authTag:encryptedData  – all parts are base64
// Key derivation: if ENCRYPTION_KEY is exactly 32 chars → raw UTF-8; otherwise SHA-256 hash.
function decryptKey(encrypted: string): string | null {
  try {
    const rawKey = process.env.ENCRYPTION_KEY;
    if (!rawKey) return null;
    const crypto = require('crypto') as typeof import('crypto');
    // Mirror server/src/utils/encryption.ts getEncryptionKey()
    const keyBuffer = rawKey.length === 32
      ? Buffer.from(rawKey, 'utf8')
      : crypto.createHash('sha256').update(rawKey).digest();

    const parts = encrypted.split(':');
    if (parts.length !== 3) return null;
    const [ivB64, authTagB64, cipherB64] = parts;
    const iv      = Buffer.from(ivB64,      'base64');
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

// ── 5. Resolve Gemini API key ─────────────────────────────────────────────────
async function resolveGeminiKey(userId: string): Promise<string> {
  // Priority 1: explicit env var
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;

  // Priority 2: encrypted key in Profile
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

// ── 6. Build the AI prompt ────────────────────────────────────────────────────
function buildPrompt(jobs: any[]): string {
  const jobBlocks = jobs.map((j, i) => {
    const parts: string[] = [];
    parts.push(`### Job ${i + 1}: ${j.jobTitle || 'Unknown Title'} @ ${j.companyName || 'Unknown Company'}`);
    if (j.status)   parts.push(`Status: ${j.status}`);
    if (j.jobType)  parts.push(`Type: ${j.jobType}`);
    const skills = j.extractedData?.skills?.join(', ');
    if (skills)     parts.push(`Extracted skills: ${skills}`);
    if (j.jobPrerequisites) parts.push(`\nPrerequisites:\n${j.jobPrerequisites}`);
    if (j.jobDescriptionText) parts.push(`\nFull Description:\n${j.jobDescriptionText.slice(0, 3000)}`);
    return parts.join('\n');
  }).join('\n\n---\n\n');

  return `You are an expert career coach and CV optimisation specialist.

I have applied to (or seriously engaged with) the following ${jobs.length} job postings.
Analyse ALL of them together and produce a comprehensive, data-driven CV gap report.

============================
APPLIED JOB POSTINGS
============================

${jobBlocks}

============================
YOUR TASK
============================

Produce a structured Markdown report with these exact sections:

## 1. Executive Summary
A 3-5 sentence overview: what roles are being targeted, common patterns, and the single most important thing to add to the CV.

## 2. Top Technical Skills to Highlight (ranked by frequency)
A numbered list of technical skills / tools / technologies that appear most frequently across the job descriptions. For each, show:
- Skill name
- Approximate number of jobs mentioning it (e.g. "12/18 jobs")
- Short note on context / level expected

## 3. Top Soft Skills & Competencies
Same format as above but for soft skills, leadership qualities, communication, etc.

## 4. Must-Have Qualifications
Education levels, certifications, years of experience, or specific domain knowledge that showed up most often as hard requirements.

## 5. Keywords for ATS Optimisation
A flat list of exact phrases or keywords that appeared verbatim in multiple job descriptions. These are high-priority for beating ATS filters.

## 6. Gaps & Recommendations
Based on a typical CV for these roles, list the top 5-8 concrete changes to make:
- What to add / strengthen
- What to remove or de-emphasise
- Suggested wording or rephrasing where relevant

## 7. Role Pattern Insights
Any interesting patterns: industries, company sizes, remote vs on-site, salary bands, technologies unique to certain sub-roles, etc.

Be specific, actionable, and concise. Use bullet points liberally. Prioritise by frequency and importance.`;
}

// ── 7. Main ───────────────────────────────────────────────────────────────────
async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('ERROR: MONGODB_URI not set in environment.');
    process.exit(1);
  }

  console.log('\n🔌 Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected.');

  // Resolve user
  let userId: mongoose.Types.ObjectId;
  if (emailArg) {
    const user = await UserModel.findOne({ email: emailArg }).lean();
    if (!user) {
      console.error(`ERROR: No user found with email "${emailArg}".`);
      process.exit(1);
    }
    userId = (user as any)._id;
    console.log(`👤 User: ${(user as any).email} (${userId})`);
  } else {
    // Find the only / first user (convenient for single-user setups)
    const users = await UserModel.find().lean();
    if (users.length === 0) {
      console.error('ERROR: No users found in the database.');
      process.exit(1);
    }
    if (users.length > 1) {
      console.log('\nMultiple users found. Pass --email <email> to pick one:');
      users.forEach(u => console.log(`  • ${(u as any).email}`));
      process.exit(1);
    }
    userId = (users[0] as any)._id;
    console.log(`👤 Auto-selected user: ${(users[0] as any).email}`);
  }

  // Fetch jobs
  console.log(`\n📋 Fetching jobs with status: [${ACTIVE_STATUSES.join(', ')}]...`);
  const jobs = await JobAppModel.find({
    userId,
    status: { $in: ACTIVE_STATUSES },
    $or: [
      { jobDescriptionText: { $exists: true, $ne: '' } },
      { jobPrerequisites:   { $exists: true, $ne: '' } },
    ],
  })
    .select('jobTitle companyName status jobType jobDescriptionText jobPrerequisites extractedData')
    .lean();

  if (jobs.length === 0) {
    console.warn(`\n⚠️  No jobs found with status [${ACTIVE_STATUSES.join(', ')}] that have a job description.`);
    console.warn('   Make sure you have applied to some jobs and that descriptions were extracted.');
    process.exit(0);
  }

  console.log(`✅ Found ${jobs.length} job(s).\n`);
  jobs.forEach((j, i) => console.log(`  ${i + 1}. ${j.jobTitle} @ ${j.companyName} [${j.status}]`));

  // Resolve Gemini key
  const apiKey = await resolveGeminiKey(userId.toString());

  // Call Gemini
  console.log('\n🤖 Sending to Gemini for analysis (this may take 20-60 seconds)...\n');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  });

  const prompt = buildPrompt(jobs);
  const result = await model.generateContent(prompt);
  const report = result.response.text();

  // ── Output ──
  const reportWithHeader =
    `# CV Gap Analysis Report\n` +
    `_Generated: ${new Date().toISOString()}_\n` +
    `_Jobs analysed: ${jobs.length} | Statuses: ${ACTIVE_STATUSES.join(', ')}_\n\n` +
    report;

  const outputPath = outputArg || path.join(process.cwd(), 'cv-gap-report.md');
  fs.writeFileSync(outputPath, reportWithHeader, 'utf8');

  console.log('═'.repeat(70));
  console.log(reportWithHeader);
  console.log('═'.repeat(70));
  console.log(`\n✅ Report saved to: ${outputPath}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message || err);
  mongoose.disconnect().finally(() => process.exit(1));
});
