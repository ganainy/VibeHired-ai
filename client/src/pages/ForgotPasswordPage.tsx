// client/src/pages/ForgotPasswordPage.tsx
import React, { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { forgotPassword } from '../services/authApi';
import Spinner from '../components/common/Spinner';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: '0.625rem',
    color: 'var(--text-primary)',
    fontSize: '0.9375rem',
    padding: '0.7rem 1rem',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    fontFamily: 'Inter, sans-serif',
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email) { setError('Email is required.'); return; }
    setIsLoading(true);
    try {
      await forgotPassword(email);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      <div
        className="w-full max-w-[420px] rounded-2xl p-8"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        {/* Icon */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center mb-6"
          style={{ backgroundColor: 'var(--accent-bg)', border: '1px solid rgba(0,98,65,0.25)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
          </svg>
        </div>

        {!submitted ? (
          <>
            <h1
              className="text-2xl font-semibold tracking-tight mb-1.5"
              style={{ fontFamily: 'Lora, Georgia, serif', color: 'var(--text-primary)' }}
            >
              Reset your password
            </h1>
            <p className="text-sm mb-7" style={{ color: 'var(--text-secondary)' }}>
              Enter your account email and we'll send a reset link.
            </p>

            {error && (
              <div
                className="flex items-start gap-2.5 rounded-lg p-3.5 mb-5 text-sm"
                style={{
                  backgroundColor: 'var(--rose-bg)',
                  border: '1px solid rgba(200,32,20,0.2)',
                  color: 'var(--rose)',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-1.5"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-bg)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-sm transition-all"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--text-on-accent)',
                  boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset, 0 2px 8px rgba(0,98,65,0.2)',
                  opacity: isLoading ? 0.7 : 1,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => { if (!isLoading) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)'; }}
              >
                {isLoading ? <><Spinner size="xs" /><span>Sending</span></> : 'Send reset link'}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'rgba(0,98,65,0.10)', border: '1px solid rgba(0,98,65,0.2)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2
              className="text-xl font-semibold mb-2"
              style={{ fontFamily: 'Lora, Georgia, serif', color: 'var(--text-primary)' }}
            >
              Check your inbox
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              If <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> is registered,
              you'll receive a reset link shortly.
            </p>
          </div>
        )}

        <div className="mt-7 text-center">
          <Link
            to="/login"
            className="text-sm transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
          >
             Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;