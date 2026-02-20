import React from 'react';
import { FieldDef } from '../../../types/cvDescriptor';
import DynamicField from './DynamicField';

interface DynamicObjectEntryProps {
  fields: FieldDef[];
  entry: Record<string, any>;
  onChange: (updated: Record<string, any>) => void;
  onRemove?: () => void;
  disabled?: boolean;
  /** 0-based position label shown in the collapsible header */
  index: number;
  /** Optional title field key to show in collapsed state, e.g. "name" or "position" */
  titleKey?: string;
}

/**
 * Renders one entry of an object-list section (e.g. one work experience item).
 * Uses DynamicField for each FieldDef and renders collapsible to save vertical space.
 */
const DynamicObjectEntry: React.FC<DynamicObjectEntryProps> = ({
  fields,
  entry,
  onChange,
  onRemove,
  disabled,
  index,
  titleKey,
}) => {
  const [open, setOpen] = React.useState(index === 0);

  const handleFieldChange = (key: string, value: any) => {
    onChange({ ...entry, [key]: value });
  };

  // Derive a readable title for the collapsed header
  const titleValue =
    titleKey && entry[titleKey]
      ? String(entry[titleKey])
      : fields[0]?.key && entry[fields[0].key]
        ? String(entry[fields[0].key])
        : `Entry ${index + 1}`;

  return (
    <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-600/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
      >
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate pr-4">
          {titleValue}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onRemove && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              disabled={disabled}
              className="text-red-400 hover:text-red-600 disabled:opacity-40 p-1 rounded transition-colors"
              title="Remove entry"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Fields */}
      {open && (
        <div className="px-4 py-4 grid grid-cols-1 gap-4 bg-white dark:bg-gray-800">
          {fields.map((fieldDef) => (
            <DynamicField
              key={fieldDef.key}
              fieldDef={fieldDef}
              value={entry[fieldDef.key]}
              onChange={(v) => handleFieldChange(fieldDef.key, v)}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DynamicObjectEntry;
