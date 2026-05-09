// server/src/adapters/openAICompatibleAdapter.ts
/**
 * OpenAI-compatible model adapter.
 *
 * Works with any provider that implements the OpenAI chat completions API:
 *   - OpenAI (GPT-4o, GPT-4, GPT-3.5, etc.)
 *   - DeepSeek (deepseek-v4-pro, deepseek-v4-flash, etc.)
 *   - GLM / Z.AI, Mistral, and other OpenAI-compatible endpoints
 *
 * DeepSeek-specific notes:
 *   - Base URL: https://api.deepseek.com
 *   - Auth: Bearer <api_key>  (set DEEPSEEK_API_KEY or OPENAI_API_KEY)
 *   - Thinking: supported via thinking: { type: 'enabled' }
 *   - Reasoning effort: low, medium, high
 *   - Images: base64 data URLs (jpg/png/jpeg, max 5MB) or public URLs
 *   - Files: not supported (use base64 images instead)
 *   - JSON mode: supported via response_format: { type: 'json_object' }
 *   - Streaming: supported via SSE (stream: true)
 *   - Temperature range: 0.0 – 1.0
 *   - Max output tokens: up to 64K (model-dependent)
 *
 * Get your DeepSeek API key: https://platform.deepseek.com
 * Docs: https://platform.deepseek.com/docs
 */
import * as fs from 'fs';
import { Readable } from 'stream';
import axios, { AxiosResponse } from 'axios';
import { ModelAdapter, GenerateContentOptions, GenerateContentResult, chatSessions, generateSessionId } from './base';
import { AIProvider } from '../constants/modelProviders';

// Lazy-load pdf-parse to avoid issues if not used
let PDFParseClass: any = null;
async function getPdfParse() {
  if (!PDFParseClass) {
    const mod = await import('pdf-parse');
    PDFParseClass = mod.PDFParse;
  }
  return PDFParseClass;
}

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
 * Read a file and prepare it for an OpenAI-compatible chat completion.
 * - Images → base64 data URL
 * - PDFs → extracted text (via pdf-parse)
 * - Text files → raw text
 * - Others → base64 description
 */
