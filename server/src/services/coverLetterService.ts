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
    cvJson: JsonResumeSchema | null,
    jobDescription: string,
    jobTitle: string,
    companyName: string,
    language: 'en' | 'de' = 'en',
    customPrompt?: string,
    rawCvText?: string,
    humanize: boolean = true
): Promise<CoverLetterResponse> {
    const languageName = language === 'de' ? 'German' : 'English';
    const suggestedDocLabel = (language === 'de') ? 'Anschreiben' : 'Cover_Letter';

    // Extract user's first and last name from CV (fall back to generic if raw text only)
    const nameParts = (cvJson?.basics?.name || 'Applicant').trim().split(/\s+/);
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
- Use clear paragraph structure with line breaks:
    1) salutation on its own line
    2) a short intro paragraph
    3) one or two body paragraphs
    4) closing phrase and name/signature on separate lines
- Preserve paragraph breaks using newline characters (\\n) and blank lines between paragraphs (\\n\\n)

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
- Write a genuinely persuasive outreach email, not just an attachment notice
- 4-7 short sentences total (plus greeting/closing), concise but substantive
- Mention the position and company naturally in the first sentence
- Include 2-3 role-relevant strengths from the CV that match this specific job
- Add one motivation sentence about why this company/role is a good fit
- End with a polite call-to-action (e.g., invitation for interview / next steps)
- Include a short note that CV and certificates are attached
${language === 'de' 
    ? '- End with "Mit freundlichen Grüßen" followed by placeholder for name'
    : '- End with "Best regards" followed by placeholder for name'}

EXAMPLE EMAIL BODY (${language === 'de' ? 'German' : 'English'}):
${language === 'de' 
    ? '"Sehr geehrte Damen und Herren,\n\nmit großem Interesse bewerbe ich mich um die Position als [Position] bei [Unternehmen].\n\nIm Anhang finden Sie meinen Lebenslauf sowie meine Zeugnisse und Zertifikate.\n\nMit freundlichen Grüßen\n[Ihr Name]"'
    : '"Dear Hiring Manager,\n\nI am writing to express my interest in the [Position] role at [Company].\n\nPlease find attached my CV along with my certificates.\n\nBest regards,\n[Your Name]"'}

