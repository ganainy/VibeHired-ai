// server/src/constants/plans.ts

export const PLANS = {
    free: {
        name: 'Free Trial',
        credits: 20,
        isRecurring: false
    },
    starter: {
        name: 'Starter',
        credits: 150,
        isRecurring: true,
        priceMonthly: 900 // $9.00
    },
    pro: {
        name: 'Pro',
        credits: 500,
        isRecurring: true,
        priceMonthly: 1900 // $19.00
    },
    premium: {
        name: 'Premium',
        credits: 1500,
        isRecurring: true,
        priceMonthly: 3900 // $39.00
    },
} as const;

export type PlanType = keyof typeof PLANS;

export const CREDIT_WEIGHTS = {
    chatMessage: 1,
    jobExtraction: 1,
    emailScan: 1,
    atsScoring: 2,
    cvGeneration: 3,
    coverLetter: 3,
    cvParsing: 2,
    analysis: 2,
    interview: 5, // Backward-compatible umbrella action
    interviewGenerateQuestions: 5,
    interviewEvaluate: 1,
    interviewAnswer: 2,
    interviewStreamAnswer: 2,
    autoJobsWorkflow: 0.25, // Cost per job retrieved (e.g., 100 jobs = 25 credits + base fee)
    autoJobsBaseFee: 3, // Base fee for job list retrieval and server overhead
} as const;

export type CreditActionType = keyof typeof CREDIT_WEIGHTS;

/**
 * Per-user AI velocity rate limits per plan.
 * Applies regardless of role — all users are subject to the same window limits.
 * The window is shared; max scales up with plan tier.
 *
 * NOTE: These limits were increased (3x) on 2026-03-28 to allow for more reasonable
 * interview practice sessions. Users were hitting 429 errors during normal usage,
 * as each question in the Interview Buddy triggers a stream-answer request.
 * With 30+ requests per 10 min window (free tier), users can have continuous
 * practice sessions without interruption.
 */
export const AI_RATE_LIMITS: Record<PlanType, { windowMs: number; max: number }> = {
    free:    { windowMs: 10 * 60 * 1000, max: 30 },  // 30 requests / 10 min
    starter: { windowMs: 10 * 60 * 1000, max: 60 },  // 60 requests / 10 min
    pro:     { windowMs: 10 * 60 * 1000, max: 120 }, // 120 requests / 10 min
    premium: { windowMs: 10 * 60 * 1000, max: 240 }, // 240 requests / 10 min
};
