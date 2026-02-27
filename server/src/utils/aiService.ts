// server/src/utils/aiService.ts
import { ProviderRegistry } from '../providers/registry';
import { AIProvider, AIProviderHelper } from '../providers/enums';
import { ProviderStrategy } from '../providers/base';
import { ModelAdapter, GenerateContentOptions, GenerateContentResult } from '../adapters/base';
import Profile from '../models/Profile';
import { NotFoundError } from './errors/AppError';

/**
 * Get user's configured provider strategy - requires explicit provider selection.
 * @param providerOverride Optional provider name to use instead of the user's default.
 */
export async function getProviderStrategy(userId: string, providerOverride?: string): Promise<ProviderStrategy> {
  const profile = await Profile.findOne({ userId });
  if (!profile) {
    throw new NotFoundError('User profile not found');
  }

  const aiProviderSettings = profile.aiProviderSettings;
  const defaultProvider = providerOverride ?? aiProviderSettings?.defaultProvider;

  // Require explicit provider selection - no automatic fallback
  if (!defaultProvider) {
    throw new NotFoundError(
      'No AI provider selected. Please select a default AI provider in Settings.'
    );
  }

  const provider = AIProviderHelper.fromString(defaultProvider);
  const strategy = ProviderRegistry.get(provider);

  if (!strategy) {
    throw new NotFoundError(`Provider ${defaultProvider} is not available`);
  }

  // Check if provider is configured with API key
  const apiKey = await strategy.getApiKey(userId);
  if (!apiKey) {
    throw new NotFoundError(
      `No API key configured for ${defaultProvider}. Please add your API key in Settings.`
    );
  }

  // Validate configuration
  const validation = await strategy.validateConfig(userId);
  if (!validation.valid) {
    throw new NotFoundError(
      `Invalid configuration for ${defaultProvider}: ${validation.error || 'Please check your settings.'}`
    );
  }

  return strategy;
}

/**
 * Get model adapter for user's configured provider.
 * @param providerOverride Optional provider name to use instead of the user's default.
 */
export async function getModelAdapter(
  userId: string,
  modelName?: string,
  providerOverride?: string
): Promise<ModelAdapter> {
  const strategy = await getProviderStrategy(userId, providerOverride);
  const apiKey = await strategy.getApiKey(userId);

  if (!apiKey) {
    throw new NotFoundError(`API key not found for provider: ${strategy.getName()}`);
  }

  // Get model name from user settings or use default
  if (!modelName) {
    const profile = await Profile.findOne({ userId });
    modelName = profile?.aiProviderSettings?.defaultModel;

    // If still no model, get first available model from provider
    if (!modelName) {
      const models = await strategy.getModels(userId);
      if (models.length === 0) {
        throw new NotFoundError(`No models available for provider: ${strategy.getName()}`);
      }
      modelName = models[0];
    }
  }

  return strategy.createModelAdapter(apiKey, modelName);
}

/**
 * Generate content using user's configured provider
 */
export async function generateContent(
  userId: string,
  prompt: string,
  options?: GenerateContentOptions
): Promise<GenerateContentResult> {
  const adapter = await getModelAdapter(userId);
  return adapter.generateContent(prompt, options);
}

/**
 * Generate content with file input using user's configured provider
 */
export async function generateContentWithFile(
  userId: string,
  prompt: string,
  filePath: string,
  mimeType: string,
  options?: GenerateContentOptions
): Promise<GenerateContentResult> {
  const adapter = await getModelAdapter(userId);
  return adapter.generateContentWithFile(prompt, filePath, mimeType, options);
}

/**
 * Generate structured JSON response using user's configured provider.
 * @param providerOverride Optional provider name to use instead of the user's default.
 */
export async function generateStructuredResponse<T>(
  userId: string,
  prompt: string,
  options?: GenerateContentOptions,
  providerOverride?: string
): Promise<T> {
  const adapter = await getModelAdapter(userId, undefined, providerOverride);
  return adapter.generateStructuredResponse<T>(prompt, options);
}

/**
 * Get available models for user's configured provider
 */
export async function getAvailableModels(userId: string): Promise<string[]> {
  const strategy = await getProviderStrategy(userId);
  return strategy.getModels(userId);
}

/**
 * Check if user's configured provider supports image context
 */
export async function supportsImageContext(userId: string, modelName?: string): Promise<boolean> {
  const strategy = await getProviderStrategy(userId);
  return strategy.supportsImageContext(modelName);
}

/**
 * Get provider capabilities
 */
export async function getProviderCapabilities(userId: string) {
  const strategy = await getProviderStrategy(userId);
  return strategy.getCapabilities();
}

