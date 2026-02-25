import React, { useState } from 'react';
import { CvSectionDescriptor } from '../../../types/cvDescriptor';
import DynamicField from './DynamicField';
import DynamicObjectEntry from './DynamicObjectEntry';

interface DynamicSectionProps {
  descriptor: CvSectionDescriptor;
  data: any;
  onChange: (descriptor: CvSectionDescriptor, newData: any) => void;
  onImprove?: (descriptor: CvSectionDescriptor, sectionData: any, customInstructions?: string) => Promise<void>;
  onDelete?: () => void;
  improving?: boolean;
}

/**
 * Renders one complete CV section driven entirely by its CvSectionDescriptor.
 * Handles all sectionType variants and exposes an AI improvement action.
 */
const DynamicSection: React.FC<DynamicSectionProps> = ({
  descriptor,
  data,
  onChange,
  onImprove,
  onDelete,
  improving = false,
}) => {
  const [showImproveInput, setShowImproveInput] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');

  const [open, setOpen] = useState<boolean>(() => {
    const stored = localStorage.getItem(`cv_section_expanded_${descriptor.key}`);
    if (stored !== null) return stored === 'true';
    return false;
  });

  const handleToggleOpen = (newOpen: boolean) => {
    setOpen(newOpen);
    localStorage.setItem(`cv_section_expanded_${descriptor.key}`, String(newOpen));
  };

  const handleImprove = async () => {
    if (!onImprove) return;
    await onImprove(descriptor, data, customInstructions || undefined);
    setShowImproveInput(false);
    setCustomInstructions('');
  };

  // ── Object-list helpers ────────────────────────────────────────────────────
  const handleObjectListChange = (idx: number, updated: Record<string, any>) => {
    const list = Array.isArray(data) ? [...data] : [];
    list[idx] = updated;
    onChange(descriptor, list);
  };

  const handleObjectListAdd = () => {
    const emptyEntry: Record<string, any> = {};
    descriptor.fields.forEach((f) => { emptyEntry[f.key] = f.type === 'string-list' ? [] : ''; });
    onChange(descriptor, [...(Array.isArray(data) ? data : []), emptyEntry]);
  };

  const handleObjectListRemove = (idx: number) => {
    const list = Array.isArray(data) ? [...data] : [];
    onChange(descriptor, list.filter((_, i) => i !== idx));
  };

  // ── String-list helpers ────────────────────────────────────────────────────
  const handleStringListItemChange = (idx: number, v: string) => {
    const list = Array.isArray(data) ? [...data] : [];
    list[idx] = v;
    onChange(descriptor, list);
  };

  const handleStringListAdd = () => {
    onChange(descriptor, [...(Array.isArray(data) ? data : []), '']);
  };

  const handleStringListRemove = (idx: number) => {
    onChange(descriptor, (Array.isArray(data) ? data : []).filter((_: any, i: number) => i !== idx));
  };

  // ── Single-object / freetext field change ──────────────────────────────────
  const handleSingleFieldChange = (key: string, value: any) => {
    onChange(descriptor, { ...(data || {}), [key]: value });
  };

  // Derive the best "title key" for object entries (name, position, company, etc.)
  const titleKey = descriptor.fields.find(f =>
    ['name', 'position', 'company', 'institution', 'title', 'language', 'issuer'].includes(f.key)
  )?.key;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Section Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700/40 border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => handleToggleOpen(!open)}
          className="flex items-center gap-2 text-left group min-w-0"
        >
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate group-hover:text-blue-600 transition-colors">
            {descriptor.label}
          </span>
          {descriptor.sectionType === 'object-list' && Array.isArray(data) && (
            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
              ({data.length})
            </span>
          )}
        </button>

        {/* Improve button */}
        {onImprove && (
          <button
            type="button"
            onClick={() => setShowImproveInput((s) => !s)}
            disabled={improving}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg disabled:opacity-50 transition-colors flex-shrink-0 ml-2 text-ink-950" style={{background:"var(--accent-bg)", color:"var(--accent)"}}
            title="Improve this section with AI"
          >
            {improving ? (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
            {improving ? 'Improving…' : 'AI Improve'}
          </button>
        )}

        {/* Delete section button */}
        {onDelete && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete section "${descriptor.label}"? This cannot be undone.`)) {
                onDelete();
              }
            }}
            className="ml-1.5 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
            title="Delete this section"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* AI improve input */}
      {showImproveInput && open && (
        <div className="px-4 py-3 border-b" style={{background:"var(--accent-bg)", borderColor:"var(--accent-dim)"}}>
          <p className="text-xs mb-2" style={{color:"var(--accent)"}}>
            Optional: add specific instructions for the AI (e.g. "focus on leadership skills", "make it more concise").
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Custom instructions (optional)"
              className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gold-400 border" style={{borderColor:"var(--accent-dim)"}}
              onKeyDown={(e) => { if (e.key === 'Enter') handleImprove(); }}
            />
            <button
              type="button"
              onClick={handleImprove}
              disabled={improving}
              className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors text-ink-950" style={{background:"var(--accent)"}}
            >
              Improve
            </button>
            <button
              type="button"
              onClick={() => { setShowImproveInput(false); setCustomInstructions(''); }}
              className="text-xs px-2 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Section Content */}
      {open && (
        <div className="p-4 bg-white dark:bg-gray-800 space-y-4">

          {/* freetext ──────────────────────────────────────────────────────── */}
          {descriptor.sectionType === 'freetext' && (
            <textarea
              value={typeof data === 'string' ? data : ''}
              onChange={(e) => onChange(descriptor, e.target.value)}
              disabled={improving}
              rows={5}
              placeholder={`Enter ${descriptor.label}…`}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y transition-colors"
            />
          )}

          {/* single-object ─────────────────────────────────────────────────── */}
          {descriptor.sectionType === 'single-object' && (
            <div className="grid grid-cols-1 gap-4">
              {descriptor.fields.map((fieldDef) => (
                <DynamicField
                  key={fieldDef.key}
                  fieldDef={fieldDef}
                  value={(data || {})[fieldDef.key]}
                  onChange={(v) => handleSingleFieldChange(fieldDef.key, v)}
                  disabled={improving}
                />
              ))}
            </div>
          )}

          {/* string-list ───────────────────────────────────────────────────── */}
          {descriptor.sectionType === 'string-list' && (
            <div className="space-y-2">
              {(Array.isArray(data) ? data : []).map((item: string, idx: number) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => handleStringListItemChange(idx, e.target.value)}
                    disabled={improving}
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    placeholder={`Item ${idx + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => handleStringListRemove(idx)}
                    disabled={improving}
                    className="text-red-400 hover:text-red-600 disabled:opacity-40 p-1.5 rounded transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleStringListAdd}
                disabled={improving}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium disabled:opacity-40"
              >
                + Add item
              </button>
            </div>
          )}

          {/* object-list ───────────────────────────────────────────────────── */}
          {descriptor.sectionType === 'object-list' && (
            <div className="space-y-3">
              {(Array.isArray(data) ? data : []).map((entry: Record<string, any>, idx: number) => (
                <DynamicObjectEntry
                  key={idx}
                  fields={descriptor.fields}
                  entry={entry}
                  onChange={(updated) => handleObjectListChange(idx, updated)}
                  onRemove={() => handleObjectListRemove(idx)}
                  disabled={improving}
                  index={idx}
                  titleKey={titleKey}
                />
              ))}
              <button
                type="button"
                onClick={handleObjectListAdd}
                disabled={improving}
                className="w-full py-2.5 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-lg text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-40 transition-colors"
              >
                + Add {descriptor.label} entry
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default DynamicSection;
