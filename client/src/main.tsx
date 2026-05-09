import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css'; // Tailwind styles
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext'; 
import { ThemeProvider } from './context/ThemeContext';
import { reportError } from './services/errorApi';
import ErrorBoundary from './components/ErrorBoundary';

interface StoredUser {
  id: string;
  email: string;
}

function getStoredUser(): { userId?: string; userEmail?: string } {
  try {
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) {
      const user: StoredUser = JSON.parse(storedUser);
      return { userId: user.id, userEmail: user.email };
    }
  } catch {}
  return {};
}

window.onerror = (message, source, lineno, colno, error) => {
  const userInfo = getStoredUser();
  reportError({
    errorType: 'frontend',
    severity: 'error',
    message: String(message),
    stack: error?.stack,
    url: window.location.href,
    userAgent: navigator.userAgent,
    userId: userInfo.userId,
    userEmail: userInfo.userEmail,
    metadata: {
      source,
      lineno,
      colno,
    },
  });
};

window.onunhandledrejection = (event) => {
  const error = event.reason;
  const message = error?.message || String(error);
  const stack = error?.stack;
  const userInfo = getStoredUser();
  
  reportError({
    errorType: 'frontend',
    severity: 'error',
    message: `Unhandled Promise Rejection: ${message}`,
    stack,
    url: window.location.href,
    userAgent: navigator.userAgent,
    userId: userInfo.userId,
    userEmail: userInfo.userEmail,
  });
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
