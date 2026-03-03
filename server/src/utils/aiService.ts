// server/src/utils/aiService.ts
import { AIProvider } from '../providers/enums';
import { ModelAdapter, GenerateContentOptions, GenerateContentResult } from '../adapters/base';
import { NotFoundError } from './errors/AppError';
import { GeminiAdapter } from '../adapters/geminiAdapter';
import { GEMINI_FLASH } from '../constants/geminiModels';

function getMasterApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('GEMINI_API_KEY not configured on server');
  }
  return key;
}

/**
 * Get model adapter for Gemini using master key.
 */
export async function getModelAdapter(
  _userId: string,
  modelName?: string,
  _providerOverride?: string
): Promise<ModelAdapter> {
  return new GeminiAdapter(
    getMasterApiKey(),
    modelName || GEMINI_FLASH
  ) as unknown as ModelAdapter;
}

/**
 * Generate content using Gemini
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
 * Generate content with file input using Gemini
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
 * Generate structured JSON response using Gemini.
 */
export async function generateStructuredResponse<T>(
  userId: string,
  prompt: string,
  options?: GenerateContentOptions,
  _providerOverride?: string
): Promise<T> {
  const adapter = await getModelAdapter(userId);
  return adapter.generateStructuredResponse<T>(prompt, options);
}

/**
 * Get available models for Gemini
 */
export async function getAvailableModels(_userId: string): Promise<string[]> {
  return [GEMINI_FLASH, 'gemini-1.5-pro'];
}

/**
 * Check if Gemini supports image context
 */
export async function supportsImageContext(_userId: string, _modelName?: string): Promise<boolean> {
  return true;
}

/**
 * Get Gemini capabilities
 */
export async function getProviderCapabilities(_userId: string) {
  return {
    supportsImages: true,
    supportsFiles: true,
    supportsJSON: true,
    maxTokens: 1000000
  };
}

