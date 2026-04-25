/**
 * Centralised AI provider configuration.
 * ─────────────────────────────────────
 * When adding a new provider, update the enums and default model mappings here
 * and the change propagates everywhere in the codebase automatically.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * GLM (Z.AI) Setup Guide
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * GLM uses an OpenAI-compatible chat completions API. Configure it like this:
 *
 *   DEFAULT_AI_PROVIDER=openai_compatible
 *   GLM_API_KEY=your_glm_api_key_here
 *   GLM_BASE_URL=https://api.z.ai/api/paas/v4
 *   GLM_MODEL=glm-5.1
 *
 * Alternative (OpenAI-style env names also work):
 *   OPENAI_API_KEY=your_glm_api_key_here
 *   OPENAI_BASE_URL=https://api.z.ai/api/paas/v4
 *   OPENAI_MODEL=glm-5.1
 *
 * Supported GLM models (text):
 *   glm-5.1, glm-5-turbo, glm-5, glm-4.7, glm-4.7-flash, glm-4.7-flashx,
 *   glm-4.6, glm-4.5, glm-4.5-air, glm-4.5-x, glm-4.5-airx, glm-4.5-flash,
 *   glm-4-32b-0414-128k
 *
 * Supported GLM vision models (images + files):
 *   glm-5v-turbo, glm-4.6v, glm-4.6v-flash, glm-4.6v-flashx, glm-4.5v
 *
 * GLM capabilities:
 *   - Images: base64 data URLs or public URLs (jpg, png, jpeg, max 5MB)
 *   - Files: PDF, txt, word, jsonl, xlsx, pptx (via public URL only)
 *     → For local files we extract text (PDF) or read raw text
 *   - Streaming: yes (SSE format)
 *   - JSON mode: yes (response_format: { type: 'json_object' })
 *   - Temperature: 0.0 – 1.0
 *   - Max tokens: up to 128K output
 *
 * Get your API key: https://z.ai/manage-apikey/apikey-list
 * Docs: https://docs.z.ai/llms.txt
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/** Supported AI providers */
export enum AIProvider {
  GEMINI = 'gemini',
  OPENAI_COMPATIBLE = 'openai_compatible',
}

/** Recognised string aliases that map to a provider */
export const PROVIDER_ALIASES: Record<string, AIProvider> = {
  gemini: AIProvider.GEMINI,
  openai_compatible: AIProvider.OPENAI_COMPATIBLE,
  openai: AIProvider.OPENAI_COMPATIBLE,
  glm: AIProvider.OPENAI_COMPATIBLE,
};

/** Helper to validate provider string */
export function isValidProvider(provider: string): provider is AIProvider {
  return Object.values(AIProvider).includes(provider as AIProvider);
}

/** Helper to get provider from string with fallback */
export function getProvider(provider: string | undefined): AIProvider {
  if (!provider) {
    return AIProvider.GEMINI; // Default fallback
  }
  const alias = PROVIDER_ALIASES[provider.toLowerCase()];
  if (alias) {
    return alias;
  }
  if (isValidProvider(provider)) {
    return provider as AIProvider;
  }
  return AIProvider.GEMINI;
}

/** Default model names per provider */
export const DEFAULT_MODELS: Record<AIProvider, string> = {
  [AIProvider.GEMINI]: 'gemini-3-flash-preview',
  [AIProvider.OPENAI_COMPATIBLE]: process.env.GLM_MODEL || process.env.OPENAI_MODEL || 'glm-5.1',
};

/** Environment variable names per provider */
export const PROVIDER_ENV_KEYS: Record<AIProvider, { apiKey: string; altApiKey?: string; baseUrl?: string; altBaseUrl?: string; model?: string; altModel?: string }> = {
  [AIProvider.GEMINI]: {
    apiKey: 'GEMINI_API_KEY',
  },
  [AIProvider.OPENAI_COMPATIBLE]: {
    apiKey: 'OPENAI_API_KEY',
    altApiKey: 'GLM_API_KEY',      // GLM-specific alternative
    baseUrl: 'OPENAI_BASE_URL',
    altBaseUrl: 'GLM_BASE_URL',    // GLM-specific alternative
    model: 'OPENAI_MODEL',
    altModel: 'GLM_MODEL',         // GLM-specific alternative
  },
};

/** Provider capabilities */
export interface ProviderCapabilityFlags {
  supportsImages: boolean;
  supportsFiles: boolean;
  supportsJSON: boolean;
  supportsStreaming: boolean;
}

export const PROVIDER_CAPABILITIES: Record<AIProvider, ProviderCapabilityFlags> = {
  [AIProvider.GEMINI]: {
    supportsImages: true,
    supportsFiles: true,
    supportsJSON: true,
    supportsStreaming: true,
  },
  [AIProvider.OPENAI_COMPATIBLE]: {
    supportsImages: true,
    supportsFiles: false, // Files must be extracted to text / base64 image
    supportsJSON: true,
    supportsStreaming: true,
  },
};
