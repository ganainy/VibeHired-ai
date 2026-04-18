import { z } from 'zod';

export const TailoringChangeSchema = z.object({
  section: z.string().describe("CV section key e.g. 'summary', 'work', 'skills'"),
  description: z.string().describe("What changed (in English)"),
  reason: z.string().describe("Why it changed, referencing the job (in English)"),
  before: z.string().optional().describe("Short original snippet (in English)"),
  after: z.string().optional().describe("Short updated snippet (in English)"),
});

export type TailoringChange = z.infer<typeof TailoringChangeSchema>;

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
