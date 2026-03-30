import { generateStructuredResponse } from '../utils/aiService';
import JobApplication from '../models/JobApplication';
import { NotFoundError, AuthorizationError } from '../utils/errors/AppError';
import CV from '../models/CV';
import InterviewMaterial from '../models/InterviewMaterial';
import { convertJsonResumeToText } from '../utils/cvTextExtractor';
import { GoogleGenerativeAI, ChatSession } from '@google/generative-ai';
import { GEMINI_FLASH } from '../constants/geminiModels';
import { Response } from 'express';
import { Readable } from 'stream';

// ─────────────────────────────────────────────────────────────
// Language helpers
// ─────────────────────────────────────────────────────────────

const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English',
    de: 'German',
};

function getLanguageName(lang?: string): string {
    return LANGUAGE_NAMES[lang ?? 'en'] ?? 'English';
}

// ─────────────────────────────────────────────────────────────
// Auth helpers
// ─────────────────────────────────────────────────────────────

async function getOwnedJob(jobId: string, userId: string) {
    const job = await JobApplication.findById(jobId);
    if (!job) throw new NotFoundError('Job application not found');
    if (job.userId.toString() !== userId.toString()) {
        throw new AuthorizationError('You do not have access to this job application');
    }
    return job;
}

// ─────────────────────────────────────────────────────────────
// In-memory chat session store
// Key: `${userId}:${jobId}:${activeCvId||'job-default'}` → { chatSession, createdAt }
// ─────────────────────────────────────────────────────────────

const chatSessions = new Map<string, { chatSession: ChatSession; createdAt: number }>();

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function sessionKey(userId: string, jobId: string, activeCvId?: string): string {
    return `${userId}:${jobId}:${activeCvId || 'job-default'}`;
}

function cleanupExpiredSessions(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    chatSessions.forEach((session, key) => {
        if (now - session.createdAt > SESSION_TTL_MS) {
            keysToDelete.push(key);
        }
    });
    keysToDelete.forEach(key => chatSessions.delete(key));
}

// ─────────────────────────────────────────────────────────────
// Gemini model factory
// ─────────────────────────────────────────────────────────────

function getGeminiApiKey(): string {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY not configured on server');
    return key;
}

// ─────────────────────────────────────────────────────────────
// Pre-warmed chat session: initialize
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(
    jobContext: string,
    cvText: string | null,
    languageName: string,
    referenceContext: string | null,
): string {
    let prompt = `You are an expert interview coach helping a candidate answer a live interview question.
The candidate will READ your answer aloud to the interviewer, so it must sound natural and confident.

Job Context:
${jobContext}
`;

    if (cvText) {
        prompt += `
Candidate's CV (reference this for specific examples):
${cvText.slice(0, 3000)}
`;
    }

    if (referenceContext) {
        prompt += `
Reference Documents from Prep Library (use these as additional factual context):
${referenceContext}
`;
    }

    prompt += `
Rules:
1. Answer ONLY the question asked — no preamble, no filler, no summary paragraph at the end.
2. Keep the total answer concise — about 30–45 seconds to say aloud.
3. Sound natural — avoid robotic phrases like "I believe" or "As a candidate".
4. If relevant, briefly reference a specific experience from the CV.
5. If relevant, reference facts from the attached Prep Library documents.
6. ALL text must be in ${languageName}.
7. Respond with plain text only — no bullet points, no headers, no formatting.`;

    return prompt;
}

