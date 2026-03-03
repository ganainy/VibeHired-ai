// client/src/pages/VerifyEmailPage.tsx
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { verifyEmailToken, resendVerificationEmail } from '../services/authApi';
import Spinner from '../components/common/Spinner';

const SunIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
);

const MoonIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
);

const VerifyEmailPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');
    const [resendEmail, setResendEmail] = useState('');
    const [resendState, setResendState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const handleResend = async () => {
        if (!resendEmail) return;
        setResendState('loading');
        try {
            await resendVerificationEmail(resendEmail);
            setResendState('sent');
        } catch {
            setResendState('error');
        }
    };

    useEffect(() => {
        const performVerification = async () => {
            if (!token) {
                setStatus('error');
                setMessage('Invalid or missing verification token.');
                return;
            }

            try {
                const response = await verifyEmailToken(token);
                setStatus('success');
                setMessage(response.message || 'Email verified successfully!');
            } catch (error: any) {
                setStatus('error');
                setMessage(error.message || 'Verification failed. The link may have expired.');
            }
        };

        performVerification();
    }, [token]);

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center p-6"
            style={{ backgroundColor: 'var(--bg-base)' }}
        >
            {/* Theme toggle */}
            <div className="absolute top-5 right-5">
                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                    aria-label="Toggle theme"
                >
                    {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                </button>
            </div>

            <div
                className="w-full max-w-[420px] rounded-2xl p-8"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
                <div className="text-center">
                    {status === 'loading' && (
                        <div className="py-10">
                            <Spinner size="lg" />
                            <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                Verifying your email address...
                            </p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="py-4">
                            <div
                                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                                style={{ backgroundColor: 'rgba(45,212,160,0.12)', border: '1px solid rgba(45,212,160,0.25)' }}
                            >
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2dd4a0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                            <h1
                                className="text-2xl font-semibold mb-2"
                                style={{ fontFamily: 'Fraunces, Georgia, serif', color: 'var(--text-primary)' }}
                            >
                                Email Verified
                            </h1>
                            <p className="text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
                                {message}
                            </p>
                            <button
                                onClick={() => navigate('/login', { replace: true })}
                                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-sm transition-all"
                                style={{
                                    backgroundColor: 'var(--accent)',
                                    color: '#0e0e17',
                                    boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset, 0 2px 8px rgba(232,184,68,0.2)',
                                }}
                            >
                                Sign In
                            </button>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="py-4">
                            <div
                                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                                style={{ backgroundColor: 'rgba(244,100,100,0.12)', border: '1px solid rgba(244,100,100,0.25)' }}
                            >
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f46464" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                            </div>
                            <h1
                                className="text-2xl font-semibold mb-2"
                                style={{ fontFamily: 'Fraunces, Georgia, serif', color: 'var(--text-primary)' }}
                            >
                                Verification Failed
                            </h1>
                            <p className="text-sm mb-6" style={{ color: 'var(--rose, #f46464)' }}>
                                {message}
                            </p>

                            {/* Request a new link */}
                            <div className="mb-6 text-left">
                                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Request a new verification link</p>
                                <input
                                    type="email"
                                    value={resendEmail}
                                    onChange={(e) => setResendEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    className="w-full rounded-xl px-3 py-2.5 text-sm mb-2 outline-none"
                                    style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}
                                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                                />
                                {resendState === 'sent' && (
                                    <p className="text-xs mb-2" style={{ color: 'var(--jade, #2dd4a0)' }}>New link sent — check your inbox!</p>
                                )}
                                {resendState === 'error' && (
                                    <p className="text-xs mb-2" style={{ color: 'var(--rose, #f46464)' }}>Could not send. Please try again.</p>
                                )}
                                <button
                                    onClick={handleResend}
                                    disabled={!resendEmail || resendState === 'loading' || resendState === 'sent'}
                                    className="w-full rounded-xl py-2.5 text-sm font-medium transition-all"
                                    style={{
                                        backgroundColor: 'var(--bg-elevated)',
                                        color: 'var(--text-primary)',
                                        border: '1px solid var(--border)',
                                        opacity: (!resendEmail || resendState === 'loading' || resendState === 'sent') ? 0.6 : 1,
                                        cursor: (!resendEmail || resendState === 'loading' || resendState === 'sent') ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    {resendState === 'loading' ? 'Sending…' : resendState === 'sent' ? '✓ Link sent' : 'Send new verification link'}
                                </button>
                            </div>

                            <Link
                                to="/login"
                                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-sm transition-all"
                                style={{
                                    backgroundColor: 'var(--bg-elevated)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--border)',
                                }}
                            >
                                Back to Sign In
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VerifyEmailPage;
