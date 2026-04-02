// server/src/utils/aiExtractor.ts
import axios from 'axios';
// Correct the import to use a named import
import { generateContent } from './aiService';
import { GoogleGenerativeAIError } from '@google/generative-ai';
import { cleanHtmlForAi } from './htmlCleaner';
import { NotFoundError } from './errors/AppError';

// Define the expected structure returned by Gemini
export interface ExtractedJobData {
    jobTitle: string | null;
    companyName: string | null;
    jobDescriptionText: string | null;
    language: string | null; // e.g., "en", "de", "es"
    location?: string | null; // Extracted location
    salary?: string | null; // Extracted salary info (null when not explicitly stated in the posting)
    estimatedSalary?: string | null; // AI-estimated salary when not explicitly stated (e.g., "$80k–$110k/year")
    salaryIsEstimate?: boolean; // true if salary is AI-estimated, false if extracted from the posting
    keyDetails?: Array<{ key: string; value: string }> | null; // AI extracted highlights (key-value pairs)
    jobPrerequisites?: string | null; // AI-extracted job requirements and prerequisites
    jobType?: 'full-time' | 'part-time' | 'working-student' | 'internship' | 'contract' | 'freelance' | null; // Employment type
    // Contact information fields
    contactEmail?: string | null; // Recruiter or company contact email
    contactPhone?: string | null; // Recruiter or company contact phone
    hiringManagerName?: string | null; // Hiring manager or recruiter name
    applicationUrl?: string | null; // Direct application URL/portal link
    notes?: string; // Reserved for user, typically null from AI
    jobTags?: string[] | null; // Short field/industry tags
}

