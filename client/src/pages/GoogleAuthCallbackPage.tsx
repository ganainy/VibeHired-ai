// client/src/pages/GoogleAuthCallbackPage.tsx
/**
 * Handles the redirect from the server after Google Sign-In.
 * URL: /auth/google?token=<jwt>
 * Reads the token, stores it via loginWithToken, then navigates to /dashboard.
 */
import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const GoogleAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (token) {
      loginWithToken(token);
      navigate('/dashboard', { replace: true });
    } else {
      // Server redirected with ?error=google_failed or no token
      const reason = error || 'google_failed';
      navigate(`/login?error=${reason}`, { replace: true });
    }
  }, [searchParams, loginWithToken, navigate]);

  return (
    <div
      className="flex justify-center items-center h-screen"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      <div className="text-center space-y-4">
        <div
          className="inline-block w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
        />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Signing you in</p>
      </div>
    </div>
  );
};

export default GoogleAuthCallbackPage;
