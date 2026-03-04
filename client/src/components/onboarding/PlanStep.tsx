// client/src/components/onboarding/PlanStep.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface PlanStepProps {
  onFinish: () => void;
  onBack: () => void;
  isLoading: boolean;
}

const plans = [
  {
    name: 'Free',
    price: '$0',
    tagline: 'Get started',
    features: ['5 AI job applications/mo', '1 CV version', 'Basic analytics'],
    accent: 'var(--border)',
    accentBg: 'var(--bg-elevated)',
    accentText: 'var(--text-secondary)',
    highlight: false,
  },
  {
    name: 'Starter',
    price: '$9',
    tagline: '/month',
    features: ['50 AI applications/mo', '5 CV versions', 'Advanced analytics', 'Email drafting'],
    accent: 'var(--accent)',
    accentBg: 'rgba(232,184,68,0.08)',
    accentText: 'var(--accent)',
    highlight: true,
  },
  {
    name: 'Pro',
    price: '$19',
    tagline: '/month',
    features: ['Unlimited applications', 'Unlimited CVs', 'Priority AI processing', 'Interview prep'],
    accent: 'var(--jade)',
    accentBg: 'rgba(45,212,160,0.08)',
    accentText: 'var(--jade)',
    highlight: false,
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.45, ease: 'easeOut' as const },
  }),
};

const PlanStep: React.FC<PlanStepProps> = ({ onFinish, onBack, isLoading }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleViewPlans = async () => {
    await onFinish();
    navigate('/subscriptions');
  };

  return (
    <div className="flex flex-col items-center max-w-xl mx-auto w-full py-4">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-6"
      >
        <div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium mb-3"
          style={{
            borderColor: 'var(--border-bright)',
            background: 'rgba(232,184,68,0.07)',
            color: 'var(--accent)',
          }}
        >
          <Sparkles size={12} />
          Optional
        </div>
        <h2 className="font-display text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Choose your plan
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Start free, upgrade anytime. No credit card required for free tier.
        </p>
      </motion.div>

      <div className="grid grid-cols-3 gap-2 w-full mb-8">
        {plans.map((plan, i) => {
          const isCurrent = user?.plan === plan.name.toLowerCase();
          return (
            <motion.div
              key={plan.name}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="card p-4 relative flex flex-col"
              style={{
                borderColor: plan.highlight ? plan.accent : 'var(--border)',
                background: plan.accentBg,
              }}
            >
              {plan.highlight && (
                <div
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: 'var(--accent)', color: 'var(--bg-base)' }}
                >
                  Popular
                </div>
              )}
              <div className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: plan.accentText }}>
                  {plan.name}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="font-display text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {plan.price}
                  </span>
                  {plan.tagline !== 'Get started' && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {plan.tagline}
                    </span>
                  )}
                </div>
              </div>
              <ul className="space-y-1.5 flex-1">
                {plan.features.map((f, fi) => (
                  <li key={fi} className="flex items-start gap-1.5">
                    <Check size={11} style={{ color: plan.accentText, marginTop: 2, flexShrink: 0 }} strokeWidth={3} />
                    <span className="text-[11px] leading-tight" style={{ color: 'var(--text-secondary)' }}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
              {isCurrent && (
                <div
                  className="mt-3 text-center text-[10px] font-semibold uppercase tracking-wider py-1 rounded"
                  style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}
                >
                  Current plan
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex gap-3 w-full justify-between"
      >
        <button className="btn-ghost text-sm" onClick={onBack} disabled={isLoading}>
          Back
        </button>
        <div className="flex gap-2">
          <button
            className="btn-secondary text-sm px-4 flex items-center gap-2"
            onClick={handleViewPlans}
            disabled={isLoading}
          >
            View all plans
          </button>
          <button
            className="btn-primary text-sm px-6 flex items-center gap-2"
            onClick={onFinish}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                Finishing…
              </>
            ) : (
              <>
                Go to Dashboard <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default PlanStep;