// Fetch HTML with retry logic and increased timeout
async function fetchHtml(url: string, retries: number = 3): Promise<string> {
    const maxRetries = retries;
    const timeout = 45000; // Increased to 45 seconds for slow-responding sites
    const baseDelay = 2000; // Base delay of 2 seconds between retries

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Fetching HTML for AI extraction (attempt ${attempt}/${maxRetries}): ${url}`);
        try {
            const response = await axios.get(url, {
                headers: { // Basic headers
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml',
                    'Accept-Language': 'en-US,en',
                },
                timeout: timeout,
                maxRedirects: 5, // Allow up to 5 redirects
            });
            if (response.status !== 200) throw new Error(`Status ${response.status}`);
            if (!response.data || typeof response.data !== 'string' || !response.data.toLowerCase().includes('<html')) {
                throw new Error('Invalid HTML content received.');
            }
            console.log(`Fetched HTML (length: ${response.data.length})`);
            return response.data;
        } catch (error: any) {
            const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
            const isLastAttempt = attempt === maxRetries;

            if (isLastAttempt) {
                console.error(`Error fetching URL ${url} for AI after ${maxRetries} attempts:`, error.message);
                const errorMessage = isTimeout
                    ? `Request timed out after ${timeout}ms. The website may be slow or unresponsive.`
                    : error.message;
                throw new Error(`Could not fetch content from URL for AI processing. ${errorMessage}`);
            }

            // Calculate exponential backoff delay: 2s, 4s, 8s, etc.
            const delay = baseDelay * Math.pow(2, attempt - 1);
            console.warn(`Attempt ${attempt} failed for ${url}: ${error.message}. Retrying in ${delay}ms...`);

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error(`Failed to fetch HTML after ${maxRetries} attempts`);
}

// Parse Gemini's JSON response for extracted data
function parseExtractionResponse(responseText: string): ExtractedJobData {
    // Try to find JSON in code blocks (with or without "json" language specifier)
    const jsonRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
    const jsonMatch = responseText.match(jsonRegex);

    let extractedJsonString = '';

    if (jsonMatch && jsonMatch[1]) {
        extractedJsonString = jsonMatch[1].trim();
    } else {
        // Fallback: Try to find the first '{' and last '}'
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            extractedJsonString = responseText.substring(firstBrace, lastBrace + 1);
        } else {
            // Just try the whole text if it looks somewhat like JSON
            extractedJsonString = responseText.trim();
        }
    }

    const normalizeJobTags = (tags: unknown): string[] | null => {
        if (!Array.isArray(tags)) return null;
        const normalized = tags
            .map(tag => (typeof tag === 'string' ? tag.trim().replace(/\s+/g, ' ') : ''))
            .filter(Boolean)
            .map(tag => tag.length > 32 ? tag.slice(0, 32).trim() : tag);
        const deduped: string[] = [];
        const seen = new Set<string>();
        for (const tag of normalized) {
            const key = tag.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                deduped.push(tag);
            }
        }
        return deduped.length > 0 ? deduped.slice(0, 6) : null;
    };

    try {
        const parsed = JSON.parse(extractedJsonString);
        // Basic validation - check for essential fields (allow null for jobDescriptionText as fallback)
        if (typeof parsed.jobTitle === 'string' &&
            typeof parsed.companyName === 'string' &&
            (typeof parsed.jobDescriptionText === 'string' || parsed.jobDescriptionText === null) &&
            typeof parsed.language === 'string') {
            // If jobDescriptionText is null, provide a fallback
            if (parsed.jobDescriptionText === null) {
                console.warn("AI returned null for jobDescriptionText. Using fallback description.");
                parsed.jobDescriptionText = parsed.notes
                    ? `Job details: ${parsed.notes}`
                    : `Job posting at ${parsed.companyName || 'the company'}. Please refer to the original job posting for full details.`;
            }
            parsed.jobTags = normalizeJobTags(parsed.jobTags);
            return parsed as ExtractedJobData; // Assume structure matches if key fields exist
        } else {
            console.warn("Parsed JSON from AI missing essential fields (jobTitle, companyName, jobDescriptionText, language):", parsed);
            throw new Error("AI response structure validation failed. Missing required fields.");
        }
    } catch (e: any) {
        console.error("JSON.parse failed on extracted content:", e.message);
        console.error("Raw response was:", responseText);
        throw new Error("AI response was not valid JSON.");
    }
}


// Main function using Gemini to extract data from HTML
async function extractFieldsWithGemini(htmlContent: string, url: string, userId: string): Promise<ExtractedJobData> {
    console.log(`Requesting Gemini to extract fields from HTML (length: ${htmlContent.length}) for URL: ${url}`);
    const maxHtmlLength = 100000; // Maximum length after cleaning
    // Clean HTML to remove noise and extract main content before truncation
    htmlContent = cleanHtmlForAi(htmlContent, maxHtmlLength);

    const prompt = `
        Analyze the following HTML content from a job posting webpage.
        Your task is to extract specific details about the job posting.

        Instructions:
        1. Identify the main job title.
        2. Identify the hiring company's name.
        3. Extract the full job description text, focusing on responsibilities, qualifications, requirements, benefits, and any other relevant details. Remove any HTML tags and return clean text.
        4. Determine the primary language of the job posting (e.g., "en" for English, "de" for German, "es" for Spanish). Use standard ISO 639-1 language codes.
        5. Extract the job location (e.g., "remote", "Berlin", "Hybrid").
        6. Salary:
           - If the posting explicitly states a salary or compensation range, extract it into the \`salary\` field and set \`salaryIsEstimate\` to false. Set \`estimatedSalary\` to null.
           - If NO salary is mentioned, set \`salary\` to null, set \`salaryIsEstimate\` to true, and provide a realistic market-rate estimate in \`estimatedSalary\` based on the job title, location, seniority level, required skills/tech stack, company type, and local market data. Express it as a range (e.g., "€60k–€80k/year", "$90k–$120k/year"). Be realistic and specific.
        7. Extract key highlights such as Employment Type, Experience Level, Remote Policy, Benefits, Tech Stack, Location, Salary, and any other important details. Return them as a structured list of key-value pairs in the 'keyDetails' field.
        8. Extract the job prerequisites and requirements as a bullet-pointed list. Include required skills, qualifications, years of experience, education requirements, certifications, languages, and any "must-have" or "nice-to-have" items. IMPORTANT: This list MUST BE IN ENGLISH, even if the job description is in another language. Translate the requirements to English if necessary. Format as a clean bulleted list (using • or - characters). Leave the 'notes' field NULL.
        9. Determine the employment type (jobType). Map common terms to these exact values: "full-time" (for Vollzeit, full-time, 40 hours), "part-time" (for Teilzeit, part-time), "working-student" (for Werkstudent, working student, student assistant), "internship" (for Praktikum, internship), "contract" (for Befristet, contract, temporary), "freelance" (for Freelance, self-employed). Use null if not specified.
        10. Extract contact information if available:
            - contactEmail: Recruiter or company contact email address
            - contactPhone: Recruiter or company contact phone number
            - hiringManagerName: Name of hiring manager, recruiter, or contact person
            - applicationUrl: Direct application URL or portal link (if different from the source URL)
        11. Provide 2-4 concise field/industry tags in jobTags (e.g., "Cybersecurity", "Network Security", "SOC", "Threat Detection"). Use Title Case, avoid duplicates, and keep each tag under 32 characters.

        Output Format:
        Return ONLY a single JSON object enclosed in triple backticks (\`\`\`json ... \`\`\`). This JSON object MUST contain exactly these top-level keys: "jobTitle", "companyName", "jobDescriptionText", "language", "location", "salary", "estimatedSalary", "salaryIsEstimate", "keyDetails", "jobPrerequisites", "jobType", "contactEmail", "contactPhone", "hiringManagerName", "applicationUrl", "jobTags", and "notes".
        - jobTitle, companyName, language, location, salary, estimatedSalary, jobPrerequisites, contactEmail, contactPhone, hiringManagerName, applicationUrl should be strings if found, or null.
        - salaryIsEstimate should be a boolean: true if salary is AI-estimated, false if extracted from the posting.
        - jobType should be one of: "full-time", "part-time", "working-student", "internship", "contract", "freelance", or null.
        - keyDetails should be an array of objects with "key" and "value" strings, or null.
        - jobPrerequisites should be a bulleted list string of requirements and qualifications (ALWAYS IN ENGLISH).
        - jobTags should be an array of 2-4 strings, or null if unclear.
        - jobDescriptionText is REQUIRED.
        - 'notes' should be null.

        Example structure (salary NOT in posting — AI estimates):
        \`\`\`json
        {
          "jobTitle": "Software Engineer",
          "companyName": "Tech Corp",
          "jobDescriptionText": "...",
          "language": "en",
          "location": "Berlin / Hybrid",
          "salary": null,
          "estimatedSalary": "€70k–€95k/year",
          "salaryIsEstimate": true,
          "jobType": "full-time",
          "contactEmail": "recruiting@techcorp.com",
          "contactPhone": "+49 30 12345678",
          "hiringManagerName": "Jane Smith",
          "applicationUrl": "https://techcorp.com/careers/apply/123",
                    "jobTags": ["Cybersecurity", "Threat Detection", "SOC"],
          "keyDetails": [
            { "key": "Contract", "value": "Full-time" },
            { "key": "Location", "value": "Berlin / Hybrid" },
            { "key": "Benefits", "value": "Health, Gym" }
          ],
          "jobPrerequisites": "• 3+ years of experience in software development\\n• Proficiency in Java, JavaScript, or Python\\n• Bachelor's degree in Computer Science or related field\\n• Experience with cloud platforms (AWS, GCP, Azure)\\n• Strong communication skills\\n• Nice to have: Experience with Kubernetes",
          "notes": null
        }
        \`\`\`

        HTML Source Code:
        ---
        ${htmlContent}
        ---
    `;

    try {
        const result = await generateContent(userId, prompt);
        const responseText = result.text;
        console.log("Received field extraction response from AI.");
        return parseExtractionResponse(responseText); // Parse and validate structure

    } catch (error: any) {
        console.error("Error during Gemini field extraction:", error);

        // Preserve NotFoundError (e.g., missing API key) with its detailed message
        if (error instanceof NotFoundError) {
            throw error;
        }

        // Handle Gemini API errors
        if (error instanceof GoogleGenerativeAIError || (error.response && error.response.promptFeedback)) {
            const blockReason = error.response?.promptFeedback?.blockReason;
            throw new Error(`AI content generation blocked during extraction: ${blockReason || 'Unknown reason'}`);
        }

        // For other errors, preserve the original message if available
        if (error?.message) {
            throw new Error(error.message);
        }

        throw new Error("Failed to get valid extraction response from AI service.");
    }
}

