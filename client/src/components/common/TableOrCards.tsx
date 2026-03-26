import React, { useMemo } from 'react';

/**
 * TableOrCards - Responsive component that displays as cards on mobile, table on desktop
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
  mobileHidden?: boolean; // Hide this column on mobile (card view)
  render?: (item: T) => React.ReactNode; // Custom cell renderer for table
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
}: {
  item: T;
  config: CardConfig<T>;
  onClick?: () => void;
  className?: string;
}) {
  const avatar = config.avatar?.(item);
  const badge = config.badge?.(item);

  return (
    <div
      onClick={onClick}
      className={`
        p-3 sm:p-4 rounded-lg border transition-all duration-200
        ${onClick ? 'cursor-pointer hover:shadow-md active:scale-[0.99]' : ''}
        ${className}
      `}
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--border)',
      }}
    >
      {/* Header: Avatar, Title, Badge */}
      <div className="flex items-start gap-3 mb-3">
        {avatar && (
          <div
            className={`
              w-10 h-10 rounded flex items-center justify-center
              font-bold text-sm uppercase shrink-0
              ${avatar.className || ''}
            `}
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
          >
            {avatar.letter}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {config.title(item)}
          </div>
          {config.subtitle && (
            <div className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
              {config.subtitle(item)}
            </div>
          )}
        </div>
        {badge && (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${badge.className}`}>
            {badge.text}
          </span>
        )}
      </div>

      {/* Fields */}
      <div className="space-y-2 mb-3">
        {config.fields.slice(0, 4).map((field, idx) => {
          const value = field.value(item);
          if (!value) return null;
          return (
            <div key={idx} className="flex items-start gap-2 text-sm">
              {field.icon && (
                <span className="mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {field.icon}
                </span>
              )}
              <div className="min-w-0 flex-1">
                {field.label && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {field.label}:{' '}
                  </span>
                )}
                <span style={{ color: 'var(--text-secondary)' }}>{value}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      {config.actions && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-dim)' }}>
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
          <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            {emptyMessage}
          </div>
        )}
      </div>
    );
  }

  // Mobile: Card View
  if (isMobile) {
    return (
      <div className={`space-y-3 ${className}`}>
        {data.map((item, idx) => (
          <MobileCard
            key={item._id || item.id || idx}
            item={item}
            config={cardConfig}
            onClick={onRowClick ? () => onRowClick(item) : undefined}
            className={rowClassName?.(item)}
          />
        ))}
      </div>
    );
  }

  // Desktop: Table View
  return (
    <div className={`overflow-x-auto rounded-xl border ${className}`} style={{ borderColor: 'var(--border)' }}>
      <table className="w-full text-left">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                onClick={col.sortable ? col.onSort : undefined}
                className={`
                  p-4 text-sm font-semibold whitespace-nowrap
                  ${col.sortable ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}
                  ${getAlignClass(col.align)}
                  ${col.headerClassName || ''}
                `}
                style={{ color: 'var(--text-muted)' }}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {col.sortDirection === 'asc' && <span>↑</span>}
                  {col.sortDirection === 'desc' && <span>↓</span>}
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
                border-t transition-colors
                ${onRowClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''}
                ${rowClassName?.(item) || ''}
              `}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              style={{ borderColor: 'var(--border)' }}
            >
              {columns.map((col) => (
                <td
                  key={String(col.key)}
                  className={`p-4 whitespace-nowrap ${getAlignClass(col.align)} ${col.className || ''}`}
                >
                  {col.render ? col.render(item) : (item[col.key as keyof T] as React.ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
