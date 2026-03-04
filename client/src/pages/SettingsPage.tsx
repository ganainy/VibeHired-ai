// client/src/pages/SettingsPage.tsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getApiKeys, UpdateApiKeysRequest } from '../services/settingsApi';
import { getGoogleCalendarStatus, getGoogleConnectUrl, disconnectGoogleCalendar } from '../services/googleCalendarApi';
import Toast from '../components/common/Toast';
import Spinner from '../components/common/Spinner';
import { useAuth } from '../context/AuthContext';
import { getUsage, UsageInfo } from '../services/usageApi';
import { createCheckoutSession, createPortalSession } from '../services/subscriptionApi';
import { resendVerificationEmail } from '../services/authApi';
import { Link } from 'react-router-dom';

// Icon Components
const EyeIcon = () => (
  <svg className="w-5 h-5 text-zinc-500 dark:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="w-5 h-5 text-zinc-500 dark:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

const KeyIcon = () => (
  <svg className="w-5 h-5 text-zinc-500 dark:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-5 h-5 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-5 h-5 text-zinc-500 dark:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg className="w-5 h-5 text-zinc-500 dark:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
);

const InfoIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} style={{ color: 'var(--accent)' }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LockIcon = () => (
  <svg className="w-5 h-5 text-zinc-500 dark:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

// Confirmation Modal Component
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 dark:bg-opacity-70">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{title}</h3>
        <p className="text-zinc-600 dark:text-zinc-400 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-lg font-medium transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const SettingsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Google Calendar state
  const [googleCalConnected, setGoogleCalConnected] = useState(false);
  const [googleCalEmail, setGoogleCalEmail] = useState<string | null>(null);
  const [isLoadingGoogleCal, setIsLoadingGoogleCal] = useState(true);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isDisconnectingGoogle, setIsDisconnectingGoogle] = useState(false);

  // Onboarding collapse state
  const [isOnboardingExpanded, setIsOnboardingExpanded] = useState(true);

  // Usage state
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [isCreatingPortal, setIsCreatingPortal] = useState(false);

  // Check if this is a new user (from registration)
  const isNewUser = location.state?.fromRegistration === true;

  const loadUsageData = async () => {
    try {
      setIsLoadingUsage(true);
      const data = await getUsage();
      setUsageInfo(data);
    } catch (err) {
      console.error('Failed to load usage data:', err);
    } finally {
      setIsLoadingUsage(false);
    }
  };

  const handleResendVerification = async () => {
    setIsResendingVerification(true);
    try {
      const res = await resendVerificationEmail(user!.email);
      setToast({ message: res.message, type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to resend verification email.', type: 'error' });
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleUpgrade = async (plan: string) => {
    try {
      const { url } = await createCheckoutSession(plan);
      window.location.href = url;
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to start checkout.', type: 'error' });
    }
  };

  const handleManageSubscription = async () => {
    setIsCreatingPortal(true);
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to open portal.', type: 'error' });
    } finally {
      setIsCreatingPortal(false);
    }
  };

  const loadGoogleCalStatus = async () => {
    setIsLoadingGoogleCal(true);
    try {
      const status = await getGoogleCalendarStatus();
      setGoogleCalConnected(status.connected);
      setGoogleCalEmail(status.email);
    } catch {
      // Non-fatal
    } finally {
      setIsLoadingGoogleCal(false);
    }
  };

  const handleGoogleConnect = async () => {
    setIsConnectingGoogle(true);
    try {
      const url = await getGoogleConnectUrl();
      window.location.href = url;
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to start Google OAuth flow.', type: 'error' });
      setIsConnectingGoogle(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    setIsDisconnectingGoogle(true);
    try {
      await disconnectGoogleCalendar();
      setGoogleCalConnected(false);
      setGoogleCalEmail(null);
      setToast({ message: 'Google Calendar disconnected.', type: 'info' });
    } catch (err: any) {
      setToast({ message: err?.response?.data?.message || 'Failed to disconnect.', type: 'error' });
    } finally {
      setIsDisconnectingGoogle(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([loadGoogleCalStatus(), loadUsageData()]);
      setIsLoading(false);
    };

    const params = new URLSearchParams(location.search);
    const gcStatus = params.get('googleCalendar');
    if (gcStatus === 'connected') {
      setToast({ message: 'Google Calendar connected successfully!', type: 'success' });
      navigate('/settings', { replace: true });
    } else if (gcStatus === 'error') {
      const reason = params.get('reason') || 'unknown';
      setToast({ message: `Google Calendar connection failed: ${reason}`, type: 'error' });
      navigate('/settings', { replace: true });
    }

    init();
  }, [location.search, navigate]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 sm:py-10 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ background: 'var(--accent-bg)' }}>
              <KeyIcon />
            </div>
            <h1 className="page-title" style={{ fontSize: '1.5rem' }}>
              Settings & Integrations
            </h1>
          </div>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 ml-12">
            Manage your account connections and view usage statistics
          </p>
        </div>

        {/* Verification Banner */}
        {user && !user.emailVerified && (
          <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg text-amber-600 dark:text-amber-400">
                <InfoIcon />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">Email Verification Required</h3>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  Please verify your email to unlock all AI-powered features. Check your inbox for the link.
                </p>
              </div>
            </div>
            <button
              onClick={handleResendVerification}
              disabled={isResendingVerification}
              className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isResendingVerification ? <Spinner size="sm" /> : 'Resend Email'}
            </button>
          </div>
        )}

        {/* Subscription & Usage Overview */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Active Plan Card */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Active Plan</h3>
              <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tight ${user?.plan === 'pro' || user?.plan === 'premium' ? 'bg-gold-500/20 text-gold-600' : 'bg-zinc-100 text-zinc-600'}`}>
                {user?.plan || 'Free'}
              </span>
            </div>

            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 italic">
                {usageInfo?.usage.remaining ?? '0'}
              </span>
              <span className="text-sm text-zinc-500">Credits Remaining</span>
            </div>

            <div className="w-full bg-zinc-100 dark:bg-zinc-700 h-2 rounded-full mb-6 overflow-hidden">
              <div
                className="bg-gold-500 h-full transition-all duration-1000"
                style={{ width: `${Math.min(100, (usageInfo?.usage.remaining || 0) / (usageInfo?.usage.creditLimit || 1) * 100)}%` }}
              />
            </div>

            {user?.plan !== 'free' ? (
              <button
                onClick={handleManageSubscription}
                disabled={isCreatingPortal}
                className="w-full py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-600 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
              >
                {isCreatingPortal ? <Spinner size="sm" /> : 'Manage Subscription'}
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleUpgrade('pro')}
                  className="w-full py-2.5 rounded-lg bg-gold-500 hover:bg-gold-600 text-gold-950 text-xs font-bold transition-all shadow-md shadow-gold-500/20"
                >
                  Upgrade to Pro
                </button>
                <Link
                  to="/subscriptions"
                  className="w-full mt-2 py-2 block text-center text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 underline"
                >
                  View all plans
                </Link>
              </>
            )}
          </div>

          {/* Usage Breakdown */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 p-6">
            <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">CV Improvements <span className="text-zinc-400">· 2 cr</span></span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{usageInfo?.actions.analysis || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">CV Generation <span className="text-zinc-400">· 3 cr</span></span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{usageInfo?.actions.cvGeneration || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">AI Chat Messages <span className="text-zinc-400">· 1 cr</span></span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{usageInfo?.actions.chatMessages || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Job Extractions <span className="text-zinc-400">· 1 cr</span></span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{usageInfo?.actions.jobExtraction || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Interview Prep <span className="text-zinc-400">· 3 cr</span></span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{usageInfo?.actions.interview || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Cover Letters <span className="text-zinc-400">· 3 cr</span></span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{usageInfo?.actions.coverLetter || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">ATS Scoring <span className="text-zinc-400">· 2 cr</span></span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{usageInfo?.actions.atsScoring || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">CV Parsing <span className="text-zinc-400">· 2 cr</span></span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{usageInfo?.actions.cvParsing || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Email Scans <span className="text-zinc-400">· 1 cr</span></span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{usageInfo?.actions.emailScan || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Auto Jobs <span className="text-zinc-400">· 3 base + 0.25 cr/job</span></span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{usageInfo?.actions.autoJobsWorkflow || 0}</span>
              </div>
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-700 flex justify-between text-xs">
                <span className="text-zinc-400 italic">Resets on</span>
                <span className="text-zinc-500">
                  {usageInfo ? new Date(usageInfo.usage.billingPeriodEnd).toLocaleDateString() : '---'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Onboarding Section for New Users */}
        {isNewUser && (
          <div className="mb-6 sm:mb-8 rounded-xl shadow-sm overflow-hidden" style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-dim)' }}>
            <button
              onClick={() => setIsOnboardingExpanded(!isOnboardingExpanded)}
              className="w-full p-4 sm:p-6 flex items-center justify-between transition-colors rounded-t-xl"
            >
              <div className="flex items-center gap-3">
                <InfoIcon />
                <h2 className="text-lg sm:text-xl font-semibold text-left" style={{ color: 'var(--text-primary)' }}>
                  Getting Started
                </h2>
              </div>
              {isOnboardingExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </button>

            {isOnboardingExpanded && (
              <div className="px-4 sm:px-6 pb-6 space-y-4">
                <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
                  Welcome to VibeHired! We've made it easy to get started with automated job discovery and AI-powered applications.
                </p>
                <div className="p-4 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <h3 className="font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <CheckIcon />
                    Centralized AI Access
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    You no longer need to manage complex API keys for job discovery. We handle all technical integrations server-side. Simply configure your preferences in the Auto Jobs section and you're ready to go!
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Integrations Section */}
        <div className="space-y-6">
          {/* Google Calendar Integration Card */}
          <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ background: 'var(--accent-bg)' }}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} style={{ color: 'var(--accent)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                      Google Calendar
                    </h3>
                    <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
                      Sync job reminders and interviews directly to your calendar
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isLoadingGoogleCal ? (
                    <Spinner size="sm" />
                  ) : googleCalConnected ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                      <CheckIcon />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-400">
                      Not Connected
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              {googleCalConnected ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">Connected account</p>
                    {googleCalEmail && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{googleCalEmail}</p>
                    )}
                  </div>
                  <button
                    onClick={handleGoogleDisconnect}
                    disabled={isDisconnectingGoogle}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                  >
                    {isDisconnectingGoogle ? <Spinner size="sm" /> : <TrashIcon />}
                    Disconnect
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Keep track of your applications by automatically syncing reminders (e.g. "Follow up in one week")
                    directly to your primary Google Calendar.
                  </p>
                  <button
                    onClick={handleGoogleConnect}
                    disabled={isConnectingGoogle}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-600 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    {isConnectingGoogle ? (
                      <Spinner size="sm" />
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 48 48" fill="none">
                        <path d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" fill="#FFC107" />
                        <path d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" fill="#FF3D00" />
                        <path d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" fill="#4CAF50" />
                        <path d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" fill="#1976D2" />
                      </svg>
                    )}
                    Connect Google Account
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Toast Notification */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
