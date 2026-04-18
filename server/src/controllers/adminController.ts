import { Request, Response } from 'express';
import User from '../models/User';
import CV from '../models/CV';
import UsageRecord from '../models/UsageRecord';
import ExternalCallLog from '../models/ExternalCallLog';
import { getUsageRecord, grantBonusCredits, resetBillingPeriod } from '../services/creditService';
import { PlanType } from '../constants/plans';
import { stripe } from '../services/stripeService';
import { generateCvPdfBuffer } from '../utils/pdfGenerator';

// ---------------------------------------------------------------------------
// Simple in-memory cache for expensive Stripe stats queries (5-minute TTL)
// ---------------------------------------------------------------------------
interface StatsCache {
    data: any;
    expiresAt: number;
}
let statsCache: StatsCache | null = null;
const STATS_CACHE_TTL_MS = 30 * 1000; // 30 seconds - more responsive for admin dashboard

/**
 * Get all users with their current usage overview.
 * paginated + search
 */
export async function getUsers(req: Request, res: Response) {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;
        const search = (req.query.search as string || '').trim();

        const matchStage = search
            ? { $or: [{ email: { $regex: search, $options: 'i' } }, { username: { $regex: search, $options: 'i' } }] }
            : {};

        // Use aggregation so we can sort by role priority (owner→admin→user) before paginating
        const pipeline: any[] = [
            { $match: matchStage },
            { $project: { passwordHash: 0 } },
            {
                $addFields: {
                    _roleOrder: {
                        $switch: {
                            branches: [
                                { case: { $eq: ['$role', 'owner'] }, then: 0 },
                                { case: { $eq: ['$role', 'admin'] }, then: 1 },
                            ],
                            default: 2,
                        },
                    },
                },
            },
            { $sort: { _roleOrder: 1, createdAt: -1 } },
            {
                $facet: {
                    users: [{ $skip: skip }, { $limit: limit }],
                    total: [{ $count: 'count' }],
                },
            },
        ];

        const [result] = await User.aggregate(pipeline);
        const users = result.users;
        const total = result.total[0]?.count ?? 0;

        // Enhance with usage info
        const usersWithUsage = await Promise.all(users.map(async (u: any) => {
            const usage = await getUsageRecord(u._id.toString());
            const servicesUsed = Object.entries(usage.actions || {})
                .filter(([, count]) => typeof count === 'number' && count > 0)
                .map(([key]) => key);
            return {
                id: u._id.toString(),
                email: u.email,
                username: u.username,
                role: u.role,
                plan: u.plan,
                emailVerified: u.emailVerified,
                isBlocked: u.isBlocked ?? false,
                stripeCustomerId: (u as any).stripeCustomerId,
                credits: usage.credits.limit - usage.credits.used,
                totalConsumed: usage.credits.used,
                lastActive: (u as any).updatedAt || u.createdAt,
                createdAt: u.createdAt,
                servicesUsed,
            };
        }));

        res.json({ users: usersWithUsage, total, page, limit });
    } catch (error) {
        console.error('getUsers error:', error);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
}

/**
 * Get system-wide stats for admin dashboard.
 * Revenue figures are fetched from Stripe and cached for 5 minutes.
 */
