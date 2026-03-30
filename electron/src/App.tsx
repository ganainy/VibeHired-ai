// electron/src/App.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AuthPayload } from './electron.d';
import { initializeSession, fetchStreamingAnswer } from './services/api';
import { useAudioRecording, enumerateMicrophones } from './hooks/useAudioRecording';
import TranscriptBar from './components/TranscriptBar';
import OverlayPanel from './components/OverlayPanel';

const STT_LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto detect' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'German' },
];

function normalizeSttLanguage(input?: string): string {
  const value = (input || '').toLowerCase();
  if (value === 'en' || value === 'de') return value;
  return 'auto';
}

const QUESTION_SPLIT_REGEX = /[^?.!\n]*\?/g;
const QUESTION_START_REGEX = /^(who|what|when|where|why|how|can|could|would|should|do|does|did|is|are|am|will|have|has|had|may|might)\b/i;

function extractQuestionsFromText(rawText: string): string[] {
  const normalized = rawText.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const questionMatches = normalized.match(QUESTION_SPLIT_REGEX) || [];
  const withQuestionMark = questionMatches
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 1);

  if (withQuestionMark.length > 0) {
    return withQuestionMark;
  }

  // Fallback: detect question-like statements that may be missing a question mark.
  const sentences = normalized
    .split(/[.!\n]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 1);

  return sentences
    .filter((segment) => QUESTION_START_REGEX.test(segment))
    .map((segment) => `${segment}?`);
}

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthPayload | null>(null);
  const [answer, setAnswer] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('auto');
  const [isStealthEnabled, setIsStealthEnabled] = useState(true);

  // Microphone device selection
  const [microphones, setMicrophones] = useState<{ deviceId: string; label: string }[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const selectedDeviceIdRef = useRef<string | null>(null);

  // Mirrors transcript state for reading inside callbacks without stale closure
  const transcriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const authRef = useRef<AuthPayload | null>(null);
  const {
    startRecording: startAudioRecording,
    stopRecording: stopAudioRecording,
    resetTranscript,
    transcript,
    interimTranscript,
    setTranscript,
    isRecording,
    isTranscribing,
    error: recordingError,
    isSupported,
  } = useAudioRecording();
  // Keep refs in sync
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { interimTranscriptRef.current = interimTranscript; }, [interimTranscript]);
  useEffect(() => { authRef.current = auth; }, [auth]);
  useEffect(() => { selectedDeviceIdRef.current = selectedDeviceId; }, [selectedDeviceId]);
  // Enumerate microphones on mount and refresh on device change
  useEffect(() => {
    const loadMics = async () => {
      try {
        const devices = await enumerateMicrophones();
        setMicrophones(devices.map(d => ({ deviceId: d.deviceId, label: d.label })));
      } catch (e) {
        console.error('[App] Failed to enumerate microphones:', e);
      }
    };
    loadMics();
    navigator.mediaDevices.addEventListener('devicechange', loadMics);
    return () => navigator.mediaDevices.removeEventListener('devicechange', loadMics);
  }, []);

  // ── Register IPC listeners once ──────────────────────────────────────────
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.signalReady();
    window.electronAPI.onAuthPayload((payload) => {
      setAuth(payload);
      setAnswer('');
      setError(null);
      resetTranscript();
      transcriptRef.current = '';
      interimTranscriptRef.current = '';
      setSessionReady(false);
      setSelectedLanguage(normalizeSttLanguage(payload.jobLanguage));

      // Pre-warm the Gemini session immediately upon auth
      if (payload.apiUrl && payload.token && payload.jobId) {
        initializeSession(
          payload.apiUrl,
          payload.token,
          payload.jobId,
          payload.referenceMaterialIds ?? [],
          payload.activeCvId,
        )
          .then(() => {
            setSessionReady(true);
            console.log('[App] Interview session initialized');
          })
          .catch((err) => {
            console.error('[App] Failed to initialize session:', err);
            // Session init is not blocking - user can still use legacy endpoint
            setSessionReady(true);
          });
      }
    });
    window.electronAPI.onHotkey(async (action) => {
      if (action === 'push-to-talk-start') {
        const currentAuth = authRef.current;
        if (currentAuth && !isListeningRef.current) {
          startAudioRecording(currentAuth, selectedLanguageRef.current, selectedDeviceIdRef.current);
        }
      } else if (action === 'push-to-talk-stop') {
        if (isListeningRef.current) {
          await stopAudioRecording();
        }
      } else if (action === 'clear-answer') {
        clearAll();
      } else if (action === 'ask-ai') {
        void askAiFromTranscript();
      } else if (action === 'toggle-listening') {
        void toggleListening();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.getContentProtection) return;
    window.electronAPI
      .getContentProtection()
      .then((enabled) => setIsStealthEnabled(Boolean(enabled)))
      .catch((err) => {
        console.error('[App] Failed to read content protection status:', err);
      });
  }, []);

  // Keep a ref so the IPC handler above can read current isListening without re-registering
  const isListeningRef = useRef(false);
  const selectedLanguageRef = useRef('auto');
  useEffect(() => { isListeningRef.current = isRecording; }, [isRecording]);
  useEffect(() => { selectedLanguageRef.current = selectedLanguage; }, [selectedLanguage]);
  /**
   * Stream an AI answer using SSE (Server-Sent Events).
   * Text appears incrementally in the overlay as it arrives from the server.
   */
  const triggerStreamingAnswer = useCallback(
    async (currentAuth: AuthPayload, question: string) => {
      setLoading(true);
      setError(null);
      setAnswer('');
      try {
        const res = await fetchStreamingAnswer(
          currentAuth.apiUrl,
          currentAuth.token,
          currentAuth.jobId,
          question,
          currentAuth.referenceMaterialIds ?? [],
          currentAuth.activeCvId,
        );
        if (!res.body) {
          throw new Error('No response body');
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let shouldStop = false;
        let readCount = 0;
        while (!shouldStop) {
          const { done, value } = await reader.read();
          readCount++;
          if (done) {
            console.log(`[SSE] reader.read() #${readCount}: done=true. Total reads: ${readCount}`);
            break;
          }

          const decoded = decoder.decode(value, { stream: true });
          console.log(`[SSE] reader.read() #${readCount}: ${decoded.length} bytes — "${decoded.slice(0, 80)}..."`);
          buffer += decoded;
          // Process complete SSE events (separated by \n\n per SSE spec)
          const events = buffer.split('\n\n');
          buffer = events.pop() || ''; // Keep incomplete event

          for (const event of events) {
            const dataLine = event.split('\n').find(l => l.startsWith('data: '));
            if (!dataLine) continue;
            const jsonStr = dataLine.slice(6).trim();
            if (!jsonStr) continue;
            try {
              const data = JSON.parse(jsonStr);
              console.log(`[SSE] Parsed event:`, data.text ? `text="${data.text.slice(0, 40)}..."` : data.done ? 'done=true' : data.error ? `error="${data.error}"` : 'unknown');
              if (data.error) {
                setError(data.error);
                shouldStop = true;
                break;
              }
              if (data.done) {
                shouldStop = true;
                break;
              }
              if (data.text) {
                setAnswer(prev => prev + data.text);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } catch (err) {
        setError((err as Error).message || 'Failed to generate answer');
      } finally {
        setLoading(false);
      }
    },
    []
  );
  const toggleListening = useCallback(async () => {
    if (!auth) return;

    if (isListeningRef.current) {
      await stopAudioRecording();
      return;
    }

    setError(null);
    resetTranscript();
    startAudioRecording(auth, selectedLanguageRef.current, selectedDeviceIdRef.current);
  }, [auth, startAudioRecording, stopAudioRecording, resetTranscript]);

  const askAiFromTranscript = useCallback(async () => {
    if (!authRef.current || loading) return;

    const wasListening = isListeningRef.current;
    const capturedText = `${transcriptRef.current} ${interimTranscriptRef.current}`.trim();

    const questions = extractQuestionsFromText(capturedText);
    if (questions.length === 0) {
      setError('No questions detected. Ask one or more questions, then press "Ask AI".');
      return;
    }

    // Keep listening while clearing the already-submitted transcript from the UI.
    if (wasListening) {
      resetTranscript();
      transcriptRef.current = '';
      interimTranscriptRef.current = '';
    }

    setError(null);
    const prompt = questions.join('\n');
    await triggerStreamingAnswer(authRef.current, prompt);
  }, [loading, resetTranscript, triggerStreamingAnswer]);

  const clearAll = useCallback(() => {
    resetTranscript();
    setAnswer('');
    setError(null);
    // Recording error will clear on next recording
  }, [resetTranscript]);

  const handleStealthToggle = useCallback(async (nextEnabled: boolean) => {
    if (!window.electronAPI?.setContentProtection) return;
    try {
      const applied = await window.electronAPI.setContentProtection(nextEnabled);
      setIsStealthEnabled(Boolean(applied));
    } catch (err) {
      console.error('[App] Failed to update content protection status:', err);
      setError('Failed to update screenshot visibility setting.');
    }
  }, []);

  const startResize = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!window.electronAPI?.resizeWindow) return;
    event.preventDefault();

    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = window.innerWidth;
    const startHeight = window.innerHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const nextWidth = startWidth + deltaX;
      const nextHeight = startHeight + deltaY;
      void window.electronAPI?.resizeWindow(nextWidth, nextHeight);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, []);

  const waitingContent = (
    <>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'var(--accent-bg)',
          border: '1px solid var(--accent-dim)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 013 3v5a3 3 0 01-6 0V5a3 3 0 013-3z" />
          <path d="M19 10a7 7 0 01-14 0" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </div>
      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
        Interview Buddy
      </p>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 220 }}>
        Click "Launch Interview Buddy" in VibeHired to begin a session.
      </p>
    </>
  );

  const titleBar = (
    <div
      className="drag-region"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 013 3v5a3 3 0 01-6 0V5a3 3 0 013-3z" />
          <path d="M19 10a7 7 0 01-14 0" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
          INTERVIEW BUDDY
        </span>
        {auth && !sessionReady && (
          <span style={{ fontSize: 9, color: 'var(--accent)', animation: 'pulse 1.5s infinite' }}>
            warming up...
          </span>
        )}
      </div>
      <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => void handleStealthToggle(!isStealthEnabled)}
          title={isStealthEnabled ? 'Stealth ON: hidden from screenshots/screen-share' : 'Stealth OFF: visible in screenshots/screen-share'}
          style={{
            height: 20,
            borderRadius: 999,
            border: '1px solid var(--border)',
            background: isStealthEnabled ? 'var(--accent-bg)' : 'transparent',
            color: isStealthEnabled ? 'var(--accent)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '0 7px',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          <span>{isStealthEnabled ? 'STEALTH ON' : 'STEALTH OFF'}</span>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isStealthEnabled ? 'var(--accent)' : 'var(--text-muted)',
            }}
          />
        </button>
        {/* Not-supported warning */}
        {!isSupported && (
          <span style={{ fontSize: 10, color: 'var(--rose)', background: 'var(--rose-bg)', padding: '2px 6px', borderRadius: 4 }}>
            Mic unavailable
          </span>
        )}
        {/* Hide button */}
        <button
          onClick={() => window.electronAPI?.toggleVisibility()}
          title="Hide overlay (Ctrl+Shift+H)"
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button
          onClick={() => window.electronAPI?.closeWindow()}
          title="Close Interview Buddy"
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
  // ── Waiting for deep-link auth ───────────────────────────────────────────
  if (!auth) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: 'rgba(14,14,23,0.96)',
          backdropFilter: 'blur(12px)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {titleBar}
        <div
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 16,
          }}
        >
          {waitingContent}
        </div>
      </div>
    );
  }
  // ── Main overlay UI ──────────────────────────────────────────────────────
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'rgba(14,14,23,0.96)',
        backdropFilter: 'blur(14px)',
        borderRadius: 12,
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {titleBar}

      {/* ── Transcript bar ── */}
      <TranscriptBar
        isListening={isRecording}
        isTranscribing={isTranscribing}
        isAsking={loading}
        transcript={transcript}
        interimTranscript={interimTranscript}
        selectedLanguage={selectedLanguage}
        languageOptions={STT_LANGUAGE_OPTIONS}
        onTranscriptChange={setTranscript}
        onToggleListening={toggleListening}
        onAskAi={askAiFromTranscript}
        onClear={clearAll}
        onLanguageChange={setSelectedLanguage}
        recognitionError={recordingError}
        microphones={microphones}
        selectedDeviceId={selectedDeviceId}
        onDeviceChange={setSelectedDeviceId}
      />

      {/* ── Answer panel ── */}
      <OverlayPanel answer={answer} loading={loading} error={error} />

      {/* ── Footer shortcut hints ── */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '6px 12px',
          display: 'flex',
          gap: 12,
          flexShrink: 0,
        }}
      >
        {[
          { keys: 'Ctrl+⇧+L', label: 'toggle listening' },
          { keys: 'Ctrl+⇧+Enter', label: 'ask AI' },
          { keys: 'Ctrl+⇧+H', label: 'hide' },
          { keys: 'Ctrl+⇧+C', label: 'clear' },
        ].map((hk) => (
          <span key={hk.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <kbd
              style={{
                fontSize: 9,
                fontFamily: "'JetBrains Mono', monospace",
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 3,
                padding: '1px 4px',
                color: 'var(--text-secondary)',
              }}
            >
              {hk.keys}
            </kbd>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{hk.label}</span>
          </span>
        ))}
      </div>

      <div
        className="no-drag"
        onMouseDown={startResize}
        title="Resize"
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 18,
          height: 18,
          cursor: 'nwse-resize',
          background: 'linear-gradient(135deg, transparent 50%, var(--border-bright) 50%)',
          borderBottomRightRadius: 12,
          opacity: 0.9,
        }}
      />
    </div>
  );
};

export default App;
