// electron/src/services/api.ts
// API client for the Interview Buddy with streaming support
// apiUrl and token are injected at runtime from the deep-link payload.

export interface AnswerResult {
  answer: string;
  done?: boolean;
}

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

/**
 * Build a WebSocket URL for the real-time transcription endpoint.
 * Example: http://localhost:5001/api -> ws://localhost:5001/api/transcribe-stream
 */
export function buildTranscriptionStreamUrl(apiUrl: string, token: string, language?: string): string {
  const url = new URL(apiUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';

  const basePath = url.pathname.endsWith('/')
    ? url.pathname.slice(0, -1)
    : url.pathname;

  url.pathname = `${basePath}/transcribe-stream`;
  url.searchParams.set('token', token);
  if (language) {
    url.searchParams.set('language', language);
  }
  return url.toString();
}

/**
 * Initialize a pre-warmed Gemini chat session for CV + job context.
 * Call this BEFORE any recording to pre-seed the conversation.
 */
export async function initializeSession(
  apiUrl: string,
  token: string,
  jobId: string,
  referenceMaterialIds: string[] = [],
  activeCvId?: string,
): Promise<{ sessionId: string }> {
  const res = await fetch(`${apiUrl}/interview/${jobId}/initialize-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ referenceMaterialIds, activeCvId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || 'Failed to initialize session');
  }
  return res.json() as Promise<{ sessionId: string }>;
}
/**
 * Stream an AI-generated answer using SSE.
 * Returns the ReadableStream that yields { text: string } and { done: true } events.
 */
export async function fetchStreamingAnswer(
  apiUrl: string,
  token: string,
  jobId: string,
  question: string,
  referenceMaterialIds: string[] = [],
  activeCvId?: string,
): Promise<Response> {
  const res = await fetch(`${apiUrl}/interview/${jobId}/stream-interview-buddy-answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question, referenceMaterialIds, activeCvId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || 'Failed to stream answer');
  }
  if (!res.body) {
    throw new Error('No response body');
  }
  return res;
}
/**
 * Legacy fetch for backward compatibility.
 * Returns the full AnswerResult with opener/keyPoints/closing structure.
 */
export async function fetchAnswer(
  apiUrl: string,
  token: string,
  jobId: string,
  question: string,
  referenceMaterialIds: string[] = [],
  activeCvId?: string,
): Promise<AnswerResult> {
  const res = await fetch(`${apiUrl}/interview/${jobId}/answer-question`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question, referenceMaterialIds, activeCvId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || 'Failed to generate answer');
  }
  return res.json() as Promise<AnswerResult>;
}