async function fileToContentParts(filePath: string, mimeType: string): Promise<Array<{ type: string; text?: string; image_url?: { url: string } }>> {
  if (mimeType.startsWith('image/')) {
    const base64 = fs.readFileSync(filePath).toString('base64');
    return [
      {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64}`,
        },
      },
    ];
  }

  if (mimeType === 'application/pdf') {
    try {
      const PDFParse = await getPdfParse();
      const buffer = fs.readFileSync(filePath);
      const parser = new PDFParse({ data: buffer });
      const pdfData = await parser.getText();
      return [{ type: 'text', text: `[PDF CONTENT START]\n${pdfData.text || ''}\n[PDF CONTENT END]` }];
    } catch (err) {
      console.warn('Failed to parse PDF for OpenAI-compatible adapter:', err);
      return [{ type: 'text', text: `[PDF FILE ATTACHED: could not extract text]` }];
    }
  }

  if (mimeType.startsWith('text/') || mimeType === 'application/json') {
    const text = fs.readFileSync(filePath, 'utf-8');
    return [{ type: 'text', text: `[FILE CONTENT START]\n${text}\n[FILE CONTENT END]` }];
  }

  // Fallback: base64 encode with description
  const base64 = fs.readFileSync(filePath).toString('base64');
  return [
    {
      type: 'text',
      text: `[ATTACHED FILE: ${mimeType}, base64 encoded]\n${base64.slice(0, 200)}... (${base64.length} chars total)`,
    },
  ];
}

/**
 * OpenAI-compatible model adapter.
 * Works with any provider that implements the OpenAI chat completions API
 * (OpenAI, GLM, DeepSeek, etc.).
 */
export class OpenAICompatibleAdapter extends ModelAdapter {
  private apiKey: string;
  private baseUrl: string;
  private modelName: string;
  private defaultTemperature: number;
  private defaultMaxTokens: number;

  constructor(
    apiKey: string,
    baseUrl: string = 'https://api.openai.com/v1',
    modelName: string = 'gpt-4o',
    temperature: number = 0.7,
    maxTokens: number = 8192
  ) {
    super();
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, ''); // strip trailing slash
    this.modelName = modelName;
    this.defaultTemperature = temperature;
    this.defaultMaxTokens = maxTokens;
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private buildMessages(
    prompt: string,
    systemPrompt?: string
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    return messages;
  }

  async generateContent(
    prompt: string,
    options?: GenerateContentOptions
  ): Promise<GenerateContentResult> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.modelName,
          messages: this.buildMessages(prompt),
          temperature: options?.temperature ?? this.defaultTemperature,
          max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
          top_p: options?.topP ?? 1,
        },
        { headers: this.buildHeaders(), timeout: 120000 }
      );

      return this.parseCompletionResponse(response);
    } catch (error: any) {
      console.error('Error during OpenAI-compatible content generation:', error?.response?.data || error.message);
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
      const fileParts = await fileToContentParts(filePath, mimeType);

      // OpenAI-compatible APIs support vision through user messages with mixed content
      const content: any[] = [{ type: 'text', text: prompt }, ...fileParts];

      const messages = [
        { role: 'user', content },
      ];

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.modelName,
          messages,
          temperature: options?.temperature ?? this.defaultTemperature,
          max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
          top_p: options?.topP ?? 1,
        },
        { headers: this.buildHeaders(), timeout: 120000 }
      );

      return this.parseCompletionResponse(response);
    } catch (error: any) {
      console.error('Error during OpenAI-compatible file content generation:', error?.response?.data || error.message);
      throw new Error(`Failed to generate content from file: ${error.message || error}`);
    }
  }

  async generateStructuredResponse<T>(
    prompt: string,
    options?: GenerateContentOptions & { responseJsonSchema?: object; debugLabel?: string }
  ): Promise<T> {
    try {
      const messages = this.buildMessages(prompt, 'You are a helpful assistant that always responds with valid JSON.');

      const body: any = {
        model: this.modelName,
        messages,
        temperature: options?.temperature ?? this.defaultTemperature,
        max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
        top_p: options?.topP ?? 1,
      };

      // Request JSON mode if the provider supports it
      body.response_format = { type: 'json_object' };

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        body,
        { headers: this.buildHeaders(), timeout: 120000 }
      );

      const result = this.parseCompletionResponse(response);
      const text = result.text;

      if (options?.debugLabel) {
        console.log(`=== RAW RESPONSE [${options.debugLabel}] ===`);
        console.log(`  Provider: openai_compatible`);
        console.log(`  Model: ${this.modelName}`);
        console.log(`  Length: ${text.length} chars`);
        console.log(`  First 500 chars: ${text.substring(0, 500)}`);
        console.log(`=== END RAW RESPONSE [${options.debugLabel}] ===`);
      }

      // Guard against empty responses
      if (text.trim().length < 10) {
        throw new Error(`OpenAI-compatible provider returned empty or suspiciously short response (${text.length} chars)`);
      }

      let cleanText = text.trim();
      // Strip markdown fences if the model wraps JSON despite schema
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
      }
      try {
        return JSON.parse(cleanText) as T;
      } catch (err: any) {
        console.error('=== OPENAI-COMPATIBLE RAW RESPONSE (malformed) ===');
        console.error(`Response length: ${cleanText.length} chars`);
        console.error(`Last 200 chars: ${cleanText.slice(-200)}`);
        console.error(`Full response: ${cleanText.substring(0, 2000)}${cleanText.length > 2000 ? '...' : ''}`);
        console.error('=== END RAW RESPONSE ===');
        throw new Error(`Failed to parse OpenAI-compatible JSON: ${err.message}`);
      }
    } catch (error: any) {
      console.error('Error during OpenAI-compatible structured response generation:', error);
      throw new Error(`Failed to generate structured response: ${error.message || error}`);
    }
  }

  async startChatSession(
    systemPrompt: string,
    options?: GenerateContentOptions
  ): Promise<string> {
    const sessionId = generateSessionId();
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'assistant', content: 'Understood. I am ready to help the candidate answer interview questions.' },
    ];
    chatSessions.set(sessionId, {
      handle: { messages, options },
      createdAt: Date.now(),
    });
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

    const { messages, options } = session.handle as {
      messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
      options?: GenerateContentOptions;
    };

    messages.push({ role: 'user', content: message });

    const readable = new Readable({
      read() {
        return { done: true } as any;
      },
    });

    (async () => {
      try {
        const response = await axios.post(
          `${this.baseUrl}/chat/completions`,
          {
            model: this.modelName,
            messages,
            temperature: options?.temperature ?? this.defaultTemperature,
            max_tokens: options?.maxTokens ?? this.defaultMaxTokens,
            top_p: options?.topP ?? 1,
            stream: true,
          },
          {
            headers: this.buildHeaders(),
            responseType: 'stream',
            timeout: 120000,
          }
        );

        const stream = response.data as NodeJS.ReadableStream;
        let buffer = '';
        let assistantText = '';

        stream.on('data', (chunk: Buffer) => {
          buffer += chunk.toString('utf-8');
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (trimmed.startsWith('data: ')) {
              try {
                const json = JSON.parse(trimmed.slice(6));
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                  assistantText += delta;
                  readable.push(Buffer.from(delta));
                }
              } catch {
                // Ignore malformed SSE lines
              }
            }
          }
        });

        stream.on('end', () => {
          // Append assistant response to history for continuity
          messages.push({ role: 'assistant', content: assistantText });
          readable.push(null);
        });

        stream.on('error', (err: Error) => {
          readable.destroy(err);
        });
      } catch (err) {
        readable.destroy(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    return readable;
  }

  getModelInfo() {
    return {
      provider: AIProvider.OPENAI_COMPATIBLE,
      modelName: this.modelName,
      capabilities: {
        imageSupport: true,
        maxTokens: this.defaultMaxTokens,
      },
    };
  }

  private parseCompletionResponse(response: AxiosResponse<any>): GenerateContentResult {
    const choice = response.data?.choices?.[0];
    const text = choice?.message?.content || '';
    const usage = response.data?.usage
      ? {
          promptTokens: response.data.usage.prompt_tokens,
          completionTokens: response.data.usage.completion_tokens,
          totalTokens: response.data.usage.total_tokens,
        }
      : undefined;

    return { text, usage };
  }
}
