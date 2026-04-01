import fs from 'fs/promises';
import path from 'path';

type JsonObject = Record<string, any>;

type ImproveIssue = {
  type: string;
  detail: string;
};

type ImproveEntryResult = {
  section: string;
  index: number;
  original: any;
  improved: any;
  issues: ImproveIssue[];
};

type CvRunResult = {
  fileName: string;
  filePath: string;
  cvId?: string;
  uploadResponse?: JsonObject;
  parsedCv?: JsonObject;
  improvements: ImproveEntryResult[];
  improvedCv?: JsonObject;
  errors: string[];
};

type Config = {
  dir: string;
  apiBase: string;
  email: string;
  password: string;
  outDir: string;
  delayMs: number;
  recursive: boolean;
};

const SUPPORTED_EXTENSIONS = new Set(['.pdf', '.docx', '.rtf', '.txt']);

function parseArgs(argv: string[]): Partial<Config> {
  const out: Partial<Config> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dir') out.dir = argv[i + 1];
    if (arg === '--apiBase') out.apiBase = argv[i + 1];
    if (arg === '--email') out.email = argv[i + 1];
    if (arg === '--password') out.password = argv[i + 1];
    if (arg === '--out') out.outDir = argv[i + 1];
    if (arg === '--delayMs') out.delayMs = Number(argv[i + 1]);
    if (arg === '--recursive') out.recursive = true;
  }
  return out;
}

function requireString(value: string | undefined, label: string): string {
  if (!value || !value.trim()) {
    throw new Error(`Missing required ${label}.`);
  }
  return value.trim();
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.rtf':
      return 'application/rtf';
    case '.txt':
      return 'text/plain';
    default:
      return 'application/octet-stream';
  }
}

async function delay(ms: number): Promise<void> {
  if (ms <= 0) return;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function listFiles(root: string, recursive: boolean): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (recursive) {
        const nested = await listFiles(fullPath, recursive);
        out.push(...nested);
      }
      continue;
    }
    out.push(fullPath);
  }
  return out;
}

function isPlainObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateImprovedShape(original: any, improved: any): ImproveIssue[] {
  const issues: ImproveIssue[] = [];

  const originalIsArray = Array.isArray(original);
  const improvedIsArray = Array.isArray(improved);
  if (originalIsArray !== improvedIsArray) {
    issues.push({ type: 'type_mismatch', detail: 'Array vs non-array response.' });
    return issues;
  }

  const originalType = originalIsArray ? 'array' : typeof original;
  const improvedType = improvedIsArray ? 'array' : typeof improved;
  if (originalType !== improvedType) {
    issues.push({ type: 'type_mismatch', detail: `Expected ${originalType}, got ${improvedType}.` });
    return issues;
  }

  if (isPlainObject(original) && isPlainObject(improved)) {
    const originalKeys = Object.keys(original).sort();
    const improvedKeys = Object.keys(improved).sort();
    if (originalKeys.join('|') !== improvedKeys.join('|')) {
      issues.push({ type: 'key_mismatch', detail: `Expected keys ${originalKeys.join(', ')}, got ${improvedKeys.join(', ')}.` });
    }

    for (const key of originalKeys) {
      const a = Array.isArray(original[key]) ? 'array' : typeof original[key];
      const b = Array.isArray(improved[key]) ? 'array' : typeof improved[key];
      if (a !== b) {
        issues.push({ type: 'field_type_mismatch', detail: `Key ${key}: expected ${a}, got ${b}.` });
      }
    }
  }

  return issues;
}

async function login(apiBase: string, email: string, password: string): Promise<string> {
  const res = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed: ${res.status} ${text}`);
  }

  const data = await res.json() as { token?: string };
  if (!data.token) {
    throw new Error('Login response missing token.');
  }
  return data.token;
}

async function uploadCv(apiBase: string, token: string, filePath: string): Promise<JsonObject> {
  const buffer = await fs.readFile(filePath);
  const fileName = path.basename(filePath);
  const mimeType = getMimeType(filePath);

  const form = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  form.append('cvFile', blob, fileName);

  const res = await fetch(`${apiBase}/cvs/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<JsonObject>;
}

