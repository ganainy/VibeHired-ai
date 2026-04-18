// IMPORTANT: This MUST be the first import to load environment variables before any other modules
import './config/env';

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { closeBrowser } from './utils/pdfGenerator'; // Assuming this is still needed

// Import routes
import jobApplicationRoutes from './routes/jobApplications';
import authRoutes from './routes/auth';
import cvsRoutes from './routes/cvs'; // Unified CV routes
import generatorRoutes from './routes/generator';
import analysisRoutes from './routes/analysis'; // Import is correct
import coverLetterRoutes from './routes/coverLetter';
import coverLetterBasesRoutes from './routes/coverLetterBases'; // Base CL templates + job isolation
import analyticsRoutes from './routes/analytics';
import githubRoutes from './routes/github';
import linkedinRoutes from './routes/linkedin';
import profileRoutes from './routes/profile';
import projectRoutes from './routes/projects';
import settingsRoutes from './routes/settings';
import autoJobRoutes from './routes/autoJobRoutes';
import chatRoutes from './routes/chat';
import interviewRoutes from './routes/interview';
import interviewMaterialsRoutes from './routes/interviewMaterials';
import sharedMaterialsRoutes from './routes/sharedMaterials';
import googleAuthRoutes from './routes/googleAuth';
import emailSuggestionsRoutes from './routes/emailSuggestions';
import employersRoutes from './routes/employers';
import workTrackerRoutes from './routes/workTracker';
import usageRoutes from './routes/usage';
import subscriptionRoutes from './routes/subscription';
import adminRoutes from './routes/admin';
import errorRoutes from './routes/errors';
import transcriptionRoutes from './routes/transcription';
import { setupTranscriptionWebSocket } from './routes/transcriptionStream';
import { handleStripeWebhook } from './controllers/webhookController';
// Correct the import for the default export
import protect from './middleware/authMiddleware'; // Import default export and alias it as 'protect'
import { errorHandler } from './middleware/errorHandler';
import { installExternalCallTracking } from './services/externalCallTracking';
import { createRequestContextMiddleware } from './services/requestContext';
import { initializeScheduler } from './utils/scheduler';
import { getAllowedFrontendOrigins } from './config/frontend';
// Import providers to ensure they register themselves
import './providers';

const app: Express = express();
const port = process.env.PORT || 5001;
installExternalCallTracking();

// Trust the first hop from Heroku's reverse proxy so that:
//  - express-rate-limit can read X-Forwarded-For without throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
//  - req.ip reflects the real client IP instead of Heroku's internal router IP
app.set('trust proxy', 1);

// CORS Configuration
// FRONTEND_URL may be a single origin or a comma-separated list of origins,
// e.g. "https://vibehired.ganainy.dev,https://vibehired-ai.netlify.app"
const allowedOrigins = getAllowedFrontendOrigins();

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // In development, allow all origins for easier testing
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// Middleware
app.use(cors(corsOptions)); // Enable CORS with configuration

// Add request size logging middleware (before body parsers)
app.use((req, res, next) => {
  const contentLength = req.get('content-length');
  if (contentLength) {
    const sizeKB = (parseInt(contentLength) / 1024).toFixed(2);
    console.log(`[RequestLogger] ${req.method} ${req.path} - Content-Length: ${sizeKB}KB, Content-Type: ${req.get('content-type') || 'unknown'}`);
  }
  next();
});

// Stripe Webhook MUST stay before express.json() to get RAW body
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

app.use(express.json({ limit: '10mb' })); // for parsing application/json, increased limit for audio payloads
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // for parsing application/x-www-form-urlencoded
// Cloudinary is now used for image storage, so local static file serving is no longer primary
// but we keep the uploads directory for temporary processing if needed


