import React from 'react';

export type CreditsBadgeVariant = 'accent' | 'gold' | 'ember' | 'dim';

interface CreditsBadgeProps {
  amount: string;
  variant?: CreditsBadgeVariant;
  className?: string;
}

const variantStyles: Record<CreditsBadgeVariant, { background: string; color: string }> = {
  accent: { background: 'var(--accent-bg)', color: 'var(--accent)' },
  gold: { background: '#e8b844', color: '#0e0e17' },
  ember: { background: 'var(--ember-bg)', color: 'var(--ember)' },
  dim: { background: 'var(--accent-dim)', color: 'var(--text-on-accent)' },
};

const CreditsBadge: React.FC<CreditsBadgeProps> = ({ amount, variant = 'accent', className = '' }) => {
  const styles = variantStyles[variant];
  return (
    <span
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${className}`}
      style={{ background: styles.background, color: styles.color }}
    >
      {amount}
    </span>
  );
};

export default CreditsBadge;
