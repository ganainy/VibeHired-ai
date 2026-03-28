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
 * Initialize a pre-warmed Gemini chat session for CV + job context.
 * Call this BEFORE any recording to pre-seed the conversation.
 */
export async function initializeSession(
  apiUrl: string,
  token: string,
  jobId: string,
): Promise<{ sessionId: string }> {
  const res = await fetch(`${apiUrl}/interview/${jobId}/initialize-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
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
): Promise<Response> {
  const res = await fetch(`${apiUrl}/interview/${jobId}/stream-answer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question }),
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
  question: string
): Promise<AnswerResult> {
  const res = await fetch(`${apiUrl}/interview/${jobId}/answer-question`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || 'Failed to generate answer');
  }
  return res.json() as Promise<AnswerResult>;
}
