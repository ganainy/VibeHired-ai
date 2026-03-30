// server/src/routes/transcription.ts
import { Router, Request, Response, RequestHandler } from 'express';
import { transcribeAudio } from '../services/transcriptionService';

const router = Router();

// POST /api/transcribe - Transcribe audio using AssemblyAI
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { audio, language } = req.body;

    if (!audio) {
      console.error('[TranscriptionRoute] No audio data in request body');
      res.status(400).json({ error: 'Audio data is required' });
      return;
    }

    // Debug: Log incoming audio payload size
    const audioSizeBytes = Buffer.byteLength(audio, 'base64');
    const audioSizeKB = (audioSizeBytes / 1024).toFixed(2);
    console.log(`[TranscriptionRoute] Received audio: ${audioSizeKB}KB (base64), language: ${language}`);

    const buffer = Buffer.from(audio, 'base64');
    console.log(`[TranscriptionRoute] Converted to buffer: ${buffer.length} bytes`);

    // transcribeAudio uses server's ASSEMBLYAI_API_KEY from environment
    const result = await transcribeAudio(buffer, language);

    res.json(result);
  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
