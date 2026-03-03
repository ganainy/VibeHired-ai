// server/src/services/providerService.ts
import { ProviderRegistry } from '../domain/providers/ProviderRegistry';
import { AIProvider, getProvider } from '../domain/providers/AIProvider';
import { AdapterFactory } from '../domain/adapters/AdapterFactory';
import { ModelAdapter } from '../domain/adapters/ModelAdapter';
import { decrypt } from '../utils/encryption';
import { GEMINI_FLASH } from '../constants/geminiModels';

/**
 * Helper service for provider-aware AI operations
 * Centralizes provider selection, API key retrieval, and adapter creation
 */

/**
 * Get Gemini API key from environment variable
 * @returns Gemini API key
 */
export function getGeminiApiKey(): string {
    const envKey = process.env.GEMINI_API_KEY;
    if (!envKey) {
        throw new Error('Gemini API key not configured on server');
    }
    return envKey;
}

/**
 * Create a model adapter for Gemini
 * @param profile - User's profile (kept for signature compatibility)
 * @param provider - Ignored (always Gemini)
 * @param modelName - Model name to use
 * @param temperature - Temperature setting (default: 0.7)
 * @param maxTokens - Max tokens (default: 8192)
 * @returns ModelAdapter instance
 */
export function createAdapter(
    _profile: any,
    _provider: string | undefined,
    modelName: string,
    temperature: number = 0.7,
    maxTokens: number = 8192
): ModelAdapter {
    const geminiApiKey = getGeminiApiKey();

    return AdapterFactory.create({
        provider: AIProvider.GEMINI,
        apiKey: geminiApiKey,
        modelName: modelName || GEMINI_FLASH,
        temperature,
        maxTokens
    });
}

/**
 * Execute an AI operation with automatic retry
 * @param operation - Async function that performs the AI operation
 * @returns Result of the operation
 */
export async function executeWithFallback<T>(
    operation: () => Promise<T>,
    _fallbackOperation?: () => Promise<T>
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        console.error('Operation failed:', error);
        throw error;
    }
}

/**
 * Get rate limit delay for a provider
 * @param provider - AI provider (ignored)
 * @returns Delay in milliseconds
 */
export function getRateLimitDelay(_provider: string | undefined): number {
    return 4500; // Default to Gemini's delay
}
