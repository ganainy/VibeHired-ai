// client/src/components/cv-workspace/CvEditorPanel.tsx
import React, { useRef, useEffect, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { JsonResumeSchema } from '../../../../server/src/types/jsonresume';
import { TemplateConfig, getAllTemplates } from '../../templates/config';
import { ResumeBuilder } from '../resume-builder';
import CvLivePreview from '../cv-editor/CvLivePreview';

export type CvSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface CvEditorPanelProps {
  /** Current CV data */
  data: JsonResumeSchema | null;
  /** Called on every edit in the form */
  onChange: (data: JsonResumeSchema) => void;
  /** Called when the user clicks Save */
  onSave: () => Promise<void> | void;
  /** Save lifecycle status – drives the status pill and Save button state */
  saveStatus?: CvSaveStatus;
  /** Whether there are unsaved edits – enables/disables the Save button */
  hasUnsavedChanges?: boolean;
  /** Active template ID */
  templateId: string;
  /** Called when the user picks a different template */
  onTemplateChange: (id: string) => void;
  /** Forwarded to ResumeBuilder for AI section improvement */
  onImproveSection?: (
    sectionName: string,
    sectionIndex: number,
    originalData: any,
    customInstructions?: string,
  ) => void;
  /** Which sections are currently being improved */
  improvingSections?: Record<string, boolean>;
  /**
   * Optional content rendered above the editor panel.
   * Useful for page-specific additions like the Tailoring Changes panel.
   */
  children?: React.ReactNode;
  /** Called when the user clicks Delete (usually only for tailored CVs) */
  onDelete?: () => void;
  className?: string;
}

const CvEditorPanel: React.FC<CvEditorPanelProps> = ({
  data,
  onChange,
  onSave,
  saveStatus = 'idle',
  hasUnsavedChanges = false,
  templateId,
  onTemplateChange,
  onImproveSection,
  improvingSections = {},
  children,
  onDelete,
  className = '',
}) => {
  // ── Template list ─────────────────────────────────────────────────────────
  const [availableTemplates, setAvailableTemplates] = useState<TemplateConfig[]>([]);
  useEffect(() => { setAvailableTemplates(getAllTemplates()); }, []);



  // ── Print ref ────────────────────────────────────────────────────────────
  const previewRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: previewRef, documentTitle: 'CV' });

  // ── Save status pill ──────────────────────────────────────────────────────
  const saveStatusConfig: Record<CvSaveStatus, { label: string; color: string } | null> = {
    idle: hasUnsavedChanges ? { label: 'Unsaved changes', color: 'amber' } : null,
    saving: { label: 'Saving…', color: 'blue' },
    saved: { label: 'Saved ✓', color: 'green' },
    error: { label: 'Save failed', color: 'red' },
  };
  const statusDisplay = saveStatusConfig[saveStatus];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col h-full ${className}`}>



      {/* ── Page-specific slot (e.g. Tailoring Changes panel) ────────────── */}
      {children}

      {/* ── Split view: editor left, preview right ────────────────────────── */}
      <div className="flex-1 min-h-0 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
        {/* Unified Toolbar inside the card */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Template selector */}
            {availableTemplates.length > 0 && (
              <select
                value={templateId}
                onChange={(e) => onTemplateChange(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[160px]"
              >
                {availableTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}

            {/* Save status pill */}
            {statusDisplay && (
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-${statusDisplay.color}-100 dark:bg-${statusDisplay.color}-900/30 text-${statusDisplay.color}-700 dark:text-${statusDisplay.color}-300`}
              >
                {statusDisplay.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Save button */}
            <button
              onClick={onSave}
              disabled={!hasUnsavedChanges || saveStatus === 'saving'}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${hasUnsavedChanges && saveStatus !== 'saving'
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                }`}
            >
              {saveStatus === 'saving' ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              )}
              {saveStatus === 'saving' ? 'Saving…' : 'Save'}
            </button>

            {/* Download PDF button */}
            <button
              onClick={() => handlePrint()}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </button>

            {/* Delete button (Tailored CVs only) */}
            {onDelete && (
              <>
                <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
                <button
                  onClick={onDelete}
                  className="flex items-center gap-2 px-4 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/40 transition-all border border-red-100 dark:border-red-900/30"
                  title="Delete this tailored CV to regenerate with new instructions"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 min-h-0 divide-x divide-gray-200 dark:divide-gray-700">

          {/* Editor pane */}
          <div className="h-full overflow-y-auto p-6">
            <div className="w-full pb-6">
              {data && (
                <ResumeBuilder
                  data={data}
                  onChange={onChange}
                  onImproveSection={onImproveSection}
                  improvingSections={improvingSections}
                />
              )}
            </div>
          </div>

          {/* Preview pane */}
          <div className="h-full overflow-y-auto p-0" style={{ minHeight: '800px' }}>
            <CvLivePreview
              ref={previewRef}
              data={data}
              templateId={templateId}
              onTemplateChange={onTemplateChange}
            />
          </div>

        </div>
      </div>
    </div>
  );
};

export default CvEditorPanel;
