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
 * Get API key for a specific provider from profile
 * @param profile - User's profile
 * @param provider - AI provider
 * @returns Decrypted API key or null
 */
export function getProviderApiKey(profile: any, provider: AIProvider): string | null {
    const strategy = ProviderRegistry.get(provider);
    if (!strategy) {
        return null;
    }

    const apiKey = strategy.getApiKey(profile);
    return apiKey;
}

/**
 * Get Gemini API key as fallback
 * @param profile - User's profile
 * @returns Gemini API key
 */
export function getGeminiApiKey(profile: any): string {
    const encryptedKey = profile?.integrations?.gemini?.accessToken;

    if (encryptedKey) {
        const decryptedKey = decrypt(encryptedKey);
        if (decryptedKey) {
            return decryptedKey;
        }
    }

    // Fallback to environment variable
    const envKey = process.env.GEMINI_API_KEY;
    if (!envKey) {
        throw new Error('Gemini API key not configured');
    }

    return envKey;
}

/**
 * Create a model adapter with automatic fallback to Gemini
 * @param profile - User's profile
 * @param provider - Desired AI provider
 * @param modelName - Model name to use
 * @param temperature - Temperature setting (default: 0.7)
 * @param maxTokens - Max tokens (default: 8192)
 * @returns ModelAdapter instance
 */
export function createAdapter(
    profile: any,
    provider: string | undefined,
    modelName: string,
    temperature: number = 0.7,
    maxTokens: number = 8192
): ModelAdapter {
    const selectedProvider = getProvider(provider);
    const geminiApiKey = getGeminiApiKey(profile);

    // Try to get API key for selected provider
    const apiKey = getProviderApiKey(profile, selectedProvider);

    if (!apiKey) {
        console.warn(`No API key for ${selectedProvider}, falling back to Gemini`);
        return AdapterFactory.create({
            provider: AIProvider.GEMINI,
            apiKey: geminiApiKey,
            modelName: GEMINI_FLASH,
            temperature,
            maxTokens
        });
    }

    // Create adapter with fallback
    try {
        return AdapterFactory.create({
            provider: selectedProvider,
            apiKey,
            modelName,
            temperature,
            maxTokens
        });
    } catch (error) {
        console.error(`Failed to create adapter for ${selectedProvider}:`, error);
        console.log('Falling back to Gemini');
        return AdapterFactory.create({
            provider: AIProvider.GEMINI,
            apiKey: geminiApiKey,
            modelName: GEMINI_FLASH,
            temperature,
            maxTokens
        });
    }
}

/**
 * Execute an AI operation with automatic retry and fallback
 * @param operation - Async function that performs the AI operation
 * @param fallbackOperation - Optional fallback operation using Gemini
 * @returns Result of the operation
 */
export async function executeWithFallback<T>(
    operation: () => Promise<T>,
    fallbackOperation?: () => Promise<T>
): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        console.error('Primary operation failed:', error);

        if (fallbackOperation) {
            console.log('Attempting fallback operation...');
            try {
                return await fallbackOperation();
            } catch (fallbackError) {
                console.error('Fallback operation also failed:', fallbackError);
                throw fallbackError;
            }
        }

        throw error;
    }
}

/**
 * Get rate limit delay for a provider
 * @param provider - AI provider
 * @returns Delay in milliseconds
 */
export function getRateLimitDelay(provider: string | undefined): number {
    const selectedProvider = getProvider(provider);
    const strategy = ProviderRegistry.get(selectedProvider);

    if (!strategy) {
        return 4500; // Default to Gemini's delay
    }

    return strategy.getRateLimitDelay();
}
