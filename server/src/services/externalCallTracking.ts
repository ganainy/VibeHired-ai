import axios from 'axios';
import mongoose from 'mongoose';
import ExternalCallLog, { ExternalCallCategory } from '../models/ExternalCallLog';
import { getUserId, getUserEmail, getRequestPath, getCreditUsed } from './requestContext';

type TrackedProvider = 'gemini' | 'openrouter' | 'ollama' | 'openai' | 'anthropic' | 'apify';

interface TrackedTarget {
  category: ExternalCallCategory;
  provider: TrackedProvider;
}

interface TrackedCallLog {
  category: ExternalCallCategory;
  provider: string;
  url: string;
  method: string;
  statusCode?: number;
  success: boolean;
  durationMs: number;
  modelName?: string;
  errorMessage?: string;
  userId?: string;
  userEmail?: string;
  service?: string;  // The backend feature/endpoint that triggered the call
}

interface AxiosTrackingMeta {
  startedAt: number;
  target: TrackedTarget;
  url: string;
  modelName?: string;
  service?: string;  // Track calling service for display
}

const TRACKED_HOSTS: Array<{ match: (host: string, port: string) => boolean; target: TrackedTarget }> = [
  {
    match: (host) => host === 'api.apify.com',
    target: { category: 'apify', provider: 'apify' },
  },
  {
    match: (host) => host === 'generativelanguage.googleapis.com',
    target: { category: 'ai', provider: 'gemini' },
  },
  {
    match: (host) => host === 'openrouter.ai',
    target: { category: 'ai', provider: 'openrouter' },
  },
  {
    match: (host, port) => host === 'localhost' && port === '11434',
    target: { category: 'ai', provider: 'ollama' },
  },
  {
    match: (host) => host === 'api.openai.com',
    target: { category: 'ai', provider: 'openai' },
  },
  {
    match: (host) => host === 'api.anthropic.com',
    target: { category: 'ai', provider: 'anthropic' },
  },
];

let fetchTrackingInstalled = false;
let axiosTrackingInstalled = false;

function safeParseUrl(input: string): URL | null {
  try {
    return new URL(input);
  } catch {
    return null;
  }
}

function getTrackedTarget(url: string): TrackedTarget | null {
  const parsed = safeParseUrl(url);
  if (!parsed) return null;

  const host = parsed.hostname.toLowerCase();
  const port = parsed.port;

  const match = TRACKED_HOSTS.find((entry) => entry.match(host, port));
  return match?.target ?? null;
}

function extractModelFromGeminiPath(pathname: string): string | undefined {
  const match = pathname.match(/\/models\/([^/:?]+)/i);
  if (!match?.[1]) return undefined;
  return decodeURIComponent(match[1]);
}

function parseBodyToObject(body: unknown): Record<string, any> | null {
  if (!body) return null;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  if (typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, any>;
  }
  return null;
}

function extractModelName(url: string, body: unknown): string | undefined {
  const parsed = safeParseUrl(url);
  const bodyObj = parseBodyToObject(body);

  const directModel = bodyObj?.model || bodyObj?.modelName;
  if (typeof directModel === 'string' && directModel.trim()) {
    return directModel.trim();
  }

  if (parsed?.hostname === 'generativelanguage.googleapis.com') {
    return extractModelFromGeminiPath(parsed.pathname);
  }

  return undefined;
}

function truncateErrorMessage(message: unknown): string | undefined {
  if (!message) return undefined;
  const text = String(message);
  if (!text) return undefined;
  return text.length > 500 ? `${text.slice(0, 497)}...` : text;
}

function persistLog(log: TrackedCallLog): void {
  const parsed = safeParseUrl(log.url);
  console.log('[ExternalCallTracking] persistLog called, url:', log.url, 'parsed:', parsed ? 'yes' : 'no');
  if (!parsed) return;

  const contextUserId = getUserId();
  const contextUserEmail = getUserEmail();

  console.log('[ExternalCallTracking] Context from asyncLocalStorage:', { contextUserId, contextUserEmail });
  console.log('[ExternalCallTracking] Log object userId/userEmail:', { logUserId: log.userId, logUserEmail: log.userEmail });

  const userId = log.userId || contextUserId;
  const userEmail = log.userEmail || contextUserEmail;

  console.log('[ExternalCallTracking] Final userId:', userId, 'userEmail:', userEmail);

  const backendRequestPath = getRequestPath();
  const contextCreditUsed = getCreditUsed();

  const doc: any = {
    category: log.category,
    provider: log.provider,
    host: parsed.hostname,
    path: parsed.pathname,
    method: (log.method || 'GET').toUpperCase(),
    statusCode: log.statusCode,
    success: log.success,
    durationMs: Math.max(0, Math.round(log.durationMs)),
    modelName: log.modelName,
    errorMessage: truncateErrorMessage(log.errorMessage),
    requestPath: backendRequestPath || parsed.pathname,
    requestMethod: (log.method || 'GET').toUpperCase(),
    metadata: {
      creditUsed: contextCreditUsed,
    },
  };

  if (typeof contextCreditUsed === 'number' && Number.isFinite(contextCreditUsed) && contextCreditUsed >= 0) {
    doc.creditUsed = contextCreditUsed;
  }

  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    doc.userId = new mongoose.Types.ObjectId(userId);
  }
  if (userEmail) {
    doc.userEmail = userEmail;
  }

  console.log('[ExternalCallTracking] Saving log with userId:', userId, 'userEmail:', userEmail);

  void ExternalCallLog.create(doc).catch((error) => {
    console.error('[ExternalCallTracking] Failed to persist call log:', error);
  });
}

