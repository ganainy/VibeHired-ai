import React, { useState, useCallback } from 'react';
import {
  CvSectionDescriptor,
  CvDynamicPayload,
  FieldType,
  FieldDef,
  SectionType,
  DisplayStyle,
} from '../../../types/cvDescriptor';
import { improveSectionDynamic } from '../../../services/cvApi';
import DynamicSection from './DynamicSection';

interface DynamicCvFormProps {
  cvId: string;
  descriptor: CvSectionDescriptor[];
  data: Record<string, any>;
  /**
   * Called whenever the user edits any field.
   * Receives the full updated descriptor + data payload.
   */
  onChange: (payload: CvDynamicPayload) => void;
}

const SECTION_TYPE_OPTIONS: { value: SectionType; label: string; hint: string }[] = [
  { value: 'freetext', label: 'Free Text', hint: 'A single paragraph or multi-line block' },
  { value: 'string-list', label: 'Tag List', hint: 'A set of items shown as tags (e.g. skills)' },
  { value: 'single-object', label: 'Key-Value Fields', hint: 'One record with named fields' },
  { value: 'object-list', label: 'Timeline / List', hint: 'Multiple records (e.g. work experience)' },
];

const FIELD_TYPE_OPTIONS: FieldType[] = ['text', 'textarea', 'date', 'url'];

function displayStyleForSectionType(type: SectionType): DisplayStyle {
  switch (type) {
    case 'freetext': return 'text-block';
    case 'string-list': return 'tag-cloud';
    case 'single-object': return 'text-block';
    case 'object-list': return 'timeline';
  }
}

function initialDataForSectionType(type: SectionType): any {
  switch (type) {
    case 'freetext': return '';
    case 'string-list': return [];
    case 'single-object': return {};
    case 'object-list': return [];
  }
}

interface NewFieldRow {
  label: string;
  type: FieldType;
}

/**
 * Renders all CV sections from a CvSectionDescriptor array.
 * Completely replaces the old ResumeBuilder + hardcoded Form components.
 */
