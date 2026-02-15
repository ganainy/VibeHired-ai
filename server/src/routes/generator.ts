import express, { Router, Request, Response, RequestHandler } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import authMiddleware from '../middleware/authMiddleware';
import JobApplication from '../models/JobApplication';
import User, { IUser } from '../models/User'; // Import IUser interface
import Profile from '../models/Profile';
import { generateContent } from '../utils/aiService';
import { GoogleGenerativeAIError } from '@google/generative-ai';
import { JsonResumeSchema } from '../types/jsonresume';
import mongoose from 'mongoose';
import CV from '../models/CV'; // Import Unified CV Model
import { generateCvPdfFromJsonResume, generateCoverLetterPdf } from '../utils/pdfGenerator'; // Import PDF generators
import { validateRequest, ValidatedRequest } from '../middleware/validateRequest';
import { generateDocumentsBodySchema, finalizeGenerationBodySchema, improveSectionBodySchema } from '../validations/generatorSchemas';
import { jobIdParamSchema, filenameParamSchema } from '../validations/commonSchemas';
import { improveCvSection } from '../controllers/generatorController';
import { asyncHandler } from '../utils/asyncHandler';

const router: Router = express.Router();
router.use(authMiddleware as RequestHandler); // Apply auth to all routes in this file

// --- Interfaces ---
interface AiGenerationOutput { tailoredCvJson: JsonResumeSchema; coverLetterText: string; }
interface IntermediateData {
    tailoredCvJson: JsonResumeSchema; coverLetterTemplate: string;
    language: 'en' | 'de';
    jobId: string; userId: string;
}
interface UserInputData { [key: string]: string; }
// For required inputs with type info
interface RequiredInputInfo { name: string; type: 'text' | 'number' | 'date' | 'textarea'; }
// Update GeneratePendingResponse to use modified IntermediateData
interface GeneratePendingResponse { status: "pending_input"; message: string; requiredInputs: RequiredInputInfo[]; intermediateData: IntermediateData; }
interface GenerateDraftReadyResponse { status: "draft_ready"; message: string; jobId: string; } // New response type
// Union type for initial generation attempt
type GenerateInitialOrPendingResponse = GeneratePendingResponse | GenerateDraftReadyResponse;


// --- Helper Functions ---

// Parse Gemini response (expecting CV + Cover Letter JSON object)
function parseGenerationResponse(responseText: string): AiGenerationOutput | null {
    // --- FIX: More robust handling of ```json block ---
    const prefix = "```json";
    const suffix = "```";
    let jsonStringToParse = responseText; // Start with the raw response

    // Remove potential leading/trailing whitespace *before* checking prefix/suffix
    jsonStringToParse = jsonStringToParse.trim();

    if (jsonStringToParse.startsWith(prefix) && jsonStringToParse.endsWith(suffix)) {
        console.log("Found ```json prefix and ``` suffix. Extracting content.");
        // Slice from after the prefix to before the suffix, then trim again for internal whitespace
        jsonStringToParse = jsonStringToParse.substring(prefix.length, jsonStringToParse.length - suffix.length).trim();
    } else if (jsonStringToParse.startsWith(prefix)) {
        // Handle case where suffix might be missing or malformed, try removing prefix only
        console.warn("Found ```json prefix but not the expected ``` suffix. Attempting to parse after prefix.");
        jsonStringToParse = jsonStringToParse.substring(prefix.length).trim();
    } else {
        // If no ```json prefix is found, the response is likely not formatted as expected.
        console.warn("Gemini response did not appear to be wrapped in ```json block. Attempting to parse as is, but this may fail.");
        // Keep jsonStringToParse as the trimmed raw response
    }
    // --- End FIX ---

    // Now attempt to parse the potentially cleaned string
    console.log("Attempting to parse potentially extracted JSON content (CV+CL)...");
    try {
        const parsedObject = JSON.parse(jsonStringToParse); // Parse the potentially extracted string

        // Validate the structure of the parsed object
        if (parsedObject && typeof parsedObject.tailoredCvJson === 'object' && parsedObject.tailoredCvJson !== null && typeof parsedObject.coverLetterText === 'string') {
            if (!parsedObject.tailoredCvJson.basics) console.warn("Parsed tailoredCvJson missing basics, potential schema deviation.");
            console.log("Successfully parsed generation response structure.");
            return parsedObject as AiGenerationOutput;
        } else {
            // Log the object that failed validation
            console.error("Parsed object structure is invalid. Expected { tailoredCvJson: object, coverLetterText: string }, Received:", parsedObject);
            throw new Error("AI response missing expected structure or types (tailoredCvJson object, coverLetterText string).");
        }
    } catch (parseError: any) {
        console.error("JSON.parse failed:", parseError.message);
        // Log the string that failed to parse
        console.error("Content attempted to parse:", jsonStringToParse);
        // Distinguish between JSON syntax error and structure error
        if (parseError instanceof SyntaxError) {
            throw new Error(`AI response was not valid JSON: ${parseError.message}`);
        } else {
            throw new Error(`Error processing AI response: ${parseError.message}`); // General error
        }
        // No need to return null here as errors are thrown, preventing further execution in the try block.
    }
    // This return is unreachable because the try/catch block either returns successfully or throws an error.
    // return null; // Remove unreachable code
}

// Infer input type for placeholder modal
function inferInputType(placeholderName: string): RequiredInputInfo['type'] {
    const lowerName = placeholderName.toLowerCase();
    if (lowerName.includes('salary') || lowerName.includes('amount') || lowerName.includes('number') || lowerName.includes('gehalt')) return 'number';
    if (lowerName.includes('date') || lowerName.includes('datum') || lowerName.includes('start')) return 'date';
    if (lowerName.includes('description') || lowerName.includes('reason') || lowerName.includes('details') || lowerName.includes('notes')) return 'textarea';
    return 'text';
}

// Define an interface for the expected user object structure
interface AuthenticatedUser {
    _id: mongoose.Types.ObjectId | string;
}


