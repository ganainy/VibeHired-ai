// electron/src/hooks/useSpeechRecognition.ts
// Adapted from client/src/hooks/useSpeechRecognition.ts — same logic,
// runs inside the Electron BrowserWindow's Chromium renderer.
import { useRef, useState, useCallback, useEffect } from 'react';

// ── Local Speech API type declarations ─────────────────────────────────────
// Chromium's Web Speech API types; declared here for portability when the
// tsconfig lib setting doesn't pull them in automatically.
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
declare const SpeechRecognition: { new (): ISpeechRecognition } | undefined;
// ────────────────────────────────────────────────────────────────────────────

interface UseSpeechRecognitionReturn {
  startListening: (lang?: string) => Promise<void>;
  stopListening: () => void;
  transcript: string;
  interimTranscript: string;
  resetTranscript: () => void;
  isListening: boolean;
  isSupported: boolean;
  recognitionError: string | null;
}

const SpeechRecognitionAPI: ({ new (): ISpeechRecognition } | undefined) =
  (typeof SpeechRecognition !== 'undefined' ? SpeechRecognition : undefined) ??
  (window as unknown as { webkitSpeechRecognition?: { new (): ISpeechRecognition } }).webkitSpeechRecognition;

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const recognitionSessionRef = useRef(0);

  const isSupported = !!SpeechRecognitionAPI;

  const detachRecognition = useCallback((recognition: ISpeechRecognition | null) => {
    if (!recognition) return;

    recognition.onstart = null;
    recognition.onend = null;
    recognition.onresult = null;
    recognition.onerror = null;
  }, []);

  const stopRecognition = useCallback((recognition: ISpeechRecognition | null) => {
    if (!recognition) return;

    try {
      recognition.stop();
    } catch {
      recognition.abort();
    }
  }, []);

  useEffect(() => {
    return () => {
      detachRecognition(recognitionRef.current);
      stopRecognition(recognitionRef.current);
      recognitionRef.current = null;
    };
  }, [detachRecognition, stopRecognition]);

  const startListening = useCallback(async (lang = 'en-US') => {
    console.log('[useSpeechRecognition] startListening called, lang:', lang);
    if (!SpeechRecognitionAPI) {
      console.log('[useSpeechRecognition] SpeechRecognitionAPI not available');
      setRecognitionError('Speech recognition is not supported in this browser.');
      return;
    }

    // Log diagnostic info
    console.log('[useSpeechRecognition] User Agent:', navigator.userAgent);
    console.log('[useSpeechRecognition] Platform:', navigator.platform);
    console.log('[useSpeechRecognition] Language:', navigator.language);

    // Check microphone permission
    try {
      console.log('[useSpeechRecognition] Checking microphone permission...');
      const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      console.log('[useSpeechRecognition] Microphone permission:', permissionStatus.state);

      if (permissionStatus.state === 'denied') {
        setRecognitionError('Microphone permission denied. Please allow microphone access in your system settings.');
        return;
      }

      if (permissionStatus.state === 'prompt') {
        setRecognitionError('Microphone permission required. Please allow microphone access when prompted.');
        return;
      }
    } catch (e) {
      console.log('[useSpeechRecognition] Could not check microphone permission:', e);
      // Permission API might not be available, continue anyway
    }

    // Try to enumerate media devices to verify microphone access
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      console.log('[useSpeechRecognition] Found', audioInputs.length, 'microphone(s):', audioInputs.map(d => d.label || 'unnamed'));

      if (audioInputs.length === 0) {
        setRecognitionError('No microphone found. Please connect a microphone and try again.');
        return;
      }
    } catch (e) {
      console.error('[useSpeechRecognition] Could not enumerate devices:', e);
      setRecognitionError('Could not access microphone. Please check your microphone settings.');
      return;
    }

    // Clear any previous error
    setRecognitionError(null);

    const previousRecognition = recognitionRef.current;
    detachRecognition(previousRecognition);
    stopRecognition(previousRecognition);

    const recognition = new SpeechRecognitionAPI();
    const sessionId = recognitionSessionRef.current + 1;
    recognitionSessionRef.current = sessionId;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    console.log('[useSpeechRecognition] Recognition config:', {
      continuous: recognition.continuous,
      interimResults: recognition.interimResults,
      lang: recognition.lang,
      service: 'Google Web Speech API (requires internet)',
    });

    recognition.onstart = () => {
      console.log('[useSpeechRecognition] onstart fired, sessionId:', sessionId, 'current:', recognitionSessionRef.current);
      if (recognitionSessionRef.current !== sessionId) {
        console.log('[useSpeechRecognition] onstart: session mismatch, ignoring');
        return;
      }
      console.log('[useSpeechRecognition] setting isListening to true');
      setIsListening(true);
    };
    recognition.onend = () => {
      console.log('[useSpeechRecognition] onend fired, sessionId:', sessionId, 'current:', recognitionSessionRef.current);
      if (recognitionSessionRef.current !== sessionId) {
        console.log('[useSpeechRecognition] onend: session mismatch, ignoring');
        return;
      }

      recognitionRef.current = null;
      console.log('[useSpeechRecognition] setting isListening to false');
      setIsListening(false);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (recognitionSessionRef.current !== sessionId) return;

      let finalSegment = '';
      let interimSegment = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalSegment += result[0].transcript;
        } else {
          interimSegment += result[0].transcript;
        }
      }

      if (finalSegment) {
        setTranscript((prev) => (prev ? prev + ' ' + finalSegment.trim() : finalSegment.trim()));
      }
      setInterimTranscript(interimSegment);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (recognitionSessionRef.current !== sessionId) return;

      const errorDesc = getErrorDescription(event.error);
      console.error('Speech recognition error:', event.error, '-', errorDesc);
      setRecognitionError(errorDesc);
      recognitionRef.current = null;
      setIsListening(false);
    };

    // Helper to describe errors
    function getErrorDescription(error: string): string {
      const errorMap: Record<string, string> = {
        'network': 'Cannot reach speech recognition servers. Check your internet connection.',
        'not-allowed': 'Microphone permission denied. Allow microphone access in your browser.',
        'no-speech': 'No speech detected. Try speaking louder or closer to the microphone.',
        'audio-capture': 'No microphone found or it is being used by another application.',
        'aborted': 'Speech recognition was stopped.',
      };
      return errorMap[error] || 'Unknown error occurred.';
    }

    recognitionRef.current = recognition;
    recognition.start();
  }, [detachRecognition, stopRecognition]);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    detachRecognition(recognition);
    recognitionRef.current = null;
    recognitionSessionRef.current += 1;
    stopRecognition(recognition);
    recognitionRef.current = null;
    setIsListening(false);
    setInterimTranscript('');
  }, [detachRecognition, stopRecognition]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setRecognitionError(null);
  }, []);

  return {
    startListening,
    stopListening,
    transcript,
    interimTranscript,
    resetTranscript,
    isListening,
    isSupported,
    recognitionError,
  };
}
