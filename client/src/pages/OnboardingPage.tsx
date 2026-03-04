// client/src/pages/OnboardingPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Briefcase, LayoutGrid, Sparkles, X } from 'lucide-react';

import StepIndicator from '../components/onboarding/StepIndicator';
import WelcomeStep from '../components/onboarding/WelcomeStep';
import CVUploadStep from '../components/onboarding/CVUploadStep';
import JobPreferencesStep from '../components/onboarding/JobPreferencesStep';
import FeatureTourStep from '../components/onboarding/FeatureTourStep';
import { completeOnboarding } from '../services/authApi';
import { useAuth } from '../context/AuthContext';

const STEPS = [
  { label: 'Welcome', icon: <Sparkles size={14} /> },
  { label: 'CV', icon: <FileText size={14} /> },
  { label: 'Prefs', icon: <Briefcase size={14} /> },
  { label: 'Features', icon: <LayoutGrid size={14} /> },
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '60%' : '-60%',
    opacity: 0,
    scale: 0.97,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: { duration: 0.38, ease: 'easeOut' as const },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-60%' : '60%',
    opacity: 0,
    scale: 0.97,
    transition: { duration: 0.28, ease: 'easeIn' as const },
  }),
};

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isFinishing, setIsFinishing] = useState(false);

  // Guard: if user has already completed onboarding, don't show this page
  useEffect(() => {
    if (user?.onboardingComplete === true) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const goNext = () => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleFinish = async () => {
    setIsFinishing(true);
    try {
      await completeOnboarding();
      await refreshProfile();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      // Navigate anyway — don't block the user
      navigate('/dashboard', { replace: true });
    } finally {
      setIsFinishing(false);
    }
  };

  const handleSkipAll = async () => {
    await handleFinish();
  };

  return (
    <div
      className="min-h-dvh w-full flex flex-col relative overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Background grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Header: progress indicator + skip */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex items-center justify-between px-6 pt-6 pb-4"
      >
        {/* Logo / brand */}
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono"
            style={{ background: 'var(--accent)', color: 'var(--bg-base)' }}
          >
            J
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Job App Assistant
          </span>
        </div>

        {step > 0 && (
          <button
            className="flex items-center gap-1.5 text-xs transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onClick={handleSkipAll}
          >
            <X size={13} />
            Skip setup
          </button>
        )}
      </motion.header>

      {/* Step indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="relative z-10 px-6 sm:px-12 py-4 max-w-lg mx-auto w-full"
      >
        <StepIndicator steps={STEPS} currentStep={step} />
      </motion.div>

      {/* Main content area */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-4 overflow-hidden">
        <div className="w-full max-w-xl relative">
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {step === 0 && <WelcomeStep onNext={goNext} />}
              {step === 1 && <CVUploadStep onNext={goNext} onBack={goBack} />}
              {step === 2 && <JobPreferencesStep onNext={goNext} onBack={goBack} />}
              {step === 3 && (
                <FeatureTourStep
                  onNext={handleFinish}
                  onBack={goBack}
                  isLast
                  isLoading={isFinishing}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer: step count */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="relative z-10 text-center pb-6 pt-2"
      >
        <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
          Step {step + 1} of {STEPS.length}
        </p>
      </motion.footer>
    </div>
  );
};

export default OnboardingPage;
