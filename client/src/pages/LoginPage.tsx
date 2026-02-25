// client/src/pages/LoginPage.tsx
import React, { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

// ── Inline spinner ──────────────────────────────────────────────────────────
const Spinner = () => (
  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

// ── Icons ───────────────────────────────────────────────────────────────────
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

// ── Component ────────────────────────────────────────────────────────────────
const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ email: false, password: false });

  const { login, error, isLoading, isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

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
    fontFamily: 'Outfit, sans-serif',
  };

  const features = [
    { icon: '⚡', text: 'AI-powered job matching & CV tailoring' },
    { icon: '📊', text: 'Application pipeline with real-time analytics' },
    { icon: '🚀', text: 'Automated job discovery across platforms' },
  ];

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/* ── Left editorial panel (desktop only) ── */}
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
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--accent-bg, rgba(232,184,68,0.15))', border: '1px solid rgba(232,184,68,0.25)' }}
            >
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <path d="M8 10h12M10 7h8M7 10v11a1 1 0 001 1h12a1 1 0 001-1V10M11 14h6M11 17h4"
                  stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span
              className="text-lg font-semibold"
              style={{ fontFamily: 'Fraunces, Georgia, serif', color: 'var(--text-primary)' }}
            >
              VibeHired
            </span>
          </div>
        </div>

        {/* Main editorial text */}
        <div className="relative z-10 space-y-8">
          <div>
            <h1
              className="text-4xl xl:text-5xl font-semibold leading-[1.1] tracking-tight"
              style={{ fontFamily: 'Fraunces, Georgia, serif', color: 'var(--text-primary)' }}
            >
              Land your next<br />
              <span style={{ color: 'var(--accent)' }}>role faster.</span>
            </h1>
            <p
              className="mt-4 text-base leading-relaxed max-w-sm"
              style={{ color: 'var(--text-secondary)' }}
            >
              The intelligent job application platform that helps you track, optimize,
              and automate your entire job search.
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-3.5">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-3">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                  style={{ backgroundColor: 'var(--accent-bg, rgba(232,184,68,0.1))', border: '1px solid rgba(232,184,68,0.2)' }}
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

      {/* ── Right form panel ── */}
      <div
        className="flex flex-col justify-center w-full md:w-[440px] lg:w-[480px] xl:w-[520px] flex-shrink-0 p-8 md:p-12"
        style={{ backgroundColor: 'var(--bg-base)' }}
      >
        {/* Theme toggle + mobile brand */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-2 md:hidden">
            <span style={{ color: 'var(--accent)', fontSize: '1.25rem' }}>
              <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="8" fill="var(--accent)" fillOpacity="0.12" />
                <path d="M8 10h12M10 7h8M7 10v11a1 1 0 001 1h12a1 1 0 001-1V10M11 14h6M11 17h4"
                  stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span
              className="font-semibold"
              style={{ fontFamily: 'Fraunces, Georgia, serif', color: 'var(--text-primary)' }}
            >
              VibeHired
            </span>
          </div>
          <div className="md:ml-auto">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </div>

        {/* Heading */}
        <div className="mb-8">
          <h2
            className="text-[1.875rem] font-semibold tracking-tight"
            style={{ fontFamily: 'Fraunces, Georgia, serif', color: 'var(--text-primary)' }}
          >
            Welcome back
          </h2>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Sign in to continue to your dashboard
          </p>
        </div>

        {/* Error alert */}
        {error && (
          <div
            className="flex items-start gap-2.5 rounded-lg p-3.5 mb-6 text-sm"
            style={{
              backgroundColor: 'var(--rose-bg, rgba(244,100,100,0.08))',
              border: '1px solid rgba(244,100,100,0.2)',
              color: 'var(--rose, #f46464)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
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
                borderColor: touched.email && emailError ? 'rgba(244,100,100,0.6)'
                  : email && touched.email && !emailError ? 'rgba(45,212,160,0.5)'
                  : 'var(--border)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,184,68,0.1)';
              }}
            />
            {touched.email && emailError && (
              <p className="mt-1.5 text-xs" style={{ color: 'var(--rose, #f46464)' }}>{emailError}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Password
            </label>
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
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,184,68,0.1)';
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
              color: '#0e0e17',
              boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset, 0 2px 8px rgba(232,184,68,0.2)',
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
                <Spinner />
                <span>Signing in…</span>
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

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
