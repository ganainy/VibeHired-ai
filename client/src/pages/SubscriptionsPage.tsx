// client/src/pages/SubscriptionsPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUsage, UsageInfo } from '../services/usageApi';
import { createCheckoutSession, createPortalSession, syncSubscription } from '../services/subscriptionApi';
import Spinner from '../components/common/Spinner';
import Toast from '../components/common/Toast';
import { PAYMENTS_ENABLED } from '../utils/featureFlags';

const PLANS = [
  {
    id: 'free',
    name: 'Free Trial',
    credits: 20,
    price: 0,
    period: 'one-time',
    description: 'Try the platform at no cost',
    features: [
      '20 credits to try everything',
      'Targeted CV generation (3 Credits each)',
      'CV analysis & ATS scoring (2 Credits each)',
      'Cover letters & interview sim (5 Credits each)',
      'Chat, email scan & job extraction (1 Credit each)',
    ],
    popular: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    credits: 150,
    price: 9,
    period: 'month',
    description: 'For occasional job seekers',
    features: [
      '150 credits / month',
      'Targeted CV generation per job (3 Credits)',
      '~75 CV analyses or ATS scans',
      '~50 cover letters per month',
      'All features included',
    ],
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 500,
    price: 19,
    period: 'month',
    description: 'Best for active job hunters',
    features: [
      '500 credits / month',
      'Targeted CV generation per job (3 Credits)',
      '~250 CV analyses or ATS scans',
      '~165 cover letters per month',
      'All features included',
      '2x AI request rate',
    ],
    popular: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    credits: 1500,
    price: 39,
    period: 'month',
    description: 'For heavy or high-volume use',
    features: [
      '1,500 credits / month',
      'Targeted CV generation per job (3 Credits)',
      '~750 CV analyses or ATS scans',
      '~500 cover letters per month',
      'All features included',
      '4x AI request rate',
    ],
    popular: false,
  },
];

const CheckIcon = () => (
  <span className="material-symbols-outlined text-green-accent text-lg shrink-0">check_circle</span>
);

