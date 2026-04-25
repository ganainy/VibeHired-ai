// client/src/pages/LoginPage.tsx
import React, { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';

import { getGoogleLoginUrl, resendVerificationEmail } from '../services/authApi';
import Spinner from '../components/common/Spinner';
import { VibeHiredLogo } from '../components/VibeHiredLogo';



//  Icons 
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


//  Component 
const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showResendOption, setShowResendOption] = useState(false);

  const { login, error, isLoading, isAuthenticated } = useAuth();
  
  const navigate = useNavigate();
  const location = useLocation();

  // Show error if Google Sign-In failed and server redirected back
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('error') === 'google_failed') {
      setGoogleError('Google sign-in failed. Please try again.');
    }
  }, [location.search]);

  // Clear verification sent when error changes
  useEffect(() => {
    if (error) {
      setVerificationSent(false);
      if (error.includes('verify your email')) {
        setShowResendOption(true);
      }
    }
  }, [error]);

  const handleGoogleLogin = async () => {
    setGoogleError(null);
    setGoogleLoading(true);
    try {
      const url = await getGoogleLoginUrl();
      window.location.href = url;
    } catch {
      setGoogleError('Could not connect to Google. Please try again.');
      setGoogleLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    setResendingVerification(true);
    try {
      await resendVerificationEmail(email);
      setVerificationSent(true);
      setResendCooldown(60); // 60 second cooldown
      const timer = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      // Error is already handled
    } finally {
      setResendingVerification(false);
    }
  };

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setEmail(v);
    if (touched.email) {
      setEmailError(v && !validateEmail(v) ? 'Please enter a valid email address' : null);
    }
  };

  const handleBlur = (field: 'email' | 'password') => {
    setTouched(p => ({ ...p, [field]: true }));
    if (field === 'email') {
      setEmailError(email && !validateEmail(email) ? 'Please enter a valid email address' : null);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!validateEmail(email)) { setEmailError('Please enter a valid email address'); return; }
    setEmailError(null);
    await login({ email, password });
  };

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

  const features = [
    {
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M9 13h6M9 17h4" />
          <path d="M9 9h1" />
        </svg>
      ),
      text: 'AI-tailored CV & cover letter for every role',
    },
    {
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
        </svg>
      ),
      text: 'Every application, deadline & interview in one place',
    },
    {
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
          <path d="M3 20h18" />
        </svg>
      ),
      text: 'Stats & insights across your entire job search',
    },
  ];

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/*  Left editorial panel (desktop only)  */}
      <div
        className="hidden md:flex flex-col justify-between flex-1 p-12 xl:p-16 relative overflow-hidden"
        style={{ backgroundColor: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}
      >
        {/* Decorative geometric background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Large circle */}
          <div
            className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-[0.04]"
            style={{ backgroundColor: 'var(--accent)' }}
          />
          {/* Grid dots */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="var(--accent)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
          {/* Bottom left circle */}
          <div
            className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full opacity-[0.04]"
            style={{ backgroundColor: 'var(--accent)' }}
          />
        </div>

        {/* Brand */}
        <div className="relative z-10">
          <VibeHiredLogo size={44} />
        </div>

        {/* Main editorial text */}
        <div className="relative z-10 space-y-8">
          <div>
            <h1
              className="text-4xl xl:text-5xl font-semibold leading-[1.1] tracking-tight"
              style={{ fontFamily: 'Lora, Georgia, serif', color: 'var(--text-primary)' }}
            >
              Tailored applications,<br />
              <span style={{ color: 'var(--accent)' }}>all in one place.</span>
            </h1>
            <p
              className="mt-4 text-base leading-relaxed max-w-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              Generate tailored CVs and cover letters for every role, track every application and interview, and get insights on your progress  all from one dashboard.
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-3.5">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-3">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'var(--accent-bg)', border: '1px solid rgba(0,98,65,0.2)' }}
                >
                  {f.icon}
                </span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Decorative bottom line */}
        <div className="relative z-10">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Trusted by job seekers worldwide
          </p>
        </div>
      </div>

      {/*  Right form panel  */}
      <div
        className="flex flex-col justify-center w-full md:w-[440px] lg:w-[480px] xl:w-[520px] flex-shrink-0 p-8 md:p-12"
        style={{ backgroundColor: 'var(--bg-base)' }}
      >
        <div className="mb-10" />

        {/* Heading */}
        <div className="mb-8">
          <h2
            className="text-[1.875rem] font-semibold tracking-tight"
            style={{ fontFamily: 'Lora, Georgia, serif', color: 'var(--text-primary)' }}
          >
            Welcome back
          </h2>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Sign in to continue to your dashboard
          </p>
        </div>

        {/* Error alert */}
        {(error || showResendOption) && (
          <div
            className="flex items-start gap-2.5 rounded-lg p-3.5 mb-6 text-sm"
            style={{
              backgroundColor: 'var(--rose-bg)',
              border: '1px solid rgba(200,32,20,0.2)',
              color: 'var(--rose)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="flex-1">
              <span>{error || 'Please verify your email before logging in. Check your inbox for the verification link.'}</span>
              {(showResendOption) && (
                <div className="mt-2">
                  {verificationSent ? (
                    <span className="text-green-500"> Verification email sent! Check your inbox.</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={resendingVerification || resendCooldown > 0}
                      className="text-xs underline hover:no-underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resendingVerification ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification email'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Email */}
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
              required
              value={email}
              onChange={handleEmailChange}
              onBlur={() => handleBlur('email')}
              placeholder="you@example.com"
              style={{
                ...inputStyle,
                borderColor: touched.email && emailError ? 'rgba(200,32,20,0.6)'
                  : email && touched.email && !emailError ? 'rgba(45,212,160,0.5)'
                    : 'var(--border)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-bg)';
              }}
            />
            {touched.email && emailError && (
              <p className="mt-1.5 text-xs" style={{ color: 'var(--rose)' }}>{emailError}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="password"
                className="block text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => handleBlur('password')}
                placeholder="Enter your password"
                style={{ ...inputStyle, paddingRight: '2.75rem' }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-bg)';
                }}
                onBlurCapture={(e) => {
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

          {/* Submit */}
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
            onMouseEnter={(e) => {
              if (!isLoading) {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-hover)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            }}
          >
            {isLoading ? (
              <>
                <Spinner size="xs" />
                <span>Connecting</span>
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        {/* Google error */}
        {googleError && (
          <div
            className="flex items-start gap-2.5 rounded-lg p-3.5 mt-5 text-sm"
            style={{
              backgroundColor: 'var(--rose-bg)',
              border: '1px solid rgba(200,32,20,0.2)',
              color: 'var(--rose)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{googleError}</span>
          </div>
        )}

        {/* Divider */}
        <div className="mt-6 flex items-center gap-3">
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>or</span>
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
        </div>

        {/* Google Sign-In */}
        <button
          type="button"
          disabled={googleLoading || isLoading}
          onClick={handleGoogleLogin}
          className="mt-4 w-full flex items-center justify-center gap-2.5 rounded-xl py-3 text-sm font-medium transition-all"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            opacity: googleLoading || isLoading ? 0.6 : 1,
            cursor: googleLoading || isLoading ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={(e) => { if (!googleLoading && !isLoading) (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
        >
          {googleLoading ? (
            <><Spinner /><span>Connecting</span></>
          ) : (
            <>
              {/* Google logo */}
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        {/* Divider + register link */}
        <div className="mt-8 text-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Don't have an account?{' '}
            <Link
              to="/register"
              className="font-medium transition-colors"
              style={{ color: 'var(--accent)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
            >
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

