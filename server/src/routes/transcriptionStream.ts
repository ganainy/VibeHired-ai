// server/src/routes/transcriptionStream.ts
// WebSocket endpoint that proxies raw PCM audio to AssemblyAI real-time transcriber

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { createRealtimeTranscriber } from '../services/transcriptionService';

export function setupTranscriptionWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/api/transcribe-stream' });

  wss.on('connection', async (ws, req) => {
    // Auth: extract token from query param
    const url = new URL(req.url || '', `http://localhost`);
    const token = url.searchParams.get('token');

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

    // Create AssemblyAI real-time transcriber
    const transcriber = createRealtimeTranscriber(16000);

    transcriber.on('transcript.partial', (transcript) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'partial', text: transcript.text }));
      }
    });

    transcriber.on('transcript.final', (transcript) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'final', text: transcript.text }));
      }
    });

    transcriber.on('error', (error) => {
      console.error('[TranscriptionStream] AssemblyAI error:', error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', error: String(error) }));
      }
    });

    transcriber.on('close', (code, reason) => {
      console.log(`[TranscriptionStream] AssemblyAI closed: ${code} ${reason}`);
    });

    try {
      await transcriber.connect();
      console.log('[TranscriptionStream] Client connected, transcriber ready');
      ws.send(JSON.stringify({ type: 'connected' }));
    } catch (err) {
      console.error('[TranscriptionStream] Failed to connect to AssemblyAI:', err);
      ws.close(1011, 'Failed to connect to transcription service');
      return;
    }

    // Forward audio data from client to AssemblyAI
    ws.on('message', (data) => {
      if (Buffer.isBuffer(data)) {
        transcriber.sendAudio(data);
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
