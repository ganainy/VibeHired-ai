import { generateStructuredResponse } from '../utils/aiService';
import {
  JdAnalysisResult,
  ContentPatchResult,
  TailoringChangesResult,
  jdAnalysisJsonSchema,
  changesOnlyJsonSchema,
} from '../schemas/cvTailoringPipeline';

export interface TailoringPipelineResult {
  jdAnalysis: JdAnalysisResult;
  patch: ContentPatchResult;
  changes: TailoringChangesResult['changes'];
  tailoredCv: Record<string, any>;
}

export type ProgressEvent = {
  step: string;
  stepLabel: string;
  description: string;
  progress: number;
};

export type ProgressCallback = (event: ProgressEvent) => void;

// Sections that typically need tailoring. We send only these to Gemini
// to keep the prompt small and focused.
const TAILORABLE_SECTION_PATTERNS = [
  // Summary / profile
  /summary|profil|about|objective|ziel|überblick/i,
  // Work experience (covers German compound words like BERUFSERFAHRUNG)
  /work|experience|erfahrung|beschäftigung|tätigkei|werdegang|arbeit|praktisch/i,
  // Projects
  /project|projekt/i,
  // Skills (covers IT-ERFAHRUNG, TECHNISCHE KENNTNISSE, KOMPETENZEN, etc.)
  /skill|kenntnis|kompetenz|competenc|technical|fähigkeit|it-erfahr|softwar/i,
  // Languages (keywords matter for JD matching)
  /language|sprach/i,
  // Certifications (often contain relevant keywords)
  /certif|zertif|weiterbildung|qualifikation|schulung/i,
  // Education & organizations — degree names and affiliations matter for JD matching
  /education|ausbildung|studium|schul|universit|akademisch|organisation|organization|vereinigung/i,
];

/**
 * Extract only the sections that can be tailored (summary, work, projects, skills).
 * Returns a subset of the base CV and a list of the keys included.
 */
function extractTailorableSections(baseCv: Record<string, any>): { sections: Record<string, any>; keys: string[] } {
  const sections: Record<string, any> = {};
  const keys: string[] = [];

  for (const [key, value] of Object.entries(baseCv)) {
    if (TAILORABLE_SECTION_PATTERNS.some(p => p.test(key))) {
      sections[key] = value;
      keys.push(key);
    }
  }

  // If no patterns matched, fall back to all non-metadata keys
  if (keys.length === 0) {
    for (const [key, value] of Object.entries(baseCv)) {
      if (typeof value === 'string' || Array.isArray(value) || typeof value === 'object') {
        sections[key] = value;
        keys.push(key);
      }
    }
  }

  return { sections, keys };
}

function buildJdAnalysisPrompt(jobDescription: string): string {
  return `
Analyze this job description and extract the following:

**Job Description:**
---
${jobDescription}
---

Return a JSON object with:
- extractedKeywords: 15-20 keywords from the JD (technical terms, skills, action phrases)
- topKeywordsForSummary: top 5 keywords to use in the professional summary
- competencyGrid: 6-8 keyword phrases for the competency grid section
- keywordInjections: array of {cvConcept, jdKeyword} mapping CV concepts to JD vocabulary
- detectedArchetype: detected role type (e.g., IT Support, DevOps, Backend Engineer)
`.trim();
}

function buildContentPatchPrompt(
  tailorableSections: Record<string, any>,
  tailorableKeys: string[],
  allBaseKeys: string[],
  jobDescription: string,
  jdAnalysis: JdAnalysisResult,
  languageName: string,
): string {
  return `
Tailor these CV sections for the job below.

Target language: ${languageName}

Base CV sections to tailor:
\`\`\`json
${JSON.stringify(tailorableSections, null, 2)}
\`\`\`

Job Description:
---
${jobDescription}
---

JD Keywords: ${jdAnalysis.extractedKeywords.join(', ')}
Summary Keywords: ${jdAnalysis.topKeywordsForSummary.join(', ')}
Competency Grid: ${jdAnalysis.competencyGrid.join(', ')}

Rules:
1. Rewrite summary using top 5 keywords + candidate narrative.
2. Reorder work bullets — most JD-relevant first. Reformulate using JD vocabulary.
3. Select top 3-4 projects. Omit less relevant ones.
4. Update skills with JD keywords.
5. NEVER invent skills or experience. Only reformulate what exists.
6. No clichés. Active voice.
7. All CV text in ${languageName}.
8. For skill/language/knowledge entries that use {category, content} structure: NEVER set content to null. If no specific value exists, use the category name itself as the content, or omit the entry entirely. A null content field renders as a blank row in the CV.

Return a JSON object containing ALL of these sections, rewritten for the job.
You MUST return all sections: ${tailorableKeys.join(', ')}.
Even if a section only needs minor tweaks, include it in full.
Copy key names VERBATIM from above. Preserve internal structure exactly.

Your response MUST start with:
{
  "${tailorableKeys[0]}": "...",
`.trim();
}

