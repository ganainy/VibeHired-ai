import { GEMINI_FLASH, GEMINI_PRO } from '../constants/geminiModels';

type ModelPreference = 'fast' | 'quality';

interface GeminiApiModel {
  name?: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

interface GeminiModelsApiResponse {
  models?: GeminiApiModel[];
}

interface CachedModelList {
  modelNames: string[];
  expiresAt: number;
}

const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MIN_CACHE_TTL_MS = 30 * 1000;
const MAX_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const modelsCache = new Map<string, CachedModelList>();

function parseCacheTtlMs(): number {
  const raw = process.env.GEMINI_MODELS_CACHE_TTL_MS;
  if (!raw) {
    return DEFAULT_CACHE_TTL_MS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_CACHE_TTL_MS;
  }

  return Math.min(MAX_CACHE_TTL_MS, Math.max(MIN_CACHE_TTL_MS, Math.floor(parsed)));
}

function normalizeModelName(value: string): string {
  return value.startsWith('models/') ? value.slice('models/'.length) : value;
}

function supportsGenerateContent(model: GeminiApiModel): boolean {
  if (!Array.isArray(model.supportedGenerationMethods)) {
    return true;
  }

  return model.supportedGenerationMethods.includes('generateContent');
}

function isPreviewOrExperimental(modelName: string, model?: GeminiApiModel): boolean {
  const haystack = [
    modelName,
    model?.displayName || '',
    model?.description || '',
  ]
    .join(' ')
    .toLowerCase();

  return [
    'preview',
    'experimental',
    'exp',
    'deprecated',
    'decommission',
  ].some((flag) => haystack.includes(flag));
}

function modelScore(modelName: string, preference: ModelPreference): number {
  const lower = modelName.toLowerCase();
  const versionMatch = lower.match(/gemini-(\d+)(?:\.(\d+))?/);
  const major = versionMatch ? Number(versionMatch[1]) : 0;
  const minor = versionMatch && versionMatch[2] ? Number(versionMatch[2]) : 0;
  const versionScore = major * 100 + minor;

  const hasFlash = /(^|-)flash(-|$)/.test(lower);
  const hasPro = /(^|-)pro(-|$)/.test(lower);
  const has8B = /(^|-)8b(-|$)/.test(lower);
  const hasPreview = lower.includes('preview');
  const hasExp = lower.includes('experimental') || /(^|-)exp(-|$)/.test(lower);

  let score = versionScore * 10;

  if (preference === 'fast') {
    if (hasFlash) score += 40;
    if (hasPro) score += 15;
  } else {
    if (hasPro) score += 40;
    if (hasFlash) score += 15;
  }

  if (has8B) score -= 10;
  if (hasPreview) score -= 2;
  if (hasExp) score -= 6;

  return score;
}

function pickBestModel(modelNames: string[], preference: ModelPreference): string | null {
  if (modelNames.length === 0) {
    return null;
  }

  const sorted = [...modelNames].sort((a, b) => {
    const scoreDiff = modelScore(b, preference) - modelScore(a, preference);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return b.localeCompare(a);
  });

  return sorted[0] || null;
}

export async function listGeminiModels(apiKey: string, forceRefresh: boolean = false): Promise<string[]> {
  const now = Date.now();
  const cached = modelsCache.get(apiKey);

  if (!forceRefresh && cached && cached.expiresAt > now) {
    return cached.modelNames;
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const message = await response.text().catch(() => 'Unknown error');
      throw new Error(`Gemini models API failed: ${response.status} ${response.statusText} - ${message}`);
    }

    const payload = (await response.json()) as GeminiModelsApiResponse;
    const apiModels = Array.isArray(payload.models) ? payload.models : [];

    const modelNames = apiModels
      .filter((model) => supportsGenerateContent(model))
      .map((model) => normalizeModelName(model.name || ''))
      .filter((name) => name.length > 0)
      .sort();

    modelsCache.set(apiKey, {
      modelNames,
      expiresAt: now + parseCacheTtlMs(),
    });

    return modelNames;
  } catch (error) {
    console.warn('Failed to list Gemini models; using cached/fallback values.', error);
    return cached?.modelNames || [];
  }
}

export async function resolveBestGeminiModel(
  apiKey: string,
  preference: ModelPreference = 'fast'
): Promise<string> {
  const fallback = preference === 'quality' ? GEMINI_PRO : GEMINI_FLASH;
  const modelNames = await listGeminiModels(apiKey);

  if (modelNames.length === 0) {
    return fallback;
  }

  // Prefer stable names first, then preview/experimental as a fallback.
  const stableModels = modelNames.filter((name) => !isPreviewOrExperimental(name));
  const bestStable = pickBestModel(stableModels, preference);
  if (bestStable) {
    return bestStable;
  }

  const bestAny = pickBestModel(modelNames, preference);
  return bestAny || fallback;
}

export function clearGeminiModelsCache(apiKey?: string): void {
  if (apiKey) {
    modelsCache.delete(apiKey);
    return;
  }

  modelsCache.clear();
}
