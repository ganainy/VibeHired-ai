import React from 'react';
import { FieldDef } from '../../../types/cvDescriptor';

interface DynamicFieldProps {
  fieldDef: FieldDef;
  value: any;
  onChange: (value: any) => void;
  /** Disable all inputs (e.g. while an AI improve is in progress) */
  disabled?: boolean;
}

const inputBase =
  'w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors';

/**
 * Renders a single field from a FieldDef as the appropriate input widget.
 * Handles all FieldType variants.
 */
const DynamicField: React.FC<DynamicFieldProps> = ({ fieldDef, value, onChange, disabled }) => {
  const { type, label, placeholder, required } = fieldDef;

  // ── string-list ───────────────────────────────────────────────────────────
  if (type === 'string-list') {
    const list: string[] = Array.isArray(value) ? value : [];

    const handleItemChange = (idx: number, v: string) => {
      const next = [...list];
      next[idx] = v;
      onChange(next);
    };

    const handleAdd = () => onChange([...list, '']);

    const handleRemove = (idx: number) => {
      onChange(list.filter((_, i) => i !== idx));
    };

    return (
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <div className="space-y-1.5">
          {list.map((item, idx) => (
            <div key={idx} className="flex gap-2">
              <input
                type="text"
                value={item}
                onChange={(e) => handleItemChange(idx, e.target.value)}
                disabled={disabled}
                className={`${inputBase} flex-1`}
                placeholder={placeholder || `Item ${idx + 1}`}
              />
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                disabled={disabled}
                className="text-red-400 hover:text-red-600 disabled:opacity-40 p-1 rounded"
                title="Remove"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAdd}
            disabled={disabled}
            className="mt-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium disabled:opacity-40"
          >
            + Add item
          </button>
        </div>
      </div>
    );
  }

  // ── textarea ──────────────────────────────────────────────────────────────
  if (type === 'textarea') {
    return (
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <textarea
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={4}
          placeholder={placeholder}
          className={`${inputBase} resize-y`}
        />
      </div>
    );
  }

  // ── single-line inputs (text, date, url, email, phone) ───────────────────
  const inputType =
    type === 'email' ? 'email' :
    type === 'url'   ? 'url'   :
    type === 'phone' ? 'tel'   :
    type === 'date'  ? 'text'  : // dates stored as YYYY-MM strings, not <input type="date">
    'text';

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={inputType}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder ?? (type === 'date' ? 'YYYY-MM' : undefined)}
        className={inputBase}
      />
    </div>
  );
};

export default DynamicField;