export async function getAdminStats(req: Request, res: Response) {
    try {
        // Serve from cache if still valid
        if (statsCache && Date.now() < statsCache.expiresAt) {
            res.json(statsCache.data);
            return;
        }

        const totalUsers = await User.countDocuments();
        const activeUsersCount = await UsageRecord.distinct('userId', {
            updatedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        });

        const users = await User.find({}, 'plan').lean();
        const tierDistribution = users.reduce((acc: any, u) => {
            acc[u.plan] = (acc[u.plan] || 0) + 1;
            return acc;
        }, { free: 0, starter: 0, pro: 0, premium: 0 });

        // Stripe revenue data
        let mrr = 0;
        let totalRevenue = 0;
        let recentPayments: any[] = [];

        if (stripe) {
            try {
                // MRR: sum monthly amounts of all active subscriptions
                const activeSubs = await stripe.subscriptions.list({ status: 'active', limit: 100 });
                mrr = activeSubs.data.reduce((sum, sub) => {
                    const item = sub.items.data[0];
                    if (!item) return sum;
                    const amount = item.price.unit_amount || 0;
                    const interval = item.price.recurring?.interval;
                    // Normalise to monthly (yearly / 12, weekly * 4)
                    if (interval === 'year') return sum + amount / 12;
                    if (interval === 'week') return sum + amount * 4;
                    return sum + amount;
                }, 0) / 100; // Convert cents to dollars

                // Recent payments (last 50 charges)
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);

                const charges = await stripe.charges.list({ limit: 50 });
                totalRevenue = charges.data
                    .filter(c => c.status === 'succeeded')
                    .reduce((sum, c) => sum + c.amount, 0) / 100;

                // Resolve customer emails in one batch
                const customerIds = [...new Set(
                    charges.data.map(c => typeof c.customer === 'string' ? c.customer : c.customer?.id).filter(Boolean)
                )] as string[];

                const customerMap = new Map<string, string>();
                await Promise.all(
                    customerIds.map(async (id) => {
                        try {
                            const customer = await stripe!.customers.retrieve(id);
                            if ('email' in customer && customer.email) {
                                customerMap.set(id, customer.email);
                            }
                        } catch { /* ignore */ }
                    })
                );

                recentPayments = charges.data.slice(0, 20).map(c => ({
                    id: c.id,
                    amount: c.amount,
                    currency: c.currency,
                    status: c.status,
                    customerEmail: customerMap.get(typeof c.customer === 'string' ? c.customer : c.customer?.id || '') || 'Unknown',
                    createdAt: new Date(c.created * 1000).toISOString(),
                }));
            } catch (stripeErr) {
                console.error('[AdminStats] Stripe query failed:', stripeErr);
                // Fall through — return zero values rather than failing the whole endpoint
            }
        }

        const now = Date.now();
        const last24hDate = new Date(now - 24 * 60 * 60 * 1000);
        const externalStats = await ExternalCallLog.aggregate([
            {
                $facet: {
                    totalsByCategory: [
                        { $group: { _id: '$category', count: { $sum: 1 } } }
                    ],
                    last24hByCategory: [
                        { $match: { createdAt: { $gte: last24hDate } } },
                        { $group: { _id: '$category', count: { $sum: 1 } } }
                    ],
                    successByStatus: [
                        { $group: { _id: '$success', count: { $sum: 1 } } }
                    ],
                    byProvider: [
                        { $group: { _id: '$provider', count: { $sum: 1 } } },
                        { $sort: { count: -1 } }
                    ],
                    topModels: [
                        { $match: { category: 'ai', modelName: { $exists: true, $nin: ['', null] } } },
                        { $group: { _id: '$modelName', count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 10 }
                    ],
                    recentCalls: [
                        { $sort: { createdAt: -1 } },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'userId',
                                foreignField: '_id',
                                as: 'userInfo',
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                category: 1,
                                provider: 1,
                                modelName: 1,
                                host: 1,
                                path: 1,
                                method: 1,
                                requestPath: 1,
                                requestMethod: 1,
                                creditUsed: {
                                    $ifNull: [
                                        '$creditUsed',
                                        {
                                            $ifNull: [
                                                '$metadata.creditUsed',
                                                {
                                                    $ifNull: [
                                                        '$metadata.creditsUsed',
                                                        '$metadata.credits'
                                                    ]
                                                }
                                            ]
                                        }
                                    ]
                                },
                                metadata: 1,
                                statusCode: 1,
                                success: 1,
                                durationMs: 1,
                                errorMessage: 1,
                                createdAt: 1,
                                userId: 1,
                                userEmail: {
                                    $ifNull: [
                                        '$userEmail',
                                        { $arrayElemAt: ['$userInfo.email', 0] }
                                    ]
                                },
                            }
                        }
                    ]
                }
            }
        ]);

        const external = externalStats[0] || {};

        const mapCount = (arr: Array<{ _id: string; count: number }> = []) =>
            arr.reduce((acc: Record<string, number>, item) => {
                if (item?._id) acc[item._id] = item.count || 0;
                return acc;
            }, {});

        const statusMap = (external.successByStatus || []).reduce((acc: Record<string, number>, item: any) => {
            acc[String(item?._id)] = item?.count || 0;
            return acc;
        }, {});

        const totalsByCategory = mapCount(external.totalsByCategory || []);
        const last24hByCategory = mapCount(external.last24hByCategory || []);

        const result = {
            totalUsers,
            activeUsers: activeUsersCount.length,
            totalRevenue,
            mrr,
            tierDistribution,
            recentPayments,
            externalCalls: {
                totals: {
                    ai: totalsByCategory.ai || 0,
                    apify: totalsByCategory.apify || 0,
                    all: (totalsByCategory.ai || 0) + (totalsByCategory.apify || 0),
                },
                last24h: {
                    ai: last24hByCategory.ai || 0,
                    apify: last24hByCategory.apify || 0,
                    all: (last24hByCategory.ai || 0) + (last24hByCategory.apify || 0),
                },
                successful: statusMap.true || 0,
                failed: statusMap.false || 0,
                byProvider: (external.byProvider || []).map((item: any) => ({
                    provider: item._id,
                    count: item.count,
                })),
                topModels: (external.topModels || []).map((item: any) => ({
                    modelName: item._id,
                    count: item.count,
                })),
                recentCalls: external.recentCalls || [],
            }
        };

        // Cache the result
        statsCache = { data: result, expiresAt: Date.now() + STATS_CACHE_TTL_MS };

        res.json(result);
    } catch (error) {
        console.error('getAdminStats error:', error);
        res.status(500).json({ message: 'Failed to fetch admin stats' });
    }
}

