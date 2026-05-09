// server/src/utils/aiService.ts
import { AIProvider, getProvider, DEFAULT_MODELS, PROVIDER_ENV_KEYS, PROVIDER_CAPABILITIES } from '../constants/modelProviders';
import { ModelAdapter, GenerateContentOptions, GenerateContentResult } from '../adapters/base';
import { NotFoundError } from './errors/AppError';
import { GeminiAdapter } from '../adapters/geminiAdapter';
import { OpenAICompatibleAdapter } from '../adapters/openAICompatibleAdapter';
import { GEMINI_FLASH } from '../constants/geminiModels';
import { listGeminiModels, resolveBestGeminiModel } from './geminiModelResolver';

/**
 * Resolve the active provider.
 * Priority:
 * 1. Explicit providerOverride argument
 * 2. DEFAULT_AI_PROVIDER env var
 * 3. Fallback to Gemini
 */
function resolveProvider(providerOverride?: string): AIProvider {
  if (providerOverride) {
    return getProvider(providerOverride);
  }
  return getProvider(process.env.DEFAULT_AI_PROVIDER);
}

/**
 * Get API key for a provider from environment variables.
 * For OPENAI_COMPATIBLE, also checks DEEPSEEK_API_KEY as a fallback.
 */
function getApiKey(provider: AIProvider): string {
  const keys = PROVIDER_ENV_KEYS[provider];
  const key = process.env[keys.apiKey] || (keys.altApiKey ? process.env[keys.altApiKey] : undefined);
  if (!key) {
    const required = [keys.apiKey, keys.altApiKey].filter(Boolean).join(' or ');
    throw new Error(`${required} not configured on server`);
  }
  return key;
}

// Cache the resolved models once at startup (Gemini-specific)
let _cachedFastModel: string | null = null;
let _cachedQualityModel: string | null = null;

async function getResolvedGeminiModel(apiKey: string, preference: 'fast' | 'quality' = 'fast'): Promise<string> {
  if (preference === 'quality') {
    if (!_cachedQualityModel) {
      _cachedQualityModel = await resolveBestGeminiModel(apiKey, 'quality');
    }
    return _cachedQualityModel;
  }
  if (!_cachedFastModel) {
    _cachedFastModel = await resolveBestGeminiModel(apiKey, 'fast');
  }
  return _cachedFastModel;
}

/**
 * Create a model adapter for the specified provider.
 */
function createAdapter(
  provider: AIProvider,
  modelName?: string,
  preference?: 'fast' | 'quality'
): ModelAdapter {
  switch (provider) {
    case AIProvider.GEMINI: {
      const apiKey = getApiKey(provider);
      const selectedModel = modelName || GEMINI_FLASH;
      console.log(`[aiService] Gemini adapter: ${selectedModel} (preference: ${preference || 'fast'})`);
      return new GeminiAdapter(apiKey, selectedModel);
    }

    case AIProvider.OPENAI_COMPATIBLE: {
      const apiKey = getApiKey(provider);
      const keys = PROVIDER_ENV_KEYS[AIProvider.OPENAI_COMPATIBLE];
      const baseUrl = process.env[keys.baseUrl!] || process.env[keys.altBaseUrl!] || 'https://api.openai.com/v1';
      const selectedModel = modelName || process.env[keys.model!] || process.env[keys.altModel!] || DEFAULT_MODELS[AIProvider.OPENAI_COMPATIBLE];
      console.log(`[aiService] OpenAI-compatible adapter: ${selectedModel} @ ${baseUrl}`);
      return new OpenAICompatibleAdapter(apiKey, baseUrl, selectedModel);
    }

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Get model adapter using the active provider configuration.
 */
export async function getModelAdapter(
  _userId: string,
  modelName?: string,
  providerOverride?: string,
  preference?: 'fast' | 'quality'
): Promise<ModelAdapter> {
  const provider = resolveProvider(providerOverride);

  // For Gemini, we can auto-resolve the best model if none specified
  if (provider === AIProvider.GEMINI && !modelName) {
    const apiKey = getApiKey(provider);
    const resolvedModel = await getResolvedGeminiModel(apiKey, preference);
    return createAdapter(provider, resolvedModel, preference);
  }

  return createAdapter(provider, modelName, preference);
}

/**
 * Generate content using the active provider.
 */
export async function generateContent(
  userId: string,
  prompt: string,
  options?: GenerateContentOptions
): Promise<GenerateContentResult> {
  const adapter = await getModelAdapter(userId, undefined, undefined, options?.modelPreference);
  return adapter.generateContent(prompt, options);
}

/**
 * Generate content with file input using the active provider.
 */
export async function generateContentWithFile(
  userId: string,
  prompt: string,
  filePath: string,
  mimeType: string,
  options?: GenerateContentOptions
): Promise<GenerateContentResult> {
  const adapter = await getModelAdapter(userId, undefined, undefined, options?.modelPreference);
  return adapter.generateContentWithFile(prompt, filePath, mimeType, options);
}

/**
 * Generate structured JSON response using the active provider.
 */
export async function generateStructuredResponse<T>(
  userId: string,
  prompt: string,
  options?: GenerateContentOptions & { responseJsonSchema?: object; modelPreference?: 'fast' | 'quality' },
  providerOverride?: string
): Promise<T> {
  const adapter = await getModelAdapter(userId, undefined, providerOverride, options?.modelPreference);
  return adapter.generateStructuredResponse<T>(prompt, options);
}

/**
 * Get available models for the active provider.
 * If Gemini is active, discovers models from the API.
 * If OpenAI-compatible is active, returns the configured model.
 */
export async function getAvailableModels(_userId: string): Promise<string[]> {
  const provider = resolveProvider();

  if (provider === AIProvider.GEMINI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return [GEMINI_FLASH];
    }
    const discovered = await listGeminiModels(apiKey);
    return discovered.length > 0 ? discovered : [GEMINI_FLASH];
  }

  if (provider === AIProvider.OPENAI_COMPATIBLE) {
    const keys = PROVIDER_ENV_KEYS[AIProvider.OPENAI_COMPATIBLE];
    const model = process.env[keys.model!] || process.env[keys.altModel!] || DEFAULT_MODELS[AIProvider.OPENAI_COMPATIBLE];
    return [model];
  }

  return [DEFAULT_MODELS[provider]];
}

/**
 * Check if the active provider supports image context.
 */
export async function supportsImageContext(_userId: string, _modelName?: string): Promise<boolean> {
  const provider = resolveProvider();
  return PROVIDER_CAPABILITIES[provider].supportsImages;
}

/**
 * Get capabilities of the active provider.
 */
export async function getProviderCapabilities(_userId: string) {
  const provider = resolveProvider();
  const caps = PROVIDER_CAPABILITIES[provider];
  return {
    supportsImages: caps.supportsImages,
    supportsFiles: caps.supportsFiles,
    supportsJSON: caps.supportsJSON,
    maxTokens: provider === AIProvider.GEMINI ? 1000000 : 128000,
  };
}
