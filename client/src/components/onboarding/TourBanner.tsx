import React from 'react';
import { Sparkles, X } from 'lucide-react';

interface TourBannerProps {
  /** Human-readable name for the feature being demoed, e.g. "Job Dashboard" */
  pageLabel: string;
  /** Called when the user clicks "Got it" */
  onDismiss: () => void;
}

/**
 * Dismissible top-of-page banner shown during the per-page demo tour.
 * Pair with a mock card below this component.
 */
const TourBanner: React.FC<TourBannerProps> = ({ pageLabel, onDismiss }) => (
  <div
    className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm"
    style={{
      background: 'var(--accent-bg)',
      border: '1px solid var(--accent-dim)',
      color: 'var(--accent)',
    }}
  >
    <div className="flex items-center gap-2.5 min-w-0">
      <Sparkles size={15} className="shrink-0" />
      <span className="font-medium truncate">
        Demo preview — this is what the <span className="font-semibold">{pageLabel}</span> looks like with your data.
      </span>
    </div>
    <button
      onClick={onDismiss}
      className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:opacity-80"
      style={{ background: 'var(--accent)', color: 'var(--bg-base)' }}
    >
      Got it
      <X size={12} />
    </button>
  </div>
);

export default TourBanner;
