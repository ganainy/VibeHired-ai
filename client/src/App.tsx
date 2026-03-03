// client/src/App.tsx
import React from 'react';
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import MainLayout from './components/layout/MainLayout';

// Import Pages
import DashboardPage from './pages/DashboardPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import CVManagementPage from './pages/CVManagementPage';
import ReviewFinalizePage from './pages/ReviewFinalizePage';
import AnalyticsPage from './pages/AnalyticsPage';
import PortfolioPage from './pages/PortfolioPage';
import PortfolioSetupPage from './pages/PortfolioSetupPage';
import SettingsPage from './pages/SettingsPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AutoJobsPage from './pages/AutoJobsPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import GoogleAuthCallbackPage from './pages/GoogleAuthCallbackPage';
import EmailSuggestionsPage from './pages/EmailSuggestionsPage';
import InterviewMaterialsPage from './pages/InterviewMaterialsPage';
import WorkTrackerPage from './pages/WorkTrackerPage';
import CalendarPage from './pages/CalendarPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminUsersPage from './pages/AdminUsersPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import SubscriptionsPage from './pages/SubscriptionsPage';

function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme } = useTheme();
  const location = useLocation();

  // Check if current route is a public portfolio route
  const isPortfolioRoute = location.pathname.startsWith('/portfolio/');

  if (isPortfolioRoute) {
    return (
      <Routes>
        <Route path="/portfolio/:username" element={<PortfolioPage />} />
      </Routes>
    );
  }

  // Loading spinner
  if (isLoading) {
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
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/google" element={<GoogleAuthCallbackPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    );
  }

  return (
    <MainLayout>
      <Routes>
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/register" element={<Navigate to="/dashboard" replace />} />
        <Route path="/forgot-password" element={<Navigate to="/dashboard" replace />} />
        <Route path="/reset-password" element={<Navigate to="/dashboard" replace />} />
        <Route path="/auth/google" element={<GoogleAuthCallbackPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/manage-cv" element={<ProtectedRoute><CVManagementPage /></ProtectedRoute>} />
        <Route path="/auto-jobs" element={<ProtectedRoute><AutoJobsPage /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
        <Route path="/portfolio-setup" element={<ProtectedRoute><PortfolioSetupPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/subscriptions" element={<ProtectedRoute><SubscriptionsPage /></ProtectedRoute>} />
        <Route path="/email-suggestions" element={<ProtectedRoute><EmailSuggestionsPage /></ProtectedRoute>} />
        <Route path="/interview-materials" element={<ProtectedRoute><InterviewMaterialsPage /></ProtectedRoute>} />
        <Route path="/work-tracker" element={<ProtectedRoute><WorkTrackerPage /></ProtectedRoute>} />
        <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
        <Route
          path="/jobs/:jobId/review/ai-review"
          element={<Navigate to="../cv" relative="path" replace />}
        />
        <Route
          path="/jobs/:jobId/review/:tab?"
          element={
            <ProtectedRoute>
              <ReviewFinalizePage />
            </ProtectedRoute>
          }
        />
        <Route path="/admin" element={<ProtectedRoute><AdminDashboardPage /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="*"
          element={
            <div
              className="flex items-center justify-center h-full text-center py-20"
              style={{ color: 'var(--text-muted)' }}
            >
              <div>
                <p className="font-mono text-5xl font-bold" style={{ color: 'var(--border-bright, #363655)' }}>404</p>
                <p className="mt-3 text-sm">Page not found</p>
                <Link
                  to="/dashboard"
                  className="mt-6 inline-flex btn-primary text-sm"
                >
                  Go to Dashboard
                </Link>
              </div>
            </div>
          }
        />
      </Routes>
    </MainLayout>
  );
}

export default App;
