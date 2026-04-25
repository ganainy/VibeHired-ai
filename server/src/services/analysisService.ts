import { Types } from 'mongoose';
import CvAnalysis, { ICvAnalysis, IAtsScores } from '../models/CvAnalysis'; // Import model and interface
import { generateContentWithFile, generateStructuredResponse } from '../utils/aiService'; // Import provider-agnostic AI functions
import { calculateScores } from '../utils/analysis/scoringUtil'; // Import scoring utility
import fs from 'fs'; // Import fs for cleanup
import path from 'path'; // Import path for determining MIME type
import { JsonResumeSchema } from '../types/jsonresume'; // Import JSON resume schema
import { analyzeWithGemini } from './atsGeminiService';
import crypto from 'crypto';
import User from '../models/User';

// Define the expected structure for the detailed results from Gemini
// This should align with the IDetailedResultItem interface in CvAnalysis.ts
interface GeminiDetailedResultItem {
    checkName: string; // e.g., "Impact Quantification", "Grammar", "Keyword Relevance"
    score?: number | null; // Optional score (0-100) reflecting quality/severity
    issues: string[]; // List of specific issues found (e.g., "Sentence in passive voice: ...", "Lacks metrics in project description X")
    suggestions?: string[]; // Specific suggestions for improvement (e.g., "Rephrase sentence to active voice: ...", "Add data point for Y achievement")
    status: 'pass' | 'fail' | 'warning' | 'not-applicable'; // Overall status for this check
    priority: 'high' | 'medium' | 'low'; // Priority level for fixing this issue
}

export type GeminiAnalysisResult = Record<string, GeminiDetailedResultItem>;

// Function to determine MIME type from file path
function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.pdf': return 'application/pdf';
        case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        // Add other supported types if necessary
        default: throw new Error(`Unsupported file type: ${ext}`);
    }
}

// Function to determine if a section is analyzable
const isSectionAnalyzable = (section: any): boolean => {
    if (Array.isArray(section)) {
        return section.length > 0;
    }
    if (typeof section === 'object' && section !== null) {
        return Object.keys(section).length > 0;
    }
    return false;
};

