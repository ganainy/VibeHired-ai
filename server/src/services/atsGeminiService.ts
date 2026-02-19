// ATS analysis service (provider-agnostic) - Enhanced with improved prompting
import { generateStructuredResponse } from '../utils/aiService';
import { JsonResumeSchema } from '../types/jsonresume';
import { convertJsonResumeToText } from '../utils/cvTextExtractor';
import {
    ISkillMatchDetails,
    IAtsComplianceDetails,
    ISectionCompleteness,
    IQuantifiableMetrics,
    ISkillsAnalysis,
    ILengthAnalysis,
    IStandardHeaders
} from '../models/CvAnalysis';
import {
    validateAtsResponse,
    isPrioritizedMissingKeywords,
    isPrioritizedMissingSkills,
    convertToMissingKeyword,
    convertToMissingSkill,
    type MissingKeyword,
    type MissingSkill,
    type ActionableFeedback,
    type ScoreBreakdown
} from '../validations/atsResponseSchema';
import { getCondensedExamples } from '../constants/atsPromptExamples';

// Enhanced GeminiAtsResponse interface with priority-based feedback
interface GeminiAtsResponse {
    atsScore: number; // Overall ATS compatibility score (0-100)

    // NEW: Score breakdown by category
    scoreBreakdown?: ScoreBreakdown;

    // Keywords analysis - enhanced with priority
    matchedKeywords: string[];
    missingKeywords: string[] | MissingKeyword[];

    // Skills analysis - enhanced with priority
    matchedSkills: string[];
    missingSkills: string[] | MissingSkill[];

    // Issues and recommendations
    formattingIssues: string[];
    recommendations: string[];

    // NEW: Actionable feedback with impact
    actionableFeedback?: ActionableFeedback[];

    // Section scores
    sectionScores?: Record<string, number>;
    skillMatchPercentage?: number;
    gapAnalysis?: Record<string, any>;

    // Comprehensive metrics
    sectionCompleteness?: {
        present: string[];
        missing: string[];
        score: number;
    };
    quantifiableMetrics?: {
        hasMetrics: boolean;
        examples: string[];
        score: number;
    };
    skillsAnalysis?: {
        hardSkills: string[];
        softSkills: string[];
        score: number;
    };
    lengthAnalysis?: {
        pageCount: number;
        wordCount: number;
        isOptimal: boolean;
        score: number;
    };
    readabilityScore?: number;
    atsBlockingElements?: string[];
    standardHeaders?: {
        isStandard: boolean;
        nonStandardHeaders: string[];
        score: number;
    };

    // Industry keywords (for general CV analysis)
    industryKeywords?: string[];
    missingIndustryKeywords?: string[];
}

// ============ SCORING WEIGHTS ============
// These weights determine how the overall ATS score is calculated
const SCORING_WEIGHTS = {
    technicalSkills: 0.40,      // 40% - Critical technical skills match
    experienceRelevance: 0.30,  // 30% - Experience alignment
    additionalSkills: 0.20,     // 20% - Nice-to-have skills
    formatting: 0.10            // 10% - ATS-friendly formatting
} as const;

/**
 * Safely converts a value to a number, returning undefined if NaN or invalid
 */
function safeNumber(value: any): number | undefined {
    if (value === null || value === undefined) return undefined;
    const num = typeof value === 'number' ? value : Number(value);
    return (isNaN(num) || !isFinite(num)) ? undefined : num;
}

/**
 * Safely gets a number with a default fallback, ensuring no NaN
 */
function safeNumberWithDefault(value: any, defaultValue: number): number {
    const num = safeNumber(value);
    return num !== undefined ? num : defaultValue;
}

/**
 * Builds the enhanced ATS analysis prompt with chain-of-thought reasoning
 */
