// server/src/domain/providers/AIProvider.ts

/**
 * Enum for AI provider types
 * Provides type-safe provider names throughout the application
 */
export enum AIProvider {
    GEMINI = 'gemini',
    OPENAI_COMPATIBLE = 'openai_compatible'
}

/**
 * Helper to validate provider string
 */
export function isValidProvider(provider: string): provider is AIProvider {
    return Object.values(AIProvider).includes(provider as AIProvider);
}

/**
 * Helper to get provider from string with fallback
 */
export function getProvider(provider: string | undefined): AIProvider {
    if (!provider || !isValidProvider(provider)) {
        return AIProvider.GEMINI; // Default fallback
    }
    return provider as AIProvider;
}