// ---  POST /api/generator/:jobId ---
// This endpoint now generates DRAFTS or returns pending_input
const generateDocumentsHandler: RequestHandler = async (req: ValidatedRequest, res) => {
    // Use type assertion for req.user
    const user = req.user as AuthenticatedUser;
    if (!user) { res.status(401).json({ message: 'User not authenticated correctly.' }); return; }

    const { jobId } = req.validated!.params!;
    const requestedLanguage = req.validated!.body?.language === 'de' ? 'de' : 'en';
    const languageName = requestedLanguage === 'de' ? 'German' : 'English';
    const userId = user._id.toString(); // Now TS knows _id exists

    try {
        // 1. Fetch Job & User data
        const job = await JobApplication.findOne({ _id: jobId, userId: userId });
        if (!job) { res.status(404).json({ message: 'Job application not found or access denied.' }); return; }
        if (!job.jobDescriptionText) { res.status(400).json({ message: 'Job description text is missing.' }); return; }
        const currentUser = await User.findById(userId);
        if (!currentUser) { res.status(404).json({ message: "User not found." }); return; }

        // Fetch Base CV from Unified CV Model
        let baseCvJson: JsonResumeSchema | null = null;
        const masterCv = await CV.findOne({ userId, isMasterCv: true });

        if (masterCv && masterCv.cvJson) {
            baseCvJson = masterCv.cvJson;
            console.log("Using Master CV from Unified CV Model.");
        }

        if (!baseCvJson?.basics) { res.status(400).json({ message: 'Valid base CV with basics section not found in user profile.' }); return; }
        // No theme determination needed

        // 2. Construct **IMPROVED** Gemini Prompt
        //    Explicitly tell AI to use basics data for CL header
        const todayDateFormatted = new Date().toLocaleDateString(requestedLanguage === 'de' ? 'de-DE' : 'en-CA'); // YYYY-MM-DD format for en-CA
        const prompt = `
            You are an expert career advisor and document writer specialized in the ${languageName} job market.
            Your task is to tailor a provided base CV (in JSON Resume format) and write a compelling cover letter for a specific job application, ensuring the output is in ${languageName} and strictly adheres to the JSON Resume Schema.

            **Target Language:** ${languageName} (${requestedLanguage})

            **Inputs:**
            1.  **Base CV Data (JSON Resume Schema):**
                \`\`\`json
                ${JSON.stringify(baseCvJson, null, 2)}
                \`\`\`
            2.  **Target Job Description (Text):**
                ---
                ${job.jobDescriptionText}
                ---

            **Instructions:**

            A.  **Tailor the CV (in ${languageName}, STRICT JSON Resume Schema):**
                *   Analyze the Base CV Data and the Target Job Description.
                *   Identify relevant skills, experiences, and qualifications from the Base CV that match the job requirements.
                *   **MANDATORY: INCLUDE ALL PROJECTS.** You MUST include EVERY single project from the Base CV's "projects" section in the output. Do NOT filter, select, or omit ANY projects, even if they seem less relevant. The user requires the full project list. Tailor the *descriptions* of the projects to the job, but do NOT remove the projects themselves. If the input has 20 projects, the output MUST have 20 projects.
                *   Rewrite/rephrase content (summaries, work descriptions, project details) to emphasize relevance IN ${languageName}, using keywords from the job description where appropriate.
                *   STRICT RULE - NO FABRICATION: You must ONLY use information that exists in the Base CV. Do NOT invent, add, or fabricate any skills, experiences, projects, certifications, or qualifications that are not explicitly present in the original CV data. If a skill from the job description is not in the CV, do NOT add it.
                *   Maintain factual integrity; do not invent skills or experiences. Every piece of information in the output must be traceable back to the Base CV.
                *   SIZE CONSTRAINT: The tailored CV should be detailed. Do not summarize so much that key details are lost.
                *   Optimize the order of items within sections (e.g., work experience) to highlight the most relevant roles first, but keep the less relevant ones further down rather than deleting them.
                *   CRITICAL OUTPUT STRUCTURE: The output for the CV MUST be a complete JSON object strictly adhering to the JSON Resume Schema (https://jsonresume.org/schema/). Include standard sections like \`basics\`, \`work\`, \`education\`, \`skills\`, etc., as applicable based on the input CV.
                *   Specific Key Mapping: Use standard JSON Resume keys like \`basics\`, \`work\`, \`volunteer\`, \`education\`, \`awards\`, \`certificates\`, \`publications\`, \`skills\`, \`languages\`, \`interests\`, \`references\`, \`projects\`. DO NOT use non-standard keys like 'personalInfo' or 'experience'.
                *   **IMPORTANT:** Ensure the \`basics.summary\` field is populated with a strong, tailored professional summary based on the candidate's profile and the job description. Do not leave this field empty.
                *   **IMPORTANT:** Do NOT mention the specific name of the company you are applying to anywhere in the generated CV (e.g. in the summary, objective, or descriptions). Focus on the role and skills, but keep the document company-agnostic.
                *   All textual content within the JSON object (names, summaries, descriptions, etc.) MUST be in ${languageName}.
                *   SECTION LABELS TRANSLATION: Include a \`meta.sectionLabels\` object in the output JSON with translated section names in ${languageName}. This object should map English section keys to their ${languageName} translations. For example, for German: {"summary": "Zusammenfassung", "work": "Berufserfahrung", "education": "Ausbildung", "skills": "Fähigkeiten & Technologien", "languages": "Sprachen", "projects": "Projekte", "certificates": "Zertifikate", "awards": "Auszeichnungen", "volunteer": "Ehrenamt", "interests": "Interessen", "references": "Referenzen"}.

            B.  **Write the Cover Letter (in ${languageName}):**
                *   **CRITICAL:** Start the cover letter text *immediately* with the sender's contact information block. Extract the following details *directly* from the \`basics\` section of the provided Base CV Data JSON:
                    *   \`basics.name\`
                    *   \`basics.location.address\` (if available, include street address on its own line)
                    *   \`basics.location.city\`, \`basics.location.postalCode\` (combine on one line, e.g., "Berlin, 10117" or "12345 Example City")
                    *   \`basics.phone\` (if available, label appropriately, e.g., "Phone: +49 123 456789")
                    *   \`basics.email\` (if available, label appropriately, e.g., "Email: your.email@example.com")
                    *   Format these details cleanly as a standard sender address block at the very top of the letter text, with each piece of information on a new line where appropriate.
                *   **CRITICAL:** After the sender's address block, include today's date automatically on its own line: ${todayDateFormatted}
                *   Generate a concise, professional cover letter body (approximately 3-4 paragraphs) IN ${languageName}.
                *   Address it appropriately (e.g., "Dear Hiring Manager," / "Sehr geehrte Damen und Herren," unless a specific contact person can be reliably extracted from the job description).
                *   Introduce the applicant and clearly state the role they are applying for: "${job.jobTitle}" at "${job.companyName}".
                *   Highlight 2-3 key qualifications or experiences from the tailored CV that directly match the most important requirements in the job description. Briefly explain *why* these qualifications make the applicant a strong fit.
                *   Express genuine enthusiasm for the specific role and company.
                *   **Placeholders:** ONLY if essential information like salary expectation or the earliest possible start date is explicitly requested in the job description OR is standard practice for applications in this field/region AND CANNOT be inferred from the CV or Job Description, insert a placeholder like "[[ASK_USER:Salary Expectation]]" or "[[ASK_USER:Earliest Start Date]]". DO NOT use placeholders for name, address, date, phone, email, or information already present in the CV. Use placeholders sparingly.
                *   Conclude professionally with a call to action (e.g., expressing eagerness for an interview) and a standard closing (e.g., "Sincerely," / "Mit freundlichen Grüßen,").
                *   The entire cover letter, including the header, date, body, and closing, must be a single string of text IN ${languageName}.

            **Output Format:**
            Return ONLY a single JSON object enclosed in triple backticks (\`\`\`json ... \`\`\`). This JSON object MUST contain exactly two top-level keys:
            1.  \`tailoredCvJson\`: The complete, tailored CV data as a valid JSON Resume Schema object (in ${languageName}).
            2.  \`coverLetterText\`: The complete cover letter as a single string (in ${languageName}, starting with sender details and date, potentially containing ASK_USER placeholders ONLY for non-extractable essential info like salary/start date).

            Example JSON output structure:
            \`\`\`json
            {
              "tailoredCvJson": {
                "basics": { ... },
                "work": [ ... ],
                // ... other JSON Resume sections ...
              },
              "coverLetterText": "John Doe\\n123 Main St\\nAnytown, 12345\\nPhone: 555-1234\\nEmail: john.doe@email.com\\n\\n${todayDateFormatted}\\n\\nDear Hiring Manager,\\n\\nI am writing to express my interest...\\n\\n...body paragraphs...\\n\\n[[ASK_USER:Salary Expectation]]\\n\\nSincerely,\\nJohn Doe"
            }
            \`\`\`
        `;

        // 3. Generate documents using AI service
        console.log(`Generating ${languageName} draft documents for job ${jobId}...`);
        // Set generation status to pending immediately
        await JobApplication.updateOne({ _id: jobId, userId: userId }, { $set: { generationStatus: 'pending_generation' } }); // Indicate processing started

        const result = await generateContent(userId, prompt);
        const responseText = result.text;
        console.log("Received generation response from AI.");

        // 4. Parse and Validate Gemini Response (using parseGenerationResponse)
        // This function ALREADY handles extracting from ```json block
        const generatedData = parseGenerationResponse(responseText);
        if (!generatedData) {
            // This error is thrown if parseGenerationResponse returned null (meaning no ```json block was found)
            // or if it threw an error during parsing.
            console.error("Failed to parse Gemini response using parseGenerationResponse. Raw response:", responseText);
            throw new Error("AI failed to return data in the expected JSON structure within ```json block.");
        }
        const { tailoredCvJson, coverLetterText } = generatedData;

        // Log parsed data (optional, for debugging)
        console.log("--- Parsed CV JSON (for draft) ---");
        // console.log(JSON.stringify(tailoredCvJson, null, 2)); // Keep commented out for cleaner logs unless debugging
        console.log("--- Parsed Cover Letter Text (for draft) ---");
        // console.log(coverLetterText); // Keep commented out for cleaner logs unless debugging
        console.log("------------------------------------------");

        // Basic validation of parsed CV structure
        if (!tailoredCvJson || typeof tailoredCvJson !== 'object' || !tailoredCvJson.basics) {
            console.error("Parsed CV JSON is invalid or missing basic structure. Parsed object:", tailoredCvJson);
            throw new Error("Parsed CV JSON from AI response is invalid or missing the 'basics' section.");
        }


        // 5. Check for Placeholders in Cover Letter
        const placeholderRegex = /\[\[ASK_USER:([^\]]+)\]\]/g;
        // Use a Set to get unique placeholder names
        const placeholderNames = new Set<string>();
        let match;
        while ((match = placeholderRegex.exec(coverLetterText)) !== null) {
            placeholderNames.add(match[1].trim());
        }
        const uniquePlaceholders = Array.from(placeholderNames);

        const requiredInputs: RequiredInputInfo[] = uniquePlaceholders.map(name => ({ name: name, type: inferInputType(name) }));

        if (requiredInputs.length > 0) {
            // --- Handle Pending Input ---
            console.log(`Placeholders found for job ${jobId}.`, uniquePlaceholders);
            const pendingResponse: GeneratePendingResponse = {
                status: "pending_input",
                message: "AI requires additional information to finalize the draft.",
                requiredInputs: requiredInputs,
                // Pass the parsed CV and the cover letter *template*
                intermediateData: { tailoredCvJson, coverLetterTemplate: coverLetterText, language: requestedLanguage, jobId, userId } // Removed theme/prefixes
            };
            // Update job status to pending_input, DO NOT save drafts yet
            await JobApplication.updateOne({ _id: jobId, userId: userId }, { $set: { generationStatus: 'pending_input' } });
            console.log(`Job ${jobId} status set to pending_input.`);
            res.status(202).json(pendingResponse); // 202 Accepted
            return;
        }

        // --- 6. NO Placeholders Found: Save Draft Directly ---
        console.log(`No placeholders found for job ${jobId}. Saving generated draft...`);
        const updateResult = await JobApplication.findOneAndUpdate(
            { _id: jobId, userId: userId },
            {
                $set: {
                    // draftCvJson: tailoredCvJson, // REMOVED: Now stored in CV model
                    draftCoverLetterText: coverLetterText,
                    language: requestedLanguage, // Store language used for draft
                    generationStatus: 'draft_ready' // Set status to draft_ready
                }
            },
            { new: true } // Return updated document
        );

        if (!updateResult) {
            throw new Error("Failed to find and update job application with draft data.");
        }

        // Save CV to Unified CV Model
        let jobCv = await CV.findOne({ jobApplicationId: jobId, userId: userId });
        if (jobCv) {
            jobCv.cvJson = tailoredCvJson;
            await jobCv.save();
        } else {
            // Create new Job CV
            // Get job info for display name
            const job = await JobApplication.findById(jobId).select('jobTitle companyName');
            const jobDisplayName = job 
                ? `Tailored CV - ${job.jobTitle} at ${job.companyName}`
                : 'Tailored CV';
            
            await CV.create({
                userId: userId,
                jobApplicationId: jobId,
                isMasterCv: false,
                isPrimary: false,
                displayName: jobDisplayName,
                cvJson: tailoredCvJson,
                // Inherit template from master if possible, or default?
                // For now, let's leave templateId undefined (will use default)
            });
        }

        console.log(`Draft saved successfully for job ${jobId}. Status set to draft_ready. CV saved to unified model.`);
        console.log(`Draft saved successfully for job ${jobId}. Status set to draft_ready.`);

        // --- 7. Send Success Response (Draft Ready) ---
        const draftReadyResponse: GenerateDraftReadyResponse = {
            status: "draft_ready",
            message: `Draft CV and cover letter generated successfully in ${languageName}. Ready for review.`,
            jobId: jobId
        };
        res.status(200).json(draftReadyResponse); // 200 OK

    } catch (error: any) {
        console.error(`Error in initial generation for job ${jobId}:`, error);
        // Ensure userId is available for error logging/updating status
        const currentUserId = (req.user as AuthenticatedUser)?._id?.toString();
        if (currentUserId) {
            try {
                // Update status to 'error' only if it's not already 'draft_ready' (e.g., if error happened after saving draft)
                await JobApplication.updateOne(
                    { _id: jobId, userId: currentUserId, generationStatus: { $ne: 'draft_ready' } },
                    { $set: { generationStatus: 'error' } }
                );
            } catch (updateError) {
                console.error(`Failed to update job status to error for job ${jobId}`, updateError);
            }
        }
        // Detailed error response logic
        let statusCode = 500;
        let errorMessage = 'Failed to generate draft documents.';

        if (error instanceof GoogleGenerativeAIError) {
            errorMessage = `Gemini API Error: ${error.message}`;
            // Potentially map specific Gemini errors to different status codes if needed
        } else if (error.message.includes("AI failed to return data") || error.message.includes("AI response did not contain") || error.message.includes("expected JSON structure")) {
            errorMessage = `AI response format error: ${error.message}`;
            statusCode = 502; // Bad Gateway - upstream error
        } else if (error.message.includes("Parsed CV JSON from AI response is invalid")) {
            errorMessage = `AI response content error: ${error.message}`;
            statusCode = 502;
        } else if (error.message.includes("Failed to find and update")) {
            errorMessage = "Internal error: Could not save draft data.";
            statusCode = 500;
        } else {
            errorMessage = error.message || 'Unknown server error';
        }

        res.status(statusCode).json({ message: errorMessage, error: error.message }); // Provide error details
    }
};


