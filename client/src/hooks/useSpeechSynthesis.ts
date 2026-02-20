import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseSpeechSynthesisReturn {
    speak: (text: string, lang?: string) => void;
    stop: () => void;
    isSpeaking: boolean;
    isSupported: boolean;
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
    const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    const [isSpeaking, setIsSpeaking] = useState(false);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (isSupported) {
                window.speechSynthesis.cancel();
            }
        };
    }, [isSupported]);

    const stop = useCallback(() => {
        if (!isSupported) return;
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
    }, [isSupported]);

    const speak = useCallback((text: string, lang = 'en-US') => {
        if (!isSupported) return;
        // Cancel any ongoing speech first
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.95;
        utterance.pitch = 1;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
    }, [isSupported]);

    return { speak, stop, isSpeaking, isSupported };
}
