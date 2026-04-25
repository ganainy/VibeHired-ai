// server/src/adapters/base.ts

import { Readable } from 'stream';

export interface GenerateContentOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  modelPreference?: 'fast' | 'quality';
  debugLabel?: string;
}

export interface GenerateContentResult {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Abstract base class for AI model adapters
 */
export abstract class ModelAdapter {
  /**
   * Generate content from a text prompt
   */
  abstract generateContent(
    prompt: string,
    options?: GenerateContentOptions
  ): Promise<GenerateContentResult>;

  /**
   * Generate content from a prompt with file input
   */
  abstract generateContentWithFile(
    prompt: string,
    filePath: string,
    mimeType: string,
    options?: GenerateContentOptions
  ): Promise<GenerateContentResult>;

  /**
   * Generate a structured JSON response from a prompt
   */
  abstract generateStructuredResponse<T>(
    prompt: string,
    options?: GenerateContentOptions
  ): Promise<T>;

  /**
   * Start a chat session with initial history (for multi-turn conversations)
   */
  abstract startChatSession(
    systemPrompt: string,
    options?: GenerateContentOptions
  ): Promise<string>;

  /**
   * Send a message to an existing chat session and return streaming response
   */
  abstract sendMessageStream(
    sessionId: string,
    message: string,
  ): Promise<NodeJS.ReadableStream>;

  /**
   * Get information about the model
   */
  abstract getModelInfo(): {
    provider: string;
    modelName: string;
    capabilities: {
      imageSupport: boolean;
      maxTokens?: number;
    };
  };
}

/**
 * Generic chat session interface — provider implementations store their own session objects
 */
export interface GenericChatSession {
  /** Provider-specific session handle (e.g. Gemini ChatSession, message history array, etc.) */
  handle: unknown;
  createdAt: number;
}

/**
 * In-memory store for active chat sessions.
 * Keyed by sessionId → GenericChatSession
 */
export const chatSessions = new Map<string, GenericChatSession>();

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Clean up expired chat sessions (older than 2 hours)
 */
export function cleanupExpiredSessions(): void {
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const now = Date.now();
  const keysToDelete: string[] = [];
  chatSessions.forEach((session, id) => {
    if (now - session.createdAt > TWO_HOURS) {
      keysToDelete.push(id);
    }
  });
  keysToDelete.forEach(id => chatSessions.delete(id));
}