/**
 * Get detailed info for a single user including full usage.
 */
export async function getUserDetail(req: Request, res: Response) {
    const { userId } = req.params;

    try {
        const user = await User.findById(userId).select('-passwordHash').lean();
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        const usage = await getUsageRecord(userId);

        res.json({
            id: user._id.toString(),
            email: user.email,
            username: user.username,
            role: user.role,
            plan: user.plan,
            emailVerified: user.emailVerified,
            isBlocked: (user as any).isBlocked ?? false,
            stripeCustomerId: (user as any).stripeCustomerId,
            stripeSubscriptionId: (user as any).stripeSubscriptionId,
            credits: usage.credits.limit - usage.credits.used,
            totalConsumed: usage.credits.used,
            lastActive: (user as any).updatedAt || user.createdAt,
            createdAt: user.createdAt,
            usage: {
                usage: {
                    total: usage.credits.limit,
                    consumed: usage.credits.used,
                    remaining: usage.credits.limit - usage.credits.used,
                    resetAt: usage.billingPeriodEnd
                },
                actions: usage.history.slice(-20).map(h => ({
                    type: h.action,
                    consumed: h.credits,
                    timestamp: h.timestamp,
                    metadata: h.metadata
                }))
            }
        });
    } catch (error) {
        console.error('getUserDetail error:', error);
        res.status(500).json({ message: 'Failed to fetch user detail' });
    }
}

/**
 * Get CV library summaries for a user (base CVs only).
 */
