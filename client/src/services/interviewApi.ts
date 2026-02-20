const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export interface EvaluationResult {
    score: number;           // 0-10
    strengths: string[];
    improvements: string[];
    modelAnswer: string;
}

function getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('authToken');
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

/** Generate 6-8 interview questions for a job */
export async function generateInterviewQuestions(jobId: string): Promise<string[]> {
    const res = await fetch(`${API_BASE_URL}/api/interview/${jobId}/questions`, {
        method: 'POST',
        headers: getAuthHeaders(),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to generate interview questions');
    }
    const data = await res.json();
    return data.questions as string[];
}

/** Evaluate a candidate's answer to an interview question */
export async function evaluateAnswer(
    jobId: string,
    question: string,
    answer: string
): Promise<EvaluationResult> {
    const res = await fetch(`${API_BASE_URL}/api/interview/${jobId}/evaluate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ question, answer }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to evaluate answer');
    }
    return res.json() as Promise<EvaluationResult>;
}
