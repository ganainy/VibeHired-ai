import { generateStructuredResponse } from '../utils/aiService';
import JobApplication from '../models/JobApplication';
import { NotFoundError, AuthorizationError } from '../utils/errors/AppError';

const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English',
    de: 'German',
};

function getLanguageName(lang?: string): string {
    return LANGUAGE_NAMES[lang ?? 'en'] ?? 'English';
}

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
 * Fetch a job application, verify ownership, and return it.
 */
async function getOwnedJob(jobId: string, userId: string) {
    const job = await JobApplication.findById(jobId);
    if (!job) throw new NotFoundError('Job application not found');
    if (job.userId.toString() !== userId.toString()) {
        throw new AuthorizationError('You do not have access to this job application');
    }
    return job;
}

/**
 * Generate interview questions tailored to the job description.
 * Questions are produced in the same language as the job posting.
 * Supports different interview levels: 'first' (general/behavioral) or 'second' (technical).
 */
export async function generateQuestions(
    userId: string,
    jobId: string,
    level: 'first' | 'second' = 'first',
    questionCount: number = 5
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
 * Feedback is provided in the same language as the job posting.
 */
export async function evaluateAnswer(
    userId: string,
    jobId: string,
    question: string,
    answer: string
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
 * The answer is structured (opener + key points + closing) so the candidate
 * can read it naturally during a live interview.
 */
export async function generateAnswer(
    userId: string,
    jobId: string,
    question: string
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

    const prompt = `You are an expert interview coach helping a candidate answer a live interview question.
The candidate will READ your answer aloud to the interviewer, so it must sound natural and confident.

Job Context:
${jobContext}

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