function buildAtsPrompt(cvText: string, cvJsonString: string, jobDescription?: string, excludeSuggestions?: string[]): string {
    // System role and context
    let prompt = `You are an expert ATS (Applicant Tracking System) analyzer with deep knowledge of resume parsing, keyword matching, and hiring systems. Your task is to analyze a CV/resume for ATS compatibility${jobDescription ? ' and match it against a job description' : ''}.

**IMPORTANT INSTRUCTIONS:**

1. **Chain-of-Thought Analysis**: Before providing scores, mentally walk through each analysis step:
   - First, extract all requirements from the job description (if provided)
   - Second, identify all skills and experience from the CV
   - Third, match keywords considering synonyms and variations
   - Fourth, calculate component scores before the final score

2. **Scoring Weights**: Calculate the overall ATS score using these weights:
   - **Technical Skills Match: 40%** - How well do the candidate's technical skills match requirements?
   - **Experience Relevance: 30%** - How relevant is the candidate's experience?
   - **Additional Skills: 20%** - Does the candidate have nice-to-have skills?
   - **Formatting: 10%** - Is the CV ATS-friendly in structure?

3. **Keyword Matching Rules**:
   - Consider synonyms (JavaScript/JS, C#/C-Sharp, AWS/Amazon Web Services)
   - Handle German/English variations (Berufserfahrung/Work Experience, Ausbildung/Education)
   - Match abbreviations to full forms and vice versa
   - Don't penalize for equivalent certifications (PMP/PRINCE2, AWS Certified/Azure Certified)

4. **Priority Levels for Missing Items**:
   - **high**: Critical requirement explicitly stated as "required" or "must have" - CV will likely be rejected without this
   - **medium**: Important skill listed in requirements but not marked as mandatory
   - **low**: Nice-to-have or implied skill that would strengthen the application

**Comprehensive Analysis Requirements - Evaluate ALL Key Metrics:**

1. **Score Breakdown**: Provide individual scores (0-100) for each weight category:
   - technicalSkills: Match of required technical skills/tools
   - experienceRelevance: How well experience aligns with role
   - additionalSkills: Presence of nice-to-have skills
   - formatting: ATS-friendliness of CV structure

2. **Keyword Analysis**:
   - List all matched keywords from job description found in CV
   - For each missing keyword, provide: keyword, priority (high/medium/low), and context explaining why it matters

3. **Skills Analysis**:
   - List all matched skills
   - For each missing skill, provide: skill, priority (high/medium/low), and context

4. **Actionable Feedback**:
   - Provide specific, actionable recommendations
   - For each recommendation, include: priority, specific action to take, expected impact on ATS score

5. **Section Scores**: Score each major CV section (0-100) for ATS compatibility:
   - Work Experience, Education, Skills, Summary, Contact Information, etc.

6. **Additional Metrics**:
   - Section Completeness (present/missing sections)
   - Quantifiable Metrics (numbers, percentages in achievements)
   - Hard/Soft Skills breakdown
   - Length Analysis (page count, word count)
   - Readability Score
   - ATS Blocking Elements
   - Standard Headers check

**CV Content:**
${cvText}

**CV JSON Structure:**
${cvJsonString}
`;

    // Add job description context if provided
    if (jobDescription) {
        prompt += `
**Job Description:**
${jobDescription}

**Analysis Focus**: 
Analyze the CV specifically against this job description. Your score should reflect how well the resume would perform in an ATS system screening for this specific role.

- Heavily weight keywords that appear in the job title and "required" sections
- Identify critical gaps that would cause automatic rejection
- Provide actionable feedback ranked by impact on getting past ATS
`;
    } else {
        prompt += `
**Note:** No job description provided. Perform general ATS compatibility analysis:
- Check for industry-standard keywords
- Evaluate overall ATS-friendliness
- Provide general optimization suggestions
`;
    }

    // Add exclusion list if previously applied suggestions exist
    if (excludeSuggestions && excludeSuggestions.length > 0) {
        prompt += `\n**Previously Applied Improvements (DO NOT RE-SUGGEST):**\nThe following improvements have already been applied to this CV. Do not include them in your suggestions, actionableFeedback, missingKeywords, or missingSkills:\n${excludeSuggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n`;
    }

    // Add few-shot examples summary
    prompt += `

**Example Output Quality Reference:**
${getCondensedExamples()}
`;

    // Output format specification
    prompt += `

**Output Format:**
Return ONLY a JSON object wrapped in triple backticks (\`\`\`json ... \`\`\`) with the following structure:

{
  "atsScore": <number 0-100 - weighted combination of category scores>,
  "scoreBreakdown": {
    "technicalSkills": <number 0-100>,
    "experienceRelevance": <number 0-100>,
    "additionalSkills": <number 0-100>,
    "formatting": <number 0-100>
  },
  "matchedKeywords": <array of strings - keywords from job description found in CV>,
  "missingKeywords": [
    {"keyword": "<string>", "priority": "high|medium|low", "context": "<why this keyword matters>"}
  ],
  "matchedSkills": <array of strings>,
  "missingSkills": [
    {"skill": "<string>", "priority": "high|medium|low", "context": "<why this skill matters>"}
  ],
  "formattingIssues": <array of strings>,
  "recommendations": <array of strings>,
  "actionableFeedback": [
    {"priority": "high|medium|low", "action": "<specific action>", "impact": "<expected score improvement>"}
  ],
  "sectionScores": {"Work Experience": 85, "Skills": 70, ...},
  "skillMatchPercentage": <number 0-100>,
  "sectionCompleteness": {
    "present": <array of section names>,
    "missing": <array of section names>,
    "score": <number 0-100>
  },
  "quantifiableMetrics": {
    "hasMetrics": <boolean>,
    "examples": <array of examples found>,
    "score": <number 0-100>
  },
  "skillsAnalysis": {
    "hardSkills": <array of technical skills>,
    "softSkills": <array of soft skills>,
    "score": <number 0-100>
  },
  "lengthAnalysis": {
    "pageCount": <number>,
    "wordCount": <number>,
    "isOptimal": <boolean - true if 1-2 pages>,
    "score": <number 0-100>
  },
  "readabilityScore": <number 0-100>,
  "atsBlockingElements": <array of blocking elements found>,
  "standardHeaders": {
    "isStandard": <boolean>,
    "nonStandardHeaders": <array of non-standard headers>,
    "score": <number 0-100>
  }
}`;

    return prompt;
}