async function getReferenceMaterialsContext(
    userId: string,
    referenceMaterialIds: string[],
): Promise<string | null> {
    if (!referenceMaterialIds.length) return null;

    const materials = await InterviewMaterial.find({
        _id: { $in: referenceMaterialIds },
        userId,
        isGlobal: true,
    })
        .sort({ updatedAt: -1 })
        .limit(12)
        .lean();

    if (!materials.length) return null;

    return materials
        .map((material, index) => {
            const type = String(material.type || '').toUpperCase();
            const contentExcerpt = typeof material.content === 'string' ? material.content.slice(0, 700) : '';
            const descriptionExcerpt = typeof material.description === 'string' ? material.description.slice(0, 280) : '';
            const urlLine = typeof material.url === 'string' && material.url.trim()
                ? `Source URL: ${material.url.trim()}`
                : '';

            const details = [descriptionExcerpt, contentExcerpt, urlLine]
                .filter(Boolean)
                .join('\n');

            return `Document ${index + 1}: ${material.title} (${type})\n${details || 'No extra text content provided.'}`;
        })
        .join('\n\n');
}

async function getCvTextForInterviewContext(
    userId: string,
    jobId: string,
    activeCvId?: string,
): Promise<string | null> {
    if (activeCvId) {
        const selectedCv = await CV.findOne({ _id: activeCvId, userId }).lean();
        if (selectedCv?.cvJson) {
            return convertJsonResumeToText(selectedCv.cvJson as any);
        }
    }

    const jobCv = await CV.getJobCv(jobId);
    if (jobCv?.cvJson) {
        return convertJsonResumeToText(jobCv.cvJson);
    }

    return null;
}

export async function initializeInterviewSession(
    userId: string,
    jobId: string,
    referenceMaterialIds: string[] = [],
    activeCvId?: string,
): Promise<string> {
    // Cleanup old sessions
    cleanupExpiredSessions();

    const job = await getOwnedJob(jobId, userId);
    const languageName = getLanguageName(job.language);

    // Build job context
    const jobContext = [
        `Job Title: ${job.jobTitle}`,
        `Company: ${job.companyName}`,
        job.jobDescriptionText
            ? `Job Description:\n${job.jobDescriptionText.slice(0, 3000)}`
            : '',
        job.jobPrerequisites
            ? `Key Requirements:\n${job.jobPrerequisites.slice(0, 1500)}`
            : '',
    ]
        .filter(Boolean)
        .join('\n\n');

    // Extract CV text
    const cvText = await getCvTextForInterviewContext(userId, jobId, activeCvId);

    const referenceContext = await getReferenceMaterialsContext(userId, referenceMaterialIds);

    // Build system prompt
    const systemPrompt = buildSystemPrompt(jobContext, cvText, languageName, referenceContext);

    // Create Gemini chat session
    const genAI = new GoogleGenerativeAI(getGeminiApiKey());
    const model = genAI.getGenerativeModel({
        model: GEMINI_FLASH,
        generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.7,
        },
    });

    // Start chat with system context as first user message
    const chatSession = model.startChat({
        history: [
            {
                role: 'user',
                parts: [{ text: systemPrompt }],
            },
            {
                role: 'model',
                parts: [
                    {
                        text: `Understood. I'm ready to help you answer interview questions for the ${job.jobTitle} position at ${job.companyName}. I'll keep my answers concise and reference your CV when relevant. Go ahead with the first question.`,
                    },
                ],
            },
        ],
    });

    // Store session
    const key = sessionKey(userId, jobId, activeCvId);
    chatSessions.set(key, { chatSession, createdAt: Date.now() });

    return key;
}

// ─────────────────────────────────────────────────────────────
// Streaming answer
// ─────────────────────────────────────────────────────────────

