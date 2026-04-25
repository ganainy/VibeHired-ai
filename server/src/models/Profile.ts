// server/src/models/Profile.ts
import mongoose, { Document, Schema } from 'mongoose';
import { GEMINI_FLASH, GEMINI_PRO } from '../constants/geminiModels';

export interface IProfile extends Document {
  userId: mongoose.Types.ObjectId;
  name?: string;
  title?: string;
  bio?: string;
  location?: string;
  phone?: string;
  linkedInExperience?: Array<{
    title?: string;
    company?: string;
    description?: string;
    location?: string;
    startDate?: { year?: number; month?: string };
    endDate?: { year?: number; month?: string };
    isCurrent?: boolean;
  }>;
  linkedInSkills?: string[];
  linkedInLanguages?: Array<{
    language?: string;
    proficiency?: string;
  }>;
  socialLinks?: {
    github?: string;
    linkedin?: string;
    twitter?: string;
    website?: string;
    portfolio?: string;
    behance?: string;
    dribbble?: string;
    medium?: string;
    dev?: string;
    stackoverflow?: string;
    youtube?: string;
  };
  headerImageUrl?: string;
  profileImageUrl?: string;
  cvViewUrl?: string;
  cvDownloadUrl?: string;
  cvFileUrl?: string;
  integrations?: {
    github?: {
      username?: string;
      accessToken?: string;
      enabled?: boolean;
    };
    linkedin?: {
      profileId?: string;
      accessToken?: string;
      enabled?: boolean;
    };
    google?: {
      accessToken?: string;
      refreshToken?: string;
      email?: string;
      enabled?: boolean;
      /** Space-separated list of granted OAuth scopes (e.g. "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify") */
      scope?: string;
    };
  };
  settings?: {
    theme?: string;
    showSkills?: boolean;
    showContact?: boolean;
    showGitHub?: boolean;
    showLinkedIn?: boolean;
    showLinkedInName?: boolean;
    showLinkedInExperience?: boolean;
    showLinkedInSkills?: boolean;
    showLinkedInLanguages?: boolean;
    emailSuggestions?: {
      scanLimit?: number;
      autoPoll?: boolean;
      /** Separate auto-scan toggle for application response emails */
      autoPollApplications?: boolean;
      /** Separate auto-scan toggle for job offer/lead emails */
      autoPollJobLeads?: boolean;
      /** Whether to include already-read emails in the scan */
      includeReadEmails?: boolean;
    };
  };
  autoJobSettings?: {
    enabled?: boolean;
    keywords?: string; // Job search keywords (max 200 chars)
    location?: string; // Job search location (max 100 chars)
    jobType?: string[]; // Job types: "full-time", "part-time", "contract", "internship"
    experienceLevel?: string[]; // Experience levels: "entry level", "associate", "mid-senior level", "director", "internship"
    datePosted?: string; // Date filter: "any time", "past 24 hours", "past week", "past month"
    maxJobs?: number; // Maximum number of jobs to retrieve (20-1000, default 100)
    avoidDuplicates?: boolean; // Skip already scraped jobs
    schedule?: string; // cron expression
  };
  aiProviderSettings?: {
    // Multi-provider settings for batch processing
    provider?: string;
    batchSize?: number;
    models?: {
      analysis?: string;
      relevance?: string;
      generation?: string;
    };
  };
  customPrompts?: {
    cvPrompt?: string;
    coverLetterPrompt?: string;
  };
  promptTemplates?: Array<{
    id: string;
    name: string;
    type: 'cv' | 'coverLetter';
    content: string;
    isDefault?: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }>;
  promptChecklists?: {
    cv?: Array<{ id: string; text: string; enabled: boolean; isDefault?: boolean }>;
    coverLetter?: Array<{ id: string; text: string; enabled: boolean; isDefault?: boolean }>;
  };
  isPublished?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const ProfileSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    name: {
      type: String,
      trim: true,
    },
    title: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
    },
    location: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    linkedInExperience: [
      {
        title: String,
        company: String,
        description: String,
        location: String,
        startDate: {
          year: Number,
          month: String,
        },
        endDate: {
          year: Number,
          month: String,
        },
        isCurrent: Boolean,
      },
    ],
    linkedInSkills: [String],
    linkedInLanguages: [
      {
        language: String,
        proficiency: String,
      },
    ],
    socialLinks: {
      github: String,
      linkedin: String,
      twitter: String,
      website: String,
      portfolio: String,
      behance: String,
      dribbble: String,
      medium: String,
      dev: String,
      stackoverflow: String,
      youtube: String,
    },
    headerImageUrl: String,
    profileImageUrl: String,
    cvViewUrl: String,
    cvDownloadUrl: String,
    cvFileUrl: String,
    integrations: {
      github: {
        username: String,
        accessToken: String,
        enabled: {
          type: Boolean,
          default: false,
        },
      },
      linkedin: {
        profileId: String,
        accessToken: String,
        enabled: {
          type: Boolean,
          default: false,
        },
      },
      google: {
        accessToken: String,
        refreshToken: String,
        email: String,
        scope: String,
        enabled: {
          type: Boolean,
          default: false,
        },
      },
    },
    settings: {
      theme: {
        type: String,
        default: 'dark',
      },
      showSkills: {
        type: Boolean,
        default: true,
      },
      showContact: {
        type: Boolean,
        default: true,
      },
      showGitHub: {
        type: Boolean,
        default: true,
      },
      showLinkedIn: {
        type: Boolean,
        default: true,
      },
      showLinkedInName: {
        type: Boolean,
        default: true,
      },
      showLinkedInExperience: {
        type: Boolean,
        default: true,
      },
      showLinkedInSkills: {
        type: Boolean,
        default: true,
      },
      showLinkedInLanguages: {
        type: Boolean,
        default: true,
      },
      emailSuggestions: {
        scanLimit: {
          type: Number,
          default: 50,
          min: 25,
          max: 200,
        },
        autoPoll: {
          type: Boolean,
          default: true,
        },
        autoPollApplications: {
          type: Boolean,
          default: true,
        },
        autoPollJobLeads: {
          type: Boolean,
          default: true,
        },
      },
    },
    autoJobSettings: {
      keywords: {
        type: String,
        default: '',
        maxlength: 200,
      },
      location: {
        type: String,
        default: '',
        maxlength: 100,
      },
      jobType: {
        type: [String],
        default: [],
        enum: ['full-time', 'part-time', 'contract', 'internship'],
      },
      experienceLevel: {
        type: [String],
        default: [],
        enum: ['entry level', 'associate', 'mid-senior level', 'director', 'internship'],
      },
      datePosted: {
        type: String,
        default: 'any time',
        enum: ['any time', 'past 24 hours', 'past week', 'past month'],
      },
      maxJobs: {
        type: Number,
        default: 100,
        min: 20,
        max: 1000,
      },
      avoidDuplicates: {
        type: Boolean,
        default: false,
      },
    },
    aiProviderSettings: {
      // Multi-provider settings
      provider: {
        type: String,
        enum: ['gemini'],
        default: 'gemini',
      },
      batchSize: {
        type: Number,
        default: 5,
        min: 1,
        max: 10,
      },
      models: {
        analysis: {
          type: String,
          default: GEMINI_FLASH,
        },
        relevance: {
          type: String,
          default: GEMINI_FLASH,
        },
        generation: {
          type: String,
          default: GEMINI_PRO,
        },
      },
    },
    customPrompts: {
      cvPrompt: {
        type: String,
      },
      coverLetterPrompt: {
        type: String,
      },
    },
    promptTemplates: [
      {
        id: { type: String, required: true },
        name: { type: String, required: true },
        type: { type: String, enum: ['cv', 'coverLetter'], required: true },
        content: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      }
    ],
    promptChecklists: {
      cv: [
        {
          id: { type: String, required: true },
          text: { type: String, required: true },
          enabled: { type: Boolean, default: true },
          isDefault: { type: Boolean, default: false }
        }
      ],
      coverLetter: [
        {
          id: { type: String, required: true },
          text: { type: String, required: true },
          enabled: { type: Boolean, default: true },
          isDefault: { type: Boolean, default: false }
        }
      ]
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export default mongoose.model<IProfile>('Profile', ProfileSchema);

