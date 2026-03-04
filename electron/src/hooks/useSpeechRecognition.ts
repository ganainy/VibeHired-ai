// electron/src/hooks/useSpeechRecognition.ts
// Adapted from client/src/hooks/useSpeechRecognition.ts — same logic,
// runs inside the Electron BrowserWindow's Chromium renderer.
import { useRef, useState, useCallback } from 'react';

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
  startListening: (lang?: string) => void;
  stopListening: () => void;
  transcript: string;
  interimTranscript: string;
  resetTranscript: () => void;
  isListening: boolean;
  isSupported: boolean;
}

const SpeechRecognitionAPI: ({ new (): ISpeechRecognition } | undefined) =
  (typeof SpeechRecognition !== 'undefined' ? SpeechRecognition : undefined) ??
  (window as unknown as { webkitSpeechRecognition?: { new (): ISpeechRecognition } }).webkitSpeechRecognition;

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  const isSupported = !!SpeechRecognitionAPI;

  const startListening = useCallback((lang = 'en-US') => {
    if (!SpeechRecognitionAPI) return;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
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
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setInterimTranscript('');
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    startListening,
    stopListening,
    transcript,
    interimTranscript,
    resetTranscript,
    isListening,
    isSupported,
  };
}
