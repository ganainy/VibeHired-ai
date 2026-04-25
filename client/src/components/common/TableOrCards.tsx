import React from 'react';

export interface ColumnDef<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  onSort?: () => void;
  sortDirection?: 'asc' | 'desc' | null;
  align?: 'left' | 'center' | 'right';
  className?: string;
  headerClassName?: string;
  wrap?: boolean;
  render?: (item: T) => React.ReactNode;
}

export interface TableOrCardsProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string | undefined;
  emptyMessage?: string;
  emptyState?: React.ReactNode;
  className?: string;
}

export function TableOrCards<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  rowClassName,
  emptyMessage = 'No data found.',
  emptyState,
  className = '',
}: TableOrCardsProps<T>) {
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
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              ∅
            </div>
            <div className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: "'Inter', sans-serif" }}>
              {emptyMessage}
            </div>
          </div>
        )}
      </div>
    );
  }

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
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className={`
                        p-4 ${col.wrap ? 'whitespace-normal' : 'whitespace-nowrap'}
                        ${getAlignClass(col.align)} ${col.className || ''}
                        transition-all duration-200
                      `}
                      style={{
                        color: 'var(--text-secondary)',
                        fontFamily: "'Inter', sans-serif",
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