// Main exported function for this utility
export async function extractJobDataFromUrl(url: string, userId: string): Promise<ExtractedJobData> {
    if (!url || !url.startsWith('http')) {
        throw new Error("Invalid or missing URL provided.");
    }
    const html = await fetchHtml(url);
    const extractedData = await extractFieldsWithGemini(html, url, userId);

    // Add final check for essential nulls after AI processing
    // Note: jobDescriptionText may have been set to a fallback value in parseExtractionResponse
    if (!extractedData.jobTitle || !extractedData.companyName || !extractedData.jobDescriptionText || !extractedData.language) {
        console.warn("AI failed to extract one or more essential fields (Title, Company, Description, Language). Extracted:", extractedData);
        throw new Error("AI could not extract all essential job details from the page.");
    }

    return extractedData;
}

// Extract job data from pasted text content (no URL fetching)
export async function extractJobDataFromText(rawText: string, userId: string): Promise<ExtractedJobData> {
    if (!rawText || rawText.trim().length < 50) {
        throw new Error("Please paste more job description text. The content seems too short.");
    }

    console.log(`Extracting job data from pasted text (length: ${rawText.length})`);

    // Truncate if too long
    const maxLength = 100000;
    const textContent = rawText.length > maxLength ? rawText.substring(0, maxLength) : rawText;

    // Prompt for extracting from raw text
    const prompt = `
        Analyze the following text that was copied from a job posting webpage.
        Your task is to extract specific details about the job posting.

        Instructions:
        1. Identify the main job title.
        2. Identify the hiring company's name.
        3. Extract the full job description text, focusing on responsibilities, qualifications, requirements, benefits, and any other relevant details.
        4. Determine the primary language of the job posting (e.g., "en" for English, "de" for German, "es" for Spanish). Use standard ISO 639-1 language codes.
        5. Extract the job location (e.g., "remote", "Berlin", "Hybrid").
        6. Salary:
           - If the posting explicitly states a salary or compensation range, extract it into the \`salary\` field and set \`salaryIsEstimate\` to false. Set \`estimatedSalary\` to null.
           - If NO salary is mentioned, set \`salary\` to null, set \`salaryIsEstimate\` to true, and provide a realistic market-rate estimate in \`estimatedSalary\` based on the job title, location, seniority level, required skills/tech stack, company type, and local market data. Express it as a range (e.g., "€60k–€80k/year", "$90k–$120k/year"). Be realistic and specific.
        7. Extract key highlights such as Employment Type, Experience Level, Remote Policy, Benefits, Tech Stack, Location, Salary, and any other important details. Return them as a structured list of key-value pairs in the 'keyDetails' field.
        8. Extract the job prerequisites and requirements as a bullet-pointed list. Include required skills, qualifications, years of experience, education requirements, certifications, languages, and any "must-have" or "nice-to-have" items. IMPORTANT: This list MUST BE IN ENGLISH, even if the job description is in another language. Translate the requirements to English if necessary. Format as a clean bulleted list (using • or - characters). Leave the 'notes' field NULL.
        9. Determine the employment type (jobType). Map common terms to these exact values: "full-time" (for Vollzeit, full-time, 40 hours), "part-time" (for Teilzeit, part-time), "working-student" (for Werkstudent, working student, student assistant), "internship" (for Praktikum, internship), "contract" (for Befristet, contract, temporary), "freelance" (for Freelance, self-employed). Use null if not specified.
        10. Extract contact information if available:
            - contactEmail: Recruiter or company contact email address
            - contactPhone: Recruiter or company contact phone number
            - hiringManagerName: Name of hiring manager, recruiter, or contact person
            - applicationUrl: Direct application URL or portal link
        11. Provide 2-4 concise field/industry tags in jobTags (e.g., "Cybersecurity", "Network Security", "SOC", "Threat Detection"). Use Title Case, avoid duplicates, and keep each tag under 32 characters.

        Output Format:
        Return ONLY a single JSON object enclosed in triple backticks (\`\`\`json ... \`\`\`). This JSON object MUST contain exactly these top-level keys: "jobTitle", "companyName", "jobDescriptionText", "language", "location", "salary", "estimatedSalary", "salaryIsEstimate", "keyDetails", "jobPrerequisites", "jobType", "contactEmail", "contactPhone", "hiringManagerName", "applicationUrl", "jobTags", and "notes".
        - jobTitle, companyName, language, location, salary, estimatedSalary, jobPrerequisites, contactEmail, contactPhone, hiringManagerName, applicationUrl should be strings if found, or null.
        - salaryIsEstimate should be a boolean: true if salary is AI-estimated, false if extracted from the posting.
        - jobType should be one of: "full-time", "part-time", "working-student", "internship", "contract", "freelance", or null.
        - keyDetails should be an array of objects with "key" and "value" strings, or null.
        - jobPrerequisites should be a bulleted list string of requirements and qualifications (ALWAYS IN ENGLISH).
        - jobTags should be an array of 2-4 strings, or null if unclear.
        - jobDescriptionText is REQUIRED.
        - 'notes' should be null.

        Example structure (salary IS in posting):
        \`\`\`json
        {
          "jobTitle": "Software Engineer",
          "companyName": "Tech Corp",
          "jobDescriptionText": "...",
          "language": "en",
          "location": "SF",
          "salary": "$150k",
          "estimatedSalary": null,
          "salaryIsEstimate": false,
          "jobType": "full-time",
          "contactEmail": "jobs@techcorp.com",
          "contactPhone": "+1 555 123 4567",
          "hiringManagerName": "John Doe",
          "applicationUrl": "https://techcorp.com/apply",
                    "jobTags": ["Cybersecurity", "Threat Detection", "SOC"],
          "keyDetails": [
            { "key": "Contract", "value": "Full-time" },
            { "key": "Experience", "value": "3+ years" },
            { "key": "Visa Sponsorship", "value": "Yes" },
            { "key": "Team", "value": "5 ppl" }
          ],
          "jobPrerequisites": "• 3+ years of experience in software development\\n• Proficiency in Java, JavaScript, or Python\\n• Bachelor's degree in Computer Science or related field\\n• Experience with cloud platforms (AWS, GCP, Azure)\\n• Strong communication skills\\n• Nice to have: Experience with Kubernetes",
          "notes": null
        }
        \`\`\`

        Job Posting Text:
        ---
        ${textContent}
        ---
    `;

    try {
        const result = await generateContent(userId, prompt);
        const responseText = result.text;
        console.log("Received field extraction response from AI for pasted text.");
        const extractedData = parseExtractionResponse(responseText);

        // Validate essential fields
        if (!extractedData.jobTitle || !extractedData.companyName || !extractedData.jobDescriptionText || !extractedData.language) {
            console.warn("AI failed to extract essential fields from pasted text. Extracted:", extractedData);
            throw new Error("Could not extract all essential job details from the pasted text. Please paste more complete job information.");
        }

        return extractedData;

    } catch (error: any) {
        console.error("Error during AI extraction from pasted text:", error);

        // Preserve NotFoundError (e.g., missing API key)
        if (error instanceof NotFoundError) {
            throw error;
        }

        // Handle Gemini API errors
        if (error instanceof GoogleGenerativeAIError || (error.response && error.response.promptFeedback)) {
            const blockReason = error.response?.promptFeedback?.blockReason;
            throw new Error(`AI content generation blocked: ${blockReason || 'Unknown reason'}`);
        }

        // Preserve original message if available
        if (error?.message) {
            throw new Error(error.message);
        }

        throw new Error("Failed to extract job details from the pasted text.");
    }
}