/**
 * Extracts plain strings from prioritized missing keywords
 */
function extractMissingKeywordStrings(keywords: string[] | MissingKeyword[]): string[] {
    if (!keywords || keywords.length === 0) return [];

    if (isPrioritizedMissingKeywords(keywords)) {
        return keywords.map(k => k.keyword);
    }
    return keywords;
}

/**
 * Extracts plain strings from prioritized missing skills
 */
function extractMissingSkillStrings(skills: string[] | MissingSkill[]): string[] {
    if (!skills || skills.length === 0) return [];

    if (isPrioritizedMissingSkills(skills)) {
        return skills.map(s => s.skill);
    }
    return skills;
}

/**
 * Calculates weighted overall score from breakdown
 */
function calculateWeightedScore(breakdown: ScoreBreakdown | undefined): number | null {
    if (!breakdown) return null;

    const weightedScore =
        (breakdown.technicalSkills * SCORING_WEIGHTS.technicalSkills) +
        (breakdown.experienceRelevance * SCORING_WEIGHTS.experienceRelevance) +
        (breakdown.additionalSkills * SCORING_WEIGHTS.additionalSkills) +
        (breakdown.formatting * SCORING_WEIGHTS.formatting);

    return Math.round(weightedScore);
}

/**
 * Analyzes CV against job description using Gemini AI for ATS compatibility
 * @param userId - User ID (required to get their Gemini API key)
 * @param cvJson - The CV in JSON Resume format
 * @param jobDescription - Optional job description for matching analysis
 * @returns ATS analysis results compatible with existing interface
 */
