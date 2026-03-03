// client/src/context/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
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

// Create the AuthProvider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start loading initially
  const [error, setError] = useState<string | null>(null);
  const [showCreditLimitModal, setShowCreditLimitModal] = useState(false);

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

  const refreshProfile = React.useCallback(async () => {
    try {
      const [profile, usageData] = await Promise.all([getCurrentUserProfile(), getUsage()]);
      setUser(prev => prev ? {
        ...prev,
        plan: profile.plan,
        role: profile.role,
        emailVerified: profile.emailVerified,
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
          const profile = await getCurrentUserProfile();
          const usageData = await getUsage();

          // Check if email is verified
          if (!profile.emailVerified) {
            console.warn('Email not verified. Logging out...');
            logout();
            setIsLoading(false);
            return;
          }

          const updatedUser = {
            ...profile,
            emailVerified: profile.emailVerified,
            credits: usageData.usage.remaining
          };
          setUser(updatedUser);
          localStorage.setItem('authUser', JSON.stringify(updatedUser));
        } catch (err) {
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
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          console.warn('Received 401 Unauthorized. Logging out...');
          logout();
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
  }, [logout]);

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

      // Fetch usage info immediately after login
      try {
        const usageData = await getUsage();
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
    } catch (e) {
      console.error('Failed to decode token', e);
    }
  }, []);

  // Register function (doesn't log in automatically)
  const register = React.useCallback(async (credentials: { email: string, username: string, password: string }): Promise<RegisterResponse | null> => {
    setError(null);
    setIsLoading(true); // Use isLoading maybe? Or a separate registerLoading state
    try {
      const data = await registerUser(credentials);
      // Optionally set a success message state here instead of error
      setIsLoading(false);
      return data;
    } catch (err: any) {
      console.error("Registration failed:", err);
      setError(err.message || 'Registration failed.');
      setIsLoading(false);
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