function installFetchTracking(): void {
  if (fetchTrackingInstalled || typeof globalThis.fetch !== 'function') return;
  fetchTrackingInstalled = true;

  const originalFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const userId = getUserId();
    const userEmail = getUserEmail();
    
    if (userId) {
      console.log('[ExternalCallTracking] Fetch - User found:', userId, userEmail);
    } else {
      console.log('[ExternalCallTracking] Fetch - No user in context for URL:', typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url);
    }
    
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const target = getTrackedTarget(url);

    if (!target) {
      return originalFetch(input as any, init);
    }

    const startedAt = Date.now();
    const method = (init?.method || (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET') || 'GET').toUpperCase();
    const modelName = extractModelName(url, init?.body);

    try {
      const response = await originalFetch(input as any, init);

      persistLog({
        category: target.category,
        provider: target.provider,
        url,
        method,
        statusCode: response.status,
        success: response.ok,
        durationMs: Date.now() - startedAt,
        modelName,
        userId,
        userEmail,
      });

      return response;
    } catch (error: any) {
      persistLog({
        category: target.category,
        provider: target.provider,
        url,
        method,
        success: false,
        durationMs: Date.now() - startedAt,
        modelName,
        errorMessage: error?.message || String(error),
        userId,
        userEmail,
      });
      throw error;
    }
  };
}

function installAxiosTracking(): void {
  if (axiosTrackingInstalled) return;
  axiosTrackingInstalled = true;

  axios.interceptors.request.use((config) => {
    // Try to get user info from async context first
    let userId = getUserId();
    let userEmail = getUserEmail();
    
    // If not in async context, check if it was set on a previous interceptor
    if (!userId) {
      userId = (config as any).__userId;
    }
    if (!userEmail) {
      userEmail = (config as any).__userEmail;
    }
    
    // Always set user info on config for response interceptor to use
    (config as any).__userId = userId;
    (config as any).__userEmail = userEmail;

    const rawUrl = config.url || '';
    const absoluteUrl = config.baseURL ? new URL(rawUrl, config.baseURL).toString() : rawUrl;
    const target = getTrackedTarget(absoluteUrl);
    
    if (target && !userId) {
      console.log('[ExternalCallTracking] Axios - No user in context for tracked URL:', absoluteUrl);
    }

    if (target && userId) {
      console.log('[ExternalCallTracking] Axios - User found for tracked call:', userId, userEmail);
    }

    if (!target) return config;

    const modelName = extractModelName(absoluteUrl, config.data);
    (config as any).__externalTrackingMeta = {
      startedAt: Date.now(),
      target,
      url: absoluteUrl,
      modelName,
    } as AxiosTrackingMeta;

    return config;
  });

  axios.interceptors.response.use(
    (response) => {
      const meta = (response.config as any).__externalTrackingMeta as AxiosTrackingMeta | undefined;
      const userId = (response.config as any).__userId;
      const userEmail = (response.config as any).__userEmail;
      if (meta) {
        persistLog({
          category: meta.target.category,
          provider: meta.target.provider,
          url: meta.url,
          method: (response.config.method || 'GET').toUpperCase(),
          statusCode: response.status,
          success: response.status >= 200 && response.status < 400,
          durationMs: Date.now() - meta.startedAt,
          modelName: meta.modelName,
          userId,
          userEmail,
        });
      }
      return response;
    },
    (error) => {
      const config = error?.config as any;
      const meta = config?.__externalTrackingMeta as AxiosTrackingMeta | undefined;
      const userId = config?.__userId;
      const userEmail = config?.__userEmail;
      if (meta) {
        persistLog({
          category: meta.target.category,
          provider: meta.target.provider,
          url: meta.url,
          method: (config?.method || 'GET').toUpperCase(),
          statusCode: error?.response?.status,
          success: false,
          durationMs: Date.now() - meta.startedAt,
          modelName: meta.modelName,
          errorMessage: error?.message || String(error),
          userId,
          userEmail,
        });
      }
      return Promise.reject(error);
    }
  );
}

export function installExternalCallTracking(): void {
  installFetchTracking();
  installAxiosTracking();
}
