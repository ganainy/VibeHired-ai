// server/src/adapters/geminiAdapter.ts
import { GoogleGenerativeAI, GenerativeModel, Part } from '@google/generative-ai';
import fs from 'fs';
import { ModelAdapter, GenerateContentOptions, GenerateContentResult } from './base';
import { GEMINI_FLASH } from '../constants/geminiModels';

/**
 * Parse JSON response from AI text output
 */
function parseJsonResponse<T>(responseText: string): T {
  const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
  const jsonMatch = responseText.match(jsonRegex);
  if (jsonMatch && jsonMatch[1]) {
    const extractedJsonString = jsonMatch[1].trim();
    try {
      return JSON.parse(extractedJsonString) as T;
    } catch (e: any) {
      console.error('JSON.parse failed on extracted content:', e.message);
      throw new Error(`AI response was not valid JSON. Parse error: ${e.message}`);
    }
  }

  // Try to extract JSON from plain text (fallback)
  const startIndex = responseText.indexOf('{');
  const endIndex = responseText.lastIndexOf('}');
  if (startIndex !== -1 && endIndex !== -1) {
    const cleanedText = responseText.substring(startIndex, endIndex + 1);
    try {
      return JSON.parse(cleanedText) as T;
    } catch {
      throw new Error('AI failed to return data in the expected JSON format.');
    }
  }

  throw new Error('AI failed to return data in the expected JSON format.');
}

/**
 * Convert file path to Gemini Part object
 */
function fileToGenerativePart(filePath: string, mimeType: string): Part {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString('base64'),
      mimeType,
    },
  };
}

/**
 * Gemini model adapter
 */
export class GeminiAdapter extends ModelAdapter {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private modelName: string;

  constructor(apiKey: string, modelName: string = GEMINI_FLASH) {
    super();
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
    this.model = this.genAI.getGenerativeModel({ model: modelName });
  }

  async generateContent(
    prompt: string,
    options?: GenerateContentOptions
  ): Promise<GenerateContentResult> {
    try {
      const generationConfig: any = {};
      if (options?.temperature !== undefined) generationConfig.temperature = options.temperature;
      if (options?.maxTokens !== undefined) generationConfig.maxOutputTokens = options.maxTokens;
      if (options?.topP !== undefined) generationConfig.topP = options.topP;
      if (options?.topK !== undefined) generationConfig.topK = options.topK;

      const model = Object.keys(generationConfig).length > 0
        ? this.genAI.getGenerativeModel({ model: this.modelName, generationConfig })
        : this.model;

      const result = await model.generateContent(prompt);
      const response = result.response;

      if (!response || !response.candidates || response.candidates.length === 0 || !response.candidates[0].content) {
        const blockReason = response?.promptFeedback?.blockReason;
        throw new Error(`AI content generation failed or was blocked: ${blockReason || 'No content generated'}`);
      }

      const text = response.text();

      // Extract usage info if available
      const usage = response.usageMetadata ? {
        promptTokens: response.usageMetadata.promptTokenCount,
        completionTokens: response.usageMetadata.candidatesTokenCount,
        totalTokens: response.usageMetadata.totalTokenCount,
      } : undefined;

      return { text, usage };
    } catch (error: any) {
      console.error('Error during Gemini content generation:', error);
      throw new Error(`Failed to generate content: ${error.message || error}`);
    }
  }

  async generateContentWithFile(
    prompt: string,
    filePath: string,
    mimeType: string,
    options?: GenerateContentOptions
  ): Promise<GenerateContentResult> {
    try {
      const filePart = fileToGenerativePart(filePath, mimeType);
      const textPart: Part = { text: prompt };
      const parts: Part[] = [textPart, filePart];

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts }],
      });
      const response = result.response;

      if (!response || !response.candidates || response.candidates.length === 0 || !response.candidates[0].content) {
        const blockReason = response?.promptFeedback?.blockReason;
        throw new Error(`AI content generation failed or was blocked: ${blockReason || 'No content generated'}`);
      }

      const text = response.text();
      const usage = response.usageMetadata ? {
        promptTokens: response.usageMetadata.promptTokenCount,
        completionTokens: response.usageMetadata.candidatesTokenCount,
        totalTokens: response.usageMetadata.totalTokenCount,
      } : undefined;

      return { text, usage };
    } catch (error: any) {
      console.error('Error during Gemini file content generation:', error);
      throw new Error(`Failed to generate content from file: ${error.message || error}`);
    }
  }

  async generateStructuredResponse<T>(
    prompt: string,
    options?: GenerateContentOptions
  ): Promise<T> {
    const jsonPrompt = `${prompt}\n\nIMPORTANT: Your response MUST be a valid JSON object wrapped in triple backticks (\`\`\`json). Do not include any additional text outside the JSON block.`;

    const result = await this.generateContent(jsonPrompt, options);
    return parseJsonResponse<T>(result.text);
  }

  getModelInfo() {
    return {
      provider: 'gemini',
      modelName: this.modelName,
      capabilities: {
        imageSupport: true,
        maxTokens: 8192,
      },
    };
  }
}

