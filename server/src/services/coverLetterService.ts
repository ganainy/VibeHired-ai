// server/src/services/coverLetterService.ts
import { JsonResumeSchema } from '../types/jsonresume';
import { generateContent } from '../utils/aiService';

/**
 * Structured cover letter response from AI
 */
export interface CoverLetterResponse {
    coverLetterText: string;      // The formal cover letter text
    fileName: string;             // Suggested filename for downloads
    emailSubject: string;         // Email subject line
    emailBody: string;            // Email body with attachment note
    emailRecipient?: string;      // Optional recipient email/address
}

/**
 * Generates a cover letter using AI based on CV data and job description
 * @param userId The user ID to get the API key for
 * @param cvJson The user's CV in JSON Resume format
 * @param jobDescription The job description text
 * @param jobTitle The job title
 * @param companyName The company name
 * @param language The language for the cover letter ('en' or 'de')
 * @param customPrompt Optional custom prompt template
 * @returns Structured object containing cover letter data and email information
 */
export async function generateCoverLetter(
    userId: string,
    cvJson: JsonResumeSchema,
    jobDescription: string,
    jobTitle: string,
    companyName: string,
    language: 'en' | 'de' = 'en',
    customPrompt?: string
): Promise<CoverLetterResponse> {
    const languageName = language === 'de' ? 'German' : 'English';
    const suggestedDocLabel = (language === 'de') ? 'Anschreiben' : 'Cover_Letter';

    // Extract user's first and last name from CV
    const nameParts = (cvJson.basics?.name || 'Applicant').trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join('_') : '';

    const prompt = `Act as a professional career consultant and generate a cover letter application package.

TASK: Create a complete application package in ${languageName} based on the CV and job description below.

REQUIREMENTS FOR COVER LETTER:
- Keep it concise (max. 250 words)
- Make it sound natural and professional, not generic
- Focus only on relevant skills from the CV
- DO NOT LIE: Only state experience clearly present in the CV
- If a job requires something not in the CV, use phrases like "I am motivated to quickly familiarize myself with..." or "I am eager to deepen my knowledge in..."
- Do not exaggerate experience
- No emojis, no bullet points, no Markdown formatting
- NO header with contact info/date - start with the salutation
- DO NOT INCLUDE THE FILENAME ANYWHERE IN THE TEXT (e.g. at the bottom)
- Do not repeat the job description

OUTPUT FORMAT - Return ONLY a valid JSON object with this exact structure:
{
    "coverLetterText": "The formal cover letter text (starting with salutation, ending with signature placeholder). EXCLUDE any mention of the filename from this field.",
    "fileName": "FirstName_LastName_${suggestedDocLabel}_Position_Company.pdf",
    "emailSubject": "Application for [Position] – [Company Name]",
    "emailBody": "Email body text with a note about attached CV and certificates",
    "emailRecipient": "Specific name or email only if explicitly stated in the job posting — otherwise null"
}

IMPORTANT: For emailRecipient, return null if no real recipient name or email is provided in the job posting. Do NOT use generic placeholders like "Hiring Manager", "HR Team", or "Sehr geehrte Damen und Herren".

EMAIL BODY REQUIREMENTS:
- Start with a brief introduction mentioning the position
- Include a note about attached documents (CV and certificates)
${language === 'de' 
    ? '- End with "Mit freundlichen Grüßen" followed by placeholder for name'
    : '- End with "Best regards" followed by placeholder for name'}

EXAMPLE EMAIL BODY (${language === 'de' ? 'German' : 'English'}):
${language === 'de' 
    ? '"Sehr geehrte Damen und Herren,\n\nmit großem Interesse bewerbe ich mich um die Position als [Position] bei [Unternehmen].\n\nIm Anhang finden Sie meinen Lebenslauf sowie meine Zeugnisse und Zertifikate.\n\nMit freundlichen Grüßen\n[Ihr Name]"'
    : '"Dear Hiring Manager,\n\nI am writing to express my interest in the [Position] role at [Company].\n\nPlease find attached my CV along with my certificates.\n\nBest regards,\n[Your Name]"'}

USER'S CV:
\`\`\`json
${JSON.stringify(cvJson, null, 2)}
\`\`\`

JOB DESCRIPTION:
---
${jobDescription}
---

JOB TITLE: ${jobTitle}
COMPANY: ${companyName}

Return ONLY the JSON object, no additional text or markdown.`;

    try {
        console.log(`Generating ${languageName} cover letter for ${jobTitle} at ${companyName}...`);

        const result = await generateContent(userId, prompt);
        const responseText = result.text.trim();
        console.log('Raw AI cover letter response:', responseText);

        // Parse JSON response
        let coverLetterData: CoverLetterResponse;

        // Try to extract JSON from the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                coverLetterData = JSON.parse(jsonMatch[0]);
            } catch (parseError) {
                console.error('Failed to parse AI JSON response, using fallback parsing');
                coverLetterData = parseFallbackResponse(responseText, firstName, lastName, jobTitle, companyName, language);
            }
        } else {
            console.error('No JSON found in AI response, using fallback parsing');
            coverLetterData = parseFallbackResponse(responseText, firstName, lastName, jobTitle, companyName, language);
        }

        // Validate required fields
        if (!coverLetterData.coverLetterText || coverLetterData.coverLetterText.length < 100) {
            throw new Error('Generated cover letter text is too short or empty');
        }

        // Ensure fileName has proper format
        if (!coverLetterData.fileName || !coverLetterData.fileName.endsWith('.pdf')) {
            coverLetterData.fileName = `${firstName}_${lastName}_${suggestedDocLabel}_${sanitizeForFilename(jobTitle)}_${sanitizeForFilename(companyName)}.pdf`;
        }

        // Ensure emailSubject exists
        if (!coverLetterData.emailSubject) {
            coverLetterData.emailSubject = language === 'de' 
                ? `Bewerbung als ${jobTitle} – ${companyName}`
                : `Application for ${jobTitle} position – ${companyName}`;
        }

        // Ensure emailBody exists
        if (!coverLetterData.emailBody) {
            coverLetterData.emailBody = generateDefaultEmailBody(coverLetterData.coverLetterText, language);
        }

        console.log(`Cover letter generated successfully (${coverLetterData.coverLetterText.length} characters)`);
        return coverLetterData;

    } catch (error: any) {
        console.error('Error generating cover letter:', error);
        throw error;
    }
}

