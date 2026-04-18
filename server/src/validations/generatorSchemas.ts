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
  matchAddress: z.boolean().optional().default(false),
  showChanges: z.boolean().optional().default(true),
}).optional();

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

