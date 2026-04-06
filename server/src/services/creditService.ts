// server/src/services/creditService.ts
import mongoose from 'mongoose';
import UsageRecord, { IUsageRecord } from '../models/UsageRecord';
import User from '../models/User';
import { PLANS, CREDIT_WEIGHTS, CreditActionType, PlanType } from '../constants/plans';

/**
 * Get or create the active usage record for a user in the current billing period.
 */
export async function getOrCreateUsageRecord(userId: string): Promise<IUsageRecord> {
    const user = await User.findById(userId);
    if (!user) {
        throw new Error('User not found');
    }

    const now = new Date();

    // Find record that encompasses 'now'
    let record = await UsageRecord.findOne({
        userId,
        billingPeriodStart: { $lte: now },
        billingPeriodEnd: { $gt: now }
    }).sort({ billingPeriodStart: -1 });

    if (!record) {
        // Create new record for the current period
        // If user has a plan expiration/renewal date, use that as the boundary
        const plan = user.plan || 'free';
        const planConfig = PLANS[plan as PlanType];

        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1); // Default to 1 month period

        record = await UsageRecord.create({
            userId,
            billingPeriodStart: start,
            billingPeriodEnd: (user.planExpiresAt && user.planExpiresAt > now) ? user.planExpiresAt : end,
            credits: {
                used: 0,
                limit: planConfig.credits
            },
            actions: {},
            history: []
        });
    }

    return record;
}

/**
 * Alias for getOrCreateUsageRecord to match legacy/usage routes.
 */
export const getUsageRecord = getOrCreateUsageRecord;

/**
 * Check if the user has enough credits for a specific action.
 */
export async function hasCredits(userId: string, action: CreditActionType, customWeight?: number): Promise<boolean> {
    const weight = customWeight !== undefined ? customWeight : CREDIT_WEIGHTS[action];
    const record = await getOrCreateUsageRecord(userId);

    return (record.credits.limit - record.credits.used) >= weight;
}

/**
 * Consume credits for a user after performing an AI action.
 */
export async function consumeCredits(
    userId: string,
    action: CreditActionType,
    metadata?: Record<string, any>,
    force: boolean = false,
    customWeight?: number
): Promise<{ success: boolean; remaining: number }> {
    const weight = customWeight !== undefined ? customWeight : CREDIT_WEIGHTS[action];
    const record = await getOrCreateUsageRecord(userId);

    if (!force && (record.credits.limit - record.credits.used) < weight) {
        return { success: false, remaining: record.credits.limit - record.credits.used };
    }

    // Update usage record
    const update: any = {
        $inc: {
            'credits.used': weight,
            [`actions.${action}s`]: 1 // Assumes field name matches action + 's' logic loosely or updated manually
        },
        $push: {
            history: {
                action,
                credits: weight,
                timestamp: new Date(),
                metadata
            }
        }
    };

    // Special handling for naming if the action name doesn't map directly to model fields
    // In the model we have: chatMessages, jobExtractions, emailScans, etc.
    const actionMap: Record<string, string> = {
        chatMessage: 'chatMessages',
        jobExtraction: 'jobExtractions',
        emailScan: 'emailScans',
        atsScoring: 'atsScoring',
        cvGeneration: 'cvGeneration',
        coverLetter: 'coverLetter',
        autoJobsWorkflow: 'autoJobsWorkflow',
        cvParsing: 'cvParsing',
        analysis: 'analysis',
        interview: 'interview',
        interviewGenerateQuestions: 'interviewGenerateQuestions',
        interviewEvaluate: 'interviewEvaluate',
        interviewAnswer: 'interviewAnswer',
        interviewStreamAnswer: 'interviewStreamAnswer'
    };

    const fieldName = actionMap[action];
    if (fieldName) {
        const nextInc: Record<string, number> = {
            'credits.used': weight,
            [`actions.${fieldName}`]: 1
        };

        // Keep the legacy aggregate interview counter populated for existing dashboards.
        if (action.startsWith('interview') && action !== 'interview') {
            nextInc['actions.interview'] = 1;
        }

        update.$inc = nextInc;
    }

    const updatedRecord = await UsageRecord.findByIdAndUpdate(
        record._id,
        update,
        { new: true }
    );

    if (!updatedRecord) throw new Error('Failed to update usage record');

    return {
        success: true,
        remaining: updatedRecord.credits.limit - updatedRecord.credits.used
    };
}

/**
 * Get the current credit status for a user.
 */
export async function getRemainingCredits(userId: string): Promise<{ used: number; limit: number; remaining: number }> {
    const record = await getOrCreateUsageRecord(userId);
    return {
        used: record.credits.used,
        limit: record.credits.limit,
        remaining: Math.max(0, record.credits.limit - record.credits.used)
    };
}

/**
 * Grant bonus credits outside of the standard plan (e.g. admin gift).
 */
export async function grantBonusCredits(userId: string, amount: number, reason: string = 'Admin adjustment'): Promise<IUsageRecord> {
    const record = await getOrCreateUsageRecord(userId);
    const updatedRecord = await UsageRecord.findByIdAndUpdate(record._id, {
        $inc: { 'credits.limit': amount },
        $push: {
            history: {
                action: 'bonus',
                credits: -amount, // Negative consumption is a gift
                timestamp: new Date(),
                metadata: { reason }
            }
        }
    }, { new: true });

    if (!updatedRecord) throw new Error('Failed to grant bonus credits');
    return updatedRecord;
}

/**
 * Reset the billing period/credits (typically used on plan change or renewal).
 */
export async function resetBillingPeriod(userId: string, plan: PlanType): Promise<void> {
    const planConfig = PLANS[plan];
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    await UsageRecord.create({
        userId,
        billingPeriodStart: start,
        billingPeriodEnd: end,
        credits: {
            used: 0,
            limit: planConfig.credits
        }
    });
}
