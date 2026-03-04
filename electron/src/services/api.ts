// electron/src/services/api.ts
// Thin fetch wrapper that calls the VibeHired backend.
// apiUrl and token are injected at runtime from the deep-link payload.

export interface AnswerResult {
  opener: string;
  keyPoints: string[];
  closing: string;
}

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
