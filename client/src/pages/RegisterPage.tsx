// client/src/pages/RegisterPage.tsx
import React, { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

import { getGoogleLoginUrl, resendVerificationEmail } from '../services/authApi';
import Spinner from '../components/common/Spinner';
import { VibeHiredLogo } from '../components/VibeHiredLogo';



//  Icons 
const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" /><path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" />
  </svg>
);



//  Password strength 
type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

const calculatePasswordStrength = (password: string): PasswordStrength => {
  if (password.length === 0) return 'weak';
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  if (strength <= 2) return 'weak';
  if (strength === 3) return 'fair';
  if (strength === 4) return 'good';
  return 'strong';
};

const strengthConfig: Record<PasswordStrength, { label: string; color: string; segments: number }> = {
  weak: { label: 'Weak', color: 'var(--rose)', segments: 1 },
  fair: { label: 'Fair', color: 'var(--ember)', segments: 2 },
  good: { label: 'Good', color: 'var(--accent)', segments: 3 },
  strong: { label: 'Strong', color: 'var(--jade)', segments: 4 },
};

//  Component 
const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string>('');
  const [emailSendFailed, setEmailSendFailed] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [touched, setTouched] = useState({ email: false, username: false, password: false, confirmPassword: false });

  const { register, error: authError } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const handleGoogleSignUp = async () => {
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

  const passwordStrength = calculatePasswordStrength(password);
  const strengthInfo = strengthConfig[passwordStrength];

  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const validateUsername = (v: string): string | null => {
    if (!v.trim()) return 'Username is required';
    if (v.length < 3) return 'At least 3 characters';
    if (v.length > 30) return 'At most 30 characters';
    if (!/^[a-z0-9_-]+$/i.test(v)) return 'Letters, numbers, hyphens, underscores only';
    return null;
  };
  const validatePassword = (v: string): string | null =>
    v.length < 8 ? 'At least 8 characters required' : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, username: true, password: true, confirmPassword: true });
    setLocalError(null);

    if (!validateEmail(email)) { setEmailError('Please enter a valid email address'); return; }
    const uErr = validateUsername(username);
    if (uErr) { setUsernameError(uErr); return; }
    const pErr = validatePassword(password);
    if (pErr) { setPasswordError(pErr); return; }
    if (password !== confirmPassword) { setConfirmPasswordError('Passwords do not match'); return; }

    setEmailError(null); setUsernameError(null); setPasswordError(null); setConfirmPasswordError(null);
    setIsSubmitting(true);
    const result = await register({ email, username, password });
    setIsSubmitting(false);
    if (result?.requiresVerification) {
      setRegisteredEmail(email);
      setEmailSendFailed(result.emailSendFailed ?? false);
      setRegistrationSuccess(true);
    }
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

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'var(--accent)';
    e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-bg)';
  };
  const onBlurStyle = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.boxShadow = 'none';
  };

  const FieldError = ({ msg }: { msg: string | null | undefined }) =>
    msg ? <p className="mt-1.5 text-xs" style={{ color: 'var(--rose)' }}>{msg}</p> : null;

  // Early return: show check-email screen after successful registration
  if (registrationSuccess) {
    const handleResend = async () => {
      if (!registeredEmail) return;
      setResendStatus('loading');
      try {
        await resendVerificationEmail(registeredEmail);
        setResendStatus('sent');
      } catch {
        setResendStatus('error');
      }
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ backgroundColor: 'var(--bg-base)' }}>
        
        <div className="w-full max-w-[420px] rounded-2xl p-8 text-center" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          {/* Success confirmation  always shown regardless of email delivery status */}
          <div className="rounded-xl p-3 mb-6 flex items-center justify-center gap-2" style={{ backgroundColor: 'var(--jade-bg)', border: '1px solid rgba(0,98,65,0.2)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--jade)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-sm font-semibold" style={{ color: 'var(--jade)' }}>Account created successfully!</span>
          </div>

          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: 'var(--accent-bg)', border: '1px solid rgba(0,98,65,0.2)' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold mb-2" style={{ fontFamily: 'Lora, Georgia, serif', color: 'var(--text-primary)' }}>
            {emailSendFailed ? 'One more step' : 'Check your inbox'}
          </h1>
          {emailSendFailed ? (
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              We couldn't send the verification email to <span className="font-semibold break-all" style={{ color: 'var(--text-primary)' }}>{registeredEmail}</span>. Click below to try again  you must verify your email before signing in.
            </p>
          ) : (
            <>
              <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>We sent a verification link to</p>
              <p className="text-sm font-semibold mb-3 break-all" style={{ color: 'var(--text-primary)' }}>{registeredEmail}</p>
              <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
                Click the link in the email to activate your account. The link expires in 24 hours. Check your spam folder if you don't see it.
              </p>
            </>
          )}
          {resendStatus === 'sent' && (
            <div className="rounded-lg p-3 text-sm mb-4" style={{ backgroundColor: 'var(--jade-bg)', border: '1px solid rgba(0,98,65,0.2)', color: 'var(--jade)' }}>
              New verification email sent  check your inbox!
            </div>
          )}
          {resendStatus === 'error' && (
            <div className="rounded-lg p-3 text-sm mb-4" style={{ backgroundColor: 'var(--rose-bg)', border: '1px solid rgba(200,32,20,0.2)', color: 'var(--rose)' }}>
              Could not resend. Please try again later.
            </div>
          )}
          <button
            onClick={handleResend}
            disabled={resendStatus === 'loading' || resendStatus === 'sent'}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all mb-4"
            style={{
              backgroundColor: emailSendFailed ? 'var(--accent)' : 'var(--bg-elevated)',
              color: emailSendFailed ? 'var(--text-on-accent)' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
              opacity: resendStatus === 'loading' || resendStatus === 'sent' ? 0.6 : 1,
              cursor: resendStatus === 'loading' || resendStatus === 'sent' ? 'not-allowed' : 'pointer',
            }}
          >
            {resendStatus === 'loading' ? 'Sending' : resendStatus === 'sent' ? ' Sent' : 'Resend verification email'}
          </button>
          <Link to="/login" className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      {/*  Left panel  */}
      <div
        className="hidden md:flex flex-col justify-between flex-1 p-12 xl:p-16 relative overflow-hidden"
        style={{ backgroundColor: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}
      >
        {/* Decorative background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -left-20 w-80 h-80 rounded-full opacity-[0.04]" style={{ backgroundColor: 'var(--accent)' }} />
          <svg className="absolute inset-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots2" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.5" fill="var(--accent)" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots2)" />
          </svg>
<div className="absolute -bottom-28 -right-16 w-72 h-72 rounded-full opacity-[0.04]"
            style={{ backgroundColor: 'var(--jade)' }} />
        </div>

        {/* Brand */}
        <div className="relative z-10">
          <VibeHiredLogo size={44} />
        </div>

        {/* Editorial text */}
        <div className="relative z-10 space-y-6">
          <h1
            className="text-4xl xl:text-5xl font-semibold leading-[1.1] tracking-tight"
            style={{ fontFamily: 'Lora, Georgia, serif', color: 'var(--text-primary)' }}
          >
            Your job search,<br />
            <span style={{ color: 'var(--accent)' }}>in one place.</span>
          </h1>
          <p className="text-base leading-relaxed max-w-sm" style={{ color: 'var(--text-secondary)' }}>
            Tailored CVs, cover letters, application tracking, calendar reminders, and stats  everything your search needs, in a single dashboard.
          </p>

          {/* Steps */}
          <ol className="space-y-4">
            {[
              { num: '01', text: 'Upload your master CV once' },
              { num: '02', text: 'Generate a tailored CV & cover letter per role' },
              { num: '03', text: 'Track applications, interviews & deadlines' },
            ].map(step => (
              <li key={step.num} className="flex items-center gap-4">
                <span
                  className="font-mono text-xs font-semibold w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: 'var(--accent-bg, var(--accent-bg))', color: 'var(--accent)', border: '1px solid rgba(0,98,65,0.2)' }}
                >
                  {step.num}
                </span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{step.text}</span>
              </li>
            ))}
          </ol>
        </div>

        <p className="relative z-10 text-xs" style={{ color: 'var(--text-muted)' }}>Free to get started  no credit card required</p>
      </div>

      {/*  Right form panel  */}
      <div
        className="flex flex-col justify-center w-full md:w-[480px] lg:w-[520px] flex-shrink-0 p-8 md:p-12 overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-base)' }}
      >
        {/* Top bar */}
        <div className="mb-8" />

        {/* Heading */}
        <div className="mb-7">
          <h2 className="text-[1.75rem] font-semibold tracking-tight" style={{ fontFamily: 'Lora, Georgia, serif', color: 'var(--text-primary)' }}>
            Create account
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Join VibeHired and start your journey</p>
        </div>

        {/* Error alert */}
        {(authError || localError) && !registrationSuccess && (
          <div className="mb-6 flex items-start gap-2.5 rounded-lg p-3.5 text-sm" style={{ backgroundColor: 'var(--rose-bg)', border: '1px solid rgba(200,32,20,0.2)', color: 'var(--rose)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{authError || localError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Username */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }} htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => {
                const v = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '');
                setUsername(v);
                setLocalError(null);
                if (touched.username) setUsernameError(validateUsername(v));
              }}
              onBlur={() => { setTouched(p => ({ ...p, username: true })); setUsernameError(validateUsername(username)); }}
              placeholder="your-handle"
              style={{ ...inputStyle }}
              onFocus={onFocus}
              onBlurCapture={onBlurStyle}
            />
            <FieldError msg={touched.username ? usernameError : null} />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }} htmlFor="reg-email">
              Email address
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (touched.email) setEmailError(e.target.value && !validateEmail(e.target.value) ? 'Please enter a valid email address' : null);
              }}
              onBlur={() => { setTouched(p => ({ ...p, email: true })); setEmailError(email && !validateEmail(email) ? 'Please enter a valid email address' : null); }}
              placeholder="you@example.com"
              style={{ ...inputStyle }}
              onFocus={onFocus}
              onBlurCapture={onBlurStyle}
            />
            <FieldError msg={touched.email ? emailError : null} />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }} htmlFor="reg-password">
              Password
            </label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (touched.password) setPasswordError(validatePassword(e.target.value));
                  if (confirmPassword && e.target.value !== confirmPassword) setConfirmPasswordError('Passwords do not match');
                  else if (confirmPassword) setConfirmPasswordError(null);
                }}
                onBlur={() => { setTouched(p => ({ ...p, password: true })); setPasswordError(validatePassword(password)); }}
                placeholder="Min. 8 characters"
                style={{ ...inputStyle, paddingRight: '2.75rem' }}
                onFocus={onFocus}
                onBlurCapture={onBlurStyle}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} aria-label="Toggle password">
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {/* Strength meter */}
            {password.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map(seg => (
                    <div
                      key={seg}
                      className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{
                        backgroundColor: seg <= strengthInfo.segments ? strengthInfo.color : 'var(--border)',
                      }}
                    />
                  ))}
                </div>
                <p className="text-xs font-mono" style={{ color: strengthInfo.color }}>{strengthInfo.label}</p>
              </div>
            )}
            <FieldError msg={touched.password ? passwordError : null} />
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }} htmlFor="confirm-password">
              Confirm password
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (touched.confirmPassword) setConfirmPasswordError(e.target.value !== password ? 'Passwords do not match' : null);
                }}
                onBlur={() => { setTouched(p => ({ ...p, confirmPassword: true })); setConfirmPasswordError(confirmPassword !== password ? 'Passwords do not match' : null); }}
                placeholder="Repeat your password"
                style={{ ...inputStyle, paddingRight: '2.75rem' }}
                onFocus={onFocus}
                onBlurCapture={onBlurStyle}
              />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} aria-label="Toggle confirm password">
                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            <FieldError msg={touched.confirmPassword ? confirmPasswordError : null} />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting || registrationSuccess}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-sm transition-all mt-2"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--text-on-accent)',
              boxShadow: '0 1px 0 rgba(255,255,255,0.15) inset, 0 2px 8px rgba(0,98,65,0.2)',
              opacity: (isSubmitting || registrationSuccess) ? 0.7 : 1,
              cursor: (isSubmitting || registrationSuccess) ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting && !registrationSuccess) {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-hover)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
            }}
          >
            {isSubmitting ? (
              <>
                <Spinner size="xs" />
                <span>Connecting</span>
              </>
            ) : registrationSuccess ? (
              <span> Account created!</span>
            ) : (
              'Create account'
            )}
          </button>
        </form>

        {/* Login link */}
        <div className="mt-7">
          {/* Google Sign-Up */}
          {googleError && (
            <div
              className="flex items-start gap-2.5 rounded-lg p-3.5 mb-4 text-sm"
              style={{
                backgroundColor: 'var(--rose-bg)',
                border: '1px solid rgba(200,32,20,0.2)',
                color: 'var(--rose)',
              }}
            >
              <span>{googleError}</span>
            </div>
          )}

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>or</span>
            <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
          </div>

          <button
            type="button"
            disabled={googleLoading || isSubmitting}
            onClick={handleGoogleSignUp}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl py-3 text-sm font-medium transition-all mb-6"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              opacity: googleLoading || isSubmitting ? 0.6 : 1,
              cursor: googleLoading || isSubmitting ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => { if (!googleLoading && !isSubmitting) (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
          >
            {googleLoading ? (
              <><Spinner /><span>Connecting</span></>
            ) : (
              <>
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

          <div className="text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium transition-colors"
                style={{ color: 'var(--accent)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-hover)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;

