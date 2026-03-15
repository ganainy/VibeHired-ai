import Stripe from 'stripe';
import { env } from '../config/env';
import { getPrimaryFrontendUrl } from '../config/frontend';
import User from '../models/User';
import { PlanType } from '../constants/plans';

if (!env.STRIPE_SECRET_KEY) {
    console.warn('STRIPE_SECRET_KEY is not defined. Stripe integration will not work.');
}

// Initialize Stripe with null safety to prevent startup crashes.
// Functions using 'stripe' will check for its existence.
export const stripe = env.STRIPE_SECRET_KEY
    ? new Stripe(env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16' as any,
    })
    : null;

export function ensureStripe() {
    if (!stripe) {
        throw new Error('Stripe is not configured on this server. Please set STRIPE_SECRET_KEY in your .env file.');
    }
    return stripe;
}

/**
 * Get or create a Stripe Customer for a user.
 */
export async function getOrCreateCustomer(userId: string): Promise<string> {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    if (user.stripeCustomerId) {
        return user.stripeCustomerId;
    }

    const customer = await ensureStripe().customers.create({
        email: user.email,
        metadata: {
            userId: String(user._id),
            username: user.username || ''
        }
    });

    user.stripeCustomerId = customer.id;
    await user.save();

    return customer.id;
}

/**
 * Define the price IDs mapping.
 */
const PRICE_MAP: Record<PlanType, string | undefined> = {
    free: undefined,
    starter: env.STRIPE_PRICE_STARTER,
    pro: env.STRIPE_PRICE_PRO,
    premium: env.STRIPE_PRICE_PREMIUM
};

/** Reverse lookup: priceId → PlanType */
export function priceIdToPlan(priceId: string): PlanType | null {
    for (const [plan, pid] of Object.entries(PRICE_MAP)) {
        if (pid && pid === priceId) return plan as PlanType;
    }
    return null;
}

/**
 * Sync a user's plan with their active Stripe subscription.
 * Called after a successful checkout when webhooks may not have fired yet.
 * Returns the resolved plan name, or null if no active subscription found.
 */
export async function syncSubscriptionFromStripe(userId: string): Promise<PlanType | null> {
    const user = await User.findById(userId);
    if (!user || !user.stripeCustomerId) return null;

    const stripe = ensureStripe();

    // Fetch all active subscriptions for the customer
    const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'active',
        limit: 5,
        expand: ['data.items.data.price'],
    });

    if (subscriptions.data.length === 0) return null;

    // Use the most recent active subscription
    const sub = subscriptions.data[0];
    const priceId = (sub.items.data[0]?.price as any)?.id as string | undefined;
    if (!priceId) return null;

    const plan = priceIdToPlan(priceId);
    if (!plan) return null;

    // Update the user's plan in DB if it has changed
    if (user.plan !== plan) {
        user.plan = plan;
        user.stripeSubscriptionId = sub.id;
        user.planExpiresAt = new Date((sub as any).current_period_end * 1000);
        await user.save();

        // Reset credits for the new plan
        const { resetBillingPeriod } = await import('./creditService');
        await resetBillingPeriod(userId, plan);
    }

    return plan;
}

/**
 * Create a Checkout Session for a subscription.
 */
export async function createCheckoutSession(userId: string, plan: PlanType): Promise<string> {
    const priceId = PRICE_MAP[plan];
    if (!priceId) throw new Error('Invalid plan or price not configured');

    const customerId = await getOrCreateCustomer(userId);
    const frontendUrl = getPrimaryFrontendUrl();

    const session = await ensureStripe().checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
            {
                price: priceId,
                quantity: 1,
            },
        ],
        mode: 'subscription',
        success_url: `${frontendUrl}/subscriptions?success=true`,
        cancel_url: `${frontendUrl}/subscriptions`,
        metadata: {
            userId,
            plan
        }
    });

    return session.url!;
}

/**
 * Create a Customer Portal Session for managing subscriptions.
 */
export async function createPortalSession(userId: string): Promise<string> {
    const customerId = await getOrCreateCustomer(userId);
    const frontendUrl = getPrimaryFrontendUrl();

    const session = await ensureStripe().billingPortal.sessions.create({
        customer: customerId,
        return_url: `${frontendUrl}/subscriptions`,
    });

    return session.url;
}
