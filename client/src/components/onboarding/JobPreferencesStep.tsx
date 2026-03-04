// client/src/components/onboarding/JobPreferencesStep.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, MapPin, Monitor, Users, Building2, ArrowRight, SkipForward } from 'lucide-react';
import axios from 'axios';

interface JobPreferencesStepProps {
  onNext: () => void;
  onBack: () => void;
}

type WorkMode = 'remote' | 'hybrid' | 'onsite' | '';

const workModes: { value: WorkMode; label: string; icon: React.ReactNode }[] = [
  { value: 'remote', label: 'Remote', icon: <Monitor size={14} /> },
  { value: 'hybrid', label: 'Hybrid', icon: <Users size={14} /> },
  { value: 'onsite', label: 'On-site', icon: <Building2 size={14} /> },
];

const API_BASE_URL = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001/api'}`;

const JobPreferencesStep: React.FC<JobPreferencesStepProps> = ({ onNext, onBack }) => {
  const [targetRole, setTargetRole] = useState('');
  const [location, setLocation] = useState('');
  const [workMode, setWorkMode] = useState<WorkMode>('');
  const [isSaving, setIsSaving] = useState(false);

  const hasAnyInput = targetRole || location || workMode;

  const handleNext = async () => {
    if (!hasAnyInput) {
      onNext();
      return;
    }
    setIsSaving(true);
    try {
      await axios.put(`${API_BASE_URL}/profile`, {
        jobPreferences: {
          targetRole: targetRole || undefined,
          workMode: workMode || undefined,
          location: location || undefined,
        },
      });
    } catch (err) {
      console.warn('Failed to save job preferences:', err);
    } finally {
      setIsSaving(false);
      onNext();
    }
  };

  const fieldClass = 'input-base w-full';

  return (
    <div className="flex flex-col items-center max-w-md mx-auto w-full py-4">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h2 className="font-display text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Job preferences
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Help the AI find and tailor applications for the right roles. You can update these anytime.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="w-full space-y-5 mb-8"
      >
        {/* Target Role */}
        <div>
          <label className="label-overline flex items-center gap-1.5 mb-2">
            <Briefcase size={12} />
            Target role
          </label>
          <input
            type="text"
            className={fieldClass}
            placeholder="e.g. Senior Frontend Engineer"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
          />
        </div>

        {/* Work Mode */}
        <div>
          <label className="label-overline flex items-center gap-1.5 mb-2">
            <Monitor size={12} />
            Work mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            {workModes.map((m) => (
              <motion.button
                key={m.value}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setWorkMode(workMode === m.value ? '' : m.value)}
                className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-medium transition-colors"
                style={{
                  borderColor: workMode === m.value ? 'var(--accent)' : 'var(--border)',
                  background:
                    workMode === m.value ? 'rgba(232,184,68,0.1)' : 'var(--bg-elevated)',
                  color: workMode === m.value ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              >
                <span style={{ color: workMode === m.value ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {m.icon}
                </span>
                {m.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="label-overline flex items-center gap-1.5 mb-2">
            <MapPin size={12} />
            Preferred location
          </label>
          <input
            type="text"
            className={fieldClass}
            placeholder="e.g. London, UK or Worldwide"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex gap-3 w-full justify-between"
      >
        <button className="btn-ghost text-sm" onClick={onBack} disabled={isSaving}>
          Back
        </button>
        <div className="flex gap-2">
          {!hasAnyInput && (
            <button
              className="btn-ghost text-sm flex items-center gap-1.5"
              style={{ color: 'var(--text-muted)' }}
              onClick={onNext}
            >
              <SkipForward size={13} />
              Skip
            </button>
          )}
          <button
            className="btn-primary flex items-center gap-2 text-sm px-6"
            onClick={handleNext}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                Saving…
              </>
            ) : (
              <>
                Continue <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default JobPreferencesStep;
