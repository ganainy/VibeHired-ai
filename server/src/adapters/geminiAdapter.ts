// server/src/adapters/geminiAdapter.ts
import { GoogleGenerativeAI, GenerativeModel, Part } from '@google/generative-ai';
import * as fs from 'fs';
import { Readable } from 'stream';
import { ModelAdapter, GenerateContentOptions, GenerateContentResult, chatSessions, generateSessionId, cleanupExpiredSessions } from './base';
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
 * Recursively strip JSON Schema fields that the Gemini API does not support.
 * Gemini's responseSchema only supports: type, format, description, nullable,
 * enum, items, properties, required, anyOf.
 */
function sanitizeGeminiSchema(schema: object): object {
  if (Array.isArray(schema)) {
    return schema.map(sanitizeGeminiSchema);
  }
  if (schema === null || typeof schema !== 'object') return schema;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    // Strip unsupported fields at any level
    if (key === 'additionalProperties' || key === 'minItems' || key === 'maxItems' ||
        key === 'minimum' || key === 'maximum' || key === 'pattern' ||
        key === 'minLength' || key === 'maxLength' || key === 'default' ||
        key === '$schema' || key === 'definitions' || key === '$defs') {
      continue;
    }
    // Recurse into nested objects/arrays
    if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeGeminiSchema(value);
    } else {
      result[key] = value;
    }
  }
  return result;
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
    options?: GenerateContentOptions & { responseJsonSchema?: object; debugLabel?: string }
  ): Promise<T> {
    try {
      const generationConfig: any = {};
      if (options?.temperature !== undefined) generationConfig.temperature = options.temperature;
      if (options?.maxTokens !== undefined) generationConfig.maxOutputTokens = options.maxTokens;
      if (options?.topP !== undefined) generationConfig.topP = options.topP;
      if (options?.topK !== undefined) generationConfig.topK = options.topK;

      const hasSchema = !!options?.responseJsonSchema;
      if (hasSchema) {
        generationConfig.responseMimeType = 'application/json';
        generationConfig.responseSchema = sanitizeGeminiSchema(options.responseJsonSchema!);
      }

      const model = Object.keys(generationConfig).length > 0
        ? this.genAI.getGenerativeModel({ model: this.modelName, generationConfig })
        : this.model;

      const result = await model.generateContent(prompt);
      const response = result.response;

      if (!response || !response.candidates || response.candidates.length === 0 || !response.candidates[0].content) {
        const blockReason = response?.promptFeedback?.blockReason;
        throw new Error(`AI content generation failed or was blocked: ${blockReason || 'No content generated'}`);
      }

      // Log finish reason and safety ratings BEFORE parsing
      const candidate = response.candidates[0];
      const finishReason = candidate.finishReason;
      const safetyRatings = candidate.safetyRatings;

      if (finishReason && finishReason !== 'STOP') {
        console.warn(`⚠️  Gemini finish reason: ${finishReason}`);
        console.warn(`   Safety ratings: ${JSON.stringify(safetyRatings)}`);
      }

      const text = response.text();

      // Always log raw response details when debugLabel is provided
      if (options?.debugLabel) {
        console.log(`=== RAW RESPONSE [${options.debugLabel}] ===`);
        console.log(`  Model: ${this.modelName}`);
        console.log(`  Length: ${text.length} chars`);
        console.log(`  Finish reason: ${finishReason}`);
        console.log(`  Safety: ${JSON.stringify(safetyRatings)}`);
        console.log(`  First 500 chars: ${text.substring(0, 500)}`);
        if (text.length > 500) {
          console.log(`  Last 200 chars: ${text.slice(-200)}`);
        }
        const partsInfo = candidate.content?.parts?.map((p: any) => ({ text: (p.text || '').substring(0, 200) }));
        console.log(`  Full candidate content parts: ${JSON.stringify(partsInfo)}`);
        console.log(`=== END RAW RESPONSE [${options.debugLabel}] ===`);
      }

      // Guard against empty/suspiciously short responses
      if (text.trim().length < 10) {
        console.error('=== GEMINI EMPTY/SUSPICIOUS RESPONSE ===');
        console.error(`Response length: ${text.length} chars`);
        console.error(`Finish reason: ${finishReason}`);
        console.error(`Full candidate: ${JSON.stringify(candidate, null, 2).substring(0, 1000)}`);
        console.error('=== END ===');
        throw new Error(`Gemini returned empty or suspiciously short response (${text.length} chars, finish: ${finishReason})`);
      }

      if (hasSchema) {
        let cleanText = text.trim();
        // Strip markdown fences if Gemini wraps JSON despite schema
        if (cleanText.startsWith('```')) {
          cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
        }
        try {
          return JSON.parse(cleanText) as T;
        } catch (err: any) {
          console.error('=== GEMINI RAW RESPONSE (truncated or malformed) ===');
          console.error(`Response length: ${cleanText.length} chars`);
          console.error(`Finish reason: ${finishReason}`);
          console.error(`Last 200 chars: ${cleanText.slice(-200)}`);
          console.error(`Full response: ${cleanText.substring(0, 2000)}${cleanText.length > 2000 ? '...' : ''}`);
          console.error('=== END RAW RESPONSE ===');
          throw new Error(`Failed to parse Gemini JSON: ${err.message}`);
        }
      }

      return parseJsonResponse<T>(text);
    } catch (error: any) {
      console.error('Error during Gemini structured response generation:', error);
      throw new Error(`Failed to generate structured response: ${error.message || error}`);
    }
  }

  async startChatSession(
    systemPrompt: string,
    options?: GenerateContentOptions
  ): Promise<string> {
    const generationConfig: any = {};
    if (options?.temperature !== undefined) generationConfig.temperature = options.temperature;
    if (options?.maxTokens !== undefined) generationConfig.maxOutputTokens = options.maxTokens;

    if (options?.topP !== undefined) generationConfig.topP = options.topP;
    if (options?.topK !== undefined) generationConfig.topK = options.topK;

    const model = Object.keys(generationConfig).length > 0
      ? this.genAI.getGenerativeModel({ model: this.modelName, generationConfig })
      : this.model;
    const chatSession = model.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'Understood. I am ready to help the candidate answer interview questions.' }] },
      ],
    });
    const sessionId = generateSessionId();
    chatSessions.set(sessionId, { handle: chatSession, createdAt: Date.now() });
    return sessionId;
  }

  async sendMessageStream(
    sessionId: string,
    message: string
  ): Promise<NodeJS.ReadableStream> {
    const session = chatSessions.get(sessionId);
    if (!session) {
      throw new Error(`Chat session ${sessionId} not found`);
    }
    const chatSession = session.handle as import('@google/generative-ai').ChatSession;
    try {
      const result = await chatSession.sendMessageStream(message);
      const readable = new Readable({
        read() {
          return { done: true } as any;
        },
      });
      (async () => {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              readable.push(Buffer.from(text));
            }
          }
          readable.push(null);
        } catch (err) {
          readable.destroy(err instanceof Error ? err : new Error(String(err)));
        }
      })();
      return readable;
    } catch (error: any) {
      chatSessions.delete(sessionId);
      throw new Error(`Failed to stream message: ${error.message || error}`);
    }
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

