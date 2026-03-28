// electron/src/hooks/useAudioRecording.ts
// Records audio and transcribes using Whisper API via the backend
import { useRef, useState, useCallback } from 'react';
import { AuthPayload } from './electron.d';

interface UseAudioRecordingReturn {
  startRecording: (auth: AuthPayload, language?: string) => void;
  stopRecording: () => Promise<string>;
  isRecording: boolean;
  transcript: string;
  setTranscript: (text: string) => void;
  error: string | null;
  isSupported: boolean;
}

export function useAudioRecording(): UseAudioRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const authRef = useRef<AuthPayload | null>(null);
  const languageRef = useRef<string>('en');

  const isSupported = typeof MediaRecorder !== 'undefined';

  const startRecording = useCallback((auth: AuthPayload, language = 'en') => {
    if (!isSupported) {
      setError('MediaRecorder is not supported in this browser.');
      return;
    }

    setError(null);
    setTranscript('');
    authRef.current = auth;
    languageRef.current = language;
    audioChunksRef.current = [];

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        // Find best supported MIME type
        const mimeType = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/ogg;codecs=opus',
        ].find(type => MediaRecorder.isTypeSupported(type)) || 'audio/webm';

        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          await transcribeAudio(audioBlob);

          // Stop all audio tracks to release microphone
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start(100); // Collect data every 100ms
        setIsRecording(true);
        console.log('[AudioRecording] Started recording');
      })
      .catch((err) => {
        console.error('[AudioRecording] Failed to access microphone:', err);
        setError('Failed to access microphone. Please check your permissions.');
      });
  }, [isSupported]);

  const transcribeAudio = async (audioBlob: Blob) => {
    const auth = authRef.current;
    if (!auth) {
      setError('No authentication data available.');
      return;
    }

    try {
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];

        console.log('[AudioRecording] Sending audio for transcription...');

        const response = await fetch(`${auth.apiUrl}/transcribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${auth.token}`,
          },
          body: JSON.stringify({
            audio: base64Audio,
            language: languageRef.current,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Transcription failed');
        }

        const result = await response.json();
        console.log('[AudioRecording] Transcription result:', result);
        setTranscript(result.text);
      };
    } catch (err) {
      console.error('[AudioRecording] Transcription error:', err);
      setError((err as Error).message || 'Transcription failed');
    }
  };

  const stopRecording = useCallback(async (): Promise<string> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve('');
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        setIsRecording(false);
        mediaRecorderRef.current = null;
        resolve(transcript); // Resolve with the transcript
      };

      mediaRecorderRef.current.stop();
      console.log('[AudioRecording] Stopped recording');
    });
  }, [transcript]);

  return {
    startRecording,
    stopRecording,
    isRecording,
    transcript,
    setTranscript,
    error,
    isSupported,
  };
}
