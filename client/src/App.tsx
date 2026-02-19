// client/src/App.tsx
import React from 'react'; // Import React
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'; // Ensure all necessary imports from react-router-dom
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

function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  // Check if current route is a public portfolio route
  const isPortfolioRoute = location.pathname.startsWith('/portfolio/');

  // Early return for public portfolio pages - no navigation, no auth required
  // Wrap in Routes/Route so React Router can extract the username parameter
  if (isPortfolioRoute) {
    return (
      <Routes>
        <Route path="/portfolio/:username" element={<PortfolioPage />} />
      </Routes>
    );
  }

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 dark:border-purple-400"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Icon components matching Material Symbols style
  const BagFilledIcon = () => (
    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
      <path d="M20 6h-3V4c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM9 4h6v2H9V4zm11 15H4V10h2v1h2v-1h6v1h2v-1h2v9z" />
    </svg>
  );

  if (!isAuthenticated) {
    // Determine which auth link to show based on current route
    const isLoginPage = location.pathname === '/login' || location.pathname === '/';
    const isRegisterPage = location.pathname === '/register';

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-center h-16">
              <Link
                to="/"
                className="flex items-center gap-2 text-2xl font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
              >
                <BagFilledIcon />
                <span>VibeHired</span>
              </Link>
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-md text-slate-600 dark:text-slate-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  aria-label="Toggle dark mode"
                >
                  {theme === 'dark' ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </button>
                {isLoginPage && (
                  <Link
                    to="/register"
                    className="px-4 py-2 rounded-md text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  >
                    Register
                  </Link>
                )}
                {isRegisterPage && (
                  <Link
                    to="/login"
                    className="px-4 py-2 rounded-md text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                  >
                    Login
                  </Link>
                )}
              </div>
            </div>
          </div>
        </nav>
        <main className="bg-slate-50 dark:bg-slate-900">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </main>
      </div>
    );
  }

  return (
    <MainLayout>
      <Routes>
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />
        <Route path="/register" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/manage-cv" element={<ProtectedRoute><CVManagementPage /></ProtectedRoute>} />
        <Route path="/auto-jobs" element={<ProtectedRoute><AutoJobsPage /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
        <Route path="/portfolio-setup" element={<ProtectedRoute><PortfolioSetupPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
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
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<div className="text-center p-10 dark:text-gray-300">404 - Page Not Found</div>} />
      </Routes>
    </MainLayout>
  );
}

export default App;