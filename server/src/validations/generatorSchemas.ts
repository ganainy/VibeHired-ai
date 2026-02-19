import { z } from 'zod';

/**
 * Language enum
 */
const languageEnum = z.enum(['en', 'de']);

/**
 * Generate documents body schema (used by generate-cv endpoint)
 */
export const generateDocumentsBodySchema = z.object({
  language: languageEnum.optional().default('en'),
  baseCvData: z.any().optional(),
  baseCvId: z.string().optional(),
  jobDescription: z.string().optional(),
  customInstructions: z.string().optional(),
  maxOutputTokens: z.number().optional(),
}).optional();

/**
 * Apply ATS suggestion body schema
 */
export const applyAtsSuggestionBodySchema = z.object({
  cvJson: z.any({
    required_error: 'CV data is required',
  }),
  suggestions: z.array(z.string().min(1)).min(1, 'At least one suggestion is required'),
  jobDescription: z.string().optional(),
});

/**
 * Improve section body schema
 */
export const improveSectionBodySchema = z.object({
  sectionName: z.string({
    required_error: 'Section name is required',
  }).min(1, 'Section name cannot be empty'),
  sectionData: z.any({
    required_error: 'Section data is required',
  }),
  customInstructions: z.string().optional(),
});

