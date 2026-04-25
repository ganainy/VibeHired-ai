import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

export const Badge: React.FC<BadgeProps> = ({ 
  className = '', 
  variant = 'default',
  ...props 
}) => {
  const baseClasses = 'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200';
  
  const variantClasses = {
    default: 'border-transparent text-white shadow-sm',
    secondary: 'border-transparent shadow-sm',
    destructive: 'border-transparent text-white shadow-sm',
    outline: 'hover:bg-[var(--bg-elevated)]',
  };

  const variantStyles: Record<string, React.CSSProperties> = {
    default: { backgroundColor: 'var(--accent)', borderColor: 'transparent' },
    secondary: { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', borderColor: 'var(--border)' },
    destructive: { backgroundColor: 'var(--rose)', borderColor: 'transparent' },
    outline: { color: 'var(--text-primary)', borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' },
  };
  
  return (
    <div 
      className={cn(baseClasses, variantClasses[variant], className)}
      style={variantStyles[variant]}
      {...props}
    />
  );
};