const DynamicCvForm: React.FC<DynamicCvFormProps> = ({ cvId, descriptor, data, onChange }) => {
  const [improvingKeys, setImprovingKeys] = useState<Set<string>>(new Set());

  // ── Add-section panel state ──────────────────────────────────────────────
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newSectionType, setNewSectionType] = useState<SectionType>('freetext');
  const [newFields, setNewFields] = useState<NewFieldRow[]>([{ label: '', type: 'text' }]);

  // Keep only visible sections, sorted by order
  const visibleSections = [...descriptor]
    .filter((s) => s.visible !== false)
    .sort((a, b) => a.order - b.order);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSectionChange = useCallback(
    (changedDescriptor: CvSectionDescriptor, newSectionData: any) => {
      onChange({
        descriptor,
        data: { ...data, [changedDescriptor.key]: newSectionData },
      });
    },
    [descriptor, data, onChange],
  );

  const handleDeleteSection = useCallback(
    (key: string) => {
      const nextDescriptor = descriptor.filter((s) => s.key !== key);
      const nextData = { ...data };
      delete nextData[key];
      onChange({ descriptor: nextDescriptor, data: nextData });
    },
    [descriptor, data, onChange],
  );

  const handleImprove = useCallback(
    async (
      sectionDescriptor: CvSectionDescriptor,
      sectionData: any,
      customInstructions?: string,
    ) => {
      setImprovingKeys((prev) => new Set(prev).add(sectionDescriptor.key));
      try {
        const result = await improveSectionDynamic(
          cvId,
          sectionDescriptor,
          sectionData,
          customInstructions,
        );
        onChange({
          descriptor,
          data: { ...data, [sectionDescriptor.key]: result.improvedData },
        });
      } catch (err: any) {
        console.error('AI improve failed for section', sectionDescriptor.key, err);
      } finally {
        setImprovingKeys((prev) => {
          const next = new Set(prev);
          next.delete(sectionDescriptor.key);
          return next;
        });
      }
    },
    [cvId, descriptor, data, onChange],
  );

  // ── Add-section helpers ───────────────────────────────────────────────────

  const resetAddForm = () => {
    setNewLabel('');
    setNewSectionType('freetext');
    setNewFields([{ label: '', type: 'text' }]);
    setIsAddOpen(false);
  };

  const handleCreateSection = () => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;

    const key = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '_' + Date.now();
    const maxOrder = descriptor.reduce((m, s) => Math.max(m, s.order ?? 0), 0);

    const builtFields: FieldDef[] = newFields
      .filter((f) => f.label.trim())
      .map((f) => ({ key: f.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'), label: f.label.trim(), type: f.type }));

    const newDescriptor: CvSectionDescriptor = {
      key,
      label: trimmed,
      sectionType: newSectionType,
      displayStyle: displayStyleForSectionType(newSectionType),
      fields: newSectionType === 'freetext' || newSectionType === 'string-list' ? [] : builtFields,
      order: maxOrder + 1,
      visible: true,
    };

    onChange({
      descriptor: [...descriptor, newDescriptor],
      data: { ...data, [key]: initialDataForSectionType(newSectionType) },
    });

    resetAddForm();
  };

  const updateField = (idx: number, patch: Partial<NewFieldRow>) => {
    setNewFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const removeField = (idx: number) => {
    setNewFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const needsFields = newSectionType === 'single-object' || newSectionType === 'object-list';

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="dynamic-cv-form w-full">
      {/* Header */}
      <div className="pb-5">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Resume Sections</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          All sections were identified and structured by AI from your uploaded CV.
          Edit freely — changes reflect instantly in the live preview.
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {visibleSections.map((sectionDescriptor) => (
          <DynamicSection
            key={sectionDescriptor.key}
            descriptor={sectionDescriptor}
            data={data[sectionDescriptor.key]}
            onChange={handleSectionChange}
            onImprove={handleImprove}
            onDelete={() => handleDeleteSection(sectionDescriptor.key)}
            improving={improvingKeys.has(sectionDescriptor.key)}
          />
        ))}
      </div>

      {visibleSections.length === 0 && !isAddOpen && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <p className="text-sm">No sections found. Add one below or try re-analysing the CV.</p>
        </div>
      )}

      {/* ── Add Section ──────────────────────────────────────────────────── */}
      <div className="mt-6">
        {!isAddOpen ? (
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-2 w-full justify-center px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Custom Section
          </button>
        ) : (
          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10 p-4 space-y-4">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">New Section</h4>

            {/* Section title */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Section Title
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Volunteer Work, Publications, Languages…"
                className="w-full text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500"
              />
            </div>

            {/* Section type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Section Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SECTION_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNewSectionType(opt.value)}
                    className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                      newSectionType === opt.value
                        ? 'border-blue-500 bg-blue-100 dark:bg-blue-800/40 text-blue-700 dark:text-blue-300'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-300'
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-gray-400 dark:text-gray-500 mt-0.5 leading-snug">{opt.hint}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Field builder — only for object types */}
            {needsFields && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Fields
                </label>
                <div className="space-y-2">
                  {newFields.map((field, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => updateField(idx, { label: e.target.value })}
                        placeholder="Field name (e.g. Company)"
                        className="flex-1 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                      <select
                        value={field.type}
                        onChange={(e) => updateField(idx, { type: e.target.value as FieldType })}
                        className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        {FIELD_TYPE_OPTIONS.map((ft) => (
                          <option key={ft} value={ft}>{ft}</option>
                        ))}
                      </select>
                      {newFields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeField(idx)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          title="Remove field"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setNewFields((prev) => [...prev, { label: '', type: 'text' }])}
                  className="mt-2 text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  + Add field
                </button>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleCreateSection}
                disabled={!newLabel.trim()}
                className="flex-1 py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium transition-colors"
              >
                Create Section
              </button>
              <button
                type="button"
                onClick={resetAddForm}
                className="py-2 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DynamicCvForm;

