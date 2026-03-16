// client/src/context/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode, useRef } from 'react';
import { loginUser, registerUser, getCurrentUserProfile, RegisterResponse } from '../services/authApi';
import { getUsage } from '../services/usageApi';
import axios from 'axios'; // Import axios to set default header

// Define the shape of the user object
interface User {
  id: string;
  email: string;
  username?: string;
  cvJson?: any;
  preferredTheme?: string;
  role?: 'user' | 'admin' | 'owner';
  plan?: 'free' | 'starter' | 'pro' | 'premium';
  emailVerified?: boolean;
  onboardingComplete?: boolean;
  credits?: number;
}

// Define the shape of the context value
interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  isLoading: boolean; // Track initial auth state loading
  error: string | null; // Store login/register errors
  login: (credentials: { email: string, password: string }) => Promise<void>;
  register: (credentials: { email: string, username: string, password: string }) => Promise<RegisterResponse | null>;
  logout: () => void;
  loginWithToken: (token: string) => void;
  refreshUsage: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  showCreditLimitModal: boolean;
  setShowCreditLimitModal: (show: boolean) => void;
}

// Create the context with a default undefined value initially
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define the props for the provider component
interface AuthProviderProps {
  children: ReactNode;
}

const normalizeRequestPath = (url: string = ''): string => {
  try {
    if (/^https?:\/\//i.test(url)) {
      return new URL(url).pathname.toLowerCase();
    }
  } catch {
    // Fallback to raw URL parsing below
  }

  return url.split('?')[0].toLowerCase();
};

const METERED_REQUEST_PATTERNS: Array<{ method: string; pathRegex: RegExp }> = [
  { method: 'post', pathRegex: /\/(?:api\/)?analysis\/analyze$/ },
  { method: 'post', pathRegex: /\/(?:api\/)?analysis\/analyze-all-sections$/ },
  { method: 'post', pathRegex: /\/(?:api\/)?analysis\/cv-section$/ },
  { method: 'post', pathRegex: /\/(?:api\/)?analysis\/[^/]+\/improve(?:\/[^/]+)?$/ },
  { method: 'post', pathRegex: /\/(?:api\/)?ats\/scan(?:\/[^/]+)?$/ },
  { method: 'post', pathRegex: /\/(?:api\/)?auto-jobs\/trigger$/ },
  { method: 'post', pathRegex: /\/(?:api\/)?chat\/[^/]+$/ },
  { method: 'post', pathRegex: /\/(?:api\/)?email-suggestions\/poll$/ },
  { method: 'post', pathRegex: /\/(?:api\/)?cvs\/upload$/ },
  { method: 'post', pathRegex: /\/(?:api\/)?cvs\/upload-branch$/ },
  { method: 'post', pathRegex: /\/(?:api\/)?cvs\/[^/]+\/restructure$/ },
  { method: 'post', pathRegex: /\/(?:api\/)?cvs\/[^/]+\/improve-section-dynamic$/ },
  { method: 'post', pathRegex: /\/(?:api\/)?interview\/[^/]+\/(questions|evaluate)$/ },
  { method: 'post', pathRegex: /\/(?:api\/)?generator\/apply-ats-suggestion$/ },
  { method: 'post', pathRegex: /\/(?:api\/)?generator\/improve-section$/ },
  { method: 'post', pathRegex: /\/(?:api\/)?generator\/[^/]+\/generate-cv$/ },
  { method: 'post', pathRegex: /\/(?:api\/)?job-applications\/recommendations\/regenerate$/ },
  { method: 'patch', pathRegex: /\/(?:api\/)?job-applications\/[^/]+\/scrape$/ },
  { method: 'patch', pathRegex: /\/(?:api\/)?job-applications\/[^/]+\/extract-from-text$/ },
  { method: 'post', pathRegex: /\/(?:api\/)?job-applications\/create-from-url$/ },
  { method: 'post', pathRegex: /\/(?:api\/)?job-applications\/create-from-text$/ },
  { method: 'post', pathRegex: /\/(?:api\/)?work-tracker\/import-schedule\/parse$/ },
  { method: 'post', pathRegex: /\/(?:api\/)?work-tracker\/parse-magic-prompt$/ },
];