export async function analyzeWithGemini(
    userId: string,
    cvJson: JsonResumeSchema,
    jobDescription?: string,
    excludeSuggestions?: string[]
): Promise<{
    score: number | null;
    details: {
        skillMatchDetails: ISkillMatchDetails | null;
        complianceDetails: IAtsComplianceDetails | null;
    };
    error?: string;
}> {
    try {
        // Convert CV to text format for better context
        const cvText = convertJsonResumeToText(cvJson);
        const cvJsonString = JSON.stringify(cvJson, null, 2);

        // Build enhanced prompt with chain-of-thought reasoning
        const prompt = buildAtsPrompt(cvText, cvJsonString, jobDescription, excludeSuggestions);

        console.log('[ATS] Starting enhanced Gemini analysis with weighted scoring');

        // Call AI service
        const geminiResult: GeminiAtsResponse = await generateStructuredResponse<GeminiAtsResponse>(
            userId,
            prompt
        );

        // Validate response structure
        const validation = validateAtsResponse(geminiResult);
        if (!validation.success) {
            console.warn('[ATS] Response validation warnings:', validation.error.errors);
            // Continue with best-effort processing - the response may still be usable
        }

        // Calculate or use provided ATS score
        let atsScore: number | null;
        if (geminiResult.scoreBreakdown) {
            // Calculate weighted score from breakdown
            const calculatedScore = calculateWeightedScore(geminiResult.scoreBreakdown);
            // Use calculated score, but allow LLM score if reasonable (within 10 points)
            const llmScore = safeNumber(geminiResult.atsScore);
            if (llmScore !== undefined && calculatedScore !== null) {
                const diff = Math.abs(llmScore - calculatedScore);
                if (diff > 10) {
                    console.log(`[ATS] Score discrepancy: LLM=${llmScore}, Calculated=${calculatedScore}. Using calculated.`);
                    atsScore = calculatedScore;
                } else {
                    atsScore = llmScore;
                }
            } else {
                atsScore = calculatedScore ?? safeNumber(geminiResult.atsScore) ?? null;
            }
        } else {
            atsScore = safeNumber(geminiResult.atsScore) ?? null;
        }

        // Calculate skillMatchPercentage safely, avoiding NaN
        let skillMatchPercentage: number | undefined = safeNumber(geminiResult.skillMatchPercentage);
        if (skillMatchPercentage === undefined) {
            const matchedCount = geminiResult.matchedSkills?.length || 0;
            const missingSkillsArray = geminiResult.missingSkills || [];
            const missingCount = isPrioritizedMissingSkills(missingSkillsArray)
                ? missingSkillsArray.length
                : missingSkillsArray.length;
            const totalCount = matchedCount + missingCount;

            if (totalCount > 0) {
                const calculated = Math.round((matchedCount / totalCount) * 100);
                skillMatchPercentage = safeNumber(calculated);
            }
        }

        // Extract plain string arrays for backward compatibility
        const missingSkillsStrings = extractMissingSkillStrings(geminiResult.missingSkills);
        const missingKeywordsStrings = extractMissingKeywordStrings(geminiResult.missingKeywords);

        // Map to skill matching details
        const skillMatchDetails: ISkillMatchDetails = {
            skillMatchPercentage: skillMatchPercentage,
            matchedSkills: geminiResult.matchedSkills || [],
            missingSkills: missingSkillsStrings,
            recommendations: geminiResult.recommendations?.filter(rec =>
                rec.toLowerCase().includes('skill') ||
                rec.toLowerCase().includes('experience') ||
                rec.toLowerCase().includes('qualification')
            ) || [],
            gapAnalysis: geminiResult.gapAnalysis || {}
        };

        // Map to ATS compliance details with enhanced data
        const complianceDetails: IAtsComplianceDetails = {
            keywordsMatched: geminiResult.matchedKeywords || geminiResult.industryKeywords || [],
            keywordsMissing: missingKeywordsStrings.length > 0
                ? missingKeywordsStrings
                : geminiResult.missingIndustryKeywords || [],
            formattingIssues: geminiResult.formattingIssues || [],
            suggestions: geminiResult.recommendations || [],
            sectionScores: geminiResult.sectionScores ? (() => {
                const scores: Record<string, number> = {};
                for (const [key, value] of Object.entries(geminiResult.sectionScores!)) {
                    const safeValue = safeNumber(value);
                    if (safeValue !== undefined) {
                        scores[key] = safeValue;
                    }
                }
                return Object.keys(scores).length > 0 ? scores : undefined;
            })() : undefined,
            sectionCompleteness: geminiResult.sectionCompleteness ? {
                present: geminiResult.sectionCompleteness.present || [],
                missing: geminiResult.sectionCompleteness.missing || [],
                score: safeNumberWithDefault(geminiResult.sectionCompleteness.score, 0)
            } : undefined,
            quantifiableMetrics: geminiResult.quantifiableMetrics ? {
                hasMetrics: geminiResult.quantifiableMetrics.hasMetrics || false,
                examples: geminiResult.quantifiableMetrics.examples || [],
                score: safeNumberWithDefault(geminiResult.quantifiableMetrics.score, 0)
            } : undefined,
            skillsAnalysis: geminiResult.skillsAnalysis ? {
                hardSkills: geminiResult.skillsAnalysis.hardSkills || [],
                softSkills: geminiResult.skillsAnalysis.softSkills || [],
                score: safeNumberWithDefault(geminiResult.skillsAnalysis.score, 0)
            } : undefined,
            lengthAnalysis: geminiResult.lengthAnalysis ? {
                pageCount: safeNumberWithDefault(geminiResult.lengthAnalysis.pageCount, 0),
                wordCount: safeNumberWithDefault(geminiResult.lengthAnalysis.wordCount, 0),
                isOptimal: geminiResult.lengthAnalysis.isOptimal || false,
                score: safeNumberWithDefault(geminiResult.lengthAnalysis.score, 0)
            } : undefined,
            readabilityScore: safeNumber(geminiResult.readabilityScore),
            atsBlockingElements: geminiResult.atsBlockingElements || [],
            standardHeaders: geminiResult.standardHeaders ? {
                isStandard: geminiResult.standardHeaders.isStandard || false,
                nonStandardHeaders: geminiResult.standardHeaders.nonStandardHeaders || [],
                score: safeNumberWithDefault(geminiResult.standardHeaders.score, 0)
            } : undefined,
            // Enhanced fields
            scoreBreakdown: geminiResult.scoreBreakdown ? {
                technicalSkills: safeNumberWithDefault(geminiResult.scoreBreakdown.technicalSkills, 0),
                experienceRelevance: safeNumberWithDefault(geminiResult.scoreBreakdown.experienceRelevance, 0),
                additionalSkills: safeNumberWithDefault(geminiResult.scoreBreakdown.additionalSkills, 0),
                formatting: safeNumberWithDefault(geminiResult.scoreBreakdown.formatting, 0)
            } : undefined,
            prioritizedMissingKeywords: isPrioritizedMissingKeywords(geminiResult.missingKeywords)
                ? geminiResult.missingKeywords.map(k => ({
                    keyword: k.keyword,
                    priority: k.priority,
                    context: k.context
                }))
                : undefined,
            prioritizedMissingSkills: isPrioritizedMissingSkills(geminiResult.missingSkills)
                ? geminiResult.missingSkills.map(s => ({
                    skill: s.skill,
                    priority: s.priority,
                    context: s.context
                }))
                : undefined,
            actionableFeedback: geminiResult.actionableFeedback?.map(f => ({
                priority: f.priority,
                action: f.action,
                impact: f.impact
            })) || undefined
        };

        // Log enhanced metrics for debugging
        if (geminiResult.scoreBreakdown) {
            console.log('[ATS] Score breakdown:', geminiResult.scoreBreakdown);
        }
        if (geminiResult.actionableFeedback) {
            console.log(`[ATS] Generated ${geminiResult.actionableFeedback.length} actionable feedback items`);
        }

        return {
            score: atsScore,
            details: {
                skillMatchDetails,
                complianceDetails
            }
        };

    } catch (error: any) {
        console.error('Error calling Gemini ATS analysis:', error);
        return {
            score: null,
            details: {
                skillMatchDetails: null,
                complianceDetails: null
            },
            error: error.message || 'Failed to analyze with Gemini ATS'
        };
    }
}
