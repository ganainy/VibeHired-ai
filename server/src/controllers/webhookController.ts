import { Request, Response } from 'express';
import { stripe, ensureStripe } from '../services/stripeService';
import { env } from '../config/env';
import User from '../models/User';
import { resetBillingPeriod } from '../services/creditService';
import { PlanType } from '../constants/plans';

/**
 * Handle Stripe Webhooks
 */
export async function handleStripeWebhook(req: Request, res: Response) {
    const sig = req.headers['stripe-signature'] as string;
    let event;

    try {
        event = ensureStripe().webhooks.constructEvent(
            req.body, // Must be raw body
            sig,
            env.STRIPE_WEBHOOK_SECRET || ''
        );
    } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    // Handle the event
    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as any;
                const userId = session.metadata.userId;
                const plan = session.metadata.plan as PlanType;

                await handleSubscriptionFulfilled(userId, plan, session.customer, session.subscription);
                break;
            }
            case 'customer.subscription.updated': {
                const subscription = event.data.object as any;
                // Update plan expiry or status if needed
                await handleSubscriptionUpdated(subscription);
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as any;
                await handleSubscriptionDeleted(subscription);
                break;
            }
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object as any;
                // Only process recurring renewals — first payment is handled by checkout.session.completed
                if (invoice.billing_reason === 'subscription_cycle') {
                    await handleInvoicePaymentSucceeded(invoice);
                }
                break;
            }
            case 'invoice.payment_failed': {
                const invoice = event.data.object as any;
                await handleInvoicePaymentFailed(invoice);
                break;
            }
            default:
                console.log(`Unhandled event type ${event.type}`);
        }
    } catch (error) {
        console.error('Error processing webhook event:', error);
        res.status(500).json({ message: 'Webhook processing failed' });
        return;
    }

    res.json({ received: true });
}

async function handleSubscriptionFulfilled(userId: string, plan: PlanType, stripeCustomerId: string, stripeSubscriptionId: string) {
    const user = await User.findById(userId);
    if (!user) return;

    user.plan = plan;
    user.stripeCustomerId = stripeCustomerId;
    user.stripeSubscriptionId = stripeSubscriptionId;

    // Set plan expiry (e.g. 1 month from now)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1);
    user.planExpiresAt = expiresAt;

    await user.save();

    // Reset credits for the new billing period
    await resetBillingPeriod(userId, plan);
}

async function handleSubscriptionUpdated(subscription: any) {
    const user = await User.findOne({ stripeSubscriptionId: subscription.id });
    if (!user) return;

    // Update expiry date based on current period end
    user.planExpiresAt = new Date(subscription.current_period_end * 1000);
    await user.save();
}

async function handleSubscriptionDeleted(subscription: any) {
    const user = await User.findOne({ stripeSubscriptionId: subscription.id });
    if (!user) return;

    // Revert to free plan
    user.plan = 'free';
    user.stripeSubscriptionId = undefined;
    user.planExpiresAt = undefined;
    await user.save();

    // Reset credits to free tier
    await resetBillingPeriod((user._id as any).toString(), 'free');
}

/**
 * Called on invoice.payment_succeeded with billing_reason === 'subscription_cycle'.
 * Resets the user's credit allowance for the new billing period.
 */
async function handleInvoicePaymentSucceeded(invoice: any) {
    const user = await User.findOne({ stripeCustomerId: invoice.customer });
    if (!user) {
        console.warn(`[Webhook] invoice.payment_succeeded: no user found for customer ${invoice.customer}`);
        return;
    }

    const userId = (user._id as any).toString();

    // Update the plan expiry from the invoice period end
    const periodEnd = invoice.lines?.data?.[0]?.period?.end;
    if (periodEnd) {
        user.planExpiresAt = new Date(periodEnd * 1000);
        await user.save();
    }

    // Reset credits for the new billing period
    await resetBillingPeriod(userId, user.plan as PlanType);

    console.log(`[Webhook] Monthly credit reset for user ${user.email} (plan: ${user.plan})`);
}

/**
 * Called on invoice.payment_failed.
 * Flags the user account so a banner can be shown in the app — does NOT
 * immediately downgrade; Stripe will retry and eventually fire
 * customer.subscription.deleted if all retries fail.
 */
async function handleInvoicePaymentFailed(invoice: any) {
    const user = await User.findOne({ stripeCustomerId: invoice.customer });
    if (!user) return;

    // Set a flag — the client can read this from the usage/profile endpoint later
    (user as any).paymentFailed = true;
    await user.save();

    console.warn(`[Webhook] Payment failed for user ${user.email} — invoice ${invoice.id}`);
}