// --- Finalize Endpoint (Needs update to NOT expect theme/prefixes in intermediateData) ---
const finalizeGenerationHandler: RequestHandler = async (req: ValidatedRequest, res) => {
    console.log("--- Finalize Endpoint Hit ---");
    // Use type assertion for req.user
    const user = req.user as AuthenticatedUser;
    if (!user) { res.status(401).json({ message: 'User not authenticated correctly.' }); return; }

    // Adjust expected IntermediateData type (Omit theme, prefixes)
    // Ensure intermediateData type matches the updated definition (no theme)
    const { intermediateData, userInputData } = req.validated!.body!;

    // Validate user ID match
    if (intermediateData.userId !== user._id.toString()) {
        console.error("Finalize Error: User mismatch.", { intermediateUserId: intermediateData.userId, reqUserId: user._id.toString() });
        res.status(400).json({ message: 'Invalid or incomplete intermediate data provided, or user mismatch.' }); return;
    }

    const { tailoredCvJson, coverLetterTemplate, language, jobId, userId } = intermediateData; // No theme/prefixes
    // userId from intermediateData should match user._id.toString()

    console.log("User Input Data Received:", userInputData);
    console.log("Finalizing draft for Job ID:", jobId);

    try {
        // Replace Placeholders in Cover Letter Text
        let finalCoverLetterText = coverLetterTemplate;
        const placeholderRegex = /\[\[ASK_USER:([^\]]+)\]\]/g;
        // Use Set to ensure we check each unique placeholder only once for input
        const requiredPlaceholders = new Set<string>();
        let match;
        // *** Check the original template for placeholders ***
        while ((match = placeholderRegex.exec(finalCoverLetterText)) !== null) {
            requiredPlaceholders.add(match[1].trim());
        }

        for (const placeholderKey of requiredPlaceholders) {
            const userValue = userInputData[placeholderKey];
            if (userValue === undefined || userValue === null || String(userValue).trim() === '') { // Check for empty string after trimming
                console.warn(`Missing input for required field: ${placeholderKey} in job ${jobId}`);
                res.status(400).json({ message: `Missing input for required field: ${placeholderKey}` }); return;
            }
            // Escape special regex characters in the placeholder key before creating the RegExp
            const escapedKey = placeholderKey.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const replaceRegex = new RegExp(`\\\[\\\[ASK_USER:${escapedKey}\\]\\\]`, 'g');
            finalCoverLetterText = finalCoverLetterText.replace(replaceRegex, String(userValue).trim()); // Ensure value is string and trimmed
        }

        // Double-check if any placeholders remain after replacement
        placeholderRegex.lastIndex = 0; // Reset regex state before re-testing
        if (placeholderRegex.test(finalCoverLetterText)) {
            console.error(`Failed to replace all placeholders for job ${jobId}. Remaining text snippet: ${finalCoverLetterText.substring(0, 100)}`);
            throw new Error("Internal error: Failed to replace all placeholders.");
        }
        console.log("Placeholders replaced successfully for finalize.");


        // Save the finalized drafts and update status (NO PDF generation here anymore)
        const updateResult = await JobApplication.findOneAndUpdate(
            { _id: jobId, userId: user._id.toString() }, // Use authenticated user ID for filter
            {
                $set: {
                    // draftCvJson: tailoredCvJson, // REMOVED: Now stored in CV model
                    // Save the cover letter *after* replacing placeholders
                    draftCoverLetterText: finalCoverLetterText,
                    language: language, // Ensure language is saved/updated
                    generationStatus: 'draft_ready' // Mark as ready for review/rendering
                }
            },
            { new: true } // Return the updated document
        );
        if (!updateResult) {
            // This could happen if the job was deleted between steps, or if userId somehow mismatched
            console.error(`Failed to find and update job application ${jobId} during finalization.`);
            throw new Error("Failed to update job application with finalized draft data. Job may no longer exist.");
        }

        // Save CV to Unified CV Model
        let jobCv = await CV.findOne({ jobApplicationId: jobId, userId: user._id.toString() });
        if (jobCv) {
            jobCv.cvJson = tailoredCvJson;
            await jobCv.save();
        } else {
            // Create new Job CV
            // Get job info for display name
            const job = await JobApplication.findById(jobId).select('jobTitle companyName');
            const jobDisplayName = job 
                ? `Tailored CV - ${job.jobTitle} at ${job.companyName}`
                : 'Tailored CV';
            
            await CV.create({
                userId: user._id.toString(),
                jobApplicationId: jobId,
                isMasterCv: false,
                isPrimary: false,
                displayName: jobDisplayName,
                cvJson: tailoredCvJson,
            });
        }

        console.log(`Finalized draft saved successfully for job ${jobId}. Status set to draft_ready.`);

        // Respond indicating draft is ready
        const draftReadyResponse: GenerateDraftReadyResponse = { status: "draft_ready", message: "Draft finalized successfully. Ready for review.", jobId: jobId };
        res.status(200).json(draftReadyResponse);

    } catch (error: any) {
        console.error(`Error finalizing draft for job ${jobId}:`, error);
        // Attempt to update status to error, but don't overwrite if it's already draft_ready
        const currentUserId = (req.user as AuthenticatedUser)?._id?.toString();
        if (currentUserId) {
            try {
                await JobApplication.updateOne(
                    { _id: jobId, userId: currentUserId, generationStatus: { $ne: 'draft_ready' } },
                    { $set: { generationStatus: 'error' } }
                );
            } catch (updateError) {
                console.error(`Failed to update job status to error during finalization for job ${jobId}`, updateError);
            }
        }

        // Now define status code and message for the final response
        let statusCode = 500;
        let errorMessage = 'Failed to finalize draft.';
        if (error instanceof Error) { // Check if it's an Error object
            if (error.message.includes("Missing input")) {
                statusCode = 400;
                errorMessage = error.message;
            } else if (error.message.includes("Failed to update job application")) {
                statusCode = 404; // Or 500, depending on expected cause
                errorMessage = error.message;
            } else if (error.message.includes("Failed to replace all placeholders")) {
                statusCode = 500; // Internal server error
                errorMessage = error.message;
            } else {
                errorMessage = error.message || 'Unknown server error during finalization';
            }
        } else {
            errorMessage = 'An unexpected error occurred during finalization.';
        }

        res.status(statusCode).json({ message: errorMessage, error: error instanceof Error ? error.message : String(error) });
    }
};


