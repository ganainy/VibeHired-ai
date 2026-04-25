import { z } from 'zod';

/**
 * Analyze CV body schema
 * CV data should match JsonResumeSchema structure
 */
export const analyzeCvBodySchema = z.object({
  cv: z.any({
    required_error: 'CV data is required',
  }), // JsonResumeSchema - using any for flexibility with complex nested structure
  job: z.any().optional(), // Job description data - optional
});

/**
 * Improve section params schema
 */
export const improveSectionParamsSchema = z.object({
  id: z.string(),
  section: z.string().min(1, 'Section is required'),
});

/**
 * Improve section body schema
 * Note: The route uses :id/:section, but the body may contain analysisId
 */
export const improveSectionBodySchema = z.object({
  analysisId: z.string().optional(), // May be in body or params
  section: z.string().optional(), // May be in body or params
  currentContent: z.string({
    required_error: 'Current content is required',
  }).min(1, 'Current content cannot be empty'),
});

/**
 * Analyze all CV sections body schema
 */
export const analyzeAllCvSectionsBodySchema = z.object({
  cv: z.any({
    required_error: 'CV data is required',
  }), // JsonResumeSchema - using any for flexibility with complex nested structure
});