async function improveSection(apiBase: string, token: string, sectionName: string, sectionData: any): Promise<any> {
  const res = await fetch(`${apiBase}/generator/improve-section`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sectionName, sectionData }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Improve-section failed: ${res.status} ${text}`);
  }

  return res.json();
}

function buildImprovedCv(original: JsonObject, improvements: ImproveEntryResult[]): JsonObject {
  const next = JSON.parse(JSON.stringify(original));
  for (const item of improvements) {
    if (Array.isArray(next[item.section]) && next[item.section][item.index]) {
      next[item.section][item.index] = item.improved;
    }
  }
  return next;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const config: Config = {
    dir: requireString(args.dir ?? process.env.VH_CV_DIR, 'CV directory (--dir or VH_CV_DIR)'),
    apiBase: requireString(args.apiBase ?? process.env.VH_API_BASE, 'API base (--apiBase or VH_API_BASE)'),
    email: requireString(args.email ?? process.env.VH_EMAIL, 'email (--email or VH_EMAIL)'),
    password: requireString(args.password ?? process.env.VH_PASSWORD, 'password (--password or VH_PASSWORD)'),
    outDir: args.outDir ?? process.env.VH_OUT_DIR ?? path.join(process.cwd(), 'cv-batch-output'),
    delayMs: Number.isFinite(args.delayMs) ? Number(args.delayMs) : Number(process.env.VH_DELAY_MS ?? 400),
    recursive: Boolean(args.recursive),
  };

  await fs.mkdir(config.outDir, { recursive: true });

  const token = await login(config.apiBase, config.email, config.password);

  const files = (await listFiles(config.dir, config.recursive))
    .filter((filePath) => SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase()));

  const resultsPath = path.join(config.outDir, 'results.jsonl');
  await fs.writeFile(resultsPath, '', { flag: 'w' });

  for (const filePath of files) {
    const runResult: CvRunResult = {
      fileName: path.basename(filePath),
      filePath,
      improvements: [],
      errors: [],
    };

    try {
      const uploadResponse = await uploadCv(config.apiBase, token, filePath);
      runResult.uploadResponse = uploadResponse;
      runResult.cvId = uploadResponse?.cv?._id ?? uploadResponse?.cv?.id;

      const cvJson = uploadResponse?.cv?.cvJson as JsonObject | undefined;
      if (!cvJson || !isPlainObject(cvJson)) {
        throw new Error('Upload response missing cvJson.');
      }
      runResult.parsedCv = cvJson;

      const sectionsToImprove = ['work', 'education', 'skills'];
      for (const sectionName of sectionsToImprove) {
        const section = cvJson[sectionName];
        if (!Array.isArray(section)) continue;

        for (let i = 0; i < section.length; i += 1) {
          const originalEntry = section[i];
          try {
            const improved = await improveSection(config.apiBase, token, sectionName, originalEntry);
            const issues = validateImprovedShape(originalEntry, improved);
            runResult.improvements.push({
              section: sectionName,
              index: i,
              original: originalEntry,
              improved,
              issues,
            });
          } catch (err: any) {
            runResult.errors.push(`Improve ${sectionName}[${i}]: ${err.message || String(err)}`);
          }
          await delay(config.delayMs);
        }
      }

      runResult.improvedCv = buildImprovedCv(cvJson, runResult.improvements);
    } catch (err: any) {
      runResult.errors.push(err.message || String(err));
    }

    const fileSafe = runResult.fileName.replace(/[^a-z0-9._-]+/gi, '_');
    const outputFilePath = path.join(config.outDir, `${fileSafe}.json`);
    await fs.writeFile(outputFilePath, JSON.stringify(runResult, null, 2));
    await fs.appendFile(resultsPath, `${JSON.stringify(runResult)}\n`);

    await delay(config.delayMs);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});