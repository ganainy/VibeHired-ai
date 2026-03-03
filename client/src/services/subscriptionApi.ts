import axios from 'axios';

const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';

/**
 * Create a Stripe checkout session for a specific plan.
 */
export const createCheckoutSession = async (plan: string): Promise<{ url: string }> => {
    const response = await axios.post(`${API_URL}/subscriptions/checkout`, { plan });
    return response.data;
};

/**
 * Create a Stripe customer portal session for management.
 */
export const createPortalSession = async (): Promise<{ url: string }> => {
    const response = await axios.post(`${API_URL}/subscriptions/portal`);
    return response.data;
};

/**
 * Sync the user's plan with their active Stripe subscription.
 * Fallback for when the checkout.session.completed webhook hasn't fired yet
 * (e.g. local dev without a Stripe tunnel).
 */
export const syncSubscription = async (): Promise<{ plan: string }> => {
    const response = await axios.post(`${API_URL}/subscriptions/sync`);
    return response.data;
};