export async function getUserCvLibrary(req: Request, res: Response) {
    const { userId } = req.params;

    const isJsonResumeLike = (value: unknown): boolean => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        const candidate = value as Record<string, unknown>;
        return 'basics' in candidate || 'work' in candidate || 'education' in candidate || 'skills' in candidate;
    };

    try {
        const userExists = await User.exists({ _id: userId });
        if (!userExists) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        const cvs = await CV.find({ userId, jobApplicationId: null })
            .select('displayName category isDefault templateId filename createdAt updatedAt cvJson originalCvJson extractionMode extractionTimestamp +originalPdf')
            .sort({ isDefault: -1, createdAt: -1 })
            .lean();

        res.json({
            cvs: cvs.map((cv) => ({
                id: cv._id.toString(),
                displayName: cv.displayName,
                category: cv.category ?? null,
                isDefault: cv.isDefault,
                templateId: cv.templateId ?? null,
                filename: cv.filename ?? null,
                createdAt: cv.createdAt,
                updatedAt: cv.updatedAt,
                hasOriginalSnapshot: Boolean(cv.originalCvJson || cv.originalPdf),
                hasCurrentJson: Boolean(cv.cvJson && isJsonResumeLike(cv.cvJson)),
                extractionMode: cv.extractionMode ?? null,
                extractionTimestamp: cv.extractionTimestamp ?? null,
            }))
        });
    } catch (error) {
        console.error('getUserCvLibrary error:', error);
        res.status(500).json({ message: 'Failed to fetch user CVs' });
    }
}

/**
 * Get a base CV detail for template preview.
 */
export async function getUserCvDetail(req: Request, res: Response) {
    const { userId, cvId } = req.params;

    try {
        const userExists = await User.exists({ _id: userId });
        if (!userExists) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        const cv = await CV.findOne({ _id: cvId, userId, jobApplicationId: null })
            .select('displayName templateId cvJson cvDescriptor cvData filename createdAt updatedAt')
            .lean();

        if (!cv) {
            res.status(404).json({ message: 'CV not found' });
            return;
        }

        res.json({
            id: cv._id.toString(),
            displayName: cv.displayName,
            templateId: cv.templateId ?? null,
            cvJson: cv.cvJson ?? null,
            cvDescriptor: cv.cvDescriptor ?? null,
            cvData: cv.cvData ?? null,
            filename: cv.filename ?? null,
            createdAt: cv.createdAt,
            updatedAt: cv.updatedAt,
        });
    } catch (error) {
        console.error('getUserCvDetail error:', error);
        res.status(500).json({ message: 'Failed to fetch CV detail' });
    }
}

/**
 * Generate a PDF preview for a user's CV snapshot (original or current).
 */
export async function getUserCvPreview(req: Request, res: Response) {
    const { userId, cvId } = req.params;
    const mode = (req.query.mode as string) || 'current';
    const template = (req.query.template as string) || undefined;

    const isJsonResumeLike = (value: unknown): boolean => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        const candidate = value as Record<string, unknown>;
        return 'basics' in candidate || 'work' in candidate || 'education' in candidate || 'skills' in candidate;
    };

    if (!['original', 'current'].includes(mode)) {
        res.status(400).json({ message: 'Invalid mode. Use original or current.' });
        return;
    }

    try {
        const cv = await CV.findOne({ _id: cvId, userId, jobApplicationId: null }).select('cvJson originalCvJson templateId +originalPdf');
        if (!cv) {
            res.status(404).json({ message: 'CV not found' });
            return;
        }

        if (mode === 'original' && cv.originalPdf) {
            const pdfBase64 = (cv.originalPdf as Buffer).toString('base64');
            res.json({
                pdfBase64,
                templateId: template || cv.templateId || 'original',
                mode,
                source: 'originalPdf'
            });
            return;
        }

        const snapshot = mode === 'original' ? cv.originalCvJson : cv.cvJson;
        if (!snapshot) {
            res.status(404).json({ message: mode === 'original' ? 'Original snapshot not available.' : 'CV data not available.' });
            return;
        }

        if (!isJsonResumeLike(snapshot)) {
            if (cv.originalPdf) {
                const pdfBase64 = (cv.originalPdf as Buffer).toString('base64');
                res.json({
                    pdfBase64,
                    templateId: template || cv.templateId || 'original',
                    mode,
                    source: 'originalPdf'
                });
                return;
            }
            res.status(400).json({ message: 'CV preview is only available for structured JSON Resume data.' });
            return;
        }

        const templateId = template || cv.templateId || 'ats-optimized';
        const pdfBuffer = await generateCvPdfBuffer(snapshot, { lang: 'en', pageFormat: 'a4' });
        const pdfBase64 = pdfBuffer.toString('base64');

        res.json({
            pdfBase64,
            templateId,
            mode,
            source: 'cvJson'
        });
    } catch (error) {
        console.error('getUserCvPreview error:', error);
        res.status(500).json({ message: 'Failed to generate CV preview' });
    }
}