// --- NEW: Render Final PDFs Endpoint ---
const renderFinalPdfsHandler: RequestHandler = async (req: ValidatedRequest, res): Promise<void> => {
    console.log("--- Render Final PDFs Endpoint Hit ---");
    const user = req.user as IUser;
    if (!user || !user._id) {
        res.status(401).json({ message: 'Authentication required.' });
        return;
    }
    const userId = user._id;
    const { jobId } = req.validated!.params!;
    const TEMP_PDF_DIR = path.join(__dirname, '..', '..', 'temp_pdfs'); // Define PDF directory path

    try {
        // 1. Fetch Saved Draft/Finalized Job
        const job = await JobApplication.findOne({ _id: jobId, userId: userId });

        // 2. Validate Job and Draft Data
        if (!job) {
            res.status(404).json({ message: 'Job application not found or access denied.' });
            return;
        }
        if (job.generationStatus !== 'draft_ready' && job.generationStatus !== 'finalized') {
            res.status(400).json({ message: 'Draft documents must be ready or previously finalized before rendering.', currentStatus: job.generationStatus });
            return;
        }

        // Fetch CV from unified model
        const jobCv = await CV.findOne({ jobApplicationId: jobId, userId: userId });

        let cvJsonData: JsonResumeSchema | null = null;
        if (jobCv && jobCv.cvJson) {
            cvJsonData = jobCv.cvJson;
        } else if (job.draftCvJson && typeof job.draftCvJson === 'object' && Object.keys(job.draftCvJson).length > 0) {
            // Fallback to legacy field
            cvJsonData = job.draftCvJson as JsonResumeSchema;
        }

        if (!cvJsonData || Object.keys(cvJsonData).length === 0) {
            res.status(400).json({ message: 'Missing or invalid draft CV data.' });
            return;
        }

        if (!job.draftCoverLetterText || typeof job.draftCoverLetterText !== 'string') {
            res.status(400).json({ message: 'Missing or invalid draft cover letter text.' });
            return;
        }
        if (!job.language || (job.language !== 'en' && job.language !== 'de')) {
            console.warn(`Job ${jobId} missing valid language for PDF naming. Defaulting to 'en'.`);
            // Optionally update the job document here if language is missing
            // await JobApplication.updateOne({ _id: jobId, userId: userId }, { $set: { language: 'en' } });
            // job.language = 'en'; // Update local copy too
            // For now, we'll just use 'en' if missing, but ideally it should be set during draft finalization
        }
        const language = (job.language === 'en' || job.language === 'de') ? job.language : 'en'; // Ensure language is 'en' or 'de'

        // --- MODIFICATION START: Delete Old PDFs Before Generating New Ones ---
        const oldCvFilename = job.generatedCvFilename;
        const oldClFilename = job.generatedCoverLetterFilename;

        if (oldCvFilename) {
            const oldCvPath = path.join(TEMP_PDF_DIR, path.basename(oldCvFilename)); // Sanitize filename
            try {
                await fs.promises.unlink(oldCvPath);
                console.log(`Deleted old CV PDF: ${oldCvPath}`);
            } catch (err: any) {
                // Log error but continue - maybe file was already deleted manually
                if (err.code !== 'ENOENT') { // ENOENT = file not found, which is okay here
                    console.warn(`Could not delete old CV PDF ${oldCvPath}: ${err.message}`);
                } else {
                    console.log(`Old CV PDF ${oldCvPath} not found, skipping deletion.`);
                }
            }
        }
        if (oldClFilename) {
            const oldClPath = path.join(TEMP_PDF_DIR, path.basename(oldClFilename)); // Sanitize filename
            try {
                await fs.promises.unlink(oldClPath);
                console.log(`Deleted old Cover Letter PDF: ${oldClPath}`);
            } catch (err: any) {
                if (err.code !== 'ENOENT') {
                    console.warn(`Could not delete old Cover Letter PDF ${oldClPath}: ${err.message}`);
                } else {
                    console.log(`Old Cover Letter PDF ${oldClPath} not found, skipping deletion.`);
                }
            }
        }
        // --- MODIFICATION END ---

        // 3. Prepare Filenames for New PDFs
        const sanitize = (str: string) => str?.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_') || 'Unknown';
        // cvJsonData is already set above
        // const applicantName = sanitize(cvJsonData?.basics?.name || 'Applicant'); // Removed from filename
        const companySanitized = sanitize(job.companyName);
        // const titleSanitized = sanitize(job.jobTitle); // Removed from filename
        // const baseFilename = `${applicantName}_${companySanitized}_${titleSanitized}`; // Simplified

        const langSuffix = language.toUpperCase();
        const cvFilenamePrefix = `CV_${companySanitized}_${langSuffix}`;
        const clFilenamePrefix = (language === 'de') ? `Anschreiben_${companySanitized}` : `Cover_Letter_${companySanitized}`;

        // 4. Call PDF Generators
        console.log(`Generating final CV PDF for job ${jobId}...`);
        const generatedCvFilename = await generateCvPdfFromJsonResume(
            cvJsonData,
            `${cvFilenamePrefix}_${language}`
        );

        console.log(`Generating final Cover Letter PDF for job ${jobId}...`);
        const generatedClFilename = await generateCoverLetterPdf(
            job.draftCoverLetterText!, // Add non-null assertion as it was validated
            cvJsonData,
            `${clFilenamePrefix}_${language}`
        );

        // 5. Update Job Status and Store NEW Filenames
        await JobApplication.updateOne({ _id: jobId, userId: userId }, {
            $set: {
                generationStatus: 'finalized',
                generatedCvFilename: generatedCvFilename, // Store new CV filename
                generatedCoverLetterFilename: generatedClFilename, // Store new CL filename
            }
        });
        console.log(`Job ${jobId} status updated to 'finalized' and latest filenames stored.`);

        // 6. Return Success
        res.status(200).json({
            status: "success",
            message: "Final CV and Cover Letter PDFs generated successfully.",
            cvFilename: generatedCvFilename,
            coverLetterFilename: generatedClFilename
        });
        return;

    } catch (error: any) {
        // 7. Error Handling
        console.error(`Error rendering final PDFs for job ${jobId}:`, error);
        // Use a non-blocking call for the error status update
        JobApplication.updateOne({ _id: jobId, userId: userId }, { $set: { generationStatus: 'error' } })
            .catch(err => console.error("Failed to update job status to error:", err));

        res.status(500).json({ message: `Failed to render final PDFs: ${error.message || 'Internal server error'}` });
        return;
    }
};


