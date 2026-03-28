// electron/src/components/TranscriptBar.tsx
import React, { useCallback, useRef, useEffect } from 'react';

interface TranscriptBarProps {
  isListening: boolean;
  isTranscribing: boolean;
  transcript: string;
  interimTranscript: string;
  onPushStart: () => void;   // mousedown / touchstart → start recording
  onPushStop: () => void;    // mouseup / touchend → stop + generate
  onClear: () => void;
  recognitionError: string | null;
  microphones: { deviceId: string; label: string }[];
  selectedDeviceId: string | null;
  onDeviceChange: (deviceId: string | null) => void;
}

const TranscriptBar: React.FC<TranscriptBarProps> = ({
  isListening,
  isTranscribing,
  transcript,
  interimTranscript,
  onPushStart,
  onPushStop,
  onClear,
  recognitionError,
  microphones,
  selectedDeviceId,
  onDeviceChange,
}) => {
  const displayText = transcript || interimTranscript;
  const isPressedRef = useRef(false);

  // Mouse event handlers for desktop - using document-level tracking to avoid
  // mouseleave issues when component re-renders or cursor moves slightly
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    console.log('[TranscriptBar] handleMouseDown, isPressedRef:', isPressedRef.current);
    if (event.button !== 0 || isPressedRef.current) return; // Left click only
    event.preventDefault();
    isPressedRef.current = true;
    console.log('[TranscriptBar] calling onPushStart');
    onPushStart();
  }, [onPushStart]);

  // Track mouse up anywhere on document (not just button) to handle
  // cases where user drags outside button before releasing
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      console.log('[TranscriptBar] handleGlobalMouseUp, isPressedRef:', isPressedRef.current);
      if (isPressedRef.current) {
        isPressedRef.current = false;
        console.log('[TranscriptBar] calling onPushStop');
        onPushStop();
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [onPushStop]);

  // Touch event handlers for mobile/touch devices
  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLButtonElement>) => {
    if (isPressedRef.current) return;
    event.preventDefault(); // Prevent scroll/zoom
    isPressedRef.current = true;
    onPushStart();
  }, [onPushStart]);

  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLButtonElement>) => {
    if (!isPressedRef.current) return;
    event.preventDefault();
    isPressedRef.current = false;
    onPushStop();
  }, [onPushStop]);

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
      }}
    >
      {/* ── Push-to-talk mic button ── */}
      <button
        className="no-drag"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        title={isListening ? 'Release to generate answer' : 'Hold to record question'}
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          border: `1.5px solid ${isListening || isTranscribing ? 'var(--accent)' : 'var(--border)'}`,
          background: isListening || isTranscribing ? 'var(--accent-bg)' : 'var(--bg-raised)',
          color: isListening || isTranscribing ? 'var(--accent)' : 'var(--text-muted)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'all 0.12s',
          position: 'relative',
          userSelect: 'none',
          gap: 2,
          outline: 'none',
          WebkitAppRegion: 'no-drag',
          WebkitUserSelect: 'none' as React.CSSProperties['WebkitUserSelect'],
        }}
      >
        {isListening && (
          <>
            <span style={{
              position: 'absolute', inset: -4, borderRadius: 14,
              border: '1.5px solid var(--accent)', opacity: 0.4,
              animation: 'pulse-ring 1.2s ease-out infinite',
            }} />
            <span style={{
              position: 'absolute', inset: -8, borderRadius: 18,
              border: '1px solid var(--accent)', opacity: 0.2,
              animation: 'pulse-ring 1.2s ease-out 0.3s infinite',
            }} />
          </>
        )}
        {isTranscribing && (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
        )}
        {!isTranscribing && (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 013 3v5a3 3 0 01-6 0V5a3 3 0 013-3z" />
            <path d="M19 10a7 7 0 01-14 0" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
        <span style={{ fontSize: 8, letterSpacing: '0.03em', lineHeight: 1, opacity: 0.7 }}>
          {isListening ? 'REC' : isTranscribing ? 'WAIT' : 'HOLD'}
        </span>
      </button>

      {/* Microphone selector */}
      <select
        className="no-drag"
        value={selectedDeviceId ?? 'default'}
        onChange={(e) => onDeviceChange(e.target.value === 'default' ? null : e.target.value)}
        title="Select microphone"
        style={{
          height: 32,
          fontSize: 10,
          fontFamily: 'inherit',
          background: 'var(--bg-raised)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          color: 'var(--text-secondary)',
          padding: '0 4px',
          cursor: 'pointer',
          flexShrink: 0,
          maxWidth: 140,
          outline: 'none',
          WebkitAppRegion: 'no-drag',
        }}
      >
        <option value="default" style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
          Default mic
        </option>
        {microphones.map((mic) => (
          <option
            key={mic.deviceId}
            value={mic.deviceId}
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          >
            {mic.label || `Microphone (${mic.deviceId.slice(0, 8)})`}
          </option>
        ))}
      </select>

      {/* ── Speech recognition error ── */}
      {recognitionError && !displayText && (
        <div style={{
          flex: 1,
          padding: '8px 10px',
          borderRadius: 8,
          background: 'var(--rose-bg)',
          border: '1px solid rgba(244,100,100,0.2)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--rose)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p style={{ fontSize: 11, color: 'var(--rose)', lineHeight: 1.5, margin: 0 }}>
            {recognitionError}
          </p>
        </div>
      )}

      {/* ── Transcript text ── */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
        {displayText ? (
          <p style={{
            fontSize: 12,
            color: interimTranscript && !transcript ? 'var(--text-muted)' : 'var(--text-secondary)',
            lineHeight: 1.5,
            wordBreak: 'break-word',
            margin: 0,
          }}>
            {transcript}
            {interimTranscript && (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                {transcript ? ' ' : ''}{interimTranscript}
              </span>
            )}
          </p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isTranscribing && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            )}
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
              {isTranscribing
                ? 'Transcribing...'
                : isListening
                ? 'Listening… speak the interview question'
                : 'Hold button (or Ctrl+Shift+Space) to record'}
            </p>
          </div>
        )}
      </div>

      {/* ── Clear button ── */}
      {displayText && (
        <button
          onClick={onClear}
          className="no-drag"
          title="Clear (Ctrl+Shift+C)"
          style={{
            width: 24, height: 24, borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default TranscriptBar;
