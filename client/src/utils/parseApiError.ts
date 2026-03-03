// client/src/utils/parseApiError.ts
// Centralised API error decoder. Recognises usageLimiter error codes so that
// credit/rate-limit failures always get a clear, actionable message.

export interface ParsedApiError {
    message: string;
    code?: string;
    /** true when the user should be prompted to upgrade their plan */
    upgrade?: boolean;
}

/**
 * Extracts a human-readable error from an Axios (or similar) error object.
 * Handles the structured codes returned by the server's usageLimiter middleware.
 */
export function parseApiError(err: any): ParsedApiError {
    const data = err?.response?.data;

    if (data?.code === 'CREDITS_EXHAUSTED') {
        return {
            message: "You've used all your monthly AI credits. Upgrade your plan to continue.",
            code: 'CREDITS_EXHAUSTED',
            upgrade: true,
        };
    }

    if (data?.code === 'RATE_LIMIT_EXCEEDED') {
        const retryAfter = data?.retryAfter as number | undefined;
        return {
            message: retryAfter
                ? `Too many AI requests. Please wait ${retryAfter} second${retryAfter !== 1 ? 's' : ''} before trying again.`
                : 'Too many AI requests. Please slow down and try again in a moment.',
            code: 'RATE_LIMIT_EXCEEDED',
        };
    }

    if (data?.code === 'EMAIL_NOT_VERIFIED') {
        return {
            message: 'Please verify your email address to use AI features.',
            code: 'EMAIL_NOT_VERIFIED',
        };
    }

    // Fall back to whatever the server returned, then axios message, then generic
    const msg: string =
        data?.error ||
        data?.message ||
        err?.message ||
        'Something went wrong. Please try again.';

    return { message: msg, code: data?.code };
}

/** Convenience helper — returns just the message string. */
export function parseApiErrorMessage(err: any): string {
    return parseApiError(err).message;
}
