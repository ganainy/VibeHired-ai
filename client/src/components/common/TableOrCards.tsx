import React, { useMemo } from 'react';

/**
 * TableOrCards - Responsive component that displays as cards on mobile, table on desktop
 * Enhanced with refined animations, visual depth, and intentional design
 */

export interface ColumnDef<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  onSort?: () => void;
  sortDirection?: 'asc' | 'desc' | null;
  align?: 'left' | 'center' | 'right';
  className?: string;
  headerClassName?: string;
  mobileHidden?: boolean;
  wrap?: boolean;
  render?: (item: T) => React.ReactNode;
}

export interface CardConfig<T> {
  title: (item: T) => string;
  subtitle?: (item: T) => string;
  badge?: (item: T) => { text: string; className: string } | null;
  avatar?: (item: T) => { letter: string; className?: string } | null;
  fields: Array<{
    label?: string;
    value: (item: T) => React.ReactNode;
    icon?: React.ReactNode;
  }>;
  actions?: (item: T) => React.ReactNode;
}

export interface TableOrCardsProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  cardConfig: CardConfig<T>;
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string | undefined;
  emptyMessage?: string;
  emptyState?: React.ReactNode;
  className?: string;
  mobileBreakpoint?: 'sm' | 'md' | 'lg';
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) {
      setMatches(media.matches);
    }
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [matches, query]);

  return matches;
}