// Master prompt for Gemini analysis (Corrected quotes)
const MASTER_ANALYSIS_PROMPT = `
Analyze the provided CV document (PDF or DOCX). Your goal is to perform a comprehensive review covering content, structure, and language.

**Output Format:**
Return ONLY a single JSON object enclosed in triple backticks (\`\`\`json ... \`\`\`).
The JSON object should have keys corresponding to different analysis checks (e.g., "impactQuantification", "grammar", "keywordRelevance", "sectionCompleteness", "toneClarity").
Each key's value MUST be an object with the following fields:
- "checkName": (string) A human-readable name for the check (e.g., "Impact Quantification", "Grammar and Spelling").
- "score": (number, optional) A score from 0 to 100 indicating performance on this check (higher is better). Omit if not applicable.
- "issues": (array of strings) Specific problems identified. Be concise but clear. If no issues, return an empty array [].
- "suggestions": (array of strings, optional) Actionable advice for improvement related to the issues. If no suggestions, omit or return an empty array [].
- "status": (string) Overall assessment for this check: "pass", "fail", "warning", or "not-applicable".
- "priority": (string) Priority level for fixing this issue: "high", "medium", or "low". Use these guidelines:
  * high: Issues that significantly impact readability, professionalism, or ATS compatibility
  * medium: Issues that affect quality but don't severely impact understanding
  * low: Minor improvements that would enhance the CV but aren't critical

**Analysis Checks to Perform:**

1.  **Impact Quantification:**
    *   Priority: high for missing metrics in key achievements, medium for general improvements
    *   Identify achievements and responsibilities that lack specific metrics
    *   "status": "fail" if many items lack metrics, "warning" if some do, "pass" if well-quantified

2.  **Grammar and Spelling:**
    *   Priority: high for obvious errors, medium for style issues
    *   Check for grammatical errors, typos, and spelling mistakes
    *   "status": "fail" if many errors, "warning" if few, "pass" if none/negligible

3.  **Keyword Relevance:**
    *   Priority: high if missing crucial industry keywords, medium for optimization
    *   Check if industry-specific keywords are present and used naturally
    *   "status": "warning" if improvement needed, "pass" otherwise

4.  **Active Voice Usage:**
    *   Priority: medium unless severely impacting clarity
    *   Focus on achievement descriptions and responsibility statements
    *   "status": "fail" if excessive passive voice, "warning" if some, "pass" if mostly active

5.  **Buzzwords and Clichés:**
    *   Priority: medium for excessive use, low for occasional instances
    *   Look for overused phrases that could be more specific
    *   "status": "warning" if detected, "pass" otherwise

6.  **Length and Structure:**
    *   Priority: high for missing crucial sections or severe length issues
    *   Check overall organization and section completeness
    *   "status": "warning" if issues found, "pass" otherwise

7.  **Contact Information:**
    *   Priority: high for missing essential contact details
    *   Verify presence of name, phone, email, location
    *   "status": "fail" if missing essentials, "pass" otherwise

8.  **Summary/Objective Quality:**
    *   Priority: medium for improvements, low if present but basic
    *   Evaluate relevance and impact
    *   "status": "warning" if generic, "pass" if strong, "not-applicable" if missing

9.  **Skills Organization:**
    *   Priority: medium for structure issues, low for minor grouping improvements
    *   Check logical grouping and presentation
    *   "status": "warning" if poorly organized, "pass" otherwise

10. **Education Presentation:**
    *   Priority: high for missing crucial details, medium for formatting
    *   Verify completeness and proper ordering
    *   "status": "warning" if issues found, "pass" otherwise

Analyze the entire document thoroughly and maintain consistency in priority assignments across all checks.
`;

// New prompt for generating section improvements
const IMPROVEMENT_PROMPT = `
You are a professional CV/resume writer. Your task is to improve a specific section of a CV based on the analysis results and suggestions.
You will receive:
1. The current content of the section
2. The analysis results and suggestions for improvement
3. The section name that needs improvement

Guidelines:
- Maintain a professional tone
- Keep the improved content relevant to the section
- Address all issues mentioned in the analysis
- Implement all relevant suggestions
- Keep the same key information but present it more effectively
- Use active voice and quantifiable achievements where possible
- Ensure improved content is ATS-friendly

Return ONLY the improved content without any additional explanation or markdown formatting.
The output should be ready to use as a direct replacement for the current content.
`;

