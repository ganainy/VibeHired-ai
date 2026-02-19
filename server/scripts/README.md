# Standalone & Migration Scripts

All scripts live in `server/scripts/` and are run with `ts-node` from the **`server/`** directory.

## Prerequisites

Every script reads from `server/.env`.  
The minimum required variables are:

```env
MONGODB_URI=mongodb://localhost:27017/job-app-assistant
GEMINI_API_KEY=<your-key>      # only needed for AI scripts
ENCRYPTION_KEY=<your-key>      # only needed when the Gemini key is stored encrypted in the DB
```

---

## 1. `analyze-job-descriptions.ts` — CV Gap Analysis

Fetches every job you have **Applied / Interviewed / Assessed / Offered / Rejected** and sends all job descriptions to Gemini AI, which returns a prioritised "what your CV should include" report.

### Usage

```bash
cd server

# Auto-picks the only user in the DB (single-user setup)
npm run analyze-jobs

# Specify account explicitly (required when multiple users exist)
npm run analyze-jobs -- --email you@example.com

# Analyse only specific statuses (comma-separated, no spaces)
npm run analyze-jobs -- --email you@example.com --status Applied,Interview

# Save the report to a custom path
npm run analyze-jobs -- --email you@example.com --output ../cv-gap-report.md
```

### CLI flags

| Flag | Default | Description |
|------|---------|-------------|
| `--email <email>` | auto (first/only user) | Account to analyse |
| `--status <list>` | `Applied,Interview,Assessment,Offer,Rejected` | Comma-separated statuses to include |
| `--output <path>` | `server/cv-gap-report.md` | Where to write the Markdown report |

### What the report contains

1. **Executive Summary** — role targets & single most important CV change  
2. **Top Technical Skills** — ranked by how many jobs mention them  
3. **Top Soft Skills** — same format  
4. **Must-Have Qualifications** — education, certs, years of experience  
5. **ATS Keywords** — exact phrases to copy into your CV  
6. **Gaps & Recommendations** — what to add, remove, and how to rephrase  
7. **Role Pattern Insights** — industries, remote/hybrid, salary bands, location clusters  

### How it resolves the Gemini API key

1. `GEMINI_API_KEY` in `.env` (highest priority)  
2. Encrypted key stored in your user Profile (requires `ENCRYPTION_KEY` in `.env`)

---

## 2. `reset_stuck_jobs.ts` — Reset Stuck Job Recommendations

Clears recommendation cache entries that are in a broken state (score is `null` with no recorded error, or reason is still `"Calculating..."`). Affected jobs are automatically re-queued for analysis on the next page load.

### Usage

```bash
cd server
npx ts-node scripts/reset_stuck_jobs.ts
```

### When to use

- Job cards are stuck showing a spinner / "Calculating…" recommendation indefinitely  
- After a server crash mid-analysis left jobs in a partial state  

### Safety

- **Non-destructive**: only clears the `recommendation` sub-document, all other job data is untouched  
- **Idempotent**: safe to run multiple times  

---

## 3. `test-cv-extraction.ts` — Test CV PDF Extraction

Sends a local CV PDF file to Gemini and prints the extracted JSON Resume Schema to the console. Used to verify that the AI extraction prompt and model are working correctly.

### Usage

```bash
cd server
# Requires GEMINI_API_KEY in .env
npx ts-node scripts/test-cv-extraction.ts <path-to-cv.pdf>
```

### When to use

- Debugging PDF extraction issues  
- Verifying a new Gemini model produces correct JSON Resume output  
- Checking extraction quality before processing real user CVs  

---

## 4. `migrate-to-cv-branches.ts` — CV Branch Migration

One-time migration that converts the old **master CV** system to the new **CV branch** system.

### What it does

1. Converts existing master CVs → primary CVs  
2. Sets `displayName` on existing job-specific CVs  
3. Populates `baseCvId` on existing job applications  

### Usage

```bash
cd server
npm run migrate-cv-branches
```

### Important notes

- ⚠️ **Run once** after deploying the CV branch feature — subsequent runs are safe (idempotent) but unnecessary  
- ⚠️ Uses the database pointed to by `MONGODB_URI` — double-check before running against production  
- Runs inside a **MongoDB transaction** — automatically rolls back on any error  

---

## Development vs Production

To target a specific database, set `MONGODB_URI` in `server/.env` before running any script:

```env
# Local
MONGODB_URI=mongodb://localhost:27017/job-app-assistant

# Atlas (production)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/job-app-assistant
```