// --- Download Endpoint (Keep as is - still needed AFTER final rendering step) ---
const downloadFileHandler: RequestHandler = async (req: ValidatedRequest, res) => {
    if (!req.user) { res.status(401).json({ message: 'Authentication required to download.' }); return; }
    const { filename } = req.validated!.params!;
    const safeFilename = path.basename(filename);
    const TEMP_PDF_DIR = path.join(__dirname, '..', '..', 'temp_pdfs');
    const filePath = path.join(TEMP_PDF_DIR, safeFilename);

    try {
        await fs.promises.access(filePath);
        console.log(`Serving file for download: ${filePath}`);
        // Create a user-friendly filename by removing the timestamp (e.g. "_1766957547866")
        // Logic: Replace the last underscore followed by digits and extension with just the extension
        let downloadFilename = safeFilename;
        const timestampRegex = /_\d+\.pdf$/;
        if (timestampRegex.test(safeFilename)) {
            downloadFilename = safeFilename.replace(timestampRegex, '.pdf');
        }

        res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
        res.setHeader('Content-Type', 'application/pdf');
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);

        fileStream.on('close', () => {
            console.log(`Finished streaming ${filePath}. File remains in temp directory.`);
        });

        fileStream.on('error', (e: NodeJS.ErrnoException) => {
            console.error(`Stream error ${filePath}`, e);
            if (!res.headersSent) {
                res.status(500).json({ message: 'Error streaming file.' });
            } else {
                res.end();
            }
        });
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') { res.status(404).json({ message: 'File not found or already deleted.' }); return; }
        console.error(`Download prep error ${filePath}`, error);
        res.status(500).json({ message: 'Server error preparing download.' });
    }
};