function MobileCard<T>({
  item,
  config,
  onClick,
  className,
  idx,
}: {
  item: T;
  config: CardConfig<T>;
  onClick?: () => void;
  className?: string;
  idx: number;
}) {
  const avatar = config.avatar?.(item);
  const badge = config.badge?.(item);
  const [isPressed, setIsPressed] = React.useState(false);

  return (
    <div
      onClick={onClick}
      onMouseDown={() => onClick && setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={() => onClick && setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      className={`
        relative overflow-hidden group
        rounded-[18px] p-[18px]
        transition-all duration-[250ms] cubic-bezier(0.4, 0, 0.2, 1)
        ${onClick ? 'cursor-pointer' : ''}
        ${isPressed ? 'scale-[0.97]' : 'hover:scale-[1.01] hover:-translate-y-0.5'}
        ${className}
      `}
      style={{
        background: 'linear-gradient(145deg, var(--bg-surface) 0%, color-mix(in srgb, var(--bg-surface) 96%, var(--accent) 4%) 100%)',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12), 0 8px 24px -8px rgba(0, 0, 0, 0.15)',
        animation: `card-fade-in 0.4s ease-out ${idx * 0.06}s both`,
      }}
    >
      {/* Subtle glow effect on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--accent) 8%, transparent) 0%, transparent 70%)',
        }}
      />

      {/* Accent line at top */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-60"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, var(--accent) 20%, var(--accent) 80%, transparent 100%)',
        }}
      />

      {/* Header: Avatar, Title, Badge */}
      <div className="relative flex items-start gap-3 mb-4">
        {avatar && (
          <div
            className="relative w-[38px] h-[38px] rounded-xl flex items-center justify-center font-bold text-sm uppercase shrink-0"
            style={{
              background: 'var(--accent-bg)',
              color: 'var(--accent)',
              border: '1px solid var(--accent-dim)',
              boxShadow: '0 2px 8px rgba(217, 119, 6, 0.15)',
            }}
          >
            {avatar.letter}
            <div
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
              style={{ background: 'var(--accent)' }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div
            className="text-[15px] font-semibold leading-tight truncate"
            style={{
              color: 'var(--text-primary)',
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 500,
            }}
          >
            {config.title(item)}
          </div>
          {config.subtitle && (
            <div
              className="text-[12px] mt-0.5 truncate"
              style={{ color: 'var(--text-muted)', fontFamily: "'Outfit', sans-serif" }}
            >
              {config.subtitle(item)}
            </div>
          )}
        </div>
        {badge && (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium tracking-wide ${badge.className}`}
            style={{
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
            }}
          >
            {badge.text}
          </span>
        )}
      </div>

      {/* Fields */}
      <div className="relative space-y-2.5 mb-4">
        {config.fields.slice(0, 4).map((field, fieldIdx) => {
          const value = field.value(item);
          if (!value) return null;
          return (
            <div
              key={fieldIdx}
              className="flex items-start gap-2.5 group/field"
              style={{ animation: `field-fade-in 0.3s ease-out ${(idx * 0.06) + (fieldIdx * 0.04)}s both` }}
            >
              {field.icon && (
                <span className="mt-0.5 shrink-0 text-[13px] opacity-70 group-hover/field:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }}>
                  {field.icon}
                </span>
              )}
              <div className="min-w-0 flex-1">
                {field.label && (
                  <span
                    className="text-[10px] uppercase tracking-[0.08em] font-semibold block mb-0.5"
                    style={{ color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {field.label}
                  </span>
                )}
                <span
                  className="text-[13px] leading-relaxed block"
                  style={{ color: 'var(--text-secondary)', fontFamily: "'Outfit', sans-serif" }}
                >
                  {value}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      {config.actions && (
        <div
          className="relative flex items-center justify-end gap-2 pt-3 border-t"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {config.actions(item)}
        </div>
      )}
    </div>
  );
}

export function TableOrCards<T extends Record<string, any>>({
  data,
  columns,
  cardConfig,
  onRowClick,
  rowClassName,
  emptyMessage = 'No data found.',
  emptyState,
  className = '',
  mobileBreakpoint = 'md',
}: TableOrCardsProps<T>) {
  const isMobile = useMediaQuery(`(max-width: ${mobileBreakpoint === 'sm' ? '640px' : mobileBreakpoint === 'md' ? '768px' : '1024px'})`);

  const getAlignClass = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center': return 'text-center';
      case 'right': return 'text-right';
      default: return 'text-left';
    }
  };

  if (data.length === 0) {
    return (
      <div className={className}>
        {emptyState || (
          <div
            className="p-12 text-center"
            style={{
              background: 'linear-gradient(180deg, var(--bg-surface) 0%, color-mix(in srgb, var(--bg-surface) 98%, transparent) 100%)',
              border: '1px dashed var(--border)',
              borderRadius: '18px',
            }}
          >
            <div
              className="text-4xl mb-3 opacity-40"
              style={{ fontFamily: "'Fraunces', Georgia, serif" }}
            >
              ∅
            </div>
            <div className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: "'Outfit', sans-serif" }}>
              {emptyMessage}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Mobile: Card View
  if (isMobile) {
    return (
      <div className={`space-y-3.5 ${className}`}>
        {data.map((item, idx) => (
          <MobileCard
            key={item._id || item.id || idx}
            item={item}
            config={cardConfig}
            onClick={onRowClick ? () => onRowClick(item) : undefined}
            className={rowClassName?.(item)}
            idx={idx}
          />
        ))}
      </div>
    );
  }

  // Desktop: Table View
  return (
    <div className={className}>
      <div
        className="overflow-hidden rounded-[18px]"
        style={{
          background: 'linear-gradient(145deg, var(--bg-surface) 0%, color-mix(in srgb, var(--bg-surface) 96%, var(--accent) 4%) 100%)',
          border: '1px solid var(--border)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12), 0 8px 24px -8px rgba(0, 0, 0, 0.15)',
        }}
      >
        {/* Accent line at top of table */}
        <div
          className="h-[2px] opacity-60"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, var(--accent) 15%, var(--accent) 85%, transparent 100%)',
          }}
        />

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr
                style={{
                  background: 'linear-gradient(180deg, color-mix(in srgb, var(--bg-elevated) 95%, transparent) 0%, var(--bg-elevated) 100%)',
                }}
              >
                {columns.map((col, colIdx) => (
                  <th
                    key={String(col.key)}
                    onClick={col.sortable ? col.onSort : undefined}
                    className={`
                      p-4 whitespace-nowrap
                      ${col.sortable ? 'cursor-pointer group hover:bg-white/[0.03]' : ''}
                      ${getAlignClass(col.align)}
                      ${col.headerClassName || ''}
                      transition-colors duration-200
                    `}
                    style={{
                      color: 'var(--text-muted)',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      animation: `header-fade-in 0.3s ease-out ${colIdx * 0.05}s both`,
                    }}
                  >
                    <div className={`flex items-center gap-2 ${getAlignClass(col.align)}`}>
                      {col.label}
                      {col.sortDirection === 'asc' && (
                        <span className="text-[10px] opacity-60" style={{ color: 'var(--accent)' }}>▲</span>
                      )}
                      {col.sortDirection === 'desc' && (
                        <span className="text-[10px] opacity-60" style={{ color: 'var(--accent)' }}>▼</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item, idx) => (
                <tr
                  key={item._id || item.id || idx}
                  className={`
                    transition-all duration-200
                    ${onRowClick ? 'cursor-pointer' : ''}
                    ${rowClassName?.(item) || ''}
                  `}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  style={{
                    borderTop: '1px solid var(--border)',
                    animation: `row-fade-in 0.4s ease-out ${idx * 0.05}s both`,
                  }}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={String(col.key)}
                      className={`
                        p-4 ${col.wrap ? 'whitespace-normal' : 'whitespace-nowrap'}
                        ${getAlignClass(col.align)} ${col.className || ''}
                        transition-all duration-200
                      `}
                      style={{
                        color: 'var(--text-secondary)',
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: '14px',
                      }}
                    >
                      {col.render ? col.render(item) : (item[col.key as keyof T] as React.ReactNode)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inline styles for animations */}
      <style>{`
        @keyframes card-fade-in {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes field-fade-in {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes header-fade-in {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes row-fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
