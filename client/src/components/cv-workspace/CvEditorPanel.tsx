// client/src/components/cv-workspace/CvEditorPanel.tsx
import React, { useRef, useEffect, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { JsonResumeSchema } from '../../../../server/src/types/jsonresume';
import { CvSectionDescriptor, CvDynamicPayload } from '../../types/cvDescriptor';
import { TemplateConfig, getAllTemplates } from '../../templates/config';
import { ResumeBuilder } from '../resume-builder';
import CvLivePreview from '../cv-editor/CvLivePreview';
import DynamicCvForm from '../cv-editor/dynamic/DynamicCvForm';
import FreeformCvEditor from '../cv-freeform/FreeformCvEditor';

const SHOW_EDITOR_PREF_KEY = 'cv_workspace_show_editor_panel';

function loadShowEditorPreference(): boolean {
  try {
    const raw = localStorage.getItem(SHOW_EDITOR_PREF_KEY);
    if (raw === '0') return false;
    if (raw === '1') return true;
  } catch {
    // Ignore storage errors and use default
  }
  return true;
}

function isJsonResumeLike(data: unknown): data is JsonResumeSchema {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const candidate = data as Record<string, unknown>;
  return 'basics' in candidate || 'work' in candidate || 'education' in candidate || 'skills' in candidate;
}

export type CvSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface CvEditorPanelProps {
  /** Current CV data (legacy JsonResume path) */
  data: JsonResumeSchema | null;
  /** Called on every edit in the legacy form */
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
  /** Forwarded to ResumeBuilder for AI section improvement (legacy path) */
  onImproveSection?: (
    sectionName: string,
    sectionIndex: number,
    originalData: any,
    customInstructions?: string,
  ) => void;
  /** Which sections are currently being improved (legacy path) */
  improvingSections?: Record<string, boolean>;
  /**
   * Optional content rendered above the editor panel.
   */
  children?: React.ReactNode;
  /** Called when the user clicks Delete */
  onDelete?: () => void;
  className?: string;
  /**
   * Optional ATS analysis panel rendered in the right pane.
   */
  atsPanel?: React.ReactNode;
  /** Which right-pane view to show by default when atsPanel is provided */
  defaultRightView?: 'preview' | 'ats';

  // ── Dynamic (AI-driven) editor props ────────────────────────────────────
  /**
   * The MongoDB _id of the CV document. Required for dynamic section AI improvement.
   */
  cvId?: string;
  /**
   * AI-generated structural descriptor. When provided together with cvData,
   * the dynamic editor is shown instead of ResumeBuilder.
   */
  cvDescriptor?: CvSectionDescriptor[] | null;
  /**
   * Free-form CV content keyed by section key.
   */
  cvData?: Record<string, any> | null;
  /**
   * Called when the user edits any field in the dynamic editor.
   */
  onDynamicChange?: (payload: CvDynamicPayload) => void;
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
  atsPanel,
  defaultRightView = 'preview',
  cvId,
  cvDescriptor,
  cvData,
  onDynamicChange,
}) => {
  const [rightView, setRightView] = useState<'preview' | 'ats'>(atsPanel ? defaultRightView : 'preview');
  const [availableTemplates, setAvailableTemplates] = useState<TemplateConfig[]>([]);
  const [showEditorPanel, setShowEditorPanel] = useState<boolean>(() => loadShowEditorPreference());
  useEffect(() => { setAvailableTemplates(getAllTemplates()); }, []);
  useEffect(() => {
    try {
      localStorage.setItem(SHOW_EDITOR_PREF_KEY, showEditorPanel ? '1' : '0');
    } catch {
      // Ignore storage errors
    }
  }, [showEditorPanel]);

  // Determine whether to use the AI-driven dynamic editor
  const isDynamic = Boolean(cvDescriptor && cvDescriptor.length > 0 && cvData && cvId);

  // Build the CvDynamicPayload for preview when in dynamic mode
  const dynamicPayload: CvDynamicPayload | null = isDynamic
    ? { descriptor: cvDescriptor!, data: cvData! }
    : null;
  const isFreeformJson = Boolean(data && !isJsonResumeLike(data));



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
    <div className={`flex flex-col h-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      {/* ── Page-specific slot (e.g. Tailoring Changes panel) ────────────── */}
      {children && (
        <div className="flex-shrink-0 p-4 pb-0 bg-gray-50/30 dark:bg-gray-800/30">
          {children}
        </div>
      )}

      {/* ── Split view: editor left, preview right ────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Unified Toolbar inside the card */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowEditorPanel((prev) => !prev)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
              aria-expanded={showEditorPanel}
              aria-label={showEditorPanel ? 'Hide editor panel' : 'Show editor panel'}
            >
              {showEditorPanel ? 'Hide Editor' : 'Show Editor'}
            </button>

            {/* Template selector — only show when more than one template is available */}
            {availableTemplates.length > 1 && (
              <select
                value={templateId}
                onChange={(e) => onTemplateChange(e.target.value)}
                disabled={isFreeformJson}
                className="input-base px-3 py-1.5 text-sm min-w-[160px] focus:ring-gold-500/50"
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
                ? 'btn-primary hover:bg-primaryLight'
                : 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed rounded-lg px-4 py-1.5 text-sm font-semibold'
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
              disabled={false}
              className="btn-primary flex items-center gap-2 px-4 py-1.5 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </button>

            {/* Delete button (Tailored CVs only) */}
            {onDelete && (
              <>
                <div className="w-px h-6 bg-gray-200 dark:bg-gray-600 mx-1" />
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

        <div className={`grid ${showEditorPanel ? 'grid-cols-1 lg:grid-cols-2 divide-x divide-gray-200 dark:divide-gray-700' : 'grid-cols-1'} flex-1 min-h-0`}>

          {/* Editor pane */}
          {showEditorPanel && (
          <div className="h-full overflow-y-auto p-6">
            <div className="w-full pb-6">
              {/* Dynamic AI-driven editor */}
              {isDynamic && cvId && cvData && cvDescriptor && onDynamicChange && (
                <DynamicCvForm
                  cvId={cvId}
                  descriptor={cvDescriptor}
                  data={cvData}
                  onChange={onDynamicChange}
                />
              )}

              {/* Legacy JsonResume editor (shown when descriptor not yet generated) */}
              {!isDynamic && data && !isFreeformJson && (
                <ResumeBuilder
                  data={data}
                  onChange={onChange}
                  onImproveSection={onImproveSection}
                  improvingSections={improvingSections}
                />
              )}

              {/* Freeform JSON editor */}
              {!isDynamic && data && isFreeformJson && (
                <FreeformCvEditor
                  value={data as Record<string, any>}
                  onChange={(next) => onChange(next as JsonResumeSchema)}
                />
              )}

              {/* Intermediate state: CV loaded but descriptor still generating */}
              {!isDynamic && !data && (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-sm">Loading CV editor…</p>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Preview / ATS pane */}
          <div className="h-full overflow-y-auto" style={{ minHeight: '800px' }}>
            {rightView === 'ats' && atsPanel ? (
              <div className="h-full">{atsPanel}</div>
            ) : (
              <CvLivePreview
                ref={previewRef}
                data={data}
                templateId={templateId}
                onTemplateChange={onTemplateChange}
                dynamicPayload={dynamicPayload}
              />
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default CvEditorPanel;
