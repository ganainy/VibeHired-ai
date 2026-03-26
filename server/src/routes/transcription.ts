// server/src/routes/transcription.ts
import { Router, Request, Response, RequestHandler } from 'express';
import { transcribeAudio, detectMimeType } from '../services/transcriptionService';

const router = Router();

// POST /api/transcribe - Transcribe audio using OpenAI Whisper
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { audio, language } = req.body;

    if (!audio) {
      res.status(400).json({ error: 'Audio data is required' });
      return;
    }

    // Convert base64 audio to blob
    const buffer = Buffer.from(audio, 'base64');
    const blob = new Blob([buffer], { type: 'audio/webm' });

    // Get API key from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const apiKey = authHeader.substring(7);

    const result = await transcribeAudio(blob, apiKey, language || 'en');

    res.json(result);
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
