// client/src/pages/SettingsPage.tsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getGoogleCalendarStatus,
  getGoogleConnectUrl,
  disconnectGoogleCalendar,
} from '../services/googleCalendarApi';
import Toast from '../components/common/Toast';
import Spinner from '../components/common/Spinner';
import { useAuth } from '../context/AuthContext';
import { getUsage, UsageInfo } from '../services/usageApi';
import { createCheckoutSession, createPortalSession } from '../services/subscriptionApi';
import { resendVerificationEmail } from '../services/authApi';
import { Link } from 'react-router-dom';
import { PAYMENTS_ENABLED } from '../utils/featureFlags';

// Icon Components
const CheckIcon = () => (
  <svg
    className="w-5 h-5 text-green-600"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    className="w-5 h-5 text-secondary-color"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg
    className="w-5 h-5 text-secondary-color"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
  </svg>
);

const InfoIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth={2}
    style={{ color: 'var(--accent)' }}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div
        className="rounded-lg shadow-warm-lg max-w-md w-full mx-4 p-6"
        style={{ backgroundColor: 'var(--bg-surface)' }}
      >
        <h3 className="text-lg font-semibold text-primary-color mb-2">{title}</h3>
        <p className="text-secondary-color mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-secondary-color bg-elevated hover:bg-[var(--bg-raised)] rounded-lg font-medium transition-colors"
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