// Updated analysis orchestration function
export const performAnalysis = async (filePath: string, userId: string | Types.ObjectId, analysisId: Types.ObjectId): Promise<void> => {
    console.log(`Starting AI analysis for ID: ${analysisId}, User: ${userId}, File: ${filePath}`);
    let analysisStatus: ICvAnalysis['status'] = 'failed'; // Default to failed
    let analysisResults: GeminiAnalysisResult | null = null;
    let calculatedScores = { overallScore: 0, categoryScores: {}, issueCount: 0 };
    let errorInfo: string | undefined = undefined;

    try {
        const mimeType = getMimeType(filePath);
        const userIdStr = userId.toString();

        // 1. Call AI service with the file and master prompt
        const result = await generateContentWithFile(
            userIdStr,
            MASTER_ANALYSIS_PROMPT,
            filePath,
            mimeType
        );
        
        // Parse the JSON response
        const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
        const jsonMatch = result.text.match(jsonRegex);
        if (jsonMatch && jsonMatch[1]) {
            analysisResults = JSON.parse(jsonMatch[1].trim()) as GeminiAnalysisResult;
        } else {
            // Try to extract JSON from plain text
            const startIndex = result.text.indexOf('{');
            const endIndex = result.text.lastIndexOf('}');
            if (startIndex !== -1 && endIndex !== -1) {
                analysisResults = JSON.parse(result.text.substring(startIndex, endIndex + 1)) as GeminiAnalysisResult;
            } else {
                throw new Error('AI response did not contain valid JSON');
            }
        }

        // Basic validation of AI response structure (check if it's an object)
        if (typeof analysisResults !== 'object' || analysisResults === null) {
            throw new Error("AI analysis did not return a valid object structure.");
        }

        // 2. Calculate scores based on AI results
        // The scoring logic will need to interpret the structured results from Gemini
        calculatedScores = calculateScores(analysisResults); // Pass AI results directly

        analysisStatus = 'completed'; // Mark as completed if AI call and scoring succeed
        console.log(`AI analysis and scoring completed for ID: ${analysisId}`);

    } catch (error: any) {
        console.error(`Analysis failed for ID: ${analysisId}:`, error);
        analysisStatus = 'failed';
        errorInfo = error instanceof Error ? error.message : 'Unknown analysis error';
        // Ensure analysisResults is null or empty if analysis failed partway
        analysisResults = null;
        calculatedScores = { overallScore: 0, categoryScores: {}, issueCount: 0 }; // Reset scores on failure

    } finally {
        // 3. Update CvAnalysis document in the database
        try {
            const updateData: Partial<ICvAnalysis> = {
                status: analysisStatus,
                detailedResults: analysisResults ?? {}, // Use empty object if null
                overallScore: calculatedScores.overallScore,
                categoryScores: calculatedScores.categoryScores,
                issueCount: calculatedScores.issueCount,
                errorInfo: errorInfo,
                analysisDate: new Date() // Update analysis date
            };
            await CvAnalysis.findByIdAndUpdate(analysisId, updateData);
            console.log(`Database record updated for analysis ID: ${analysisId} with status: ${analysisStatus}`);
        } catch (dbError: any) {
            console.error(`FATAL: Failed to update database for analysis ID: ${analysisId} after analysis attempt:`, dbError);
            // This is a secondary error, the primary error (if any) is already logged.
        }

        // 4. Clean up the temporary file
        fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) {
                console.error(`Error deleting temporary file ${filePath} for analysis ID ${analysisId}:`, unlinkErr);
            } else {
                console.log(`Temporary file ${filePath} deleted for analysis ID ${analysisId}.`);
            }
        });
    }
};