const PlanCard: React.FC<{
  plan: typeof PLANS[0];
  currentPlan: string | undefined;
  isLoading: boolean;
  onSelectPlan: (planId: string) => void;
}> = ({ plan, currentPlan, isLoading, onSelectPlan }) => {
  const isCurrentPlan = currentPlan === plan.id;
  const hasPaidPlan = currentPlan && currentPlan !== 'free';

  let buttonText = '';
  let isDisabled = false;

  if (!PAYMENTS_ENABLED && plan.id !== 'free') {
    buttonText = 'Coming Soon';
    isDisabled = true;
  } else if (isCurrentPlan) {
    buttonText = 'Current Plan';
    isDisabled = true;
  } else if (plan.id === 'free') {
    buttonText = hasPaidPlan ? 'Downgrade to Free' : 'Get Started Free';
    isDisabled = !hasPaidPlan;
  } else {
    buttonText = hasPaidPlan ? `Switch to ${plan.name}` : `Upgrade to ${plan.name}`;
  }

  const isPopular = plan.popular;

  return (
    <div
      className={`relative flex flex-col rounded-xl p-6 whisper-shadow transition-all duration-200
        ${isCurrentPlan
          ? 'bg-white border-2 border-green-accent'
          : isPopular
          ? 'bg-white border-2 border-green-accent'
          : 'bg-white border border-[var(--border-subtle)] hover:border-green-accent'
        }`}
    >
      {/* Badges */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <span className="bg-green-accent text-white text-[10px] font-bold px-4 py-1 rounded-full tracking-widest uppercase">
            Popular
          </span>
        </div>
      )}
      {isCurrentPlan && (
        <div className="absolute -top-3 right-4 z-10">
          <span className="bg-green text-white text-[10px] font-bold px-3 py-1 rounded-full tracking-widest uppercase">
            Current
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <h3 className="font-manrope text-xl font-semibold text-green mb-1">{plan.name}</h3>
        <p className="text-sm text-[var(--text-secondary)]">{plan.description}</p>
      </div>

      {/* Price */}
      <div className="mb-6">
        {plan.price === 0 ? (
          <span className="font-manrope text-5xl font-semibold text-green">Free</span>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="font-manrope text-5xl font-semibold text-green">${plan.price}</span>
            <span className="text-[var(--text-secondary)] font-body">/mo</span>
          </div>
        )}
        <p className="text-xs text-[var(--text-muted)] mt-1">
          {plan.credits.toLocaleString()} credits{plan.price > 0 ? ' / month' : ' one-time'}
        </p>
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-8 flex-1">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
            <CheckIcon />
            {feature}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={() => onSelectPlan(plan.id)}
        disabled={isLoading || isDisabled}
        className={`w-full h-[50px] rounded-full font-manrope text-sm font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
          ${isCurrentPlan
            ? 'border-2 border-green-accent text-green-accent hover:bg-green-light'
            : isPopular
            ? 'bg-green-accent text-white hover:bg-green shadow-md'
            : 'bg-green-accent text-white hover:bg-green'
          }`}
      >
        {isLoading ? <Spinner size="sm" /> : buttonText}
      </button>
    </div>
  );
};

const SubscriptionsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshProfile } = useAuth();
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [successBanner, setSuccessBanner] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('success') === 'true') {
      setSuccessBanner(true);
      window.history.replaceState({}, '', location.pathname);
      // First call the sync endpoint so the DB gets updated from Stripe
      // immediately (fallback for when the webhook hasn't fired, e.g. in
      // local dev without a Stripe tunnel). Then poll refreshProfile() to
      // pull the updated plan into React state.
      const syncAndPoll = async () => {
        try {
          await syncSubscription();
        } catch {
          // Non-fatal just continue polling
        }
        let attempts = 0;
        const poll = async () => {
          await refreshProfile();
          attempts++;
          if (attempts < 3) {
            setTimeout(poll, 2000);
          }
        };
        poll();
      };
      syncAndPoll();
      const timer = setTimeout(() => setSuccessBanner(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [location.search, location.pathname, refreshProfile]);

  useEffect(() => {
    getUsage()
      .then(setUsageInfo)
      .catch(console.error)
      .finally(() => setIsLoadingUsage(false));
  }, []);

  const handleSelectPlan = async (planId: string) => {
    if (planId === 'free') return;
    if (!PAYMENTS_ENABLED) return;

    if (user?.plan && user.plan !== 'free') {
      setIsProcessing(true);
      try {
        const { url } = await createPortalSession();
        window.location.href = url;
      } catch (err: any) {
        setToast({ message: err.response?.data?.message || 'Failed to open portal', type: 'error' });
        setIsProcessing(false);
      }
      return;
    }

    setIsProcessing(true);
    try {
      const { url } = await createCheckoutSession(planId);
      window.location.href = url;
    } catch (err: any) {
      setToast({ message: err.response?.data?.message || 'Failed to start checkout', type: 'error' });
      setIsProcessing(false);
    }
  };

  const currentPlanId = user?.plan || 'free';
  const currentPlanName = PLANS.find(p => p.id === currentPlanId)?.name || 'Free Trial';
  const usedPct = usageInfo
    ? Math.min(100, Math.round((usageInfo.usage.creditsUsed / usageInfo.usage.creditLimit) * 100))
    : 0;

  const remainingCredits = usageInfo?.usage.remaining ?? 0;
  const totalCredits = usageInfo?.usage.creditLimit ?? 0;
  const usedCredits = usageInfo?.usage.creditsUsed ?? 0;
  const billingEnd = usageInfo?.usage.billingPeriodEnd;

  return (
    <div className="space-y-8 max-w-[1440px] mx-auto">
      {/* Header Section */}
      <header>
        <h1 className="font-manrope text-4xl md:text-[45px] font-semibold text-green mb-2 tracking-tight">
          Plans & Billing
        </h1>
        <p className="text-lg text-[var(--text-secondary)] max-w-2xl leading-relaxed">
          Manage your subscription, view credits, and explore premium features tailored for your job search success.
        </p>
      </header>

      {/* Payments coming-soon banner */}
      {!PAYMENTS_ENABLED && (
        <div className="flex items-center gap-3 p-4 bg-[var(--ember-bg)] border border-[var(--ember)] rounded-xl">
          <span className="material-symbols-outlined text-amber shrink-0">info</span>
          <p className="text-sm text-amber">
            <span className="font-semibold">Paid plans coming soon</span> — enjoy your free credits in the meantime. Subscriptions will be available shortly.
          </p>
        </div>
      )}

      {/* Success Banner */}
      {successBanner && (
        <div className="flex items-center gap-3 p-4 bg-[var(--jade-bg)] border border-emerald-200 rounded-xl text-green">
          <span className="material-symbols-outlined shrink-0">check_circle</span>
          <div className="flex-1">
            <p className="font-semibold text-sm">Subscription activated!</p>
            <p className="text-xs opacity-80 mt-0.5">Your plan has been upgraded and credits have been added to your account.</p>
          </div>
          <button
            onClick={() => setSuccessBanner(false)}
            className="p-1 hover:bg-[var(--jade-bg)] rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* Current Usage Section */}
      <section className="bg-white rounded-xl p-6 md:p-8 whisper-shadow border border-[var(--border-subtle)]">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="font-manrope text-xl font-semibold text-green">Current Plan: {currentPlanName}</h2>
            {billingEnd && (
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                Your next billing date is {new Date(billingEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </div>
          {!isLoadingUsage && usageInfo && (
            <div className="text-left md:text-right">
              <span className="font-manrope text-4xl font-semibold text-green-accent">{remainingCredits}</span>
              <span className="text-[var(--text-secondary)] text-sm ml-1">Credits Remaining</span>
            </div>
          )}
          {isLoadingUsage && (
            <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
              <Spinner size="sm" /> Loading usage…
            </div>
          )}
        </div>

        {!isLoadingUsage && usageInfo && (
          <div className="space-y-2">
            <div className="h-4 w-full bg-[var(--bg-elevated)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usedPct >= 90 ? 'bg-red-500' : usedPct >= 70 ? 'bg-amber-500' : 'bg-green-accent'
                }`}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-[var(--text-secondary)] font-medium">
              <span>{usedCredits} Credits Used</span>
              <span>{totalCredits} Total Credits</span>
            </div>
          </div>
        )}
      </section>

      {/* Plan Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            currentPlan={currentPlanId}
            isLoading={isProcessing}
            onSelectPlan={handleSelectPlan}
          />
        ))}
      </section>

      {/* Manage Billing button for paid users */}
      {PAYMENTS_ENABLED && user?.plan && user.plan !== 'free' && (
        <div className="flex justify-center">
          <button
            onClick={() => handleSelectPlan(user.plan!)}
            disabled={isProcessing}
            className="px-6 py-2.5 text-sm font-semibold bg-white border border-[var(--border)] rounded-full hover:bg-[var(--bg-elevated)] transition-colors disabled:opacity-50 shadow-sm"
          >
            Manage Billing
          </button>
        </div>
      )}

      {/* FAQ Section */}
      <section className="max-w-3xl mx-auto">
        <h2 className="font-display text-3xl text-green text-center mb-8">Frequently Asked Questions</h2>
        <div className="space-y-3">
          <FAQItem
            question="What is targeted CV generation?"
            answer="For each job you track, the app can generate a tailored version of your CV that highlights the most relevant experience and skills for that specific role and job description. It costs 3 credits per generation and produces a downloadable PDF."
          />
          <FAQItem
            question="What do credits cost, and what do they cover?"
            answer="Credits power every AI action: chat messages and email scans (1 Credit), CV analysis and ATS scoring (2 Credits each), targeted CV generation, cover letter generation, and interview simulations (5 Credits each). Job board searches cost 3 Credits base + 0.25 Credits per result."
          />
          <FAQItem
            question="Do unused credits roll over?"
            answer="No — credits reset at the start of each billing cycle. On the Free tier, the 20 credits are one-time and never expire until used."
          />
          <FAQItem
            question="What's the real difference between plans?"
            answer="Credits and AI rate limits. Every plan unlocks all features — the tiers simply give you more credits per month (150 / 500 / 1,500) and raise the cap on how many AI requests you can make in a short window, which matters when scanning large email batches or running multiple generations back-to-back."
          />
          <FAQItem
            question="Can I upgrade or downgrade at any time?"
            answer="Yes — open the Manage Billing portal to switch plans or cancel. Upgrades take effect immediately with prorated billing; downgrades apply at the end of the current billing period."
          />
          <FAQItem
            question="What happens when I run out of credits?"
            answer="AI-powered actions are paused for the rest of the billing cycle. Your tracked jobs, CVs, and application data are always accessible. Upgrading to a higher plan tops up your credits right away."
          />
        </div>
      </section>

      {/* Footer */}
      <p className="text-sm text-[var(--text-muted)] text-center pb-4">
        Questions?{' '}
        <button onClick={() => navigate('/settings')} className="text-[var(--text-secondary)] hover:underline font-medium">
          Contact support
        </button>
      </p>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

const FAQItem: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <div className="bg-white rounded-xl whisper-shadow border border-[var(--border-subtle)] overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-[var(--bg-elevated)] transition-colors"
      >
        <span className="text-sm font-semibold text-[var(--text-primary)]">{question}</span>
        <span className={`material-symbols-outlined text-green-accent transition-transform shrink-0 ml-4 ${isOpen ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>
      {isOpen && (
        <div className="px-6 pb-4">
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
};

export default SubscriptionsPage;
