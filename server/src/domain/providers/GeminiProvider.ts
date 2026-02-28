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
import { GEMINI_FLASH, GEMINI_FLASH_LITE, GEMINI_FLASH_8B, GEMINI_PRO } from '../../constants/geminiModels';

/**
 * Gemini AI provider strategy
 * Implements the ProviderStrategy interface for Google Gemini models
 */
export class GeminiProvider extends ProviderStrategy {
    getProviderType(): AIProvider {
        return AIProvider.GEMINI;
    }

    async getModels(config: any): Promise<ModelInfo[]> {
        // Return hardcoded Gemini models
        // In the future, this could fetch from Gemini API
        return [
            {
                id: GEMINI_FLASH_LITE,
                name: 'Gemini 1.5 Flash',
                contextWindow: 1000000,
                costPer1kTokens: 0.00015,
                supportsImages: true
            },
            {
                id: GEMINI_FLASH_8B,
                name: 'Gemini 1.5 Flash-8B',
                contextWindow: 1000000,
                costPer1kTokens: 0.00010,
                supportsImages: true
            },
            {
                id: GEMINI_PRO,
                name: 'Gemini 1.5 Pro',
                contextWindow: 2000000,
                costPer1kTokens: 0.00125,
                supportsImages: true
            },
            {
                id: GEMINI_FLASH,
                name: 'Gemini 3 Flash (Preview)',
                contextWindow: 1000000,
                costPer1kTokens: 0.00015,
                supportsImages: true
            }
        ];
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
