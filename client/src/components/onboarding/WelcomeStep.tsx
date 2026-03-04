// client/src/components/onboarding/WelcomeStep.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, FileText, Zap, TrendingUp, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface WelcomeStepProps {
  onNext: () => void;
}

const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
  const { user } = useAuth();
  const firstName = user?.username || user?.email?.split('@')[0] || 'there';

  const highlights = [
    { icon: <FileText size={14} />, label: 'AI-Powered CV Tailoring' },
    { icon: <Zap size={14} />, label: 'Auto-Apply to Jobs' },
    { icon: <TrendingUp size={14} />, label: 'Application Analytics' },
  ];

  const wordVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.12, duration: 0.5, ease: 'easeOut' as const },
    }),
  };

  const words = ['Your', 'dream', 'job', 'starts', 'here.'];

  return (
    <div className="flex flex-col items-center justify-center text-center max-w-lg mx-auto py-6 select-none">
      {/* Floating blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute rounded-full opacity-[0.07]"
          style={{
            width: 480,
            height: 480,
            top: '50%',
            left: '50%',
            translate: '-50% -50%',
            background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full opacity-[0.055]"
          style={{
            width: 300,
            height: 300,
            top: '20%',
            right: '5%',
            background: 'radial-gradient(circle, var(--jade) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.15, 1], x: [0, 12, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Badge */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
        className="flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-medium mb-8"
        style={{
          borderColor: 'var(--border-bright)',
          background: 'rgba(232,184,68,0.07)',
          color: 'var(--accent)',
        }}
      >
        <Sparkles size={13} />
        Quick setup — just 2 minutes
      </motion.div>

      {/* Headline */}
      <h1 className="font-display text-4xl sm:text-5xl font-bold leading-tight mb-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {words.map((word, i) => (
          <motion.span
            key={i}
            custom={i}
            variants={wordVariants}
            initial="hidden"
            animate="visible"
            style={{
              color: i === 1 || i === 2 ? 'var(--accent)' : 'var(--text-primary)',
            }}
          >
            {word}
          </motion.span>
        ))}
      </h1>

      {/* Subheadline */}
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75, duration: 0.5 }}
        className="text-base sm:text-lg mb-8 leading-relaxed"
        style={{ color: 'var(--text-secondary)' }}
      >
        Welcome, <span style={{ color: 'var(--text-primary)' }} className="font-semibold">{firstName}</span>.
        {' '}Let's set up your workspace in a few quick steps.
      </motion.p>

      {/* Feature highlights */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="flex flex-wrap justify-center gap-2 mb-10"
      >
        {highlights.map((h, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9 + i * 0.1, type: 'spring', stiffness: 300, damping: 20 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium"
            style={{
              borderColor: 'var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ color: 'var(--jade)' }}>{h.icon}</span>
            {h.label}
          </motion.span>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.button
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, duration: 0.5 }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onNext}
        className="btn-primary flex items-center gap-2 px-8 py-3 text-base font-semibold"
      >
        Get started
        <ArrowRight size={16} />
      </motion.button>
    </div>
  );
};

export default WelcomeStep;
