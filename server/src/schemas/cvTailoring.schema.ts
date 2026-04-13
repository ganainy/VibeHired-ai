import { z } from 'zod';

// --- Shared ---
export const TailoringChangeSchema = z.object({
  section: z.string().describe("CV section key e.g. 'summary', 'work', 'skills'"),
  description: z.string().describe("What changed (in English)"),
  reason: z.string().describe("Why it changed, referencing the job (in English)"),
  before: z.string().optional().describe("Short original snippet (in English)"),
  after: z.string().optional().describe("Short updated snippet (in English)"),
});

export type TailoringChange = z.infer<typeof TailoringChangeSchema>;

// --- Shared Tailoring Response Schema ---
// Used for both JSON Resume and Freeform CVs — tailoredCv is open-ended to
// preserve arbitrary keys while still enforcing the wrapper shape + changes.
export const TailoringResponseSchema = z.object({
  tailoredCv: z.record(z.any()).describe(
    "Tailored CV JSON. Preserve the same top-level keys and structure as the base CV."
  ),
  changes: z.array(TailoringChangeSchema).min(1),
});

// Pre-converted JSON Schema for Gemini (computed once at module load)
// TailoredCv includes top-level JSON Resume keys as structural hints so Gemini
// knows what to generate — even for freeform CVs these act as suggestions,
// not requirements, so Gemini still fills whatever the base CV actually has.
export const tailoringResponseJsonSchema = {
  type: 'object' as const,
  required: ['tailoredCv', 'changes'],
  properties: {
    tailoredCv: {
      type: 'object' as const,
      description: 'Tailored CV JSON preserving the same top-level keys and structure as the base CV.',
      properties: {
        basics:       { type: 'object' as const },
        work:         { type: 'array' as const, items: { type: 'object' as const } },
        education:    { type: 'array' as const, items: { type: 'object' as const } },
        skills:       { type: 'array' as const, items: { type: 'object' as const } },
        projects:     { type: 'array' as const, items: { type: 'object' as const } },
        languages:    { type: 'array' as const, items: { type: 'object' as const } },
        certificates: { type: 'array' as const, items: { type: 'object' as const } },
        awards:       { type: 'array' as const, items: { type: 'object' as const } },
        volunteer:    { type: 'array' as const, items: { type: 'object' as const } },
        interests:    { type: 'array' as const, items: { type: 'object' as const } },
        references:   { type: 'array' as const, items: { type: 'object' as const } },
        meta:         { type: 'object' as const },
      },
      // No 'required' on these — sections not in the base CV stay absent
    },
    changes: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        required: ['section', 'description', 'reason'],
        properties: {
          section:     { type: 'string' as const, description: "CV section key e.g. 'summary', 'work', 'skills'" },
          description: { type: 'string' as const, description: 'What changed (in English)' },
          reason:      { type: 'string' as const, description: 'Why it changed, referencing the job (in English)' },
          before:      { type: 'string' as const, description: 'Short original snippet (in English)' },
          after:       { type: 'string' as const, description: 'Short updated snippet (in English)' },
        },
      },
    },
  },
};

// Lightweight schema for the generateAiTailoringChanges diff call (changes only)
export const changesOnlyJsonSchema = {
  type: 'object' as const,
  required: ['changes'],
  properties: {
    changes: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        required: ['section', 'description', 'reason'],
        properties: {
          section:     { type: 'string' as const, description: "CV section key" },
          description: { type: 'string' as const, description: 'What changed (in English)' },
          reason:      { type: 'string' as const, description: 'Why this change was made (in English)' },
          before:      { type: 'string' as const, description: 'Original text snippet (in English)' },
          after:       { type: 'string' as const, description: 'Updated text snippet (in English)' },
        },
      },
    },
  },
};

// Convenience type for the unified response shape
export type TailoringResponse = {
  tailoredCv: Record<string, any>;
  changes: TailoringChange[];
};
