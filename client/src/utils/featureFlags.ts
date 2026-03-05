// client/src/utils/featureFlags.ts
// Feature flags driven by build-time environment variables.
//
// Set VITE_PAYMENTS_ENABLED=false in Netlify (Site settings → Environment
// variables) to hide Stripe checkout and upgrade CTAs until the integration is
// ready for production.  When ready, set it to "true" and trigger a new deploy
// — no code changes required.

export const PAYMENTS_ENABLED =
    import.meta.env.VITE_PAYMENTS_ENABLED !== 'false';
