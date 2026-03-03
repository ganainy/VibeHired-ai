// server/src/providers/geminiProvider.ts
import { AIProvider } from './enums';
import { ProviderStrategy, ProviderCapabilities } from './base';
import { ModelAdapter } from '../adapters/base';
import { GeminiAdapter } from '../adapters/geminiAdapter';
import Profile from '../models/Profile';
import { decrypt, isEncrypted } from '../utils/encryption';

/**
 * Gemini provider strategy
 */
export class GeminiProvider extends ProviderStrategy {
  constructor() {
    super(AIProvider.GEMINI);
  }

  getName(): string {
    return 'gemini';
  }

  async getModels(userId: string): Promise<string[]> {
    const apiKey = await this.getApiKey(userId);

    // If no API key, return empty array - user must configure API key first
    if (!apiKey) {
      console.warn('Gemini API key not configured. User must add API key in Settings to load models.');
      return [];
    }

    try {
      // Fetch models from Gemini API
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`);
        return [];
      }

      const data = await response.json();
      const modelsList = data.models || [];

      if (modelsList.length === 0) {
        console.warn('No Gemini models found in API response');
        return [];
      }

      // Normalize model names (remove "models/" prefix if present)
      const normalizedModels = modelsList
        .map((model: any) => {
          const modelName = model.name || model.id || '';
          // Remove "models/" prefix if present
          return modelName.startsWith('models/')
            ? modelName.substring(7)
            : modelName;
        })
        .filter((name: string) => name.length > 0)
        .sort(); // Sort alphabetically

      return normalizedModels;
    } catch (error: any) {
      console.error('Error fetching Gemini models from API:', error);
      return [];
    }
  }

  getApiKeyName(): string {
    return 'GEMINI_API_KEY';
  }

  async validateConfig(userId: string): Promise<{ valid: boolean; error?: string }> {
    const apiKey = await this.getApiKey(userId);
    if (!apiKey) {
      return {
        valid: false,
        error: 'GEMINI_API_KEY is not set in configuration. Please add your Gemini API key in Settings.',
      };
    }
    return { valid: true };
  }

  async getApiKey(_userId: string): Promise<string | null> {
    try {
      // Use master key from environment variables
      return process.env.GEMINI_API_KEY || null;
    } catch (error) {
      console.error('Error getting Gemini API key:', error);
      return null;
    }
  }


  checkDependencies(): { installed: boolean; message?: string } {
    try {
      require('@google/generative-ai');
      return { installed: true };
    } catch {
      return {
        installed: false,
        message: 'Install: npm install @google/generative-ai',
      };
    }
  }

  supportsImageContext(modelName?: string): boolean {
    // Gemini models generally support images
    return true;
  }

  getCapabilities(): ProviderCapabilities {
    return {
      xmlMaxLen: 500000,
      imageSupported: true,
      imageMaxWidth: 640,
      payloadMaxSizeKb: 1000,
      online: true,
    };
  }

  createModelAdapter(apiKey: string, modelName: string): ModelAdapter {
    return new GeminiAdapter(apiKey, modelName);
  }
}

// Register the provider
import { ProviderRegistry } from './registry';
ProviderRegistry.register(AIProvider.GEMINI, new GeminiProvider());

