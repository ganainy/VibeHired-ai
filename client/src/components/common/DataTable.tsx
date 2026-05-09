import React from 'react';

export interface DataTableColumn<T> {
  key: keyof T | string;
  label: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
  headerClassName?: string;
  wrap?: boolean;
  render?: (item: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string | undefined;
  emptyMessage?: string;
  emptyState?: React.ReactNode;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  onRowClick,
  rowClassName,
  emptyMessage = 'No data found.',
  emptyState,
  className = '',
}: DataTableProps<T>) {
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
            className="py-16 text-center"
            style={{
              border: '1px dashed var(--border)',
              borderRadius: '12px',
            }}
          >
            <div
              className="text-3xl mb-3 opacity-40"
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
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr
            className="border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={`
                  pb-4 whitespace-nowrap
                  ${getAlignClass(col.align)}
                  ${col.headerClassName || ''}
                `}
                style={{
                  color: 'var(--text-muted)',
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody
          className="divide-y"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          {data.map((item, idx) => (
            <tr
              key={item._id || item.id || idx}
              className={`
                group transition-colors duration-200
                ${onRowClick ? 'cursor-pointer' : ''}
                ${rowClassName?.(item) || ''}
              `}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
              style={{
                animation: `row-fade-in 0.4s ease-out ${idx * 0.05}s both`,
              }}
            >
              {columns.map((col) => (
                <td
                  key={String(col.key)}
                  className={`
                    py-5 ${col.wrap ? 'whitespace-normal' : 'whitespace-nowrap'}
                    ${getAlignClass(col.align)} ${col.className || ''}
                    transition-all duration-200
                  `}
                  style={{
                    color: 'var(--text-secondary)',
                    fontFamily: "'Manrope', sans-serif",
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

      {/* Inline styles for animations */}
      <style>{`
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
