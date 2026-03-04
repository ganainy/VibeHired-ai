// client/src/components/onboarding/FeatureTourStep.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Zap, Globe, Target, ArrowRight } from 'lucide-react';

interface FeatureTourStepProps {
  onNext: () => void;
  onBack: () => void;
  isLast?: boolean;
  isLoading?: boolean;
}

const features = [
  {
    icon: <LayoutDashboard size={28} />,
    accent: 'var(--accent)',
    accentBg: 'rgba(232,184,68,0.1)',
    title: 'Smart Dashboard',
    description:
      'Track every application, monitor your status pipeline, and get AI insights about your job search performance — all in one place.',
  },
  {
    icon: <Zap size={28} />,
    accent: 'var(--jade)',
    accentBg: 'rgba(45,212,160,0.1)',
    title: 'Custom CV & Cover Letter',
    description:
      'Paste any job URL and the AI rewrites your CV and generates a personalised cover letter perfectly matched to that role in seconds.',
  },
  {
    icon: <Target size={28} />,
    accent: 'var(--rose)',
    accentBg: 'rgba(244,100,100,0.1)',
    title: 'ATS & Job Match Score',
    description:
      'Instantly see how well your CV passes Applicant Tracking Systems and how closely it matches the job requirements — before you apply.',
  },
  {
    icon: <Globe size={28} />,
    accent: 'var(--ember)',
    accentBg: 'rgba(240,126,56,0.1)',
    title: 'Public Portfolio',
    description:
      'Showcase your skills with a beautiful, shareable portfolio page. Recruiters can browse your work without you lifting a finger.',
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.15, duration: 0.5, ease: 'easeOut' as const },
  }),
};

const FeatureTourStep: React.FC<FeatureTourStepProps> = ({ onNext, onBack, isLast = false, isLoading = false }) => {
  return (
    <div className="flex flex-col items-center max-w-xl mx-auto w-full py-4">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <h2 className="font-display text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Your full toolkit
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Here's what's waiting for you inside
        </p>
      </motion.div>

      <div className="w-full space-y-3 mb-8">
        {features.map((f, i) => (
          <motion.div
            key={i}
            custom={i}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ x: 4 }}
            className="card p-5 flex items-start gap-4 cursor-default"
          >
            <div
              className="shrink-0 flex items-center justify-center rounded-xl"
              style={{
                width: 52,
                height: 52,
                background: f.accentBg,
                color: f.accent,
              }}
            >
              {f.icon}
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
                {f.title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {f.description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex gap-3 w-full justify-between"
      >
        <button className="btn-ghost text-sm" onClick={onBack} disabled={isLoading}>
          Back
        </button>
        <button
          className="btn-primary flex items-center gap-2 text-sm px-6"
          onClick={onNext}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <div
                className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
              />
              Finishing…
            </>
          ) : isLast ? (
            <>Go to Dashboard <ArrowRight size={14} /></>
          ) : (
            <>Next <ArrowRight size={14} /></>
          )}
        </button>
      </motion.div>
    </div>
  );
};

export default FeatureTourStep;
