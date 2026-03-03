// server/src/domain/adapters/AdapterFactory.ts
import { ModelAdapter, AdapterConfig } from './ModelAdapter';
import { GeminiAdapter } from './GeminiAdapter';
import { AIProvider } from '../providers/AIProvider';
import { GEMINI_FLASH } from '../../constants/geminiModels';

/**
 * Factory for creating model adapters
 * Centralizes adapter creation logic
 */
export class AdapterFactory {
    /**
     * Create a model adapter based on provider and configuration
     * @param config - Adapter configuration
     * @returns ModelAdapter instance
     */
    static create(config: AdapterConfig): ModelAdapter {
        const { provider, apiKey, modelName, temperature, maxTokens } = config;

        switch (provider) {
            case AIProvider.GEMINI:
                return new GeminiAdapter(apiKey, modelName, temperature, maxTokens);

            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }
    }

    /**
     * Create adapter with fallback to Gemini if primary fails
     * @param primaryConfig - Primary adapter configuration
     * @param fallbackApiKey - Gemini API key for fallback
     * @returns ModelAdapter instance
     */
    static createWithFallback(
        primaryConfig: AdapterConfig,
        fallbackApiKey: string
    ): ModelAdapter {
        try {
            return this.create(primaryConfig);
        } catch (error) {
            console.warn(`Failed to create ${primaryConfig.provider} adapter, falling back to Gemini:`, error);
            return new GeminiAdapter(
                fallbackApiKey,
                GEMINI_FLASH,
                primaryConfig.temperature,
                primaryConfig.maxTokens
            );
        }
    }
}