const iconStyle = { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" };

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

  const usageActions = usageInfo?.actions ?? {};
  const getActionCount = (...keys: string[]): number => {
    for (const key of keys) {
      const value = usageActions[key];
      if (typeof value === 'number') return value;
    }
    return 0;
  };

  const getActionTotal = (...keys: string[]): number =>
    keys.reduce((sum, key) => {
      const value = usageActions[key];
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);

  // Prefer specific Interview Buddy action counters when present.
  // Fall back to the legacy aggregate "interview" counter for older records.
  const interviewBuddyCount = (() => {
    const specificTotal = getActionTotal(
      'interviewGenerateQuestions',
      'interviewEvaluate',
      'interviewAnswer',
      'interviewStreamAnswer'
    );
    return specificTotal > 0 ? specificTotal : getActionCount('interview');
  })();

  const quickStatItems = [
    { label: 'CV Improvements', cost: '2 Credits', count: getActionCount('analysis') },
    { label: 'CV Generation', cost: '3 Credits', count: getActionCount('cvGeneration') },
    { label: 'AI Chat Messages', cost: '1 Credit', count: getActionCount('chatMessages', 'chatMessage') },
    { label: 'Job Extractions', cost: '1 Credit', count: getActionCount('jobExtractions', 'jobExtraction') },
    { label: 'Interview Buddy', cost: '1-5 Credits', count: interviewBuddyCount },
    { label: 'Cover Letters', cost: '3 Credits', count: getActionCount('coverLetter') },
    { label: 'ATS Scoring', cost: '2 Credits', count: getActionCount('atsScoring') },
    { label: 'CV Parsing', cost: '2 Credits', count: getActionCount('cvParsing') },
    { label: 'Email Scans', cost: '1 Credit', count: getActionCount('emailScans', 'emailScan') },
    { label: 'Auto Jobs', cost: '3 base + 0.25/job', count: getActionCount('autoJobsWorkflow') },
  ];

  const totalActionsThisCycle = quickStatItems.reduce((sum, item) => sum + item.count, 0);
  const peakActionCount = Math.max(1, ...quickStatItems.map((item) => item.count));
  const creditsUsed = usageInfo?.usage.creditsUsed ?? 0;
  const creditsRemaining = usageInfo?.usage.remaining ?? 0;
  const creditLimit = usageInfo?.usage.creditLimit ?? 0;
  const creditsRemainingPct = creditLimit > 0 ? Math.min(100, (creditsRemaining / creditLimit) * 100) : 0;
  const creditsUsedPct = creditLimit > 0 ? Math.min(100, (creditsUsed / creditLimit) * 100) : 0;

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
      setToast({
        message: err?.response?.data?.message || 'Failed to start Google OAuth flow.',
        type: 'error',
      });
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
      <div className="flex justify-center items-center min-h-screen bg-[#f2f0eb]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 sm:py-10 px-4 md:px-12 bg-[#f2f0eb] text-slate-700 font-manrope">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/50 p-2 rounded-lg shadow-sm">
              <span className="material-symbols-outlined text-[#006241]" style={iconStyle}>
                key
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-[#006241] tracking-tight">
              Settings & Integrations
            </h1>
          </div>
          <p className="text-slate-500 text-lg">
            Manage your account connections and view usage statistics
          </p>
        </header>

        {/* Verification Banner */}
        {user && !user.emailVerified && (
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-card flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                <InfoIcon />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-amber-800">Email Verification Required</h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  Please verify your email to unlock all AI-powered features. Check your inbox for the
                  link.
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

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-5 flex flex-col gap-8">
            {/* Active Plan Card */}
            <section className="bg-white rounded-card shadow-card p-6">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Active Plan</h2>
                <span
                  className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                    user?.plan === 'pro' || user?.plan === 'premium'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {user?.plan || 'Free'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="border border-slate-100 rounded-lg p-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Remaining
                  </span>
                  <span className="text-2xl font-extrabold text-[#006241]">{creditsRemaining}</span>
                </div>
                <div className="border border-slate-100 rounded-lg p-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Used</span>
                  <span className="text-2xl font-extrabold text-[#006241]">{creditsUsed}</span>
                </div>
                <div className="border border-slate-100 rounded-lg p-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Limit</span>
                  <span className="text-2xl font-extrabold text-[#006241]">{creditLimit}</span>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-medium text-slate-500">Credit pool</span>
                  <span className="text-sm font-semibold text-slate-500">
                    {Math.round(creditsRemainingPct)}% remaining
                  </span>
                </div>
                <div className="h-2 w-full bg-[#d4e9e2] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#00754A] transition-all duration-700"
                    style={{ width: `${creditsRemainingPct}%` }}
                  />
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-50">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Credits used</span>
                  <div className="flex items-center gap-3 flex-1 px-8">
                    <div className="h-1.5 w-full bg-[#d4e9e2] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#00754A] transition-all duration-700"
                        style={{ width: `${creditsUsedPct}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{Math.round(creditsUsedPct)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Billing cycle resets</span>
                  <span className="text-sm font-bold text-slate-700">
                    {usageInfo
                      ? new Date(usageInfo.usage.billingPeriodEnd).toLocaleDateString()
                      : '---'}
                  </span>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-4">
                {user?.plan !== 'free' ? (
                  PAYMENTS_ENABLED && (
                    <button
                      onClick={handleManageSubscription}
                      disabled={isCreatingPortal}
                      className="bg-[#00754A] hover:opacity-90 text-white font-bold h-[50px] w-full rounded-pill transition-all shadow-lg shadow-[#00754A]/20 flex items-center justify-center gap-2"
                    >
                      {isCreatingPortal ? <Spinner size="sm" /> : 'Manage Subscription'}
                    </button>
                  )
                ) : (
                  <>
                    {PAYMENTS_ENABLED ? (
                      <button
                        onClick={() => handleUpgrade('pro')}
                        className="bg-[#00754A] hover:opacity-90 text-white font-bold h-[50px] w-full rounded-pill transition-all shadow-lg shadow-[#00754A]/20"
                      >
                        Upgrade to Pro
                      </button>
                    ) : (
                      <div className="h-[50px] w-full rounded-pill bg-slate-100 text-slate-400 text-sm font-bold flex items-center justify-center cursor-not-allowed">
                        Paid plans coming soon
                      </div>
                    )}
                    <Link
                      to="/subscriptions"
                      className="text-sm font-bold text-[#00754A] hover:underline text-center block"
                    >
                      View all plans
                    </Link>
                  </>
                )}
              </div>
            </section>

            {/* Google Calendar Integration Card */}
            <section className="bg-white rounded-card shadow-card overflow-hidden">
              <div className="p-6 pb-4">
                <div className="flex gap-4 mb-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-slate-400 text-3xl"
                      style={iconStyle}
                    >
                      calendar_today
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-[#006241] leading-tight">Google Calendar</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Sync job reminders and interviews directly to your calendar
                    </p>
                  </div>
                </div>
                {isLoadingGoogleCal ? (
                  <Spinner size="sm" />
                ) : googleCalConnected ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold">
                    <span className="material-symbols-outlined text-[14px]" style={iconStyle}>
                      check
                    </span>
                    Connected
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-bold">
                    Not Connected
                  </div>
                )}
              </div>
              <div className="px-6 py-5 bg-slate-50/50 border-t border-slate-100">
                {googleCalConnected ? (
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">
                        Connected account
                      </p>
                      <p className="text-sm font-medium text-slate-600">
                        {googleCalEmail || '---'}
                      </p>
                    </div>
                    <button
                      onClick={handleGoogleDisconnect}
                      disabled={isDisconnectingGoogle}
                      className="border border-red-100 text-red-500 hover:bg-red-50 text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                      {isDisconnectingGoogle ? (
                        <Spinner size="sm" />
                      ) : (
                        <span
                          className="material-symbols-outlined text-lg"
                          style={iconStyle}
                        >
                          delete
                        </span>
                      )}
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500">
                      Keep track of your applications by automatically syncing reminders directly to
                      your primary Google Calendar.
                    </p>
                    <button
                      onClick={handleGoogleConnect}
                      disabled={isConnectingGoogle}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      {isConnectingGoogle ? (
                        <Spinner size="sm" />
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 48 48" fill="none">
                          <path
                            d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
                            fill="#FFC107"
                          />
                          <path
                            d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
                            fill="#FF3D00"
                          />
                          <path
                            d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
                            fill="#4CAF50"
                          />
                          <path
                            d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
                            fill="#1976D2"
                          />
                        </svg>
                      )}
                      Connect Google Account
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-7">
            <section className="bg-white rounded-card shadow-card h-full flex flex-col">
              <div className="p-6 md:p-8 flex-1">
                <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-8">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
                      Quick Stats
                    </h2>
                    <p className="text-slate-500 text-sm font-medium">
                      Actions used in the current billing cycle
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600">
                      {totalActionsThisCycle} total actions
                    </span>
                    <span className="bg-emerald-50 px-3 py-1.5 rounded-lg text-xs font-bold text-emerald-700">
                      {creditsUsed} credits used
                    </span>
                  </div>
                </div>

                {isLoadingUsage ? (
                  <div className="space-y-6">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div key={idx} className="h-8 rounded-lg bg-slate-100 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {quickStatItems.map((item) => {
                      const widthPct = Math.max(
                        3,
                        peakActionCount > 0 ? (item.count / peakActionCount) * 100 : 0
                      );
                      return (
                        <div key={item.label}>
                          <div className="flex justify-between items-end mb-2">
                            <div className="text-sm font-medium">
                              <span className="text-slate-700">{item.label}</span>
                              <span className="text-slate-400 ml-1">{item.cost}</span>
                            </div>
                            <span className="text-sm font-extrabold text-[#006241]">
                              {item.count}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-[#d4e9e2] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#00754A] transition-all duration-700"
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-slate-50 flex justify-between items-center text-xs font-medium text-slate-400 italic">
                <span>Resets on</span>
                <span className="text-slate-500 not-italic font-bold">
                  {usageInfo
                    ? new Date(usageInfo.usage.billingPeriodEnd).toLocaleDateString()
                    : '---'}
                </span>
              </div>
            </section>
          </div>
        </main>

        {/* Onboarding Section for New Users */}
        {isNewUser && (
          <div className="mt-8 mb-6 sm:mb-8 rounded-card shadow-card overflow-hidden bg-white border border-[#00754A]/10">
            <button
              onClick={() => setIsOnboardingExpanded(!isOnboardingExpanded)}
              className="w-full p-4 sm:p-6 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-3">
                <InfoIcon />
                <h2 className="text-lg sm:text-xl font-extrabold text-[#006241] text-left">
                  Getting Started
                </h2>
              </div>
              {isOnboardingExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
            </button>

            {isOnboardingExpanded && (
              <div className="px-4 sm:px-6 pb-6 space-y-4">
                <p className="text-sm sm:text-base text-slate-500">
                  Welcome to VibeHired! We've made it easy to get started with automated job
                  discovery and AI-powered applications.
                </p>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                  <h3 className="font-semibold mb-2 flex items-center gap-2 text-slate-700">
                    <CheckIcon />
                    Centralized AI Access
                  </h3>
                  <p className="text-sm text-slate-500">
                    You no longer need to manage complex API keys for job discovery. We handle all
                    technical integrations server-side. Simply configure your preferences in the Auto
                    Jobs section and you're ready to go!
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
