// Focused schemas for the sparse CV patch pipeline

// ── Call 1: JD Analysis ──
export const jdAnalysisJsonSchema = {
  type: 'object' as const,
  required: ['extractedKeywords', 'topKeywordsForSummary', 'competencyGrid', 'keywordInjections'],
  properties: {
    extractedKeywords: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: '15-20 keywords extracted from the JD',
    },
    topKeywordsForSummary: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Top 5 keywords to use in the professional summary',
    },
    competencyGrid: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: '6-8 keyword phrases for the competency grid section',
    },
    keywordInjections: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        required: ['cvConcept', 'jdKeyword'],
        properties: {
          cvConcept: { type: 'string' as const, description: 'Concept/skill from the base CV' },
          jdKeyword: { type: 'string' as const, description: 'Equivalent keyword from the JD to use' },
        },
      },
      description: 'Map of CV concepts to JD vocabulary for keyword injection',
    },
    detectedArchetype: {
      type: 'string' as const,
      description: 'Detected role archetype (e.g., IT Support, DevOps, etc.)',
    },
  },
};

export type JdAnalysisResult = {
  extractedKeywords: string[];
  topKeywordsForSummary: string[];
  competencyGrid: string[];
  keywordInjections: Array<{ cvConcept: string; jdKeyword: string }>;
  detectedArchetype?: string;
};

export type ContentPatchResult = Record<string, any>;

// ── Call 3: Changes List ──
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
          section: { type: 'string' as const, description: "CV section key" },
          description: { type: 'string' as const, description: 'What changed (one line, in English)' },
          reason: { type: 'string' as const, description: 'Why this change was made (one line, in English)' },
        },
      },
    },
  },
};

export type TailoringChangesResult = {
  changes: Array<{
    section: string;
    description: string;
    reason: string;
    before?: string;
    after?: string;
  }>;
};