// --- Render CV PDF Only Endpoint ---
const renderCvPdfHandler: RequestHandler = async (req: ValidatedRequest, res): Promise<void> => {
    const user = req.user as IUser;
    if (!user || !user._id) {
        res.status(401).json({ message: 'Authentication required.' });
        return;
    }
    const userId = user._id;
    const { jobId } = req.validated!.params!;
    const TEMP_PDF_DIR = path.join(__dirname, '..', '..', 'temp_pdfs');

    try {
        const job = await JobApplication.findOne({ _id: jobId, userId: userId });
        if (!job) {
            res.status(404).json({ message: 'Job application not found or access denied.' });
            return;
        }

        // Fetch CV from unified model
        const jobCv = await CV.findOne({ jobApplicationId: jobId, userId: userId });

        // Use CV logic:
        let cvJsonData: JsonResumeSchema | null = null;
        if (jobCv && jobCv.cvJson) {
            cvJsonData = jobCv.cvJson;
        } else if (job.draftCvJson && typeof job.draftCvJson === 'object' && Object.keys(job.draftCvJson).length > 0) {
            // Fallback to legacy field
            cvJsonData = job.draftCvJson as JsonResumeSchema;
        }

        if (!cvJsonData || Object.keys(cvJsonData).length === 0) {
            res.status(400).json({ message: 'Missing or invalid draft CV data.' });
            return;
        }

        const language = (job.language === 'en' || job.language === 'de') ? job.language : 'en';

        // Delete old CV PDF if exists
        if (job.generatedCvFilename) {
            const oldCvPath = path.join(TEMP_PDF_DIR, path.basename(job.generatedCvFilename));
            try {
                await fs.promises.unlink(oldCvPath);
                console.log(`Deleted old CV PDF: ${oldCvPath}`);
            } catch (err: any) {
                if (err.code !== 'ENOENT') {
                    console.warn(`Could not delete old CV PDF ${oldCvPath}: ${err.message}`);
                }
            }
        }

        // Generate new CV PDF
        const sanitize = (str: string) => str?.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_') || 'Unknown';
        // cvJsonData is already set output
        // const applicantName = sanitize(cvJsonData?.basics?.name || 'Applicant');
        const companySanitized = sanitize(job.companyName);
        // const titleSanitized = sanitize(job.jobTitle);
        const langSuffix = language.toUpperCase();
        const cvFilenamePrefix = `CV_${companySanitized}_${langSuffix}`;

        const generatedCvFilename = await generateCvPdfFromJsonResume(cvJsonData, cvFilenamePrefix);

        // Update job with new CV filename
        await JobApplication.updateOne({ _id: jobId, userId: userId }, {
            $set: {
                generatedCvFilename: generatedCvFilename,
                generationStatus: 'finalized'
            }
        });

        res.status(200).json({
            status: "success",
            message: "CV PDF generated successfully.",
            cvFilename: generatedCvFilename
        });
    } catch (error: any) {
        console.error(`Error rendering CV PDF for job ${jobId}:`, error);
        JobApplication.updateOne({ _id: jobId, userId: userId }, { $set: { generationStatus: 'error' } })
            .catch(err => console.error("Failed to update job status to error:", err));
        res.status(500).json({ message: `Failed to render CV PDF: ${error.message || 'Internal server error'}` });
    }
};

// --- Render Cover Letter PDF Only Endpoint ---
const renderCoverLetterPdfHandler: RequestHandler = async (req: ValidatedRequest, res): Promise<void> => {
    const user = req.user as IUser;
    if (!user || !user._id) {
        res.status(401).json({ message: 'Authentication required.' });
        return;
    }
    const userId = user._id;
    const { jobId } = req.validated!.params!;
    const TEMP_PDF_DIR = path.join(__dirname, '..', '..', 'temp_pdfs');

    try {
        const job = await JobApplication.findOne({ _id: jobId, userId: userId });
        if (!job) {
            res.status(404).json({ message: 'Job application not found or access denied.' });
            return;
        }
        if (!job.draftCoverLetterText || typeof job.draftCoverLetterText !== 'string') {
            res.status(400).json({ message: 'Missing or invalid draft cover letter text.' });
            return;
        }
        const language = (job.language === 'en' || job.language === 'de') ? job.language : 'en';

        // Fetch CV from unified model for header data
        const jobCv = await CV.findOne({ jobApplicationId: jobId, userId: userId });

        let cvJsonData: JsonResumeSchema | null = null;
        if (jobCv && jobCv.cvJson) {
            cvJsonData = jobCv.cvJson;
        } else if (job.draftCvJson && typeof job.draftCvJson === 'object' && Object.keys(job.draftCvJson).length > 0) {
            // Fallback to legacy field
            cvJsonData = job.draftCvJson as JsonResumeSchema;
        }

        // If no CV data, use empty object (cover letter might not need much from CV except header)
        // But generateCoverLetterPdf expects it.
        if (!cvJsonData) cvJsonData = {} as JsonResumeSchema;

        // Delete old Cover Letter PDF if exists
        if (job.generatedCoverLetterFilename) {
            const oldClPath = path.join(TEMP_PDF_DIR, path.basename(job.generatedCoverLetterFilename));
            try {
                await fs.promises.unlink(oldClPath);
                console.log(`Deleted old Cover Letter PDF: ${oldClPath}`);
            } catch (err: any) {
                if (err.code !== 'ENOENT') {
                    console.warn(`Could not delete old Cover Letter PDF ${oldClPath}: ${err.message}`);
                }
            }
        }

        // Generate new Cover Letter PDF
        const sanitize = (str: string) => str?.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_') || 'Unknown';
        // cvJsonData set above
        // const applicantName = sanitize(cvJsonData?.basics?.name || 'Applicant');
        const companySanitized = sanitize(job.companyName);
        // const titleSanitized = sanitize(job.jobTitle);
        const clFilenamePrefix = (language === 'de') ? `Anschreiben_${companySanitized}` : `Cover_Letter_${companySanitized}`;

        const generatedClFilename = await generateCoverLetterPdf(
            job.draftCoverLetterText,
            cvJsonData || {},
            clFilenamePrefix
        );

        // Update job with new Cover Letter filename
        await JobApplication.updateOne({ _id: jobId, userId: userId }, {
            $set: {
                generatedCoverLetterFilename: generatedClFilename,
                generationStatus: 'finalized'
            }
        });

        res.status(200).json({
            status: "success",
            message: "Cover Letter PDF generated successfully.",
            coverLetterFilename: generatedClFilename
        });
    } catch (error: any) {
        console.error(`Error rendering Cover Letter PDF for job ${jobId}:`, error);
        JobApplication.updateOne({ _id: jobId, userId: userId }, { $set: { generationStatus: 'error' } })
            .catch(err => console.error("Failed to update job status to error:", err));
        res.status(500).json({ message: `Failed to render Cover Letter PDF: ${error.message || 'Internal server error'}` });
    }
};

