// server/src/domain/providers/GeminiProvider.ts
import { AIProvider } from './AIProvider';
import {
    ProviderStrategy,
    ModelInfo,
    ProviderCapabilities,
    ValidationResult,
    DependencyCheck
} from './ProviderStrategy';
import { decrypt } from '../../utils/encryption';
import { GEMINI_FLASH } from '../../constants/geminiModels';
import { listGeminiModels } from '../../utils/geminiModelResolver';

/**
 * Gemini AI provider strategy
 * Implements the ProviderStrategy interface for Google Gemini models
 */
export class GeminiProvider extends ProviderStrategy {
    getProviderType(): AIProvider {
        return AIProvider.GEMINI;
    }

    async getModels(config: any): Promise<ModelInfo[]> {
        const apiKey = this.getApiKey(config);

        if (!apiKey) {
            return [
                {
                    id: GEMINI_FLASH,
                    name: GEMINI_FLASH,
                    contextWindow: 1000000,
                    costPer1kTokens: 0.00015,
                    supportsImages: true
                }
            ];
        }

        const modelNames = await listGeminiModels(apiKey);
        if (modelNames.length === 0) {
            return [
                {
                    id: GEMINI_FLASH,
                    name: GEMINI_FLASH,
                    contextWindow: 1000000,
                    costPer1kTokens: 0.00015,
                    supportsImages: true
                }
            ];
        }

        return modelNames.map((modelName) => ({
            id: modelName,
            name: modelName,
            contextWindow: 1000000,
            costPer1kTokens: modelName.includes('pro') ? 0.00125 : 0.00015,
            supportsImages: true,
        }));
    }

    validateConfig(config: any): ValidationResult {
        const apiKey = this.getApiKey(config);

        if (!apiKey) {
            return {
                valid: false,
                error: 'Gemini API key not configured. Please add your API key in Settings.'
            };
        }

        // Basic validation: Gemini keys start with "AIza"
        if (!apiKey.startsWith('AIza')) {
            return {
                valid: false,
                error: 'Invalid Gemini API key format. Key should start with "AIza".'
            };
        }

        return { valid: true };
    }

    getApiKey(config: any): string | null {
        // Try to get from user's profile integrations
        const encryptedKey = config?.integrations?.gemini?.accessToken;

        if (encryptedKey) {
            const decryptedKey = decrypt(encryptedKey);
            if (decryptedKey) {
                return decryptedKey;
            }
        }

        // Fallback to environment variable
        return process.env.GEMINI_API_KEY || null;
    }

    checkDependencies(): DependencyCheck {
        // Gemini uses @google/generative-ai which should already be installed
        try {
            require('@google/generative-ai');
            return { installed: true };
        } catch {
            return {
                installed: false,
                message: 'Please install @google/generative-ai: npm install @google/generative-ai'
            };
        }
    }

    supportsImageContext(modelName?: string): boolean {
        // All current Gemini models support images
        return true;
    }

    getCapabilities(): ProviderCapabilities {
        return {
            maxTokens: 1000000,
            supportsImages: true,
            supportsStreaming: true,
            rateLimitPerMinute: 15, // Gemini free tier: 15 RPM
            costPer1kTokens: 0.00015 // Flash model cost
        };
    }

    getRateLimitDelay(): number {
        // 15 requests per minute = 4 seconds between requests
        // Add small buffer for safety
        return 4500; // 4.5 seconds
    }
}
