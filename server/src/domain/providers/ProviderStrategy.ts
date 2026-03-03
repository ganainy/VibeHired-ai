// server/src/domain/providers/ProviderStrategy.ts
import { AIProvider } from './AIProvider';

/**
 * Model information returned by providers
 */
export interface ModelInfo {
    id: string;
    name: string;
    contextWindow?: number;
    costPer1kTokens?: number;
    supportsImages?: boolean;
}

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
    maxTokens: number;
    supportsImages: boolean;
    supportsStreaming: boolean;
    rateLimitPerMinute: number;
    costPer1kTokens: number;
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Dependency check result
 */
export interface DependencyCheck {
    installed: boolean;
    message?: string;
}

/**
 * Abstract base class for AI provider strategies
 * Each provider (Gemini) implements this interface
 */
export abstract class ProviderStrategy {
    /**
     * Get the provider type
     */
    abstract getProviderType(): AIProvider;

    /**
     * Get available models for this provider
     * @param config - User's profile configuration
     */
    abstract getModels(config: any): Promise<ModelInfo[]>;

    /**
     * Validate provider configuration
     * @param config - User's profile configuration
     */
    abstract validateConfig(config: any): ValidationResult;

    /**
     * Get API key or base URL from configuration
     * @param config - User's profile configuration
     */
    abstract getApiKey(config: any): string | null;

    /**
     * Check if required dependencies are installed
     */
    abstract checkDependencies(): DependencyCheck;

    /**
     * Check if provider supports image context for a specific model
     * @param modelName - Optional model name to check
     */
    abstract supportsImageContext(modelName?: string): boolean;

    /**
     * Get provider capabilities
     */
    abstract getCapabilities(): ProviderCapabilities;

    /**
     * Get rate limit delay in milliseconds
     * Returns intelligent delay based on provider's rate limits
     */
    abstract getRateLimitDelay(): number;
}
