// server/src/services/transcriptionService.ts
// Speech-to-text using AssemblyAI real-time streaming

import { AssemblyAI } from 'assemblyai';

let client: AssemblyAI | null = null;

function getClient(): AssemblyAI {
  if (!client) {
    const apiKey = process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      throw new Error('ASSEMBLYAI_API_KEY environment variable is not set');
    }
    client = new AssemblyAI({ apiKey });
  }
  return client;
}

export interface TranscriptionResult {
  text: string;
}

/**
 * Create a real-time transcriber for streaming audio via WebSocket.
 */
export function createRealtimeTranscriber(sampleRate: number = 16000) {
  return getClient().realtime.transcriber({ sampleRate });
}

/**
 * Create a streaming transcriber using AssemblyAI's current v3 streaming API.
 */
export function createStreamingTranscriber(sampleRate: number = 16000, language: string = 'auto') {
  const speechModel = language === 'en'
    ? 'universal-streaming-english'
    : 'universal-streaming-multilingual';

  return getClient().streaming.transcriber({
    sampleRate,
    speechModel,
    formatTurns: true,
  });
}

/**
 * File-upload transcription fallback (non-streaming).
 * Used by the REST endpoint for backward compatibility.
 */
export async function transcribeAudio(
  audioBuffer: Buffer | Blob,
  language?: string
): Promise<TranscriptionResult> {
  const c = getClient();

  // Convert Blob to Buffer if needed
  const audioData: Buffer = audioBuffer instanceof Buffer
    ? audioBuffer
    : Buffer.from(await (audioBuffer as Blob).arrayBuffer());

  // Debug: Log audio buffer details
  const bufferKB = (audioData.length / 1024).toFixed(2);
  console.log(`[TranscriptionService] Audio buffer: ${bufferKB}KB, language: ${language}`);
  console.log(`[TranscriptionService] Calling AssemblyAI with speech_models: ["universal-3-pro", "universal-2"]`);

  const transcript = await c.transcripts.transcribe({
    audio: audioData,
    ...(language && language !== 'auto' ? { language_code: language } : {}),
    speech_models: ['universal-3-pro', 'universal-2'],
  });

  // Debug: Log AssemblyAI response
  console.log(`[TranscriptionService] AssemblyAI status: ${transcript.status}`);
  if (transcript.status === 'error') {
    console.error(`[TranscriptionService] AssemblyAI error: ${transcript.error}`);
    throw new Error(transcript.error || 'Transcription failed');
  }

  console.log(`[TranscriptionService] Transcription successful, length: ${transcript.text?.length || 0} chars`);
  return { text: transcript.text || '' };
}
