import { GoogleGenerativeAI, GoogleGenerativeAIError, GenerativeModel, Part } from "@google/generative-ai";
import fs from 'fs'; // Import fs for file reading
import { GEMINI_FLASH } from '../constants/geminiModels';
import { resolveBestGeminiModel } from './geminiModelResolver';

/**
 * Creates a Gemini client instance with the provided API key
 * @param apiKey - Gemini API key
 * @returns Object containing model instances
 */
export const createGeminiClient = (apiKey: string) => {
    const genAI = new GoogleGenerativeAI(apiKey);

    // Keep this function sync for backward compatibility with existing call sites.
    // Dynamic model selection is done by createGeminiClientAuto.
    const model = genAI.getGenerativeModel({ model: GEMINI_FLASH });

    return { model };
};

/**
 * Creates a Gemini client and automatically selects the best currently available model.
 * Uses API-discovered models with cache and fallback behavior.
 */
export async function createGeminiClientAuto(
    apiKey: string,
    preference: 'fast' | 'quality' = 'fast'
): Promise<{ model: GenerativeModel; modelName: string }> {
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = await resolveBestGeminiModel(apiKey, preference);
    const model = genAI.getGenerativeModel({ model: modelName });
    return { model, modelName };
}

/**
 * Converts a local file path to a GoogleGenerativeAI.Part object.
 * @param filePath The path to the local file.
 * @param mimeType The MIME type of the file.
 * @returns A Part object for the Gemini API.
 */
function fileToGenerativePart(filePath: string, mimeType: string): Part {
    console.log(`Reading file for Gemini: ${filePath}, MIME type: ${mimeType}`);
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
            mimeType
        },
    };
}

/**
 * Parses a JSON response block from the AI's text output.
 * Looks for ```json ... ``` blocks.
 * @param responseText The raw text response from the AI.
 * @returns The parsed JavaScript object.
 * @throws Error if JSON block is not found or parsing fails.
 */
function parseJsonResponse<T>(responseText: string): T {
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const jsonMatch = responseText.match(jsonRegex);
    if (jsonMatch && jsonMatch[1]) {
        const extractedJsonString = jsonMatch[1].trim();
        try {
            return JSON.parse(extractedJsonString) as T;
        } catch (e: any) {
            console.error("JSON.parse failed on extracted content:", e.message);
            console.error("Raw response text:", responseText); // Log the raw text for debugging
            throw new Error(`AI response was not valid JSON. Parse error: ${e.message}`);
        }
    }
    console.error("AI response did not contain expected ```json formatting. Raw:", responseText);
    throw new Error("AI failed to return data in the expected JSON format.");
}

/**
 * Generates content using the Gemini model with file input and expects a structured JSON response.
 * @param apiKey - Gemini API key
 * @param prompt The text prompt accompanying the file.
 * @param filePath The path to the local file to be analyzed.
 * @param mimeType The MIME type of the file (e.g., 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document').
 * @param T The expected type of the parsed JSON object.
 * @returns A promise that resolves to the parsed JSON object.
 * @throws Error if the API call fails, content is blocked, or JSON parsing fails.
 */
export async function generateAnalysisFromFile<T>(
    apiKey: string,
    prompt: string,
    filePath: string,
    mimeType: string
): Promise<T> {
    console.log(`Sending file (${mimeType}) and prompt to Gemini for structured analysis...`);
    try {
        const { model, modelName } = await createGeminiClientAuto(apiKey, 'fast');
        console.log(`Gemini model selected: ${modelName}`);
        const filePart = fileToGenerativePart(filePath, mimeType);
        // Wrap the text prompt in a Part object
        const textPart: Part = { text: prompt };
        const parts: Part[] = [
            textPart, // Text prompt part first
            filePart  // Then the file data part
        ];

        const result = await model.generateContent({ contents: [{ role: "user", parts }] });
        const response = result.response;

        // Check for blocking or lack of content
        if (!response || !response.candidates || response.candidates.length === 0 || !response.candidates[0].content) {
            const blockReason = response?.promptFeedback?.blockReason;
            const safetyRatings = response?.promptFeedback?.safetyRatings;
            console.error("Safety Ratings:", JSON.stringify(safetyRatings, null, 2));
            throw new Error(`AI content generation failed or was blocked: ${blockReason || 'No content generated'}`);
        }

        const responseText = response.text(); // Use helper if available, otherwise access text directly
        console.log("Received structured analysis response from Gemini.");
        return parseJsonResponse<T>(responseText);

    } catch (error: any) {
        console.error("Error during Gemini file analysis generation:", error);
        if (error instanceof GoogleGenerativeAIError || (error.response && error.response.promptFeedback)) {
            const blockReason = error.response?.promptFeedback?.blockReason;
            const safetyRatings = error.response?.promptFeedback?.safetyRatings;
            console.error("Safety Ratings:", JSON.stringify(safetyRatings, null, 2));
            throw new Error(`AI content generation blocked: ${blockReason || 'Unknown reason'}`);
        }
        // Rethrow other errors (network, API key issues, file reading, etc.)
        throw new Error(`Failed to get valid structured response from AI service: ${error.message || error}`);
    }
}