/**
 * Update user role or plan manually.
 */
export async function updateUser(req: Request, res: Response) {
    const { userId } = req.params;
    const { role, plan, emailVerified, isBlocked } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        if (role) user.role = role;
        if (plan) user.plan = plan;
        if (emailVerified !== undefined) user.emailVerified = emailVerified;
        if (isBlocked !== undefined) (user as any).isBlocked = isBlocked;

        await user.save();

        res.json({ message: 'User updated successfully', user });
    } catch (error) {
        console.error('updateUser error:', error);
        res.status(500).json({ message: 'Failed to update user' });
    }
}

/**
 * Get detailed usage history for a user.
 */
export async function getUserUsage(req: Request, res: Response) {
    const { userId } = req.params;

    try {
        const records = await UsageRecord.find({ userId }).sort({ billingPeriodStart: -1 });
        res.json(records);
    } catch (error) {
        console.error('getUserUsage error:', error);
        res.status(500).json({ message: 'Failed to fetch usage history' });
    }
}

/**
 * Grant bonus credits to a user.
 */
export async function adminGrantBonus(req: Request, res: Response) {
    const { userId } = req.params;
    const { amount, reason } = req.body;

    try {
        if (!amount || typeof amount !== 'number') {
            res.status(400).json({ message: 'Amount is required and must be a number' });
            return;
        }

        const usage = await grantBonusCredits(userId, amount, reason);
        res.json({ message: `Granted ${amount} credits`, usage });
    } catch (error) {
        console.error('adminGrantBonus error:', error);
        res.status(500).json({ message: 'Failed to grant credits' });
    }
}

/**
 * Block or unblock a user account.
 * PATCH /api/admin/users/:userId  { isBlocked: boolean }
 */
export async function setUserBlocked(req: Request, res: Response) {
    const { userId } = req.params;
    const { isBlocked } = req.body;

    if (typeof isBlocked !== 'boolean') {
        res.status(400).json({ message: 'isBlocked must be a boolean' });
        return;
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        (user as any).isBlocked = isBlocked;
        await user.save({ validateBeforeSave: false });

        // Bust the stats cache so the admin dashboard reflects the change
        statsCache = null;

        res.json({ message: isBlocked ? 'User blocked' : 'User unblocked', userId });
    } catch (error) {
        console.error('setUserBlocked error:', error);
        res.status(500).json({ message: 'Failed to update user block status' });
    }
}

/**
 * Cancel a user's Stripe subscription and revert them to the free plan.
 */
export async function cancelUserSubscription(req: Request, res: Response) {
    const { userId } = req.params;

    try {
        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        if (!user.stripeSubscriptionId) {
            res.status(400).json({ message: 'User has no active Stripe subscription' });
            return;
        }

        if (!stripe) {
            res.status(503).json({ message: 'Stripe is not configured on this server' });
            return;
        }

        try {
            await stripe.subscriptions.cancel(user.stripeSubscriptionId);
        } catch (stripeErr: any) {
            if (stripeErr.code !== 'resource_missing') throw stripeErr;
        }

        // Revert locally
        user.plan = 'free';
        user.stripeSubscriptionId = undefined;
        user.planExpiresAt = undefined;
        await user.save();

        // Reset credits to free tier
        await resetBillingPeriod(userId, 'free');

        // Bust the stats cache so revenue reflects the cancellation
        statsCache = null;

        res.json({ message: 'Subscription cancelled and user reverted to free plan' });
    } catch (error) {
        console.error('cancelUserSubscription error:', error);
        res.status(500).json({ message: 'Failed to cancel subscription' });
    }
}
