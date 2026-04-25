import { z } from 'zod';

/**
 * Job application status enum
 */
const jobStatusEnum = z.enum([
  'Applied',
  'Not Applied',
  'Interview',
  'Assessment',
  'Rejected',
  'Offer',
]);

/**
 * Job type enum
 */
const jobTypeEnum = z.enum([
  'full-time',
  'part-time',
  'working-student',
  'internship',
  'contract',
  'freelance',
]).nullable().optional();

const jobTagsSchema = z.array(
  z.string().min(1, 'Tag cannot be empty').max(32, 'Tag is too long').trim()
).max(8, 'Too many tags').optional();

/**
 * Create job application body schema
 */
export const createJobBodySchema = z.object({
  jobTitle: z.string({
    required_error: 'Job title is required',
  }).min(1, 'Job title cannot be empty').trim(),
  companyName: z.string({
    required_error: 'Company name is required',
  }).min(1, 'Company name cannot be empty').trim(),
  status: jobStatusEnum.optional(),
  jobUrl: z.string().optional(), // Accept any string - can contain multiple URLs separated by newlines/commas
  notes: z.string().optional(),
  salary: z.string().optional(),
  contact: z.string().optional(),
  // Structured contact information
  contactEmail: z.string().email('Invalid email format').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  hiringManagerName: z.string().optional(),
  applicationUrl: z.string().url('Invalid URL format').optional().or(z.literal('')),
  language: z.string().optional(),
  jobDescriptionText: z.string().optional(),
  baseCvId: z.string().optional(),
  createdAt: z.string().optional(),
  jobTags: jobTagsSchema,
});

/**
 * Update job application body schema (all fields optional)
 */
export const updateJobBodySchema = z.object({
  jobTitle: z.string().min(1, 'Job title cannot be empty').trim().optional(),
  companyName: z.string().min(1, 'Company name cannot be empty').trim().optional(),
  status: jobStatusEnum.optional(),
  jobUrl: z.string().optional(), // Accept any string - can contain multiple URLs separated by newlines/commas
  notes: z.string().optional(),
  salary: z.string().optional(),
  contact: z.string().optional(),
  // Structured contact information
  contactEmail: z.string().email('Invalid email format').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  hiringManagerName: z.string().optional(),
  applicationUrl: z.string().url('Invalid URL format').optional().or(z.literal('')),
  jobDescriptionText: z.string().optional(),
  dateApplied: z.string().optional(),
  createdAt: z.string().optional(),
  // Allow updating generation-related fields
  generationStatus: z.enum(['none', 'pending_input', 'pending_generation', 'draft_ready', 'finalized', 'error']).optional(),
  draftCoverLetterText: z.string().nullable().optional(),
  // Cover letter email fields
  coverLetterFileName: z.string().optional(),
  coverLetterEmailSubject: z.string().optional(),
  coverLetterEmailBody: z.string().optional(),
  coverLetterEmailRecipient: z.string().optional(),
  suggestedCoverLetterFilename: z.string().optional(),
  generatedCoverLetterFilename: z.string().nullable().optional(),
  // Allow updating baseCvId and jobType
  baseCvId: z.string().optional().nullable(),
  jobType: jobTypeEnum.optional().nullable(),
  language: z.enum(['en', 'de']).optional(),
  // Allow updating favorite status
  isFavorite: z.boolean().optional(),
  jobTags: jobTagsSchema,
});

/**
 * Scrape job description body schema
 */
export const scrapeJobBodySchema = z.object({
  url: z.string().url('Invalid URL format').optional(),
}).optional();

/**
 * Create job from URL body schema
 */
export const createJobFromUrlBodySchema = z.object({
  url: z.string({
    required_error: 'URL is required',
  }).url('Invalid URL format').refine(
    (val) => val.startsWith('http://') || val.startsWith('https://'),
    {
      message: 'URL must start with http:// or https://',
    }
  ),
});

/**
 * Update draft body schema
 */
export const updateDraftBodySchema = z.object({
  draftCoverLetterText: z.string().nullable().optional(),
}).refine(
  (data) => data.draftCoverLetterText !== undefined,
  {
    message: 'draftCoverLetterText must be provided',
  }
);

/**
 * Create job from pasted text body schema
 */
export const createJobFromTextBodySchema = z.object({
  text: z.string({
    required_error: 'Job description text is required',
  }).min(50, 'Please paste more job description text (at least 50 characters)').max(200000, 'Text is too long'),
  // Additional fields for pre-extraction form
  baseCvId: z.string().optional().nullable(),
  jobUrl: z.string().optional(), // Accept any string - can contain multiple URLs separated by newlines/commas
  status: jobStatusEnum.optional(),
  jobType: jobTypeEnum,
  force: z.boolean().optional(), // Skip duplicate check when true
});

export const checkDuplicateQuerySchema = z.object({
  jobUrl: z.string().url('Must be a valid URL').optional(),
  companyName: z.string().optional(),
  jobTitle: z.string().optional(),
});

/**
 * Parse reminder (AI) — just the natural language text
 */
export const parseReminderBodySchema = z.object({
  naturalText: z.string().min(3, 'Please describe what you want to be reminded about.').max(500),
});

/**
 * Save a confirmed reminder
 */
export const addReminderBodySchema = z.object({
  naturalText: z.string().min(1),
  title: z.string().min(1, 'Title is required.'),
  description: z.string().default(''),
  dateTimeISO: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'dateTimeISO must be a valid ISO 8601 date string',
  }),
  notificationMinutesBefore: z.number().int().min(0).max(10080).default(30),
});

/**
 * Reminder id param
 */
export const reminderIdParamSchema = z.object({
  id: z.string().min(1, 'Job ID is required'),
  reminderId: z.string().min(1, 'Reminder ID is required'),
});

/**
 * Follow-up suggestion job id param
 */
export const followUpJobIdParamSchema = z.object({
  id: z.string().min(1, 'Job ID is required'),
});