// --- NEW: Generate CV Only Endpoint ---
const generateCvOnlyHandler: RequestHandler = async (req: ValidatedRequest, res) => {
    const user = req.user as AuthenticatedUser;
    if (!user) { res.status(401).json({ message: 'User not authenticated correctly.' }); return; }

    const { jobId } = req.validated!.params!;
    const requestedLanguage = req.validated!.body?.language === 'de' ? 'de' : 'en';

    // Validate request body
    const requestBody = req.validated!.body as {
        language?: string;
        baseCvData?: any;
        baseCvId?: string;
        jobDescription?: string;
        customInstructions?: string;
        maxOutputTokens?: number;
    };

    const baseCvDataOverride = requestBody?.baseCvData;
    const baseCvId = requestBody?.baseCvId;
    const jobDescriptionOverride = requestBody?.jobDescription;
    const customInstructionsOverride = requestBody?.customInstructions;
    const maxOutputTokens = requestBody?.maxOutputTokens;

    const languageName = requestedLanguage === 'de' ? 'German' : 'English';
    const userId = user._id.toString();

    try {
        // 1. Fetch Job & User data
        const job = await JobApplication.findOne({ _id: jobId, userId: userId });
        if (!job) { res.status(404).json({ message: 'Job application not found or access denied.' }); return; }

        // Update job description if override provided
        if (jobDescriptionOverride) {
            job.jobDescriptionText = jobDescriptionOverride;
            await job.save();
        }

        if (!job.jobDescriptionText) { res.status(400).json({ message: 'Job description text is missing.' }); return; }

        const currentUser = await User.findById(userId);
        if (!currentUser) { res.status(404).json({ message: "User not found." }); return; }

        let baseCvJson: JsonResumeSchema | null = null;
        let usedBaseCvId: string | undefined = undefined;

        if (baseCvDataOverride && typeof baseCvDataOverride === 'object' && baseCvDataOverride.basics) {
            // Only use override if it looks like a CV
            console.log(`Using overridden Base CV data for job ${jobId}`);
            baseCvJson = baseCvDataOverride;
        } else if (baseCvId) {
            // Fetch specific Base CV by ID
            const specificCv = await CV.findOne({ _id: baseCvId, userId });
            if (specificCv && specificCv.cvJson) {
                baseCvJson = specificCv.cvJson;
                usedBaseCvId = specificCv._id.toString();
                console.log(`Using specific Base CV (${baseCvId}) for job ${jobId}`);
            } else {
                console.warn(`Specific Base CV (${baseCvId}) not found, falling back to Master CV.`);
            }
        }

        // Fallback to Master CV if no valid base found yet
        if (!baseCvJson) {
            const masterCv = await CV.findOne({ userId, isMasterCv: true });
            if (masterCv && masterCv.cvJson) {
                baseCvJson = masterCv.cvJson;
                usedBaseCvId = masterCv._id.toString();
                console.log("Using Master CV from Unified CV Model.");
            }
        }

        if (!baseCvJson?.basics) { res.status(400).json({ message: 'Valid base CV with basics section not found in user profile or provided override.' }); return; }

        // Fetch Custom Prompt (if any) or use override
        const profile = await Profile.findOne({ userId: userId });
        let customPrompt = customInstructionsOverride || profile?.customPrompts?.cvPrompt;

        // 2. Construct CV-only Gemini Prompt
        let prompt: string;

        if (customPrompt) {
            // Use custom prompt but inject necessary context variables
            prompt = customPrompt
                .replace('{{language}}', languageName)
                .replace('{{baseCv}}', JSON.stringify(baseCvJson, null, 2))
                .replace('{{jobDescription}}', job.jobDescriptionText);

            // Fallback: If variables aren't used, append context at the end
            if (!customPrompt.includes('{{baseCv}}')) {
                prompt += `\n\n**Context Data:**\nBase CV Data: ${JSON.stringify(baseCvJson, null, 2)}\nJob Description: ${job.jobDescriptionText}\nTarget Language: ${languageName}`;
            }
        } else {
            // Default Prompt with Changes Tracking
            prompt = `
            You are an expert career advisor specialized in the ${languageName} job market.
            Your task is to tailor a provided base CV (in JSON Resume format) for a specific job application and document the changes you made.
            
            **Target Language:** ${languageName} (${requestedLanguage})

            **Inputs:**
            1.  **Base CV Data (JSON Resume Schema):**
                \`\`\`json
                ${JSON.stringify(baseCvJson, null, 2)}
                \`\`\`
            2.  **Target Job Description (Text):**
                ---
                ${job.jobDescriptionText}
                ---

            **Instructions:**
            *   Analyze the Base CV Data and the Target Job Description.
            *   Identify relevant skills, experiences, and qualifications from the Base CV that match the job requirements.
            *   **MANDATORY: INCLUDE ALL PROJECTS.** You MUST include EVERY single project from the Base CV's "projects" section in the output. Do NOT filter, select, summarize, or omit ANY projects. The user needs their FULL project history. If the Base CV has 20 projects, the customized CV MUST have 20 projects.
            *   **DO NOT CONDENSE TO ONE PAGE.** Ignore any internal bias for one-page resumes. If the content requires 2, 3, or more pages, that is acceptable. Completeness is more important than brevity.
            *   Rewrite/rephrase content (summaries, work descriptions, project details) to emphasize relevance IN ${languageName}, using keywords from the job description where appropriate.
            *   STRICT RULE - NO FABRICATION: You must ONLY use information that exists in the Base CV. Do NOT invent, add, or fabricate any skills, experiences, projects, certifications, or qualifications that are not explicitly present in the original CV data. If a skill from the job description is not in the CV, do NOT add it.
            *   Maintain factual integrity; do not invent skills or experiences. Every piece of information in the output must be traceable back to the Base CV.
            *   SIZE CONSTRAINT: The tailored CV MUST NOT be shorter than the Base CV. It should be detailed and comprehensive.
            *   Optimize the order of items within sections (e.g., work experience) to highlight the most relevant roles first, but keep the less relevant ones further down rather than deleting them.
            *   CRITICAL OUTPUT STRUCTURE: The output MUST be a complete JSON object strictly adhering to the JSON Resume Schema (https://jsonresume.org/schema/).
            *   Use standard JSON Resume keys like \`basics\`, \`work\`, \`volunteer\`, \`education\`, \`awards\`, \`certificates\`, \`publications\`, \`skills\`, \`languages\`, \`interests\`, \`references\`, \`projects\`.
            *   **IMPORTANT:** Ensure the \`basics.summary\` field is populated with a strong, tailored professional summary based on the candidate's profile and the job description. Do not leave this field empty.
            *   **IMPORTANT:** Do NOT mention the specific name of the company you are applying to anywhere in the generated CV (e.g. in the summary, objective, or descriptions). Focus on the role and skills, but keep the document company-agnostic.
            *   All textual content within the JSON object (names, summaries, descriptions, etc.) MUST be in ${languageName}.
            *   SECTION LABELS TRANSLATION: Include a \`meta.sectionLabels\` object in the tailoredCv JSON with translated section names in ${languageName}. For example, for German: {"summary": "Zusammenfassung", "work": "Berufserfahrung", "education": "Ausbildung", "skills": "Fähigkeiten & Technologien", "languages": "Sprachen", "projects": "Projekte", "certificates": "Zertifikate", "awards": "Auszeichnungen", "volunteer": "Ehrenamt", "interests": "Interessen", "references": "Referenzen"}.
            *   **IMPORTANT:** Also provide a list of changes you made. **The 'description' and 'reason' fields in this list MUST ALWAYS BE IN ENGLISH, regardless of the target language of the CV.**

            **Output Format:**
            Return ONLY a single JSON object enclosed in triple backticks (\`\`\`json ... \`\`\`). This JSON object MUST contain:
            1.  \`tailoredCv\`: The complete, tailored CV data as a valid JSON Resume Schema object (in ${languageName}).
            2.  \`changes\`: An array of change objects, each with:
                - \`section\`: The CV section that was modified (use English keys: "summary", "work", "skills", "education", "projects", etc.)
                - \`description\`: A brief description of what was changed (IN ENGLISH)
                - \`reason\`: Why this change was made, ideally referencing relevant job requirements (IN ENGLISH)

            Example output structure:
            \`\`\`json
            {
              "tailoredCv": {
                "basics": { ... },
                "work": [ ... ],
                "education": [ ... ],
                "skills": [ ... ]
              },
              "changes": [
                {
                  "section": "summary",
                  "description": "Rewrote professional summary to highlight cloud expertise",
                  "reason": "Job requires extensive AWS and cloud architecture experience"
                },
                {
                  "section": "work",
                  "description": "Added specific metrics to software engineer role",
                  "reason": "Job emphasizes measurable impact and data-driven results"
                },
                {
                  "section": "skills",
                  "description": "Reordered skills to prioritize Python and machine learning",
                  "reason": "These are listed as primary requirements in the job description"
                }
              ]
            }
            \`\`\`
        `;
        }

        // 3. Generate CV using AI service
        console.log(`Generating ${languageName} CV only for job ${jobId}...`);
        await JobApplication.updateOne({ _id: jobId, userId: userId }, { $set: { generationStatus: 'pending_generation' } });

        const result = await generateContent(userId, prompt, { maxTokens: maxOutputTokens }); // Pass maxTokens if provided
        const responseText = result.text;
        console.log("Received CV generation response from AI.");

        // 4. Parse Response (extract JSON from ```json block)
        let jsonStringToParse = responseText.trim();
        const prefix = "```json";
        const suffix = "```";

        if (jsonStringToParse.startsWith(prefix) && jsonStringToParse.endsWith(suffix)) {
            jsonStringToParse = jsonStringToParse.substring(prefix.length, jsonStringToParse.length - suffix.length).trim();
        } else if (jsonStringToParse.startsWith(prefix)) {
            jsonStringToParse = jsonStringToParse.substring(prefix.length).trim();
        }

        let parsedResponse;
        try {
            parsedResponse = JSON.parse(jsonStringToParse);
        } catch (parseError: any) {
            console.error("Failed to parse CV JSON:", parseError.message);
            throw new Error("AI failed to return valid JSON for CV.");
        }

        // 5. Handle both new format (with changes) and legacy format (direct CV)
        let tailoredCvJson;
        let tailoringChanges: Array<{ section: string; description: string; reason: string }> | null = null;

        if (parsedResponse.tailoredCv && typeof parsedResponse.tailoredCv === 'object') {
            // New format: { tailoredCv: {...}, changes: [...] }
            tailoredCvJson = parsedResponse.tailoredCv;
            tailoringChanges = Array.isArray(parsedResponse.changes) ? parsedResponse.changes : null;
            console.log(`Parsed new format response with ${tailoringChanges?.length || 0} changes.`);
        } else if (parsedResponse.basics) {
            // Legacy format: Direct CV JSON (for backwards compatibility with custom prompts)
            tailoredCvJson = parsedResponse;
            console.log("Parsed legacy format response (direct CV JSON, no changes).");
        } else {
            console.error("Parsed response is invalid:", parsedResponse);
            throw new Error("AI response missing expected structure.");
        }

        // Validate CV structure
        if (!tailoredCvJson || typeof tailoredCvJson !== 'object' || !tailoredCvJson.basics) {
            console.error("Parsed CV JSON is invalid or missing basics:", tailoredCvJson);
            throw new Error("Parsed CV JSON is invalid or missing the 'basics' section.");
        }

        // 6. Save ONLY the CV draft (not cover letter)
        console.log(`Saving CV draft for job ${jobId}...`);

        await JobApplication.findOneAndUpdate(
            { _id: jobId, userId: userId },
            {
                $set: {
                    language: requestedLanguage,
                    generationStatus: 'draft_ready'
                }
            },
            { new: true }
        );

        // Save CV to Unified CV Model (including tailoringChanges)
        let jobCv = await CV.findOne({ jobApplicationId: jobId, userId: userId });
        if (jobCv) {
            jobCv.cvJson = tailoredCvJson;
            jobCv.tailoringChanges = tailoringChanges;
            await jobCv.save();
        } else {
            // Create new Job CV if missing
            // Get job info for display name
            const job = await JobApplication.findById(jobId).select('jobTitle companyName');
            const jobDisplayName = job 
                ? `Tailored CV - ${job.jobTitle} at ${job.companyName}`
                : 'Tailored CV';
            
            await CV.create({
                userId: userId,
                jobApplicationId: jobId,
                isMasterCv: false,
                isPrimary: false,
                displayName: jobDisplayName,
                cvJson: tailoredCvJson,
                tailoringChanges: tailoringChanges,
            });
        }

        console.log(`CV draft saved successfully for job ${jobId}. Saved to unified CV model.`);

        res.status(200).json({
            status: "draft_ready",
            message: `CV generated successfully in ${languageName}. Ready for review.`,
            jobId: jobId,
            changesCount: tailoringChanges?.length || 0
        });

    } catch (error: any) {
        console.error(`Error generating CV for job ${jobId}:`, error);
        const currentUserId = (req.user as AuthenticatedUser)?._id?.toString();
        if (currentUserId) {
            await JobApplication.updateOne(
                { _id: jobId, userId: currentUserId, generationStatus: { $ne: 'draft_ready' } },
                { $set: { generationStatus: 'error' } }
            ).catch(err => console.error("Failed to update job status to error:", err));
        }
        res.status(500).json({ message: error.message || 'Failed to generate CV.' });
    }
};