// Updated function to analyze CV JSON directly
export const performJsonAnalysis = async (
    cvJson: JsonResumeSchema,
    userId: string | Types.ObjectId,
    analysisId: Types.ObjectId,
    jobContext?: any
): Promise<void> => {
    console.log(`Starting JSON-based AI analysis for ID: ${analysisId}, User: ${userId}`);
    let analysisStatus: ICvAnalysis['status'] = 'failed';
    let analysisResults: GeminiAnalysisResult | null = null;
    let calculatedScores = { overallScore: 0, categoryScores: {}, issueCount: 0 };
    let errorInfo: string | undefined = undefined;

    try {
        // Convert CV JSON to string for analysis
        const cvString = JSON.stringify(cvJson, null, 2);

        // Add job context to the prompt if available
        let prompt = MASTER_ANALYSIS_PROMPT;
        if (jobContext?.jobDescription) {
            prompt = `${prompt}\n\nJob Description Context:\n${jobContext.jobDescription}\n\nAnalyze the CV in relation to this job description.`;
        }

        // Determine which sections are present and analyzable in the CV
        const sectionsToAnalyze = Object.entries(cvJson)
            .filter(([key, value]) =>
                value !== undefined &&
                key !== '_id' &&
                key !== '__v' &&
                isSectionAnalyzable(value)
            )
            .map(([key]) => key);

        console.log('Analyzing sections:', sectionsToAnalyze);

        // Generate initial analysis using provider-agnostic service
        const userIdStr = userId.toString();
        const combinedPrompt = `${prompt}\n\nAnalyze the following CV in JSON Resume format:\n\n${cvString}`;
        
        analysisResults = await generateStructuredResponse<GeminiAnalysisResult>(
            userIdStr,
            combinedPrompt
        );

        if (typeof analysisResults !== 'object' || analysisResults === null) {
            throw new Error("AI analysis did not return a valid object structure.");
        }

        // Mark sections as not-applicable if they're empty or missing
        const allPossibleSections = ['basics', 'work', 'education', 'skills', 'projects', 'languages', 'certificates'];
        allPossibleSections.forEach(section => {
            if (!sectionsToAnalyze.includes(section) && !analysisResults![section]) {
                analysisResults![section] = {
                    checkName: `${section} Analysis`,
                    score: null,
                    issues: [],
                    suggestions: [],
                    status: 'not-applicable',
                    priority: 'low'
                };
            }
        });

        calculatedScores = calculateScores(analysisResults);
        analysisStatus = 'completed';
        console.log(`AI analysis and scoring completed for ID: ${analysisId}`);

    } catch (error: any) {
        console.error(`Analysis failed for ID: ${analysisId}:`, error);
        analysisStatus = 'failed';
        errorInfo = error instanceof Error ? error.message : 'Unknown analysis error';
        analysisResults = null;
        calculatedScores = { overallScore: 0, categoryScores: {}, issueCount: 0 };
    } finally {
        try {
            const updateData: Partial<ICvAnalysis> = {
                status: analysisStatus,
                detailedResults: analysisResults ?? {},
                overallScore: calculatedScores.overallScore,
                categoryScores: calculatedScores.categoryScores,
                issueCount: calculatedScores.issueCount,
                errorInfo: errorInfo,
                analysisDate: new Date()
            };
            await CvAnalysis.findByIdAndUpdate(analysisId, updateData);
            console.log(`Database record updated for analysis ID: ${analysisId} with status: ${analysisStatus}`);
        } catch (dbError: any) {
            console.error(`FATAL: Failed to update database for analysis ID: ${analysisId} after analysis attempt:`, dbError);
        }
    }
};