const isMeteredRequest = (method?: string, url?: string): boolean => {
  if (!method || !url) return false;

  const normalizedMethod = method.toLowerCase();
  const normalizedPath = normalizeRequestPath(url);

  return METERED_REQUEST_PATTERNS.some(
    ({ method: expectedMethod, pathRegex }) => expectedMethod === normalizedMethod && pathRegex.test(normalizedPath)
  );
};

// Create the AuthProvider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start loading initially
  const [error, setError] = useState<string | null>(null);
  const [showCreditLimitModal, setShowCreditLimitModal] = useState(false);
  const refreshUsageInFlightRef = useRef<Promise<void> | null>(null);

  // Logout function
  const logout = React.useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    // Remove Axios default Authorization header
    delete axios.defaults.headers.common['Authorization'];
  }, []);

  const refreshUsage = React.useCallback(async () => {
    try {
      const usageData = await getUsage();
      setUser(prev => prev ? { ...prev, credits: usageData.usage.remaining } : null);
    } catch (err) {
      console.error("Failed to refresh usage:", err);
    }
  }, []);

  const refreshUsageSafely = React.useCallback(async () => {
    if (refreshUsageInFlightRef.current) {
      return refreshUsageInFlightRef.current;
    }

    const inFlight = (async () => {
      await refreshUsage();
    })().finally(() => {
      refreshUsageInFlightRef.current = null;
    });

    refreshUsageInFlightRef.current = inFlight;
    return inFlight;
  }, [refreshUsage]);

  const refreshProfile = React.useCallback(async () => {
    try {
      const [profile, usageData] = await Promise.all([getCurrentUserProfile(), getUsage()]);
      setUser(prev => prev ? {
        ...prev,
        plan: profile.plan,
        role: profile.role,
        emailVerified: profile.emailVerified,
        onboardingComplete: profile.onboardingComplete,
        credits: usageData.usage.remaining,
      } : null);
    } catch (err) {
      console.error("Failed to refresh profile:", err);
    }
  }, []);

  // Effect to check for existing token in localStorage on initial load
  useEffect(() => {
    const initAuth = async () => {
      setIsLoading(true);
      const storedToken = localStorage.getItem('authToken');
      const storedUser = localStorage.getItem('authUser');

      if (storedToken && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(parsedUser);
          // Set Axios default Authorization header for subsequent requests
          axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        } catch (e) {
          console.error("Failed to parse stored user data", e);
          logout(); // Use logout to clean up
        }
      }

      // If we have a user, fetch their latest profile and usage
      if (storedToken && storedUser) {
        try {
          // Use skipLogoutOn401 so the global Axios interceptor doesn't race with this
          // try/catch — we handle session expiry ourselves below.
          const profile = await getCurrentUserProfile({ skipLogoutOn401: true });
          const usageData = await getUsage({ skipLogoutOn401: true });

          // Block access only for email accounts whose verification is explicitly false.
          // Google OAuth users always have emailVerified: true (set on the server).
          if (profile.emailVerified === false) {
            console.warn('Email not verified. Logging out...');
            logout();
            setIsLoading(false);
            return;
          }

          const updatedUser = {
            ...profile,
            emailVerified: profile.emailVerified,
            onboardingComplete: profile.onboardingComplete,
            credits: usageData.usage.remaining
          };
          setUser(updatedUser);
          localStorage.setItem('authUser', JSON.stringify(updatedUser));
        } catch (err: any) {
          // If the token is expired or revoked (401), log the user out cleanly.
          // For transient server errors (5xx, network) keep the locally-cached
          // session so the user isn't unexpectedly kicked out.
          if (err?.status === 401) {
            console.warn('Session expired or invalid. Logging out...');
            logout();
            setIsLoading(false);
            return;
          }
          console.error("Failed to sync profile/usage on init:", err);
        }
      }
      setIsLoading(false); // Finished loading initial state
    };

    initAuth();
  }, [logout]);

  // Axios interceptor to handle 401 Unauthorized responses
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => {
        if (isMeteredRequest(response.config?.method, response.config?.url)) {
          void refreshUsageSafely();
        }
        return response;
      },
      (error) => {
        if (error.response && error.response.status === 401) {
          // Only force a global logout when the user genuinely has an active
          // session (token present in localStorage). This prevents the interceptor
          // from kicking the user out if an optional background request (e.g.
          // the usage-refresh immediately after login) happens to fail with 401
          // before the token is fully propagated, or when a network error is
          // mis-reported as 401 by a proxy.
          const hasStoredToken = !!localStorage.getItem('authToken');
          // Never log out for requests that explicitly opt out (set skipLogoutOn401).
          const skip = error.config?.skipLogoutOn401;
          if (hasStoredToken && !skip) {
            console.warn('Received 401 Unauthorized. Logging out...');
            logout();
          }
        } else if (error.response && error.response.status === 403 && error.response.data?.message?.includes('credits')) {
          console.warn('Insufficient credits detected.');
          setShowCreditLimitModal(true);
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [logout, refreshUsageSafely]);

  // Login function
  const login = React.useCallback(async (credentials: { email: string, password: string }) => {
    setError(null); // Clear previous errors
    setIsLoading(true);
    try {
      const response = await loginUser(credentials);

      // Check if email is verified
      if (!response.user.emailVerified) {
        setError('Please verify your email before logging in. Check your inbox for the verification link.');
        setIsLoading(false);
        return;
      }

      setUser(response.user);
      setToken(response.token);
      // Store token and user info in localStorage
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('authUser', JSON.stringify(response.user));
      // Set Axios default Authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.token}`;

      // Fetch usage info immediately after login.
      // Mark with skipLogoutOn401 so a transient failure here does not
      // trigger the global logout interceptor and undo a successful login.
      try {
        const usageData = await getUsage({ skipLogoutOn401: true });
        const updatedUser = { ...response.user, credits: usageData.usage.remaining };
        setUser(updatedUser);
        localStorage.setItem('authUser', JSON.stringify(updatedUser));
      } catch (err) {
        console.warn("Failed to fetch usage after login", err);
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error("Login failed:", err);
      setError(err.message || 'Login failed. Please check credentials.');
      setIsLoading(false);
      // Ensure cleanup if login fails
      logout();
    }
  }, [logout]);

  // loginWithToken — used by the Google OAuth callback page
  const loginWithToken = React.useCallback((token: string) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userObj: User = { id: payload.userId, email: payload.email };
      setUser(userObj);
      setToken(token);
      localStorage.setItem('authToken', token);
      localStorage.setItem('authUser', JSON.stringify(userObj));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // Fetch full profile + usage in the background so credits/plan are available immediately
      (async () => {
        try {
          const [profile, usageData] = await Promise.all([
            getCurrentUserProfile(),
            getUsage({ skipLogoutOn401: true }),
          ]);
          const updatedUser: User = {
            ...userObj,
            plan: profile.plan,
            role: profile.role,
            emailVerified: profile.emailVerified,
            onboardingComplete: profile.onboardingComplete,
            credits: usageData.usage.remaining,
          };
          setUser(updatedUser);
          localStorage.setItem('authUser', JSON.stringify(updatedUser));
        } catch (err) {
          console.warn('Failed to fetch profile/usage after Google login', err);
        }
      })();
    } catch (e) {
      console.error('Failed to decode token', e);
    }
  }, []);

  // Register function (doesn't log in automatically)
  const register = React.useCallback(async (credentials: { email: string, username: string, password: string }): Promise<RegisterResponse | null> => {
    setError(null);
    // Do NOT set the global isLoading here — that triggers the full-screen spinner
    // in App.tsx which unmounts RegisterPage and wipes its local state (including
    // registrationSuccess). RegisterPage manages its own submit-loading via the
    // isLoading value it already reads from this context via the login/register
    // button disabled state; the spinner there is driven by local state instead.
    try {
      const data = await registerUser(credentials);
      return data;
    } catch (err: any) {
      console.error("Registration failed:", err);
      setError(err.message || 'Registration failed.');
      return null;
    }
  }, []);

  // Value provided by the context
  const value = {
    isAuthenticated: !!token,
    user,
    token,
    isLoading,
    error,
    login,
    register,
    logout,
    loginWithToken,
    refreshUsage,
    refreshProfile,
    showCreditLimitModal,
    setShowCreditLimitModal,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to easily consume the AuthContext
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};