// === ROUTE DEFINITIONS (Order Matters!) ===
router.post('/improve-section', validateRequest({ body: improveSectionBodySchema }), asyncHandler(improveCvSection)); // Improve CV section
router.post('/finalize', validateRequest({ body: finalizeGenerationBodySchema }), finalizeGenerationHandler); // Finalize draft content
router.post('/:jobId/render-pdf', validateRequest({ params: jobIdParamSchema }), renderFinalPdfsHandler); // Render both PDFs
router.post('/:jobId/render-cv-pdf', validateRequest({ params: jobIdParamSchema }), renderCvPdfHandler); // Render CV PDF only
router.post('/:jobId/render-cover-letter-pdf', validateRequest({ params: jobIdParamSchema }), renderCoverLetterPdfHandler); // Render Cover Letter PDF only
router.post('/:jobId/generate-cv', validateRequest({ params: jobIdParamSchema, body: generateDocumentsBodySchema }), generateCvOnlyHandler); // Generate CV only (no cover letter)
router.post('/:jobId', validateRequest({ params: jobIdParamSchema, body: generateDocumentsBodySchema }), generateDocumentsHandler); // Generate initial draft or ask for input
router.get('/download/:filename', validateRequest({ params: filenameParamSchema }), downloadFileHandler); // Download generated files

export default router;