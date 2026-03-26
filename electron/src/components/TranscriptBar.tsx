// electron/src/components/TranscriptBar.tsx
import React, { useCallback, useRef, useEffect } from 'react';

interface TranscriptBarProps {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  onPushStart: () => void;   // mousedown / touchstart → start recording
  onPushStop: () => void;    // mouseup / touchend → stop + generate
  onClear: () => void;
}

const TranscriptBar: React.FC<TranscriptBarProps> = ({
  isListening,
  transcript,
  interimTranscript,
  onPushStart,
  onPushStop,
  onClear,
}) => {
  const displayText = transcript || interimTranscript;
  const isPressedRef = useRef(false);

  // Mouse event handlers for desktop - using document-level tracking to avoid
  // mouseleave issues when component re-renders or cursor moves slightly
  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || isPressedRef.current) return; // Left click only
    event.preventDefault();
    isPressedRef.current = true;
    onPushStart();
  }, [onPushStart]);

  // Track mouse up anywhere on document (not just button) to handle
  // cases where user drags outside button before releasing
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isPressedRef.current) {
        isPressedRef.current = false;
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
          border: `1.5px solid ${isListening ? 'var(--accent)' : 'var(--border)'}`,
          background: isListening ? 'var(--accent-bg)' : 'var(--bg-raised)',
          color: isListening ? 'var(--accent)' : 'var(--text-muted)',
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
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 013 3v5a3 3 0 01-6 0V5a3 3 0 013-3z" />
          <path d="M19 10a7 7 0 01-14 0" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        <span style={{ fontSize: 8, letterSpacing: '0.03em', lineHeight: 1, opacity: 0.7 }}>
          {isListening ? 'REC' : 'HOLD'}
        </span>
      </button>

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
          <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
            {isListening
              ? 'Listening… speak the interview question'
              : 'Hold button (or Ctrl+Shift+Space) to record'}
          </p>
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
      `}</style>
    </div>
  );
};

export default TranscriptBar;
