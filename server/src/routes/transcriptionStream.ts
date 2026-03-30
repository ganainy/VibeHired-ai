// server/src/routes/transcriptionStream.ts
// WebSocket endpoint that proxies raw PCM audio to AssemblyAI real-time transcriber

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { createStreamingTranscriber } from '../services/transcriptionService';

function isTranscriberSocketOpen(transcriber: unknown): boolean {
  const maybeSocket = (transcriber as { socket?: { readyState?: number } })?.socket;
  // WS OPEN constant is 1 in browser/ws implementations.
  return maybeSocket?.readyState === 1;
}

export function setupTranscriptionWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/api/transcribe-stream' });

  wss.on('connection', async (ws, req) => {
    // Auth: extract token from query param
    const url = new URL(req.url || '', `http://localhost`);
    const token = url.searchParams.get('token');
    const language = (url.searchParams.get('language') || 'auto').toLowerCase();

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        ws.close(1011, 'Server configuration error');
        return;
      }
      jwt.verify(token, jwtSecret);
    } catch {
      ws.close(4003, 'Invalid or expired token');
      return;
    }

    // AssemblyAI streaming (v3) is configured for 16k PCM mono input.
    const transcriber = createStreamingTranscriber(16000, language);
    let transcriberConnected = false;

    transcriber.on('turn', (turn) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      const text = (turn.transcript || '').trim();
      if (!text) return;

      if (turn.end_of_turn) {
        ws.send(JSON.stringify({ type: 'final', text }));
      } else {
        ws.send(JSON.stringify({ type: 'partial', text }));
      }
    });

    transcriber.on('error', (error) => {
      console.error('[TranscriptionStream] AssemblyAI error:', error);
      transcriberConnected = false;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', error: String(error) }));
      }
    });

    transcriber.on('close', (code, reason) => {
      transcriberConnected = false;
      console.log(`[TranscriptionStream] AssemblyAI closed: ${code} ${reason}`);
    });

    try {
      await transcriber.connect();
      transcriberConnected = true;
      console.log('[TranscriptionStream] Client connected, transcriber ready');
      ws.send(JSON.stringify({ type: 'connected' }));
    } catch (err) {
      console.error('[TranscriptionStream] Failed to connect to AssemblyAI:', err);
      ws.close(1011, 'Failed to connect to transcription service');
      return;
    }

    // Forward audio data from client to AssemblyAI.
    // Non-binary frames are treated as optional control messages.
    ws.on('message', (data, isBinary) => {
      if (!isBinary) {
        const raw = typeof data === 'string' ? data : data.toString();
        try {
          const control = JSON.parse(raw) as { type?: string };
          if (control.type === 'ping' && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch {
          // Ignore malformed control messages.
        }
        return;
      }

      if (isBinary) {
        let audioChunk: Buffer | null = null;

        if (Buffer.isBuffer(data)) {
          audioChunk = data;
        } else if (data instanceof ArrayBuffer) {
          audioChunk = Buffer.from(data);
        } else if (Array.isArray(data)) {
          audioChunk = Buffer.concat(data as Buffer[]);
        }

        if (audioChunk && audioChunk.length > 0) {
          if (!transcriberConnected) {
            return;
          }

          if (!isTranscriberSocketOpen(transcriber)) {
            transcriberConnected = false;
            return;
          }

          try {
            transcriber.sendAudio(audioChunk);
          } catch (err) {
            const message = (err as Error)?.message || '';
            const closedSocketRace = message.includes('Socket is not open for communication');
            transcriberConnected = false;

            if (!closedSocketRace) {
              console.error('[TranscriptionStream] Failed to send audio chunk:', err);
            } else {
              console.warn('[TranscriptionStream] Upstream stream closed before audio chunk send; ending session gracefully.');
            }

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'error', error: 'Transcription stream disconnected. Please retry.' }));
              ws.close(1011, 'Transcription stream disconnected');
            }
          }
        }
      }
    });

    // Cleanup on disconnect
    ws.on('close', () => {
      transcriber.close().catch((err: Error) => {
        console.error('[TranscriptionStream] Error closing transcriber:', err);
      });
    });
  });

  console.log('[TranscriptionStream] WebSocket endpoint ready at /api/transcribe-stream');
}