USER'S CV:
${rawCvText
    ? `\`\`\`\n${rawCvText}\n\`\`\``
    : `\`\`\`json\n${JSON.stringify(cvJson, null, 2)}\n\`\`\``}

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

        // Normalize paragraph structure so the editor/PDF don't show one giant block.
        coverLetterData.coverLetterText = normalizeCoverLetterFormatting(coverLetterData.coverLetterText, language);

        // Second pass: rewrite the drafted letter to sound more human while preserving facts.
        if (humanize) {
            coverLetterData.coverLetterText = await humanizeCoverLetterText(
                userId,
                coverLetterData.coverLetterText,
                jobDescription,
                jobTitle,
                companyName,
                language,
                cvJson,
                rawCvText
            );
        }

        // Always sanitize the filename to ensure it contains only safe characters
        if (!coverLetterData.fileName) {
            coverLetterData.fileName = `${firstName}_${lastName}_${suggestedDocLabel}_${sanitizeForFilename(jobTitle)}_${sanitizeForFilename(companyName)}.pdf`;
        } else {
            // Remove .pdf extension if present, sanitize, then add it back
            const nameWithoutExt = coverLetterData.fileName.replace(/\.pdf$/i, '');
            const sanitized = sanitizeForFilename(nameWithoutExt);
            coverLetterData.fileName = `${sanitized}.pdf`;
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

    coverLetterText = normalizeCoverLetterFormatting(coverLetterText, language);

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
    const compactCoverLetter = String(coverLetterText || '')
        .replace(/\r\n/g, '\n')
        .replace(/\n{2,}/g, '\n')
        .trim();

    const sentences = compactCoverLetter
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(Boolean);

    const summarySentences = sentences.slice(0, 3).join(' ');

    if (language === 'de') {
        const opening = 'Sehr geehrte Damen und Herren,';
        const body = summarySentences || 'mit großem Interesse bewerbe ich mich auf die ausgeschriebene Position und bringe relevante praktische Erfahrung mit.';
        const attachmentLine = 'Im Anhang finden Sie meinen Lebenslauf sowie meine Zeugnisse und Zertifikate.';
        const cta = 'Ich freue mich über die Gelegenheit, Sie in einem persönlichen Gespräch von meiner Eignung zu überzeugen.';
        const closing = 'Mit freundlichen Grüßen';
        return `${opening}\n\n${body}\n\n${attachmentLine}\n${cta}\n\n${closing}`;
    }

    const opening = 'Dear Hiring Team,';
    const body = summarySentences || 'I am excited to apply for this role and bring relevant hands-on experience that aligns with your requirements.';
    const attachmentLine = 'Please find attached my CV along with my certificates.';
    const cta = 'I would welcome the opportunity to discuss how I can contribute to your team.';
    const closing = 'Best regards';
    return `${opening}\n\n${body}\n\n${attachmentLine}\n${cta}\n\n${closing}`;

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

function normalizeCoverLetterFormatting(text: string, language: 'en' | 'de'): string {
    let normalized = String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    const salutationRegex = language === 'de'
        ? /^(Sehr geehrte[^\n]*|Guten Tag[^\n]*),?/i
        : /^(Dear[^\n]*),?/i;

    const closingRegex = language === 'de'
        ? /(Mit freundlichen Grüßen|Freundliche Grüße|Beste Grüße|Hochachtungsvoll)/i
        : /(Best regards|Kind regards|Sincerely|Yours sincerely|Yours faithfully)/i;

    // Ensure salutation is followed by a blank line.
    const salutationMatch = normalized.match(salutationRegex);
    if (salutationMatch) {
        const salutation = salutationMatch[0].trim();
        const rest = normalized.slice(salutation.length).trim();
        normalized = `${salutation}\n\n${rest}`;
    }

    // Ensure closing starts on a new paragraph.
    normalized = normalized.replace(closingRegex, '\n\n$1');
    normalized = normalized.replace(/\n{3,}/g, '\n\n').trim();

    // If still one block (or mostly one line), create paragraph breaks every ~2 sentences.
    const lineCount = normalized.split('\n').filter(line => line.trim().length > 0).length;
    if (lineCount <= 2) {
        const sentences = normalized
            .split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ])/)
            .map(s => s.trim())
            .filter(Boolean);

        if (sentences.length >= 4) {
            const paragraphs: string[] = [];
            for (let index = 0; index < sentences.length; index += 2) {
                paragraphs.push(sentences.slice(index, index + 2).join(' ').trim());
            }
            normalized = paragraphs.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
        }
    }

    return normalized;
}

async function humanizeCoverLetterText(
    userId: string,
    draftedCoverLetter: string,
    jobDescription: string,
    jobTitle: string,
    companyName: string,
    language: 'en' | 'de',
    cvJson?: JsonResumeSchema | null,
    rawCvText?: string
): Promise<string> {
    const languageName = language === 'de' ? 'German' : 'English';

    const prompt = `You are a professional writing editor. Rewrite the cover letter so it reads naturally human, specific, and sincere.

STRICT RULES:
- Keep the same core facts and claims. Do not invent achievements, years, tools, or responsibilities.
- Keep language in ${languageName}.
- Keep the same target role and company.
- Keep professional tone, but avoid robotic phrasing.
- Remove common AI patterns: inflated significance language, vague attributions, formulaic list-like rhythm, excessive hedging, and repetitive transition words.
- Prefer concrete phrasing over abstract buzzwords.
- Vary sentence rhythm naturally.
- Keep plain text only. No markdown, no bullet points, no emojis.
- Start with salutation and keep paragraph breaks.
- Stay concise (max 250 words).

CONTEXT FOR FACT CHECKING:
JOB TITLE: ${jobTitle}
COMPANY: ${companyName}

JOB DESCRIPTION:
---
${jobDescription}
---

CV SOURCE:
${rawCvText
        ? `\n\
\
${rawCvText}`
        : JSON.stringify(cvJson ?? {}, null, 2)}

DRAFT COVER LETTER TO REWRITE:
---
${draftedCoverLetter}
---

Return ONLY the rewritten cover letter text.`;

    try {
        const result = await generateContent(userId, prompt);
        const rewritten = String(result?.text || '')
            .trim()
            .replace(/^```[a-zA-Z]*\s*/g, '')
            .replace(/\s*```$/g, '')
            .trim();

        if (!rewritten || rewritten.length < 100) {
            return draftedCoverLetter;
        }

        return normalizeCoverLetterFormatting(rewritten, language);
    } catch (error) {
        console.warn('Humanization pass failed. Returning drafted cover letter.', error);
        return draftedCoverLetter;
    }
}
