// server/src/models/User.ts
import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { JsonResumeSchema } from '../types/jsonresume';

export interface IUser extends Document {
  email: string;
  passwordHash?: string; // Optional — Google-only users have no password
  googleId?: string;   // Google OAuth subject ID
  username?: string; // Optional username for portfolio URLs
  cvJson?: JsonResumeSchema | mongoose.Schema.Types.Mixed;
  cvAnalysisCache?: {
    cvHash: string; // Hash of the CV data that was analyzed
    analyses: Record<string, Array<{ needsImprovement: boolean; feedback: string }>>;
    analyzedAt: Date;
  };
  selectedTemplate?: string; // Selected CV template ID
  cvFilename?: string; // Original filename of the uploaded CV
  passwordResetToken?: string;   // SHA-256 hash of the raw reset token
  passwordResetExpires?: Date;    // Expiry date of the reset token
  role: 'user' | 'admin' | 'owner';
  emailVerified: boolean;
  emailVerificationToken?: string | null;
  emailVerificationExpires?: Date | null;
  plan: 'free' | 'starter' | 'pro' | 'premium';
  isBlocked: boolean;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  planExpiresAt?: Date | null;
  onboardingComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true, // Emails must be unique
      lowercase: true, // Store emails in lowercase
      trim: true,
      match: [/.+\@.+\..+/, 'Please fill a valid email address'], // Basic email format validation
    },
    username: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null/undefined values - only enforces uniqueness for non-null values
      trim: true,
      lowercase: true,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allow many null values; enforce uniqueness only for non-null
    },
    passwordHash: {
      type: String,
      required: false, // Optional for Google-only accounts
    },
    passwordResetToken: {
      type: String,
    },
    passwordResetExpires: {
      type: Date,
    },
    cvJson: {
      type: Schema.Types.Mixed,
      required: false // Not required on registration
    },
    cvAnalysisCache: {
      type: {
        cvHash: String,
        analyses: Schema.Types.Mixed,
        analyzedAt: Date
      },
      required: false
    },
    selectedTemplate: {
      type: String,
      required: false,
      default: 'modern-clean'
    },
    cvFilename: {
      type: String,
      required: false
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'owner'],
      default: 'user'
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: {
      type: String
    },
    emailVerificationExpires: {
      type: Date
    },
    plan: {
      type: String,
      enum: ['free', 'starter', 'pro', 'premium'],
      default: 'free'
    },
    isBlocked: {
      type: Boolean,
      default: false
    },
    stripeCustomerId: {
      type: String,
      sparse: true
    },
    stripeSubscriptionId: {
      type: String,
      sparse: true
    },
    planExpiresAt: {
      type: Date
    },
    onboardingComplete: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// --- Password Hashing Middleware (Before Saving) ---
// Use a pre-save hook to hash the password BEFORE it's saved to the DB
// Note: Needs 'function' keyword to correctly scope 'this'
UserSchema.pre<IUser>('save', async function (next) {
  // Only hash the password if it has been modified (or is new) and is set
  if (!this.isModified('passwordHash') || !this.passwordHash) return next();

  try {
    // Generate a salt and hash the password
    const salt = await bcrypt.genSalt(10); // 10 rounds is generally recommended
    // IMPORTANT: We assume the value assigned to passwordHash IS the plain password at this stage
    // The controller logic will need to ensure this assignment happens correctly before save
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    // Ensure error is correctly typed or handled
    if (error instanceof Error) {
      next(error);
    } else {
      next(new Error('Password hashing failed'));
    }
  }
});


// --- Password Comparison Method ---
// Add a method to the user schema to easily compare passwords
UserSchema.methods.comparePassword = function (candidatePassword: string): Promise<boolean> {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Note: Username index is automatically created by the field definition with unique: true and sparse: true
// No need for a separate UserSchema.index() call

export default mongoose.model<IUser>('User', UserSchema);