// Request Logger
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url}`);
  next();
});

// Request Context - MUST be before protected routes to capture user info
// NOTE: Disabled because authMiddleware already handles context setup for protected routes.
// Having both creates potential conflicts with async local storage nesting.
// app.use(createRequestContextMiddleware());

// --- Mount Routes ---
// Public route (example)
app.get('/', (req: Request, res: Response) => {
  res.send('Job App Assistant Backend is Running!');
});

// API Routes
app.use('/api/auth', authRoutes); // Auth routes (likely public or specific middleware)
app.use('/api/cvs', protect, cvsRoutes); // Unified CV routes
app.use('/api/job-applications', protect, jobApplicationRoutes); // Protect Job Application routes
app.use('/api/generator', protect, generatorRoutes); // Protect Generator routes
app.use('/api/analysis', analysisRoutes); // Mounting looks correct
app.use('/api/cover-letter', protect, coverLetterRoutes); // Protect Cover Letter routes
app.use('/api/cover-letter-bases', protect, coverLetterBasesRoutes); // Base CLs + job isolation
app.use('/api/analytics', protect, analyticsRoutes); // Protect Analytics routes
app.use('/api/github', githubRoutes); // GitHub routes (public for viewing, protected for actions)
app.use('/api/linkedin', linkedinRoutes); // LinkedIn routes (protected)
app.use('/api/profile', profileRoutes); // Profile routes (public aggregated, protected for updates)
app.use('/api/projects', projectRoutes); // Project routes (public viewing, protected for CRUD)
app.use('/api/settings', settingsRoutes); // Settings routes (protected)
app.use('/api/auto-jobs', autoJobRoutes); // Auto-jobs routes (protected)
app.use('/api/chat', protect, chatRoutes); // Chat routes (protected)
app.use('/api/interview', protect, interviewRoutes); // Mock interview routes (protected)
app.use('/api/interview-materials', protect, interviewMaterialsRoutes); // Interview prep materials (protected)
app.use('/api/shared', sharedMaterialsRoutes); // Public shared materials
app.use('/api/auth/google', googleAuthRoutes); // Google OAuth routes (callback is public, others are protected internally)
app.use('/api/email-suggestions', protect, emailSuggestionsRoutes); // Email suggestion routes (protected)
app.use('/api/employers', employersRoutes); // Employer management (protected internally)
app.use('/api/work-tracker', workTrackerRoutes); // Work time tracker (protected internally)
app.use('/api/usage', usageRoutes); // Credit usage tracking (protected)
app.use('/api/subscriptions', protect, subscriptionRoutes); // Subscription management (protected)
app.use('/api/admin', adminRoutes); // Admin management (protected)
app.use('/api/errors', errorRoutes); // Public error reporting
app.use('/api/transcribe', protect, transcriptionRoutes); // Audio transcription (protected)

// Error handling middleware (must be last)
app.use(errorHandler);

// --- MongoDB Connection ---
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  console.error("FATAL ERROR: MONGODB_URI is not defined in .env file.");
  process.exit(1);
}

mongoose.connect(mongoUri)
  .then(() => {
    console.log('MongoDB Connected Successfully');

    // Start listening only after successful DB connection
    initializeScheduler();

    const server = app.listen(port, () => {
      console.log(`[server]: Server is running at http://localhost:${port}`);

      // Setup AssemblyAI real-time transcription WebSocket
      setupTranscriptionWebSocket(server);
    });

    // --- Graceful Shutdown ---
    const shutdown = async (signal: string) => {
      console.log(`\n${signal} signal received. Shutting down gracefully...`);
      // Close any resources like Puppeteer if pdfGenerator is used
      // await closeBrowser(); // Uncomment if pdfGenerator is actively used
      server.close(() => {
        console.log('HTTP server closed.');
        mongoose.connection.close(false).then(() => { // Close DB connection
          console.log('MongoDB connection closed.');
          process.exit(0); // Exit process
        }).catch(err => {
          console.error("Error closing MongoDB connection:", err);
          process.exit(1);
        });
      });
      // Force shutdown if graceful fails after timeout
      setTimeout(() => {
        console.error('Could not close connections in time, forcing shutdown.');
        process.exit(1);
      }, 10000); // 10 seconds timeout
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT')); // Catches Ctrl+C

  })
  .catch(err => {
    console.error('MongoDB Connection Error:', err);
    process.exit(1); // Exit if DB connection fails on startup
  });
