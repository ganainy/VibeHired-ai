// electron/src/components/OverlayPanel.tsx
import React from 'react';
import { AnswerResult } from '../services/api';

interface OverlayPanelProps {
  answer: AnswerResult | null;
  loading: boolean;
  error: string | null;
}

const OverlayPanel: React.FC<OverlayPanelProps> = ({ answer, loading, error }) => {
  if (loading) {
    return (
      <div
        className="answer-scroll"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          padding: 20,
        }}
      >
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: '2px solid var(--border-bright)',
            borderTopColor: 'var(--accent)',
            display: 'inline-block',
            animation: 'spin 0.7s linear infinite',
          }}
        />
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Generating answer…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="answer-scroll"
        style={{
          flex: 1,
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            background: 'var(--rose-bg)',
            border: '1px solid rgba(244,100,100,0.2)',
            borderRadius: 10,
            padding: '10px 12px',
          }}
        >
          <p style={{ fontSize: 12, color: 'var(--rose)', fontWeight: 600, marginBottom: 2 }}>Error</p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (!answer) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          gap: 8,
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--border-bright)" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
          Answer will appear here after the interviewer asks a question.
        </p>
      </div>
    );
  }

  return (
    <div
      className="answer-scroll no-drag"
      style={{ flex: 1, padding: '14px 16px', overflowY: 'auto' }}
    >
      {/* Opener */}
      <p
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--text-primary)',
          lineHeight: 1.6,
          marginBottom: 10,
          paddingBottom: 10,
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {answer.opener}
      </p>

      {/* Key points */}
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
        {answer.keyPoints.map((point, i) => (
          <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span
              style={{
                flexShrink: 0,
                width: 18,
                height: 18,
                borderRadius: 5,
                background: 'var(--accent-bg)',
                border: '1px solid var(--accent-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 1,
              }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.6, flex: 1 }}>
              {point}
            </p>
          </li>
        ))}
      </ul>

      {/* Closing */}
      <p
        style={{
          fontSize: 12.5,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          paddingTop: 10,
          borderTop: '1px solid var(--border-subtle)',
          fontStyle: 'italic',
        }}
      >
        {answer.closing}
      </p>
    </div>
  );
};

export default OverlayPanel;
