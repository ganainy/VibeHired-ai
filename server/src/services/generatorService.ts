import { generateStructuredResponse, generateContent } from '../utils/aiService';

/**
 * Improves a CV section using AI
 * @param userId - The user ID to get the API key for
 * @param sectionName - The name of the section (e.g., "work", "education", "skills")
 * @param sectionData - The original section data from the frontend
 * @returns The improved section data in the same JSON structure
 */
export const improveSectionWithAi = async (
    userId: string,
    sectionName: string,
    sectionData: any,
    customInstructions?: string
): Promise<any> => {
    console.log(`Improving CV section: ${sectionName}`);

    const improvementPrompt = `
You are a professional CV writing expert. Your task is to improve a specific section of a CV.

Section Name: ${sectionName}
Original Section Data:
${JSON.stringify(sectionData, null, 2)}

${customInstructions ? `
IMPORTANT - USER CUSTOM INSTRUCTIONS:
The user has provided specific instructions for this improvement. You MUST prioritize these instructions above general guidelines:
"${customInstructions}"
` : ''}

Instructions:
1. Analyze the provided section data
2. Rewrite and improve the content while maintaining the exact same JSON structure
3. Focus on:
   - Using strong action verbs (e.g., "Engineered", "Led", "Optimized", "Developed")
   - Adding quantifiable achievements and metrics where possible
   - Improving clarity and impact
   - Ensuring ATS-friendliness
   - Maintaining professional tone
4. Keep all the same fields and structure - only improve the content within those fields
5. Do not add new fields or remove existing fields
6. Preserve dates, names, and factual information - only improve descriptions, summaries, and highlights

Return ONLY a JSON object with the exact same structure as the input sectionData, but with improved content.
The output should be ready to use as a direct replacement for the original section data.

Example:
If input is:
{
  "company": "Example Inc.",
  "position": "Software Developer",
  "summary": "Worked on projects",
  "highlights": ["Did some coding", "Fixed bugs"]
}

Output should be:
{
  "company": "Example Inc.",
  "position": "Software Developer",
  "summary": "Developed and maintained web applications, leading to improved user engagement and system performance.",
  "highlights": [
    "Engineered scalable web applications using modern frameworks, reducing load times by 30%",
    "Resolved critical production bugs, improving system stability and reducing downtime by 25%"
  ]
}
`;

    try {
        const improvedData = await generateStructuredResponse<any>(userId, improvementPrompt);

        if (!improvedData || typeof improvedData !== 'object') {
            throw new Error('AI response did not return valid section data');
        }

        // Validate that the structure matches (at least has the same top-level keys)
        const originalKeys = Object.keys(sectionData || {});
        const improvedKeys = Object.keys(improvedData || {});

        // Check if at least some keys match (allowing for some flexibility)
        const matchingKeys = originalKeys.filter(key => improvedKeys.includes(key));
        if (matchingKeys.length === 0 && originalKeys.length > 0) {
            console.warn(`Warning: Improved section structure may differ from original. Original keys: ${originalKeys.join(', ')}, Improved keys: ${improvedKeys.join(', ')}`);
        }

        return improvedData;
    } catch (error: any) {
        console.error(`Error improving section ${sectionName}:`, error);
        throw new Error(`Failed to improve CV section: ${error.message}`);
    }
};

/**
 * Generate customized resume HTML for a specific job
 * Used by auto-job workflow
 */
