import { z } from 'zod';
import mongoose from 'mongoose';

/**
 * Validates MongoDB ObjectId format
 */
export const objectIdSchema = z.string().refine(
  (val) => mongoose.Types.ObjectId.isValid(val),
  {
    message: 'Invalid ObjectId format',
  }
);

/**
 * Validates MongoDB ObjectId parameter (id)
 */
export const objectIdParamSchema = z.object({
  id: objectIdSchema,
});

/**
 * Validates jobId parameter
 */
export const jobIdParamSchema = z.object({
  jobId: objectIdSchema,
});

/**
 * Validates jobApplicationId parameter
 */
export const jobApplicationIdParamSchema = z.object({
  jobApplicationId: objectIdSchema,
});

/**
 * Validates analysisId parameter
 */
export const analysisIdParamSchema = z.object({
  id: objectIdSchema,
});

/**
 * Pagination query parameters
 */
export const paginationSchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
});

/**
 * Validates safe filename pattern (no path traversal, no special chars)
 * Allows alphanumeric, spaces, underscores, dashes, dots, and common special chars like &, +, ()
 */
export const filenameParamSchema = z.object({
  filename: z.string().refine(
    (val) => {
      const basename = val.split('/').pop() || val;
      return basename === val && !val.includes('..') && /^[a-zA-Z0-9_.\-+&\(\)\s]+$/.test(val);
    },
    {
      message: 'Invalid filename format',
    }
  ),
});