// Updated function to generate improvements for a specific section
export const generateSectionImprovement = async (
    analysis: ICvAnalysis,
    section: string,
    currentContent: string
): Promise<string> => {
    // Validate inputs
    if (!currentContent?.trim()) {
        throw new Error('Current content is empty or invalid');
    }

    if (!section?.trim()) {
        throw new Error('Section name is required');
    }

    if (analysis.status !== 'completed') {
        throw new Error(`Cannot generate improvements: Analysis status is ${analysis.status}`);
    }

    // Handle Map type properly by converting to object if needed
    const detailedResults = analysis.detailedResults instanceof Map
        ? Object.fromEntries(analysis.detailedResults)
        : analysis.detailedResults;

    if (!detailedResults || Object.keys(detailedResults).length === 0) {
        throw new Error('Cannot generate improvements: No analysis results available');
    }

    // Filter relevant analysis results for this section
    const sectionChecks: Record<string, string[]> = {
        summary: ['summaryObjectiveQuality', 'toneClarity', 'activeVoiceUsage', 'buzzwordsAndCliches'],
        experience: ['impactQuantification', 'activeVoiceUsage', 'keywordRelevance', 'toneClarity'],
        skills: ['keywordRelevance', 'skillsOrganization', 'buzzwordsAndCliches'],
        education: ['educationPresentation', 'toneClarity', 'activeVoiceUsage'],
        projects: ['impactQuantification', 'activeVoiceUsage', 'keywordRelevance', 'toneClarity'],
        achievements: ['impactQuantification', 'activeVoiceUsage', 'toneClarity'],
        certifications: ['keywordRelevance', 'toneClarity'],
        languages: ['skillsOrganization', 'toneClarity'],
        volunteer: ['impactQuantification', 'activeVoiceUsage', 'toneClarity'],
        interests: ['toneClarity', 'buzzwordsAndCliches']
    };

    if (!sectionChecks[section]) {
        throw new Error(`Unsupported section type: ${section}. Valid sections are: ${Object.keys(sectionChecks).join(', ')}`);
    }

    // Filter out mongoose metadata and get valid check results
    const relevantResults = Object.entries(detailedResults)
        .filter(([key]) => !key.startsWith('$__') && !key.startsWith('_') && sectionChecks[section].includes(key))
        .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
        }, {} as typeof detailedResults);

    if (Object.keys(relevantResults).length === 0) {
        const availableChecks = Object.entries(detailedResults)
            .filter(([key]) => !key.startsWith('$__') && !key.startsWith('_'))
            .map(([key]) => key);
        throw new Error(`No analysis results found for section '${section}'. Available checks: ${availableChecks.join(', ')}`);
    }

    // Create a detailed prompt with the current content and analysis results
    const fullPrompt = `${IMPROVEMENT_PROMPT}

Section: ${section}

Current Content:
${currentContent}

Analysis Results and Suggestions:
${JSON.stringify(relevantResults, null, 2)}

Generate improved content for this section addressing the identified issues and implementing the suggestions.

Return the improved content in this format:
\`\`\`json
{
    "content": "Your improved content here"
}
\`\`\``;

    try {
        const userIdString = String(analysis.userId);
        const response = await generateStructuredResponse<{ content: string }>(userIdString, fullPrompt);
        const improvedContent = response?.content?.trim();

        if (!improvedContent) {
            throw new Error('AI generated empty or invalid content');
        }

        return improvedContent;
    } catch (error: any) {
        console.error(`Error generating improvement for section ${section}:`, error);
        const errorMessage = error.message || 'Unknown error';
        throw new Error(`Failed to generate improvement: ${errorMessage}. This may be due to AI service issues or invalid input content.`);
    }
};

/**
 * Generates a hash for the CV data to detect changes
 * @param cvJson - The CV JSON object
 * @returns A hash string representing the CV content
 */
export const generateCvHash = (cvJson: JsonResumeSchema): string => {
    // Create a normalized version of the CV (only relevant sections for analysis)
    const normalizedCv = {
        work: cvJson.work || [],
        education: cvJson.education || [],
        skills: cvJson.skills || []
    };
    const cvString = JSON.stringify(normalizedCv);
    return crypto.createHash('sha256').update(cvString).digest('hex');
};

/**
 * Analyzes all CV sections in a single request and returns feedback for each section item
 * @param cvJson - The complete CV JSON object
 * @param userId - Optional user ID to cache results
 * @returns Analysis results organized by section name, with an array of results for each section
 */
