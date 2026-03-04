// client/src/pages/SubscriptionsPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUsage, UsageInfo } from '../services/usageApi';
import { createCheckoutSession, createPortalSession, syncSubscription } from '../services/subscriptionApi';
import Spinner from '../components/common/Spinner';
import Toast from '../components/common/Toast';

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
            'Targeted CV generation (3 cr each)',
            'CV analysis & ATS scoring (2 cr each)',
            'Cover letters & interview sim (3 cr each)',
            'Chat, email scan & job extraction (1 cr each)',
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
            'Targeted CV generation per job (3 cr)',
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
            'Targeted CV generation per job (3 cr)',
            '~250 CV analyses or ATS scans',
            '~165 cover letters per month',
            'All features included',
            '2× AI request rate',
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
            'Targeted CV generation per job (3 cr)',
            '~750 CV analyses or ATS scans',
            '~500 cover letters per month',
            'All features included',
            '4× AI request rate',
        ],
        popular: false,
    },
];

const CheckIcon = () => (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
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

    if (isCurrentPlan) {
        buttonText = 'Current Plan';
        isDisabled = true;
    } else if (plan.id === 'free') {
        buttonText = hasPaidPlan ? 'Downgrade to Free' : 'Get Started Free';
        isDisabled = !hasPaidPlan;
    } else {
        buttonText = hasPaidPlan ? `Switch to ${plan.name}` : `Upgrade to ${plan.name}`;
    }

    return (
        <div className={`relative flex flex-col bg-white dark:bg-zinc-900 rounded-2xl border transition-all duration-200
            ${isCurrentPlan
                ? 'border-gold-500 dark:border-gold-500 ring-1 ring-gold-500/30'
                : plan.popular
                    ? 'border-zinc-300 dark:border-zinc-600 shadow-md'
                    : 'border-zinc-200 dark:border-zinc-800'
            }`}
        >
            {/* Badges */}
            {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="bg-gold-500 text-gold-950 text-[10px] font-black px-3 py-1 rounded-full tracking-wide uppercase">
                        Most Popular
                    </span>
                </div>
            )}
            {isCurrentPlan && (
                <div className="absolute -top-3 right-4 z-10">
                    <span className="bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full tracking-wide uppercase">
                        Current
                    </span>
                </div>
            )}

            <div className="p-6 flex flex-col flex-1">
                {/* Header */}
                <div className="mb-5">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{plan.name}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{plan.description}</p>
                </div>

                {/* Price */}
                <div className="mb-5">
                    {plan.price === 0 ? (
                        <span className="text-3xl font-black text-zinc-900 dark:text-zinc-100">Free</span>
                    ) : (
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-zinc-900 dark:text-zinc-100">${plan.price}</span>
                            <span className="text-sm text-zinc-500">/ {plan.period}</span>
                        </div>
                    )}
                    <p className="text-xs text-zinc-400 mt-1">
                        {plan.credits.toLocaleString()} credits{plan.price > 0 ? ' / month' : ' one-time'}
                    </p>
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-6 flex-1">
                    {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                            <span className="text-emerald-500 mt-0.5"><CheckIcon /></span>
                            {feature}
                        </li>
                    ))}
                </ul>

                {/* CTA */}
                <button
                    onClick={() => onSelectPlan(plan.id)}
                    disabled={isLoading || isDisabled}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
                        ${isCurrentPlan
                            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                            : plan.popular
                                ? 'bg-gold-500 hover:bg-gold-600 text-gold-950'
                                : 'bg-zinc-900 dark:bg-white hover:bg-zinc-700 dark:hover:bg-zinc-200 text-white dark:text-zinc-900'
                        }`}
                >
                    {isLoading ? <Spinner size="sm" /> : buttonText}
                </button>
            </div>
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
                    // Non-fatal — just continue polling
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

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 font-display">Plans & Billing</h1>
                    <p className="text-zinc-500 mt-1">Manage your subscription and credit usage.</p>
                </div>
                {user?.plan && user.plan !== 'free' && (
                    <button
                        onClick={() => handleSelectPlan(user.plan!)}
                        disabled={isProcessing}
                        className="shrink-0 px-4 py-2 text-sm font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                        Manage Billing →
                    </button>
                )}
            </div>

            {/* Success Banner */}
            {successBanner && (
                <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-2xl text-emerald-800 dark:text-emerald-200">
                    <svg className="w-5 h-5 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                        <p className="font-bold text-sm">Subscription activated!</p>
                        <p className="text-xs opacity-80 mt-0.5">Your plan has been upgraded and credits have been added to your account.</p>
                    </div>
                    <button onClick={() => setSuccessBanner(false)} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}

            {/* Current Usage */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Current Plan</p>
                        <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{currentPlanName}</p>
                    </div>
                    {!isLoadingUsage && usageInfo && (
                        <div className="flex items-center gap-6 text-center">
                            <div>
                                <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{usageInfo.usage.remaining}</p>
                                <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Remaining</p>
                            </div>
                            <div className="h-10 w-px bg-zinc-100 dark:bg-zinc-800" />
                            <div>
                                <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{usageInfo.usage.creditsUsed}</p>
                                <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Used</p>
                            </div>
                            <div>
                                <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{usageInfo.usage.creditLimit}</p>
                                <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Total</p>
                            </div>
                        </div>
                    )}
                </div>
                {!isLoadingUsage && usageInfo && (
                    <div>
                        <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
                            <span>Credit usage</span>
                            <span>{usedPct}%</span>
                        </div>
                        <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${usedPct >= 90 ? 'bg-red-500' : usedPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                style={{ width: `${usedPct}%` }}
                            />
                        </div>
                    </div>
                )}
                {isLoadingUsage && <div className="flex items-center gap-2 text-zinc-400 text-sm"><Spinner size="sm" /> Loading usage...</div>}
            </div>

            {/* Plan Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                {PLANS.map((plan) => (
                    <PlanCard
                        key={plan.id}
                        plan={plan}
                        currentPlan={currentPlanId}
                        isLoading={isProcessing}
                        onSelectPlan={handleSelectPlan}
                    />
                ))}
            </div>

            {/* FAQ */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 className="font-bold text-zinc-900 dark:text-zinc-100">Frequently Asked Questions</h2>
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    <FAQItem
                        question="What is targeted CV generation?"
                        answer="For each job you track, the app can generate a tailored version of your CV that highlights the most relevant experience and skills for that specific role and job description. It costs 3 credits per generation and produces a downloadable PDF."
                    />
                    <FAQItem
                        question="What do credits cost, and what do they cover?"
                        answer="Credits power every AI action: chat messages and email scans (1 cr), CV analysis and ATS scoring (2 cr each), targeted CV generation, cover letter generation, and interview simulations (3 cr each). Job board searches cost 3 cr base + 0.25 cr per result."
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
            </div>

            {/* Footer */}
            <p className="text-sm text-zinc-400 text-center pb-4">
                Questions?{' '}
                <button onClick={() => navigate('/settings')} className="text-zinc-600 dark:text-zinc-300 hover:underline font-medium">
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
        <div>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
            >
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{question}</span>
                <svg
                    className={`w-4 h-4 text-zinc-400 transition-transform shrink-0 ml-4 ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && (
                <div className="px-6 pb-4">
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{answer}</p>
                </div>
            )}
        </div>
    );
};

export default SubscriptionsPage;