/**
 * Generates analysis from JSON string.
 * @param apiKey - Gemini API key
 * @param prompt The text prompt accompanying the JSON content.
 * @param jsonString The JSON string to be analyzed.
 * @param T The expected type of the parsed JSON object.
 * @returns A promise that resolves to the parsed JSON object.
 * @throws Error if the API call fails or JSON parsing fails.
 */
export async function generateJsonAnalysis<T>(
    apiKey: string,
    prompt: string,
    jsonString: string
): Promise<T> {
    try {
        const { model } = await createGeminiClientAuto(apiKey, 'fast');
        // Combine the prompt with the JSON content
        const combinedPrompt = `${prompt}\n\nAnalyze the following CV in JSON Resume format:\n\n${jsonString}`;

        const result = await model.generateContent(combinedPrompt);
        const response = result.response;
        const responseText = response.text();

        return parseJsonResponse<T>(responseText);
    } catch (error: any) {
        console.error('Error during JSON analysis:', error);
        throw error;
    }
}

/**
 * Generates a structured response from a text prompt.
 * @param apiKey - Gemini API key
 * @param prompt The text prompt.
 * @param T The expected type of the parsed JSON object.
 * @returns A promise that resolves to the parsed JSON object.
 * @throws Error if the API call fails or JSON parsing fails.
 */
export async function generateStructuredResponse<T>(apiKey: string, prompt: string): Promise<T> {
    console.log("Sending prompt to Gemini for structured response...");
    try {
        const { model } = await createGeminiClientAuto(apiKey, 'fast');
        // Add explicit instruction for JSON format with escaped backticks
        const jsonPrompt = `${prompt}\n\nIMPORTANT: Your response MUST be a valid JSON object wrapped in triple backticks (\`\`\`json). Do not include any additional text outside the JSON block.`;

        const result = await model.generateContent(jsonPrompt);
        const response = result.response;

        if (!response || !response.candidates || response.candidates.length === 0) {
            const blockReason = response?.promptFeedback?.blockReason;
            throw new Error(`AI failed to generate content: ${blockReason || 'No response generated'} `);
        }

        const responseText = response.text();
        console.log("Received structured response from Gemini.");

        try {
            // First attempt: Try parsing with the standard JSON block extractor
            return parseJsonResponse<T>(responseText);
        } catch (parseError) {
            // Second attempt: Try to clean and fix the response
            console.log("Initial JSON parse failed, attempting to clean response...");

            // Find the first { and last } to extract just the JSON object
            const startIndex = responseText.indexOf('{');
            const endIndex = responseText.lastIndexOf('}');

            if (startIndex === -1 || endIndex === -1) {
                throw new Error('Could not find valid JSON object markers in the response');
            }

            const cleanedText = responseText.substring(startIndex, endIndex + 1);

            try {
                // Try parsing the cleaned JSON
                const parsed = JSON.parse(cleanedText) as T;
                console.log("Successfully parsed cleaned JSON response");
                return parsed;
            } catch (secondError) {
                console.error("Failed to parse even after cleaning. Raw response:", responseText);
                throw new Error(`Failed to parse AI response as JSON after cleaning: ${(secondError as Error).message} `);
            }
        }
    } catch (error: any) {
        console.error("Error during Gemini structured content generation:", error);

        if (error instanceof GoogleGenerativeAIError) {
            // GoogleGenerativeAIError doesn't have response property, use error message directly
            throw new Error(`AI content generation blocked: ${error.message}`);
        }

        // If it's already an Error with a message we created, throw it as is
        if (error instanceof Error) {
            throw error;
        }

        // For any other type of error
        throw new Error(`Failed to get valid structured response from AI service: ${error.message || error}`);
    }
}

/**
 * Creates a model instance for direct use (for backward compatibility where needed)
 * @param apiKey - Gemini API key
 * @returns GenerativeModel instance
 */
export const getGeminiModel = (apiKey: string): GenerativeModel => {
    const { model } = createGeminiClient(apiKey);
    return model;
};
