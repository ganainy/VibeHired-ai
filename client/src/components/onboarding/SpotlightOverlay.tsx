import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface SpotlightOverlayProps {
  isOpen: boolean;
  targetRef: React.RefObject<HTMLElement>;
  message: string;
  onDismiss?: () => void;
  padding?: number;
  maxWidth?: number;
}

const SpotlightOverlay: React.FC<SpotlightOverlayProps> = ({
  isOpen,
  targetRef,
  message,
  onDismiss,
  padding = 16,
  maxWidth = 260,
}) => {
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setRect(null);
      return;
    }

    const updateSpotlight = () => {
      if (!targetRef.current) return;
      const targetRect = targetRef.current.getBoundingClientRect();
      setRect({
        top: Math.max(8, targetRect.top - padding),
        left: Math.max(8, targetRect.left - padding),
        width: Math.min(window.innerWidth - 16, targetRect.width + padding * 2),
        height: Math.min(window.innerHeight - 16, targetRect.height + padding * 2),
      });
    };

    updateSpotlight();
    window.addEventListener('resize', updateSpotlight);
    window.addEventListener('scroll', updateSpotlight, true);
    return () => {
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight, true);
    };
  }, [isOpen, padding, targetRef]);

  if (!isOpen || !rect) return null;

  const overlay = (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      <div
        className="absolute rounded-[28px]"
        style={{
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          boxShadow: '0 0 0 9999px rgba(10, 10, 10, 0.55)',
          border: '2px solid #111',
          transition: 'all 200ms ease',
        }}
      />
      <div
        className="absolute rounded-xl border px-3 py-2 text-xs font-medium shadow-lg pointer-events-auto"
        style={{
          top: rect.top - 56 < 12
            ? Math.min(window.innerHeight - 12, rect.top + rect.height + 18)
            : Math.max(12, rect.top - 56),
          left: Math.max(12, Math.min(rect.left + 24, window.innerWidth - maxWidth - 12)),
          maxWidth,
          background: 'var(--bg-elevated)',
          borderColor: 'var(--border)',
          color: 'var(--text-primary)'
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="pr-2">{message}</p>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: 'var(--accent)' }}
              aria-label="Dismiss highlight"
            >
              Got it
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document === 'undefined' ? overlay : createPortal(overlay, document.body);
};

export default SpotlightOverlay;