/**
 * Fallback parser for non-JSON AI responses
 */
function parseFallbackResponse(
    responseText: string,
    firstName: string,
    lastName: string,
    jobTitle: string,
    companyName: string,
    language: 'en' | 'de'
): CoverLetterResponse {
    const suggestedDocLabel = language === 'de' ? 'Anschreiben' : 'Cover_Letter';
    
    // Try to extract cover letter text
    let coverLetterText = responseText;
    const clMatch = responseText.match(/1\)\s*([\s\S]*?)(?=2\)|$)/i);
    if (clMatch && clMatch[1]) {
        coverLetterText = clMatch[1].trim();
    }

    return {
        coverLetterText,
        fileName: `${firstName}${lastName ? '_' + lastName : ''}_${suggestedDocLabel}_${sanitizeForFilename(jobTitle)}_${sanitizeForFilename(companyName)}.pdf`,
        emailSubject: language === 'de' 
            ? `Bewerbung als ${jobTitle} – ${companyName}`
            : `Application for ${jobTitle} position – ${companyName}`,
        emailBody: generateDefaultEmailBody(coverLetterText, language),
        emailRecipient: undefined
    };
}

/**
 * Generate default email body from cover letter text
 */
function generateDefaultEmailBody(coverLetterText: string, language: 'en' | 'de'): string {
    const attachmentNote = language === 'de'
        ? '\n\nIm Anhang finden Sie meinen Lebenslauf sowie meine Zeugnisse und Zertifikate.\n\nMit freundlichen Grüßen'
        : '\n\nPlease find attached my CV along with my certificates.\n\nBest regards';

    // Try to find closing and insert attachment note before it
    const closingPatterns = language === 'de'
        ? ['Mit freundlichen Grüßen', 'Freundliche Grüße', 'Beste Grüße', 'Hochachtungsvoll']
        : ['Best regards', 'Sincerely', 'Yours sincerely', 'Kind regards', 'Yours faithfully'];

    let bodyText = coverLetterText;
    
    for (const pattern of closingPatterns) {
        const idx = bodyText.toLowerCase().indexOf(pattern.toLowerCase());
        if (idx !== -1) {
            const beforeClosing = bodyText.substring(0, idx).trim();
            const closingAndAfter = bodyText.substring(idx);
            const attachmentText = language === 'de'
                ? '\n\nIm Anhang finden Sie meinen Lebenslauf sowie meine Zeugnisse und Zertifikate.\n\n'
                : '\n\nPlease find attached my CV along with my certificates.\n\n';
            return beforeClosing + attachmentText + closingAndAfter;
        }
    }

    // No closing found, append attachment note
    return coverLetterText.trim() + attachmentNote;
}

/**
 * Sanitize string for use in filename
 */
function sanitizeForFilename(str: string): string {
    return str
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        || 'Unknown';
}