function buildChangesPrompt(
  patchKeys: string[],
  baseSnippets: Record<string, string>,
  patchSnippets: Record<string, string>,
  jobRole: string,
): string {
  const diffs = patchKeys.map(key => {
    const before = baseSnippets[key] || '(new section)';
    const after = patchSnippets[key] || '(removed section)';
    return `- ${key}: before="${before}" → after="${after}"`;
  }).join('\n');

  return `
<context>
The following CV sections were modified for the role: "${jobRole}".

${diffs}
</context>

<instructions>
Based on the changes above, return a JSON object with a "changes" array.
Do NOT repeat any content from <context> in your output values.

Each change entry must have exactly these fields:
- section: the section key that changed (e.g., "work", "skills")
- description: one-line summary of what changed (English, max 60 chars)
- reason: why this change was made, referencing the job (English, max 60 chars)

Do NOT include "before" or "after" fields — they are not needed.

Respond with valid JSON only. No markdown. No explanation.
</instructions>
`.trim();
}

/**
 * Validate patch keys against base CV to reject hallucinated keys.
 */
function validatePatch(patch: ContentPatchResult, baseCv: Record<string, any>): ContentPatchResult {
  const validated: ContentPatchResult = {};
  for (const key of Object.keys(patch)) {
    if (key in baseCv) {
      validated[key] = patch[key];
    } else {
      console.warn(`  ⚠️  Rejected hallucinated patch key: "${key}" — not in base CV`);
    }
  }
  return validated;
}

/**
 * Sanitize patch: replace null content fields in array entries with
 * fallback values from the base CV, or omit them if no fallback exists.
 */
function sanitizePatchNulls(patch: ContentPatchResult, baseCv: Record<string, any>): ContentPatchResult {
    const sanitized: ContentPatchResult = {};
    for (const [key, value] of Object.entries(patch)) {
        if (!Array.isArray(value)) {
            sanitized[key] = value;
            continue;
        }
        sanitized[key] = value.map((entry: any) => {
            if (!entry || typeof entry !== 'object') return entry;
            const cleaned: Record<string, any> = {};
            for (const [field, val] of Object.entries(entry)) {
                if (val === null) {
                    const baseArray = baseCv[key];
                    if (Array.isArray(baseArray)) {
                        const baseEntry = baseArray.find((b: any) =>
                            b && typeof b === 'object' && b.category === entry.category
                        );
                        if (baseEntry && baseEntry[field] !== null && baseEntry[field] !== undefined) {
                            cleaned[field] = baseEntry[field];
                        }
                    }
                } else {
                    cleaned[field] = val;
                }
            }
            return cleaned;
        });
    }
    return sanitized;
}

/**
 * Build short snippets for each patched key (first 100 chars of stringified value).
 */
function buildSnippets(obj: Record<string, any>, keys: string[], maxLen: number = 100): Record<string, string> {
  const snippets: Record<string, string> = {};
  for (const key of keys) {
    const val = obj[key];
    if (val === undefined) {
      snippets[key] = '(removed)';
    } else if (typeof val === 'string') {
      snippets[key] = val.substring(0, maxLen);
    } else if (Array.isArray(val)) {
      const texts = val.slice(0, 3).map((item: any) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          return item.title || item.name || item.description || item.content ||
                 item.company || item.institution || item.skill || JSON.stringify(item).substring(0, Math.min(200, maxLen));
        }
        return String(item);
      }).filter(Boolean).join('; ');
      snippets[key] = texts.length > maxLen ? texts.substring(0, maxLen) + '...' : texts;
    } else if (typeof val === 'object') {
      const str = JSON.stringify(val);
      snippets[key] = str.substring(0, maxLen);
    } else {
      snippets[key] = String(val).substring(0, maxLen);
    }
  }
  return snippets;
}