export const generateCustomizedResume = async (
    baseResumeText: string,
    structuredResume: any,
    jobDescription: string,
    userId: string
): Promise<string> => {
    const prompt = `You are a resume writing assistant creating a tailored resume.

Base Resume:
${baseResumeText}

Structured Resume Data:
${JSON.stringify(structuredResume, null, 2)}

Job Description:
${jobDescription}

Create a customized resume that:
1. Highlights relevant skills and experiences for this specific job
2. Uses keywords from the job description naturally
3. Maintains truthfulness - don't add fake experience
4. Formats in clean, professional HTML (suitable for PDF conversion)
5. Includes proper sections: Summary, Experience, Education, Skills

Return ONLY the HTML content (without <html>, <head>, or <body> tags - just the inner content).`;

    const result = await generateContent(userId, prompt);
    let htmlContent = result.text;

    // Clean up markdown code blocks if present
    if (htmlContent.includes('```html')) {
        htmlContent = htmlContent.replace(/^```html\s*/, '').replace(/\s*```$/, '');
    } else if (htmlContent.includes('```')) {
        htmlContent = htmlContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    return htmlContent.trim();
};

/**
 * Generate cover letter with skill match scoring
 * Used by auto-job workflow
 */
export const generateCoverLetterWithSkillMatch = async (
    structuredResume: any,
    companyInsights: any,
    jobDetails: {
        jobTitle: string;
        companyName: string;
        jobDescription: string;
        extractedData?: any;
    },
    userId: string
): Promise<{ coverLetter: string; skillMatchScore: number; skillMatchReason: string }> => {

    const prompt = `You are a cover letter writing assistant.

Candidate Resume:
${JSON.stringify(structuredResume, null, 2)}

Company Information:
${JSON.stringify(companyInsights, null, 2)}

Job Details:
- Title: ${jobDetails.jobTitle}
- Company: ${jobDetails.companyName}
- Description: ${jobDetails.jobDescription}

Tasks:
1. Write a compelling, humanized cover letter that:
   - Shows genuine interest in the company (use their mission/values)
   - Highlights relevant experience (DO NOT LIE: Use ONLY info from resume. If a skill is missing, mention basics or willingness to learn.)
   - Demonstrates cultural fit
   - Is personalized, not generic
   - Is 250-350 words
   - NO HEADER: Skip name, address, contact info and date. Start with the salutation.
   - NO MARKDOWN: Output only plain text (no ** for bold, etc).
   
2. Calculate a skill match score (1-5 scale):
   - 5: Exceptional match, candidate exceeds requirements
   - 4: Strong match, meets all key requirements
   - 3: Good match, meets most requirements
   - 2: Partial match, meets some requirements
   - 1: Weak match, limited alignment

3. Provide a brief reason for the score (1-2 sentences).
   - Use plain text (no markdown).

Return a JSON object:
{
  "coverLetter": "Dear Hiring Manager,\n\n...",
  "skillMatchScore": 4,
  "skillMatchReason": "Candidate has strong React experience but lacks Python knowledge."
}`;

    const result = await generateContent(userId, prompt);
    const responseText = result.text;

    // Clean up response
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
        const parsed = JSON.parse(jsonText);
        return {
            coverLetter: parsed.coverLetter || '',
            skillMatchScore: Math.min(Math.max(parsed.skillMatchScore || 3, 1), 5), // Ensure 1-5 range
            skillMatchReason: parsed.skillMatchReason || 'No reason provided'
        };
    } catch (error) {
        console.error('Error parsing cover letter response:', error);
        return {
            coverLetter: responseText, // Fallback to raw text if JSON parse fails
            skillMatchScore: 3,
            skillMatchReason: 'Error parsing AI response'
        };
    }
};

/**
 * Provider-aware cover letter generation with skill match scoring
 * Uses the specified provider with automatic fallback to Gemini
 */
export const generateCoverLetterWithProvider = async (
    structuredResume: any,
    companyInsights: any,
    jobDetails: {
        jobTitle: string;
        companyName: string;
        jobDescription: string;
        extractedData?: any;
    },
    profile: any,
    provider: string | undefined,
    modelName: string
): Promise<{ coverLetter: string; skillMatchScore: number; skillMatchReason: string }> => {
    const { createAdapter, executeWithFallback, getGeminiApiKey } = require('./providerService');

    // Create adapter with fallback
    const adapter = createAdapter(profile, provider, modelName, 0.8); // Higher temperature for creativity
    const geminiApiKey = getGeminiApiKey(profile);

    console.log(`  Using ${adapter.getProvider()}/${adapter.getModelName()} for cover letter generation`);

    // Define primary operation
    const primaryOperation = async () => {
        return generateCoverLetterWithSkillMatch(
            structuredResume,
            companyInsights,
            jobDetails,
            geminiApiKey
        );
    };

    // Define fallback operation
    const fallbackOperation = async () => {
        console.log('  Falling back to Gemini for cover letter generation');
        return generateCoverLetterWithSkillMatch(
            structuredResume,
            companyInsights,
            jobDetails,
            geminiApiKey
        );
    };

    // Execute with fallback
    return executeWithFallback(primaryOperation, fallbackOperation);
};
