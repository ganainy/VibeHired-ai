// client/src/pages/ResetPasswordPage.tsx
import React, { useState, FormEvent } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';

import { resetPassword } from '../services/authApi';
import Spinner from '../components/common/Spinner';

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" />
  </svg>
);

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

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

  if (!token) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{ backgroundColor: 'var(--bg-base)' }}
      >
        <div className="text-center space-y-4">
          <p style={{ color: 'var(--rose)' }}>Invalid or missing reset token.</p>
          <Link to="/forgot-password" style={{ color: 'var(--accent)', fontSize: '0.875rem' }}>
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setIsLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Reset failed. The link may have expired.');
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
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        {!done ? (
          <>
            <h1
              className="text-2xl font-semibold tracking-tight mb-1.5"
              style={{ fontFamily: 'Lora, Georgia, serif', color: 'var(--text-primary)' }}
            >
              Set new password
            </h1>
            <p className="text-sm mb-7" style={{ color: 'var(--text-secondary)' }}>
              Choose a strong password for your account.
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
                <label htmlFor="password" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  New password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    autoFocus
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    style={{ ...inputStyle, paddingRight: '2.75rem' }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-bg)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your new password"
                  style={{
                    ...inputStyle,
                    borderColor: confirmPassword && confirmPassword !== password
                      ? 'rgba(200,32,20,0.6)'
                      : confirmPassword && confirmPassword === password
                        ? 'rgba(45,212,160,0.5)'
                        : 'var(--border)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--accent)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-bg)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = confirmPassword && confirmPassword !== password
                      ? 'rgba(200,32,20,0.6)'
                      : confirmPassword && confirmPassword === password
                        ? 'rgba(45,212,160,0.5)'
                        : 'var(--border)';
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
                {isLoading ? <><Spinner size="xs" /><span>Updating</span></> : 'Update password'}
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
              Password updated
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              Your password has been changed successfully.
            </p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-sm transition-all"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--text-on-accent)',
                boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset, 0 2px 8px rgba(0,98,65,0.2)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)'; }}
            >
              Sign in
            </button>
          </div>
        )}

        {!done && (
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
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;

