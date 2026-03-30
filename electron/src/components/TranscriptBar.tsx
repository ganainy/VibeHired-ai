// electron/src/components/TranscriptBar.tsx
import React from 'react';

interface TranscriptBarProps {
  isListening: boolean;
  isTranscribing: boolean;
  isAsking: boolean;
  transcript: string;
  interimTranscript: string;
  selectedLanguage: string;
  languageOptions: Array<{ value: string; label: string }>;
  onTranscriptChange: (text: string) => void;
  onToggleListening: () => void;
  onAskAi: () => void;
  onClear: () => void;
  onLanguageChange: (language: string) => void;
  recognitionError: string | null;
  microphones: { deviceId: string; label: string }[];
  selectedDeviceId: string | null;
  onDeviceChange: (deviceId: string | null) => void;
}

const TranscriptBar: React.FC<TranscriptBarProps> = ({
  isListening,
  isTranscribing,
  isAsking,
  transcript,
  interimTranscript,
  selectedLanguage,
  languageOptions,
  onTranscriptChange,
  onToggleListening,
  onAskAi,
  onClear,
  onLanguageChange,
  recognitionError,
  microphones,
  selectedDeviceId,
  onDeviceChange,
}) => {
  const [showSettings, setShowSettings] = React.useState(false);
  const displayText = transcript;
  const interimPreview = interimTranscript.trim();

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {/* ── Listen toggle ── */}
        <button
          className="no-drag"
          onClick={onToggleListening}
          title={isListening ? 'Turn listening off' : 'Turn listening on'}
          style={{
            width: 62,
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
            {isListening ? 'ON' : isTranscribing ? 'WAIT' : 'OFF'}
          </span>
        </button>

        <button
          onClick={onAskAi}
          className="no-drag"
          disabled={isAsking || isTranscribing}
          title="Send detected questions to AI"
          style={{
            height: 32,
            minWidth: 74,
            borderRadius: 8,
            border: '1px solid var(--accent-dim)',
            background: isAsking || isTranscribing ? 'var(--bg-raised)' : 'var(--accent-bg)',
            color: isAsking || isTranscribing ? 'var(--text-muted)' : 'var(--accent)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.05em',
            cursor: isAsking || isTranscribing ? 'not-allowed' : 'pointer',
            padding: '0 10px',
            flexShrink: 0,
            WebkitAppRegion: 'no-drag',
          }}
        >
          {isAsking ? 'ASKING...' : 'ASK AI'}
        </button>

        <button
          onClick={() => setShowSettings((prev) => !prev)}
          className="no-drag"
          title="Open audio settings"
          style={{
            height: 32,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-raised)',
            color: 'var(--text-secondary)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
            cursor: 'pointer',
            padding: '0 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            WebkitAppRegion: 'no-drag',
          }}
        >
          SETTINGS
          <span style={{ fontSize: 10, opacity: 0.8 }}>
            {showSettings ? '▲' : '▼'}
          </span>
        </button>

        {displayText && (
          <button
            onClick={onClear}
            className="no-drag"
            title="Clear (Ctrl+Shift+C)"
            style={{
              height: 32,
              minWidth: 56,
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              flexShrink: 0,
              marginLeft: 'auto',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span style={{ fontSize: 10 }}>Clear</span>
          </button>
        )}
      </div>

      {showSettings && (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 10,
            background: 'var(--bg-raised)',
            padding: '8px 10px',
            display: 'grid',
            gap: 8,
          }}
        >
          <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.04em', fontWeight: 700 }}>
            SETTINGS
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 150 }}>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.04em', fontWeight: 700 }}>
                Transcription language
              </label>
              <select
                className="no-drag"
                value={selectedLanguage}
                onChange={(e) => onLanguageChange(e.target.value)}
                title="Select transcription language"
                style={{
                  height: 32,
                  fontSize: 10,
                  fontFamily: 'inherit',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-secondary)',
                  padding: '0 8px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  minWidth: 150,
                  maxWidth: 220,
                  outline: 'none',
                  WebkitAppRegion: 'no-drag',
                }}
              >
                {languageOptions.map((lang) => (
                  <option
                    key={lang.value}
                    value={lang.value}
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
                  >
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.04em', fontWeight: 700 }}>
                Input microphone
              </label>
              <select
                className="no-drag"
                value={selectedDeviceId ?? 'default'}
                onChange={(e) => onDeviceChange(e.target.value === 'default' ? null : e.target.value)}
                title="Select microphone"
                style={{
                  height: 32,
                  fontSize: 10,
                  fontFamily: 'inherit',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text-secondary)',
                  padding: '0 8px',
                  cursor: 'pointer',
                  flexShrink: 0,
                  minWidth: 180,
                  maxWidth: 280,
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
            </div>
          </div>
        </div>
      )}

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

      {/* ── Transcript text (editable) ── */}
      <div style={{ width: '100%', minWidth: 0 }}>
        <textarea
          className="no-drag"
          value={displayText}
          onChange={(event) => onTranscriptChange(event.target.value)}
          readOnly={false}
          placeholder={
            isTranscribing
              ? 'Transcribing...'
              : isListening
              ? 'Listening... capture everything, then press Ask AI'
              : 'Turn listening ON, then edit text here if needed before pressing Ask AI'
          }
          style={{
            width: '100%',
            minHeight: 72,
            maxHeight: 150,
            resize: 'vertical',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-raised)',
            color: 'var(--text-secondary)',
            fontSize: 12,
            lineHeight: 1.45,
            padding: '8px 10px',
            outline: 'none',
            opacity: 1,
          }}
        />
        {interimPreview && (
          <p style={{ margin: '6px 2px 0', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            Live interim: {interimPreview}
          </p>
        )}
      </div>

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
