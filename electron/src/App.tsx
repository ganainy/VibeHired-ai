// electron/src/App.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AuthPayload } from './electron.d';
import { AnswerResult, fetchAnswer } from './services/api';
import { useSpeechRecognition } from './hooks/useSpeechRecognition';
import TranscriptBar from './components/TranscriptBar';
import OverlayPanel from './components/OverlayPanel';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthPayload | null>(null);
  const [answer, setAnswer] = useState<AnswerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mirrors transcript state for reading inside callbacks without stale closure
  const transcriptRef = useRef('');
  const authRef = useRef<AuthPayload | null>(null);
  const prevIsListeningRef = useRef(false);

  const {
    startListening,
    stopListening,
    transcript,
    interimTranscript,
    resetTranscript,
    isListening,
    isSupported,
  } = useSpeechRecognition();

  // Keep refs in sync
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { authRef.current = auth; }, [auth]);

  // ── Register IPC listeners once ──────────────────────────────────────────
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.signalReady();

    window.electronAPI.onAuthPayload((payload) => {
      setAuth(payload);
      setAnswer(null);
      setError(null);
      resetTranscript();
    });

    window.electronAPI.onHotkey((action) => {
      if (action === 'push-to-talk-start') {
        const currentAuth = authRef.current;
        if (currentAuth && !isListeningRef.current) {
          setAnswer(null);
          setError(null);
          resetTranscript();
          startListening('en-US');
        }
      } else if (action === 'push-to-talk-stop') {
        if (isListeningRef.current) {
          stopListening();
        }
      } else if (action === 'clear-answer') {
        clearAll();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a ref so the IPC handler above can read current isListening without re-registering
  const isListeningRef = useRef(false);
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);

  // ── Auto-generate when recognition ends (push-to-talk release or natural end)
  useEffect(() => {
    const wasListening = prevIsListeningRef.current;
    prevIsListeningRef.current = isListening;

    if (wasListening && !isListening) {
      // Recognition just stopped — generate answer if there's content
      const captured = transcriptRef.current.trim();
      const currentAuth = authRef.current;
      if (captured.length > 2 && currentAuth && !loading) {
        triggerAnswer(currentAuth, captured);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  const triggerAnswer = useCallback(
    async (currentAuth: AuthPayload, question: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAnswer(
          currentAuth.apiUrl,
          currentAuth.token,
          currentAuth.jobId,
          question
        );
        setAnswer(result);
      } catch (err) {
        setError((err as Error).message || 'Failed to generate answer');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ── Push-to-talk: hold button / shortcut ─────────────────────────────────
  const startRecording = useCallback(() => {
    console.log('[App] startRecording called, isListeningRef.current:', isListeningRef.current);
    if (isListeningRef.current) {
      console.log('[App] startRecording: already listening, returning');
      return;
    }
    setAnswer(null);
    setError(null);
    resetTranscript();
    console.log('[App] calling startListening');
    startListening('en-US');
  }, [startListening, resetTranscript]);

  const stopRecording = useCallback(() => {
    console.log('[App] stopRecording called, isListeningRef.current:', isListeningRef.current);
    if (!isListeningRef.current) {
      console.log('[App] stopRecording: not listening, returning');
      return;
    }
    console.log('[App] calling stopListening');
    stopListening(); // isListening effect above will trigger answer generation
  }, [stopListening]);

  const clearAll = useCallback(() => {
    stopListening();
    resetTranscript();
    setAnswer(null);
    setError(null);
    transcriptRef.current = '';
  }, [stopListening, resetTranscript]);

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
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          overflow: 'hidden',
        }}
      >
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
      }}
    >
      {/* ── Title bar (draggable) ── */}
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
        </div>

        <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
        </div>
      </div>

      {/* ── Transcript bar ── */}
      <TranscriptBar
        isListening={isListening}
        transcript={transcript}
        interimTranscript={interimTranscript}
        onPushStart={startRecording}
        onPushStop={stopRecording}
        onClear={clearAll}
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
          { keys: 'Ctrl+⇧+Space', label: 'hold to record' },
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
    </div>
  );
};

export default App;