export const getAllSectionsAnalysis = async (
    cvJson: JsonResumeSchema,
    userId: string | Types.ObjectId
): Promise<Record<string, Array<{ needsImprovement: boolean; feedback: string }>>> => {
    const userIdString = String(userId);
    
    // Check cache first
    try {
        const user = await User.findById(userId).select('cvAnalysisCache');
        if (user?.cvAnalysisCache) {
            const currentHash = generateCvHash(cvJson);
            if (user.cvAnalysisCache.cvHash === currentHash && user.cvAnalysisCache.analyses) {
                console.log('Using cached analysis results');
                return user.cvAnalysisCache.analyses as Record<string, Array<{ needsImprovement: boolean; feedback: string }>>;
            }
        }
    } catch (error) {
        console.warn('Error checking analysis cache:', error);
        // Continue with fresh analysis if cache check fails
    }

    console.log('Analyzing all CV sections in one request');

    const fullAnalysisPrompt = `
You are a professional CV reviewer. Analyze the following CV and provide feedback for each section item.

CV Data:
${JSON.stringify(cvJson, null, 2)}

Your task:
1. Analyze each item in the work experience section (if present)
2. Analyze each item in the education section (if present)
3. Analyze each item in the skills section (if present)
4. For each item, evaluate quality and identify areas for improvement
5. Provide concise, actionable feedback for each item

Return ONLY a JSON object with this exact structure:
{
  "work": [
    {
      "needsImprovement": true or false,
      "feedback": "A concise message explaining what can be improved, or an empty string if no improvements are needed."
    },
    ... (one object per work experience item)
  ],
  "education": [
    {
      "needsImprovement": true or false,
      "feedback": "A concise message explaining what can be improved, or an empty string if no improvements are needed."
    },
    ... (one object per education item)
  ],
  "skills": [
    {
      "needsImprovement": true or false,
      "feedback": "A concise message explaining what can be improved, or an empty string if no improvements are needed."
    },
    ... (one object per skills category)
  ]
}

Guidelines:
- Set "needsImprovement" to true if there are clear areas for improvement
- Set "needsImprovement" to false if the section is well-written and follows best practices
- Keep feedback concise (1-2 sentences) and actionable
- Focus on: quantifiable achievements, strong action verbs, clarity, completeness, and ATS-friendliness
- The arrays must match the length of the corresponding sections in the CV
- If a section is empty or missing, return an empty array for that section
`;

    try {
        const response = await generateStructuredResponse<Record<string, Array<{ needsImprovement: boolean; feedback: string }>>>(
            userIdString,
            fullAnalysisPrompt
        );

        if (!response || typeof response !== 'object') {
            throw new Error('AI response did not return valid analysis structure');
        }

        // Ensure all sections have arrays, even if empty
        const result: Record<string, Array<{ needsImprovement: boolean; feedback: string }>> = {
            work: response.work || [],
            education: response.education || [],
            skills: response.skills || []
        };

        // Validate array lengths match CV data
        if (cvJson.work && Array.isArray(cvJson.work)) {
            if (result.work.length !== cvJson.work.length) {
                console.warn(`Work analysis length (${result.work.length}) doesn't match CV work length (${cvJson.work.length})`);
                // Pad or trim to match
                while (result.work.length < cvJson.work.length) {
                    result.work.push({ needsImprovement: false, feedback: '' });
                }
                result.work = result.work.slice(0, cvJson.work.length);
            }
        }

        if (cvJson.education && Array.isArray(cvJson.education)) {
            if (result.education.length !== cvJson.education.length) {
                console.warn(`Education analysis length (${result.education.length}) doesn't match CV education length (${cvJson.education.length})`);
                while (result.education.length < cvJson.education.length) {
                    result.education.push({ needsImprovement: false, feedback: '' });
                }
                result.education = result.education.slice(0, cvJson.education.length);
            }
        }

        if (cvJson.skills && Array.isArray(cvJson.skills)) {
            if (result.skills.length !== cvJson.skills.length) {
                console.warn(`Skills analysis length (${result.skills.length}) doesn't match CV skills length (${cvJson.skills.length})`);
                while (result.skills.length < cvJson.skills.length) {
                    result.skills.push({ needsImprovement: false, feedback: '' });
                }
                result.skills = result.skills.slice(0, cvJson.skills.length);
            }
        }

        // Cache the results if userId is provided
        if (userId) {
            try {
                const cvHash = generateCvHash(cvJson);
                await User.findByIdAndUpdate(userId, {
                    $set: {
                        cvAnalysisCache: {
                            cvHash,
                            analyses: result,
                            analyzedAt: new Date()
                        }
                    }
                });
                console.log('Analysis results cached for user');
            } catch (cacheError) {
                console.warn('Error caching analysis results:', cacheError);
                // Don't fail the request if caching fails
            }
        }

        return result;
    } catch (error: any) {
        console.error('Error analyzing CV sections:', error);
        throw new Error(`Failed to analyze CV sections: ${error.message}`);
    }
};