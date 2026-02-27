/**
 * estimate-missing-salaries.ts
 *
 * One-time script that finds all job applications with no salary information
 * (no user-entered salary, no extracted salary from posting, no AI estimate)
 * and uses Gemini AI to generate a realistic salary estimate for each.
 *
 * Usage (run from the `server/` directory):
 *   npx ts-node scripts/estimate-missing-salaries.ts
 *   npx ts-node scripts/estimate-missing-salaries.ts --dry-run   # preview without saving
 *   npx ts-node scripts/estimate-missing-salaries.ts --email user@example.com  # specific user
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

// ── 1. Load .env ──────────────────────────────────────────────────────────────
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
const isDryRun  = process.argv.includes('--dry-run');
const emailArg  = getArg('--email');

if (isDryRun) console.log('⚠️  DRY RUN — no changes will be saved to the database.');

// ── 3. Minimal Mongoose models ────────────────────────────────────────────────
const JobApplicationSchema = new mongoose.Schema({
  userId:             { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  jobTitle:           String,
  companyName:        String,
  salary:             String,
  jobType:            String,
  jobDescriptionText: String,
  jobPrerequisites:   String,
  showInDashboard:    Boolean,
  extractedData: {
    location:        String,
    salaryRaw:       String,
    estimatedSalary: String,
    salaryIsEstimate: Boolean,
    keyDetails:      mongoose.Schema.Types.Mixed,
  },
}, { timestamps: true });

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
    gemini: { accessToken: String },
  },
  aiProviderSettings: {
    defaultModel: String,
  },
}, { timestamps: true });

const ProfileModel: mongoose.Model<mongoose.Document & Record<string, any>> =
  (mongoose.models['Profile'] as any) ||
  mongoose.model('Profile', ProfileSchema);

// ── 4. Encryption helper (mirrors server/src/utils/encryption.ts) ─────────────
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

// ── 6. AI salary estimation ───────────────────────────────────────────────────
async function estimateSalary(job: any, gemini: GoogleGenerativeAI, modelName: string): Promise<string | null> {
  const model = gemini.getGenerativeModel({ model: modelName });

  // Build context from available job data
  const lines: string[] = [];
  lines.push(`Job Title: ${job.jobTitle || 'Unknown'}`);
  lines.push(`Company: ${job.companyName || 'Unknown'}`);
  if (job.jobType) lines.push(`Employment Type: ${job.jobType}`);
  if (job.extractedData?.location) lines.push(`Location: ${job.extractedData.location}`);

  // Include key details summary
  const kd = job.extractedData?.keyDetails;
  if (kd && Array.isArray(kd) && kd.length > 0) {
    const kdStr = kd.map((item: any) => `${item.key}: ${item.value}`).join(', ');
    lines.push(`Key Details: ${kdStr}`);
  }

  // Include a trimmed job description for context
  if (job.jobDescriptionText) {
    lines.push(`\nJob Description (excerpt):\n${job.jobDescriptionText.slice(0, 2000)}`);
  } else if (job.jobPrerequisites) {
    lines.push(`\nRequirements:\n${job.jobPrerequisites.slice(0, 1000)}`);
  }

  const prompt = `You are a compensation expert. Based on the job details below, provide a realistic annual salary range estimate for this position. Consider: location (cost of living), seniority level, required skills/tech stack, industry, employment type, and current market rates.

Job Details:
${lines.join('\n')}

IMPORTANT: Return ONLY a JSON object in this exact format, nothing else:
{"estimatedSalary": "<range>"}

Examples of valid ranges: "€60k–€80k/year", "$90k–$120k/year", "£45k–£60k/year", "€40k–€55k/year"
Use the appropriate currency for the location. If location is unknown, use USD.
Be specific and realistic. Do not add any explanation.`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    // Parse the JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.estimatedSalary && typeof parsed.estimatedSalary === 'string') {
        return parsed.estimatedSalary;
      }
    }
    console.warn(`  ⚠️  Could not parse AI response for "${job.jobTitle}": ${responseText.slice(0, 100)}`);
    return null;
  } catch (err: any) {
    console.warn(`  ⚠️  AI call failed for "${job.jobTitle}": ${err.message}`);
    return null;
  }
}

// ── 7. Main ───────────────────────────────────────────────────────────────────
async function main() {
  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set in .env');

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected\n');

  // Resolve target users
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

  // Gather jobs with no salary data across all target users
  const jobs = await JobAppModel.find({
    userId: { $in: userIds },
    showInDashboard: true,
    salary: { $in: [null, undefined, ''] },           // no user-entered salary
    'extractedData.salaryRaw': { $in: [null, undefined, ''] },      // no extracted salary
    'extractedData.estimatedSalary': { $in: [null, undefined, ''] }, // no prior estimate
  }).lean();

  if (jobs.length === 0) {
    console.log('✅ No jobs found that are missing salary information. All done!');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${jobs.length} job(s) with no salary data — estimating...\n`);

  // Group by userId so we only resolve Gemini key once per user
  const byUser = new Map<string, any[]>();
  for (const job of jobs) {
    const uid = job.userId.toString();
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid)!.push(job);
  }

  let updated = 0;
  let failed  = 0;

  for (const [userId, userJobs] of byUser) {
    // Resolve API key for this user
    let gemini: GoogleGenerativeAI;
    let modelName: string;
    try {
      const apiKey = await resolveGeminiKey(userId);
      gemini = new GoogleGenerativeAI(apiKey);
      // Use user's configured model or fall back to gemini-2.5-flash
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
      process.stdout.write(`  Estimating salary for ${label}... `);

      const estimate = await estimateSalary(job, gemini, modelName);

      if (!estimate) {
        console.log('SKIPPED (no estimate returned)');
        failed++;
        continue;
      }

      console.log(`→ ${estimate}`);

      if (!isDryRun) {
        await JobAppModel.updateOne(
          { _id: job._id },
          {
            $set: {
              'extractedData.estimatedSalary': estimate,
              'extractedData.salaryIsEstimate': true,
            },
          }
        );
        updated++;
      } else {
        updated++; // count as "would update" in dry-run
      }

      // Small delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
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
