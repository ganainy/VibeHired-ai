// client/src/components/onboarding/StepIndicator.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface Step {
  label: string;
  icon: React.ReactNode;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ steps, currentStep }) => {
  return (
    <div className="flex items-center justify-center w-full">
      {steps.map((step, index) => {
        const isDone = index < currentStep;
        const isActive = index === currentStep;

        return (
          <React.Fragment key={index}>
            {/* Step dot */}
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                className="relative flex items-center justify-center rounded-full border-2 text-xs font-mono font-bold transition-colors"
                style={{
                  width: 36,
                  height: 36,
                  borderColor: isDone
                    ? 'var(--jade)'
                    : isActive
                    ? 'var(--accent)'
                    : 'var(--border)',
                  background: isDone
                    ? 'rgba(45,212,160,0.12)'
                    : isActive
                    ? 'rgba(232,184,68,0.12)'
                    : 'var(--bg-elevated)',
                  color: isDone
                    ? 'var(--jade)'
                    : isActive
                    ? 'var(--accent)'
                    : 'var(--text-muted)',
                }}
                animate={{ scale: isActive ? 1.1 : 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {isDone ? (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <Check size={14} strokeWidth={3} />
                  </motion.span>
                ) : (
                  <span>{step.icon}</span>
                )}
                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2"
                    style={{ borderColor: 'var(--accent)' }}
                    animate={{ scale: [1, 1.4, 1], opacity: [0.7, 0, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                )}
              </motion.div>
              <span
                className="text-[10px] font-medium tracking-wide uppercase hidden sm:block"
                style={{
                  color: isActive
                    ? 'var(--accent)'
                    : isDone
                    ? 'var(--jade)'
                    : 'var(--text-muted)',
                }}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className="flex-1 h-px mx-2 sm:mx-3 relative overflow-hidden"
                style={{ background: 'var(--border)' }}
              >
                <motion.div
                  className="absolute inset-y-0 left-0 h-full"
                  style={{ background: 'var(--jade)' }}
                  initial={{ width: 0 }}
                  animate={{ width: isDone ? '100%' : '0%' }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default StepIndicator;
