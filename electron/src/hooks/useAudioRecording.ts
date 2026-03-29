// electron/src/hooks/useAudioRecording.ts
// Records audio and transcribes using AssemblyAI via the backend
import { useRef, useState, useCallback } from 'react';
import { AuthPayload } from './electron.d';

interface UseAudioRecordingReturn {
  startRecording: (auth: AuthPayload, language?: string, deviceId?: string | null) => void;
  stopRecording: () => Promise<string>;
  resetTranscript: () => void;
  isRecording: boolean;
  isTranscribing: boolean;
  transcript: string;
  setTranscript: (text: string) => void;
  error: string | null;
  isSupported: boolean;
}

export function useAudioRecording(): UseAudioRecordingReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const authRef = useRef<AuthPayload | null>(null);
  const languageRef = useRef<string>('en');
  const resolveRef = useRef<((value: string) => void) | null>(null);

  const isSupported = typeof MediaRecorder !== 'undefined';

  const startRecording = useCallback((auth: AuthPayload, language = 'en', deviceId?: string | null) => {
    if (!isSupported) {
      setError('MediaRecorder is not supported in this browser.');
      return;
    }

    setError(null);
    setTranscript('');
    setIsTranscribing(false);
    authRef.current = auth;
    languageRef.current = language;
    audioChunksRef.current = [];

    const constraints: MediaStreamConstraints = {
      audio: deviceId ? { deviceId: { exact: deviceId } } : true,
    };
    navigator.mediaDevices.getUserMedia(constraints)
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
          // Stop all audio tracks to release microphone immediately
          stream.getTracks().forEach(track => track.stop());
          setIsRecording(false);
          setIsTranscribing(true);
          mediaRecorderRef.current = null;

          // Process transcription in background
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const text = await transcribeAudio(audioBlob);

          // Resolve the stopRecording promise with the transcript
          if (resolveRef.current) {
            resolveRef.current(text);
            resolveRef.current = null;
          }
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

  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    const auth = authRef.current;
    if (!auth) {
      setError('No authentication data available.');
      return '';
    }

    try {
      // Convert blob to base64
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

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
      setIsTranscribing(false);
      return result.text;
    } catch (err) {
      console.error('[AudioRecording] Transcription error:', err);
      setError((err as Error).message || 'Transcription failed');
      setIsTranscribing(false);
      return '';
    }
  };

  const resetTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  const stopRecording = useCallback(async (): Promise<string> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) {
        resolve('');
        return;
      }

      // Store resolve so startRecording's onstop can resolve with the transcript
      resolveRef.current = resolve;
      recorder.stop();
      console.log('[AudioRecording] Stopped recording');
    });
  }, []);

  return {
    startRecording,
    stopRecording,
    resetTranscript,
    isRecording,
    isTranscribing,
    transcript,
    setTranscript,
    error,
    isSupported,
  };
}

/**
 * Enumerate available microphone devices.
 * Requests temporary audio access to ensure device labels are populated
 * (labels are empty until the user grants microphone permission).
 */
export async function enumerateMicrophones(): Promise<MediaDeviceInfo[]> {
  try {
    const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    tempStream.getTracks().forEach(t => t.stop());
    return devices.filter(d => d.kind === 'audioinput');
  } catch {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'audioinput');
  }
}
