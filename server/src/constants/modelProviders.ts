/**
 * Centralised AI provider configuration.
 * ─────────────────────────────────────
 * When adding a new provider, update the enums and default model mappings here
 * and the change propagates everywhere in the codebase automatically.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * DeepSeek Setup Guide
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * DeepSeek uses an OpenAI-compatible chat completions API. Configure it like this:
 *
 *   DEFAULT_AI_PROVIDER=openai_compatible
 *   OPENAI_API_KEY=your_deepseek_api_key_here
 *   OPENAI_BASE_URL=https://api.deepseek.com
 *   OPENAI_MODEL=deepseek-v4-flash
 *
 * Alternative (DeepSeek-specific env names also work):
 *   DEEPSEEK_API_KEY=your_deepseek_api_key_here
 *   DEEPSEEK_BASE_URL=https://api.deepseek.com
 *   DEEPSEEK_MODEL=deepseek-v4-flash
 *
 * Supported DeepSeek models (text):
 *   deepseek-v4-pro, deepseek-v4-flash
 *
 * DeepSeek capabilities:
 *   - Thinking mode: supported (via thinking: { type: 'enabled' })
 *   - Reasoning effort: low, medium, high
 *   - Images: base64 data URLs or public URLs (jpg, png, jpeg, max 5MB)
 *   - Files: not supported (use base64 images instead)
 *   - Streaming: yes (SSE format)
 *   - JSON mode: yes (response_format: { type: 'json_object' })
 *   - Temperature: 0.0 – 1.0
 *   - Max tokens: up to 64K output
 *
 * Get your API key: https://platform.deepseek.com
 * Docs: https://platform.deepseek.com/docs
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
  deepseek: AIProvider.OPENAI_COMPATIBLE,
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
  [AIProvider.OPENAI_COMPATIBLE]: process.env.DEEPSEEK_MODEL || process.env.OPENAI_MODEL || 'deepseek-v4-flash',
};

/** Environment variable names per provider */
export const PROVIDER_ENV_KEYS: Record<AIProvider, { apiKey: string; altApiKey?: string; baseUrl?: string; altBaseUrl?: string; model?: string; altModel?: string }> = {
  [AIProvider.GEMINI]: {
    apiKey: 'GEMINI_API_KEY',
  },
  [AIProvider.OPENAI_COMPATIBLE]: {
    apiKey: 'OPENAI_API_KEY',
    altApiKey: 'DEEPSEEK_API_KEY',      // DeepSeek-specific alternative
    baseUrl: 'OPENAI_BASE_URL',
    altBaseUrl: 'DEEPSEEK_BASE_URL',    // DeepSeek-specific alternative
    model: 'OPENAI_MODEL',
    altModel: 'DEEPSEEK_MODEL',         // DeepSeek-specific alternative
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
