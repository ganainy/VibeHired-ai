// Chat service for AI-powered job description Q&A
import JobApplication, { IJobApplication } from '../models/JobApplication';
import CV from '../models/CV';
import { Types } from 'mongoose';
import { NotFoundError, ValidationError } from '../utils/errors/AppError';
import { generateContent } from '../utils/aiService';

const MAX_CV_CONTEXT_CHARS = 20000;

function serializeContext(value: unknown, maxChars = MAX_CV_CONTEXT_CHARS): string {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    if (!serialized) return '';
    if (serialized.length <= maxChars) return serialized;
    return `${serialized.slice(0, maxChars)}\n...[truncated for context length]`;
}

async function resolveCvContext(
    jobApplication: IJobApplication,
    userObjectId: Types.ObjectId
): Promise<{ source: string; content: string } | null> {
    const jobSpecificCv = await CV.findOne({
        userId: userObjectId,
        jobApplicationId: jobApplication._id,
    }).lean();

    if (jobSpecificCv?.cvJson) {
        return {
            source: `job-specific CV (${jobSpecificCv.displayName || 'unnamed'})`,
            content: serializeContext(jobSpecificCv.cvJson),
        };
    }

    if (jobSpecificCv?.cvData) {
        return {
            source: `job-specific CV data (${jobSpecificCv.displayName || 'unnamed'})`,
            content: serializeContext(jobSpecificCv.cvData),
        };
    }

    if (jobApplication.baseCvId) {
        const baseCv = await CV.findOne({ _id: jobApplication.baseCvId, userId: userObjectId }).lean();
        if (baseCv?.cvJson) {
            return {
                source: `selected base CV (${baseCv.displayName || 'unnamed'})`,
                content: serializeContext(baseCv.cvJson),
            };
        }
        if (baseCv?.cvData) {
            return {
                source: `selected base CV data (${baseCv.displayName || 'unnamed'})`,
                content: serializeContext(baseCv.cvData),
            };
        }
    }

    const primaryCv = await CV.findOne({ userId: userObjectId, isDefault: true, jobApplicationId: null }).lean();
    if (primaryCv?.cvJson) {
        return {
            source: `primary CV (${primaryCv.displayName || 'unnamed'})`,
            content: serializeContext(primaryCv.cvJson),
        };
    }
    if (primaryCv?.cvData) {
        return {
            source: `primary CV data (${primaryCv.displayName || 'unnamed'})`,
            content: serializeContext(primaryCv.cvData),
        };
    }

    return null;
}

/**
 * Get AI chat response for a job application question and save to history
 * @param jobId - The job application ID
 * @param userId - The user ID (for authorization)
 * @param userQuestion - The user's question about the job
 * @returns The AI's response as a string
 */
export async function getAiChatResponse(
    jobId: string,
    userId: string,
    userQuestion: string
): Promise<string> {
    const userObjectId = new Types.ObjectId(userId);

    // Find the job application and ensure the user owns it
    const jobApplication: IJobApplication | null = await JobApplication.findOne({
        _id: new Types.ObjectId(jobId),
        userId: userObjectId
    });

    if (!jobApplication) {
        throw new NotFoundError('Job application not found');
    }

    // Check if job description exists
    if (!jobApplication.jobDescriptionText) {
        throw new ValidationError('Job application does not have a job description. Please scrape the job description first.');
    }

    // Get existing chat history for context
    const chatHistory = jobApplication.chatHistory || [];

    // Build context from recent chat history (last 10 messages for context)
    const recentHistory = chatHistory.slice(-10);
    let historyContext = '';
    if (recentHistory.length > 0) {
        historyContext = '\n\n**Previous Conversation:**\n';
        recentHistory.forEach(msg => {
            historyContext += `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}\n`;
        });
    }

    const cvContext = await resolveCvContext(jobApplication, userObjectId);
    const cvContextBlock = cvContext
        ? `\n\nCandidate CV Context (source: ${cvContext.source}):\n${cvContext.content}`
        : '\n\nCandidate CV Context:\nNot available for this job yet.';

    // Construct the prompt for Gemini
    const prompt = `You are a helpful human assistant for one specific job application. Answer using the provided job details and CV context.

Rules:
1. Act as a human: clearly and naturally.
2. Keep it concise, but complete enough to be useful.
3. NO MARKDOWN: Do NOT use asterisks (** or *), hashtags (#), or other markdown syntax. Use plain text only.
4. Prioritize facts from the provided context. Do not invent CV experience or job requirements.
5. If asked about the CV, answer from Candidate CV Context. If CV context is missing, say that clearly.
6. If asked about job requirements, answer from Job Description.
7. If both are relevant (e.g., fit/gap questions), compare CV and job requirements explicitly.

Job Title: ${jobApplication.jobTitle}
Company: ${jobApplication.companyName}

**Job Description:**
${jobApplication.jobDescriptionText}${cvContextBlock}${historyContext}

**User Question:**
${userQuestion}

Please answer based on the provided context above.`;

    try {
        // Generate response using provider-agnostic AI service
        const result = await generateContent(userId, prompt);
        const responseText = result.text;

        // Save both user question and AI response to chat history
        const updatedHistory = [
            ...chatHistory,
            {
                sender: 'user' as const,
                text: userQuestion,
                timestamp: new Date()
            },
            {
                sender: 'ai' as const,
                text: responseText,
                timestamp: new Date()
            }
        ];

        // Update the job application with new chat history
        await JobApplication.findByIdAndUpdate(
            jobId,
            { chatHistory: updatedHistory },
            { new: true }
        );

        return responseText;
    } catch (error: any) {
        console.error('Error calling AI for chat response:', error);
        throw new Error(`Failed to get AI response: ${error.message || error}`);
    }
}

/**
 * Get chat history for a job application
 * @param jobId - The job application ID
 * @param userId - The user ID (for authorization)
 * @returns Array of chat messages
 */
export async function getChatHistory(
    jobId: string,
    userId: string
): Promise<Array<{ sender: 'user' | 'ai'; text: string; timestamp: Date }>> {
    const jobApplication: IJobApplication | null = await JobApplication.findOne({
        _id: new Types.ObjectId(jobId),
        userId: new Types.ObjectId(userId)
    });

    if (!jobApplication) {
        throw new NotFoundError('Job application not found');
    }

    return jobApplication.chatHistory || [];
}

