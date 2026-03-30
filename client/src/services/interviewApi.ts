import axios from 'axios';
import { parseApiErrorMessage } from '../utils/parseApiError';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api';

export interface EvaluationResult {
    score: number;           // 0-10
    strengths: string[];
    improvements: string[];
    modelAnswer: string;
}

/** Generate interview questions for a job */
export async function generateInterviewQuestions(
    jobId: string,
    level: 'first' | 'second' = 'first',
    questionCount: number = 5
): Promise<string[]> {
    try {
        const { data } = await axios.post<{ questions: string[] }>(
            `${API_BASE_URL}/interview/${jobId}/questions`,
            { level, questionCount }
        );
        return data.questions;
    } catch (error) {
        throw new Error(parseApiErrorMessage(error) || 'Failed to generate interview questions');
    }
}

export interface AnswerResult {
    opener: string;
    keyPoints: string[];
    closing: string;
}

/** Generate a live answer for the AI Interview Buddy overlay */
export async function answerQuestion(
    jobId: string,
    question: string
): Promise<AnswerResult> {
    try {
        const { data } = await axios.post<AnswerResult>(`${API_BASE_URL}/interview/${jobId}/answer-question`, { question });
        return data;
    } catch (error) {
        throw new Error(parseApiErrorMessage(error) || 'Failed to generate answer');
    }
}

/** Evaluate a candidate's answer to an interview question */
export async function evaluateAnswer(
    jobId: string,
    question: string,
    answer: string
): Promise<EvaluationResult> {
    try {
        const { data } = await axios.post<EvaluationResult>(`${API_BASE_URL}/interview/${jobId}/evaluate`, { question, answer });
        return data;
    } catch (error) {
        throw new Error(parseApiErrorMessage(error) || 'Failed to evaluate answer');
    }
}