export async function runTailoringPipeline(
  userId: string,
  baseCvJson: Record<string, any>,
  jobDescription: string,
  languageName: string,
  showChanges: boolean = true,
  onProgress?: ProgressCallback,
): Promise<TailoringPipelineResult> {
  // ── Call 1: JD Analysis ──
  onProgress?.({ step: 'analyzing', stepLabel: 'Analyzing Job Description', description: 'Extracting keywords, competencies, and requirements from the job description...', progress: 15 });
  console.log('  → Pipeline Call 1/4: JD Analysis...');
  const jdAnalysis = await generateStructuredResponse<JdAnalysisResult>(userId, buildJdAnalysisPrompt(jobDescription), {
    maxTokens: 2048,
    responseJsonSchema: jdAnalysisJsonSchema,
    modelPreference: 'fast',
  });
  console.log(`     Extracted ${jdAnalysis.extractedKeywords.length} keywords, ${jdAnalysis.competencyGrid.length} competencies`);
  if (jdAnalysis.detectedArchetype) {
    console.log(`     Detected archetype: ${jdAnalysis.detectedArchetype}`);
  }

  onProgress?.({ step: 'matching', stepLabel: 'Matching Skills & Experience', description: `Found ${jdAnalysis.extractedKeywords.length} key requirements. Matching your experience to the role...`, progress: 30 });

  // ── Extract only tailorable sections for Call 2 ──
  const { sections: tailorableSections, keys: tailorableKeys } = extractTailorableSections(baseCvJson);
  const allBaseKeys = Object.keys(baseCvJson);
  const tailorableSize = JSON.stringify(tailorableSections).length;
  const fullSize = JSON.stringify(baseCvJson).length;
  console.log(`  → Tailorable sections: ${tailorableKeys.join(', ')} (${tailorableSize} bytes vs ${fullSize} bytes full CV)`);

  // ── Call 2: Sparse Content Patch (only tailorable sections) ──
  onProgress?.({ step: 'tailoring', stepLabel: 'Tailoring Your CV', description: 'Rewriting your CV content to highlight relevant experience and skills...', progress: 40 });
  console.log('  → Pipeline Call 2/4: Sparse Content Patch...');
  const prompt2 = buildContentPatchPrompt(tailorableSections, tailorableKeys, allBaseKeys, jobDescription, jdAnalysis, languageName);
  console.log(`     Prompt size: ${prompt2.length} chars`);

  let patch: ContentPatchResult = {};
  let patchKeys: string[] = [];

  // Attempt 1: quality model
  try {
    patch = await generateStructuredResponse<ContentPatchResult>(userId, prompt2, {
      maxTokens: 8192,
      modelPreference: 'quality',
      debugLabel: 'Call2-ContentPatch',
    });
    patchKeys = Object.keys(patch);
  } catch (err: any) {
    console.warn(`  ⚠️  Call 2 failed with quality model: ${err.message}`);
  }

  // Attempt 2: fast model (if quality failed or returned empty)
  if (patchKeys.length === 0) {
    onProgress?.({ step: 'tailoring', stepLabel: 'Tailoring Your CV', description: 'Retrying with alternative approach for better results...', progress: 48 });
    console.log('  → Retrying with fast model...');
    try {
      patch = await generateStructuredResponse<ContentPatchResult>(userId, prompt2, {
        maxTokens: 8192,
        modelPreference: 'fast',
        debugLabel: 'Call2-ContentPatch-Fast',
      });
      patchKeys = Object.keys(patch);
    } catch (err2: any) {
      console.warn(`  ⚠️  Call 2 also failed with fast model: ${err2.message}`);
    }
  }

  // Attempt 3: fast model with explicit retry prompt
  if (patchKeys.length === 0) {
    onProgress?.({ step: 'tailoring', stepLabel: 'Tailoring Your CV', description: 'Optimizing content generation...', progress: 54 });
    console.log('  → Retrying with explicit instruction prompt...');
    const retryPrompt = prompt2 + `

IMPORTANT: Your previous response was empty or did not contain valid JSON.
You MUST return a JSON object. Start your response immediately with { and include all of these keys: ${tailorableKeys.join(', ')}.
Do not include any explanation or markdown. Only the JSON object.`;

    try {
      patch = await generateStructuredResponse<ContentPatchResult>(userId, retryPrompt, {
        maxTokens: 8192,
        modelPreference: 'fast',
        debugLabel: 'Call2-ContentPatch-Retry',
      });
      patchKeys = Object.keys(patch);
    } catch (err3: any) {
      console.warn(`  ⚠️  Call 2 retry also failed: ${err3.message}`);
    }
  }

  if (patchKeys.length === 0) {
    throw new Error(
      'CV tailoring produced no output after three model attempts. ' +
      'The job description may be too short, the CV content may be empty, ' +
      'or the model response was malformed. ' +
      'Raw response snippet: ' + JSON.stringify(patch).substring(0, 300)
    );
  }

  console.log(`     Patched ${patchKeys.length} sections: ${patchKeys.join(', ')}`);

  // ── Step 3: Validate & Merge ──
  onProgress?.({ step: 'tailoring', stepLabel: 'Tailoring Your CV', description: `Tailored ${patchKeys.length} sections. Validating and merging changes...`, progress: 65 });
  const validatedPatch = validatePatch(patch, baseCvJson);
  const sanitizedPatch = sanitizePatchNulls(validatedPatch, baseCvJson);
  const tailoredCv = { ...baseCvJson, ...sanitizedPatch };
  console.log(`     After validation: ${Object.keys(sanitizedPatch).length} sections applied`);

  // ── Call 4: Changes List (diff snippets only) ──
  let changesResult: TailoringChangesResult;

  if (!showChanges) {
    onProgress?.({ step: 'finalizing', stepLabel: 'Finalizing Document', description: 'Preparing your tailored CV...', progress: 85 });
    console.log('  → Pipeline Call 3/4: Changes Generation — SKIPPED (showChanges=false)');
    changesResult = {
      changes: [{
        section: 'Full CV',
        description: `AI tailored your CV for this role — ${patchKeys.length} section${patchKeys.length !== 1 ? 's' : ''} updated to match job requirements`,
        reason: 'Optimized content, keywords, and emphasis to align with the target position.',
      }],
    };
  } else {
    onProgress?.({ step: 'finalizing', stepLabel: 'Finalizing Document', description: 'Summarizing the tailoring changes for your review...', progress: 80 });
    console.log('  → Pipeline Call 3/4: Changes Generation...');

    // If no patches were applied, generate changes from the JD analysis alone
    if (patchKeys.length === 0) {
      console.log('     No patches to compare — generating changes from JD analysis only');
      const baseSnippets = buildSnippets(baseCvJson, tailorableKeys, 300);
      const analysisSnippet = `Keywords extracted: ${jdAnalysis.extractedKeywords.slice(0, 10).join(', ')}...`;
      changesResult = await generateStructuredResponse<TailoringChangesResult>(userId, buildChangesPrompt(tailorableKeys, baseSnippets, { analysis: analysisSnippet }, jobDescription.split('\n')[0].substring(0, 80)), {
        maxTokens: 4096,
        responseJsonSchema: changesOnlyJsonSchema,
        modelPreference: 'quality',
      });
      console.log(`     Generated ${changesResult.changes.length} changes`);
    } else {
      const baseSnippets = buildSnippets(baseCvJson, patchKeys, 300);
      const patchSnippets = buildSnippets(sanitizedPatch, patchKeys, 300);
      changesResult = await generateStructuredResponse<TailoringChangesResult>(userId, buildChangesPrompt(patchKeys, baseSnippets, patchSnippets, jobDescription.split('\n')[0].substring(0, 80)), {
        maxTokens: 4096,
        responseJsonSchema: changesOnlyJsonSchema,
        modelPreference: 'quality',
      });
      console.log(`     Generated ${changesResult.changes.length} changes`);
    }
  }

  // Fallback: if AI returned 0 changes but patches were applied, generate summaries from patch keys
  if (changesResult.changes.length === 0 && patchKeys.length > 0) {
    console.log('     ⚠️  AI returned 0 changes despite patches — generating fallback change descriptions');
    const keywordHints = jdAnalysis.keywordInjections.slice(0, 5).map(i => i.jdKeyword).join(', ');
    changesResult.changes = patchKeys.map(key => ({
      section: key,
      description: `Tailored ${key} content for this role`,
      reason: `Optimized ${key} to align with job requirements${keywordHints ? ` (e.g., ${keywordHints})` : ''}`,
    }));
  }

  // ── Log tailoring details ──
  console.log('═══════════════════════════════════════════════════════');
  console.log('  CV TAILORING DETAILS');
  console.log('═══════════════════════════════════════════════════════');

  console.log(`\n📌 EXTRACTED KEYWORDS (${jdAnalysis.extractedKeywords.length}):`);
  jdAnalysis.extractedKeywords.forEach((kw, i) => console.log(`   ${i + 1}. ${kw}`));

  const summaryKey = patchKeys.find(k => /summary|profil|profil/i.test(k));
  if (summaryKey && typeof validatedPatch[summaryKey] === 'string') {
    console.log('\n📝 REWRITTEN SUMMARY:');
    console.log(`   ${validatedPatch[summaryKey].substring(0, 300)}`);
  }

  console.log('\n🔄 PATCHED SECTIONS:');
  patchKeys.forEach(key => console.log(`   - ${key}`));

  console.log('\n🏷️  COMPETENCY GRID:');
  jdAnalysis.competencyGrid.forEach((c, i) => console.log(`   ${i + 1}. ${c}`));

  if (jdAnalysis.keywordInjections.length) {
    console.log('\n💉 KEYWORD INJECTIONS:');
    jdAnalysis.keywordInjections.forEach((inj, i) => {
      console.log(`   ${i + 1}. CV: "${inj.cvConcept}" → JD: "${inj.jdKeyword}"`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════');

  return {
    jdAnalysis,
    patch: validatedPatch,
    changes: changesResult.changes,
    tailoredCv,
  };
}