export async function streamAnswerToResponse(
    userId: string,
    jobId: string,
    question: string,
    res: Response,
    _referenceMaterialIds: string[] = [],
    activeCvId?: string,
): Promise<void> {
    const key = sessionKey(userId, jobId, activeCvId);
    const session = chatSessions.get(key);

    if (!session) {
        throw new NotFoundError('Interview session not found. Please initialize a session first.');
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Flush headers
    res.flushHeaders();

    try {
        const stream = await session.chatSession.sendMessageStream(question);
        let chunkCount = 0;

        for await (const chunk of stream.stream) {
            chunkCount++;
            const text = chunk.text();
            console.log(`[streamAnswer] Chunk ${chunkCount}: "${text?.slice(0, 60)}..."`);
            if (text) {
                res.write(`data: ${JSON.stringify({ text })}\n\n`);
            }
        }

        // Signal completion
        console.log(`[streamAnswer] Stream complete. Total chunks: ${chunkCount}`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
    } catch (error: any) {
        console.error('[streamAnswer] Error:', error);
        res.write(
            `data: ${JSON.stringify({ error: error.message || 'Failed to generate answer' })}\n\n`,
        );
        res.end();
        // Remove broken session
        chatSessions.delete(key);
    }
}

// ─────────────────────────────────────────────────────────────
// Legacy functions (kept for backward compatibility)
// ─────────────────────────────────────────────────────────────

interface InterviewQuestionsResponse {
    questions: string[];
}

interface EvaluationResponse {
    score: number;
    strengths: string[];
    improvements: string[];
    modelAnswer: string;
}

/**
 * Generate interview questions tailored to the job description.
 */
export async function generateQuestions(
    userId: string,
    jobId: string,
    level: 'first' | 'second' = 'first',
    questionCount: number = 5,
): Promise<string[]> {
    const job = await getOwnedJob(jobId, userId);

    const languageName = getLanguageName(job.language);
    const jobContext = [
        `Job Title: ${job.jobTitle}`,
        `Company: ${job.companyName}`,
        job.jobDescriptionText
            ? `Job Description:\n${job.jobDescriptionText.slice(0, 4000)}`
            : '',
        job.jobPrerequisites
            ? `Key Requirements:\n${job.jobPrerequisites.slice(0, 1500)}`
            : '',
    ]
        .filter(Boolean)
        .join('\n\n');

    let prompt: string;

    if (level === 'first') {
        prompt = `You are an experienced HR interviewer conducting a FIRST-ROUND interview with me.
Conduct a first-round interview focused on general fit, motivation and soft skills.

${jobContext}

Generate exactly ${questionCount} tailored questions covering:
- Self-introduction / background (1 question)
- Motivation & company fit — "Why this role / company?" (2 questions)
- Behavioural — "Tell me about a time when…" using the STAR method (2 questions)
- Teamwork, communication, and working style

Rules:
1. All questions MUST be written entirely in ${languageName} — no other language.
2. Questions should be relevant to the specific role and company described above.
3. Questions should be open-ended and encourage detailed answers.
4. Do NOT include any numbering, prefixes, or labels — just the question text.

Respond with a JSON object matching this exact schema:
{
  "questions": ["question 1", "question 2", "question 3", "question 4", "question 5"]
}`;
    } else {
        prompt = `You are a senior technical interviewer conducting a SECOND-ROUND deep-dive interview with me.
Conduct a second-round interview focused on technical depth and problem-solving ability.

${jobContext}

Generate exactly ${questionCount} technically rigorous questions covering:
- Core technical / domain knowledge specific to the role requirements (2 questions)
- System design, architecture or process thinking relevant to the role (1 question)
- Past technical project deep-dive — specific accomplishments from my CV (1 question)
- Problem-solving scenario — a realistic challenge they would face on the job (1 question)

Rules:
1. All questions MUST be written entirely in ${languageName} — no other language.
2. Questions should be relevant to the specific role and company described above.
3. Questions should be open-ended and encourage detailed answers.
4. Do NOT include any numbering, prefixes, or labels — just the question text.

Respond with a JSON object matching this exact schema:
{
  "questions": ["question 1", "question 2", "question 3", "question 4", "question 5"]
}`;
    }

    const result = await generateStructuredResponse<InterviewQuestionsResponse>(userId, prompt);
    if (!Array.isArray(result?.questions) || result.questions.length === 0) {
        throw new Error('AI returned an invalid questions list');
    }
    return result.questions;
}

/**
 * Evaluate a candidate's answer to an interview question.
 */
export async function evaluateAnswer(
    userId: string,
    jobId: string,
    question: string,
    answer: string,
): Promise<EvaluationResponse> {
    const job = await getOwnedJob(jobId, userId);

    const languageName = getLanguageName(job.language);
    const jobContext = [
        `Job Title: ${job.jobTitle}`,
        `Company: ${job.companyName}`,
        job.jobDescriptionText
            ? `Job Description (excerpt):\n${job.jobDescriptionText.slice(0, 2000)}`
            : '',
    ]
        .filter(Boolean)
        .join('\n\n');

    const prompt = `You are an expert interviewer evaluating a candidate's response during a mock interview.

Context:
${jobContext}

Interview Question:
"${question}"

Candidate's Answer:
"${answer}"

Evaluate the answer and respond ENTIRELY in ${languageName} — no other language.

Score the answer from 0 to 10 where:
- 0-3: Poor — missing key points, very vague, or off-topic
- 4-6: Acceptable — covers the basics but lacks depth or concrete examples
- 7-8: Good — solid answer with relevant examples
- 9-10: Excellent — comprehensive, specific, and tailored to the role

Respond with a JSON object matching this exact schema:
{
  "score": <integer 0-10>,
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "modelAnswer": "<a concise ideal answer in 3-5 sentences>"
}

All text values (strengths, improvements, modelAnswer) must be in ${languageName}.`;

    const result = await generateStructuredResponse<EvaluationResponse>(userId, prompt);
    if (typeof result?.score !== 'number') {
        throw new Error('AI returned an invalid evaluation response');
    }
    return result;
}

interface AnswerResponse {
    opener: string;
    keyPoints: string[];
    closing: string;
}

/**
 * Generate a concise, ready-to-speak answer for an interview question.
 * (Legacy — the streaming version is preferred for the live Interview Buddy.)
 */
export async function generateAnswer(
    userId: string,
    jobId: string,
    question: string,
    referenceMaterialIds: string[] = [],
    activeCvId?: string,
): Promise<AnswerResponse> {
    const job = await getOwnedJob(jobId, userId);

    const languageName = getLanguageName(job.language);
    const jobContext = [
        `Job Title: ${job.jobTitle}`,
        `Company: ${job.companyName}`,
        job.jobDescriptionText
            ? `Job Description (excerpt):\n${job.jobDescriptionText.slice(0, 3000)}`
            : '',
        job.jobPrerequisites
            ? `Key Requirements:\n${job.jobPrerequisites.slice(0, 1500)}`
            : '',
    ]
        .filter(Boolean)
        .join('\n\n');

    const referenceContext = await getReferenceMaterialsContext(userId, referenceMaterialIds);
    const cvText = await getCvTextForInterviewContext(userId, jobId, activeCvId);

    const prompt = `You are an expert interview coach helping a candidate answer a live interview question.
The candidate will READ your answer aloud to the interviewer, so it must sound natural and confident.

Job Context:
${jobContext}

${referenceContext ? `Reference Documents from Prep Library:\n${referenceContext}\n` : ''}

${cvText ? `Active CV Context:\n${cvText.slice(0, 3000)}\n` : ''}

Interview Question:
"${question}"

Generate a structured answer in ${languageName} that the candidate can read naturally and confidently.

Rules:
1. The "opener" should be one sentence that directly addresses the question — conversational, not robotic.
2. "keyPoints" should be 2–3 short bullet points using a STAR-style approach (Situation/Task, Action, Result). Keep each point to 1–2 sentences max. No bullet characters — just the text.
3. The "closing" should be one sentence that ties back to the role/company or expresses enthusiasm.
4. ALL text must be in ${languageName} — no other language.
5. Keep the total answer concise — it should take about 60–90 seconds to say aloud.

Respond with a JSON object matching this exact schema:
{
  "opener": "<one opening sentence>",
  "keyPoints": ["<point 1>", "<point 2>", "<point 3 optional>"],
  "closing": "<one closing sentence>"
}`;

    const result = await generateStructuredResponse<AnswerResponse>(userId, prompt);
    if (!result?.opener || !Array.isArray(result?.keyPoints)) {
        throw new Error('AI returned an invalid answer response');
    }
    return result;
}
