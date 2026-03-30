import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { JsonResumeSchema } from '../../../../server/src/types/jsonresume';
import { CvSectionDescriptor, CvDynamicPayload } from '../../../types/cvDescriptor';
import ErrorAlert from '../../../components/common/ErrorAlert';
import Spinner from '../../../components/common/Spinner';
import CvEditorPanel from '../../../components/cv-workspace/CvEditorPanel';
import AtsInlinePanel from '../../../components/ats/AtsInlinePanel';
import PromptChecklist from '../../../components/common/PromptChecklist';
import { AtsScores } from '../../../services/atsApi';

interface CvEditorTabProps {
    jobApplication: any;
    jobId: string | undefined;
    cvData: JsonResumeSchema;
    setCvData: React.Dispatch<React.SetStateAction<JsonResumeSchema>>;
    currentCvId: string | null;
    currentCvFilename: string | null;
    liveCvDescriptor: CvSectionDescriptor[] | null;
    liveCvData: Record<string, any> | null;
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
    isGenerating: boolean;
    generateError: string | null;
    tailoringChanges: Array<{ section: string; description: string; reason: string; before?: string; after?: string }> | null;
    showInlineCvDiff: boolean;
    selectedBaseCvId: string;
    availableCvs: { id: string; name: string; data: any }[];
    hasMasterCv: boolean;
    cvCreationMode: 'ai' | 'import';
    cvImportFile: File | null;
    isApplyingBaseCv: boolean;
    applyCvError: string | null;
    selectedBaseCvIdForImport: string;
    selectedTemplate: string;
    isLoadingRawPdf: boolean;
    hasLocalCv: boolean;
    hasPersistableCvContent: boolean;
    improvingSections: Record<string, boolean>;
    analyzeError: string | null;
    tailoredJobTitle: string;
    tailoredCompanyName: string;
    tailoredJobDescription: string;
    customInstructions: string;
    lastSavedCvDataRef: React.RefObject<string | null>;
    // ATS state
    atsScores: AtsScores | null;
    isScanningAts: boolean;
    isLoadingAts: boolean;
    atsProgressMessage: string;
    isApplyingAtsBatch: boolean;
    // Handlers
    onCvChange: (data: JsonResumeSchema) => void;
    onManualSaveCv: () => void;
    onDynamicChange: (payload: CvDynamicPayload) => void;
    onImproveSection: (sectionKey: string, sectionData: any) => void;
    onSetSelectedTemplate: (template: string) => void;
    onSetShowInlineCvDiff: (show: boolean) => void;
    onSetCvCreationMode: (mode: 'ai' | 'import') => void;
    onSetCvImportFile: (file: File | null) => void;
    onSetSelectedBaseCvIdForImport: (id: string) => void;
    onSetApplyCvError: (error: string | null) => void;
    onApplyBaseCv: () => void;
    onSelectedBaseCvIdChange: (id: string) => void;
    onGenerateSpecificCv: () => void;
    onSetTailoredJobTitle: (value: string) => void;
    onSetTailoredCompanyName: (value: string) => void;
    onSetTailoredJobDescription: (value: string) => void;
    onSetCustomInstructions: (value: string) => void;
    onSetGenerateCvError: (error: string | null) => void;
    onDeleteCv: () => void;
    onResetLocalCvState: () => void;
    onGetCvOriginalPdf: (cvId: string) => Promise<{ pdfBase64: string }>;
    onSetPreviewPdfBase64: (data: string | null) => void;
    onSetIsPreviewOpen: (open: boolean) => void;
    onDetachJobCv: () => Promise<void>;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
    // ATS handlers
    onScanAts: () => void;
    onApplyAtsSuggestionBatch: (suggestions: string[]) => void;
    onDeleteAts: () => void;
    onSetAnalyzeError: (error: string | null) => void;
}

export const CvEditorTab: React.FC<CvEditorTabProps> = ({
    jobApplication,
    jobId,
    cvData,
    setCvData,
    currentCvId,
    currentCvFilename,
    liveCvDescriptor,
    liveCvData,
    saveStatus,
    isGenerating,
    generateError,
    tailoringChanges,
    showInlineCvDiff,
    selectedBaseCvId,
    availableCvs,
    hasMasterCv,
    cvCreationMode,
    cvImportFile,
    isApplyingBaseCv,
    applyCvError,
    selectedBaseCvIdForImport,
    selectedTemplate,
    isLoadingRawPdf,
    hasLocalCv,
    hasPersistableCvContent,
    improvingSections,
    analyzeError,
    tailoredJobTitle,
    tailoredCompanyName,
    tailoredJobDescription,
    customInstructions,
    lastSavedCvDataRef,
    atsScores,
    isScanningAts,
    isLoadingAts,
    atsProgressMessage,
    isApplyingAtsBatch,
    onCvChange,
    onManualSaveCv,
    onDynamicChange,
    onImproveSection,
    onSetSelectedTemplate,
    onSetShowInlineCvDiff,
    onSetCvCreationMode,
    onSetCvImportFile,
    onSetSelectedBaseCvIdForImport,
    onSetApplyCvError,
    onApplyBaseCv,
    onSelectedBaseCvIdChange,
    onGenerateSpecificCv,
    onSetTailoredJobTitle,
    onSetTailoredCompanyName,
    onSetTailoredJobDescription,
    onSetCustomInstructions,
    onSetGenerateCvError,
    onDeleteCv,
    onResetLocalCvState,
    onGetCvOriginalPdf,
    onSetPreviewPdfBase64,
    onSetIsPreviewOpen,
    onDetachJobCv,
    showToast,
    onScanAts,
    onApplyAtsSuggestionBatch,
    onDeleteAts,
    onSetAnalyzeError,
}) => {
    const cvImportFileRef = useRef<HTMLInputElement>(null);

    return (
        <div>
            {/* Raw PDF attached -- no JSON, show placeholder */}
            {hasLocalCv && (!cvData || !cvData.basics || Object.keys(cvData.basics).length === 0) && !liveCvDescriptor ? (
                <div className="p-10 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col items-center gap-4 text-center">
                    <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--accent)' }}>description</span>
                    <div>
                        <p className="text-base font-semibold text-gray-800 dark:text-gray-200">CV attached as PDF</p>
                        {currentCvFilename && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">{currentCvFilename}</p>
                        )}
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                            This CV was stored as-is. No in-app editing is available for raw PDF attachments.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            disabled={isLoadingRawPdf}
                            onClick={async () => {
                                if (!currentCvId) return;
                                try {
                                    const { pdfBase64 } = await onGetCvOriginalPdf(currentCvId);
                                    onSetPreviewPdfBase64(pdfBase64);
                                    onSetIsPreviewOpen(true);
                                } catch {
                                    showToast('Failed to load PDF preview', 'error');
                                }
                            }}
                            className="btn-secondary text-sm disabled:opacity-50"
                        >
                            {isLoadingRawPdf ? (
                                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                            ) : (
                                <span className="material-symbols-outlined text-base">visibility</span>
                            )}
                            Preview PDF
                        </button>
                        <button
                            type="button"
                            onClick={async () => {
                                if (!window.confirm('Remove this attached CV? You can re-attach another one.')) return;
                                try {
                                    await onDetachJobCv();
                                } catch (err: any) {
                                    const msg: string = err?.message ?? '';
                                    if (!msg.toLowerCase().includes('no cv was attached') && !msg.toLowerCase().includes('not found')) {
                                        showToast(`Failed to remove CV: ${msg}`, 'error');
                                        return;
                                    }
                                }
                                onResetLocalCvState();
                                showToast('CV removed', 'success');
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg transition-colors"
                        >
                            <span className="material-symbols-outlined text-base">delete</span>
                            Remove &amp; re-attach
                        </button>
                    </div>
                </div>
            ) : hasLocalCv ? (
                <CvEditorPanel
                    data={cvData}
                    onChange={onCvChange}
                    onSave={onManualSaveCv}
                    saveStatus={saveStatus}
                    hasUnsavedChanges={
                        lastSavedCvDataRef.current !== null &&
                        JSON.stringify(cvData) !== lastSavedCvDataRef.current
                    }
                    templateId={selectedTemplate}
                    onTemplateChange={onSetSelectedTemplate}
                    onImproveSection={onImproveSection}
                    improvingSections={improvingSections}
                    cvId={currentCvId ?? undefined}
                    cvDescriptor={liveCvDescriptor}
                    cvData={liveCvData}
                    onDynamicChange={onDynamicChange}
                    diffChanges={tailoringChanges || []}
                    showDiffOverlay={showInlineCvDiff}
                    onDelete={onDeleteCv}
                >
                    {/* Tailoring Changes Panel */}
                    {tailoringChanges !== null && (
                        <div className="mb-6 bg-surface rounded-xl border border-theme shadow-sm overflow-hidden">
                            <details className="group">
                                <summary className="flex items-center justify-between cursor-pointer p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors border-b border-transparent group-open:border-zinc-100 dark:group-open:border-zinc-800">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-lg text-ink-950 shadow-sm" style={{ background: 'var(--accent)' }}>
                                            <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Tailoring Changes</h3>
                                            <p className="text-xs text-secondary-color">
                                                {tailoringChanges.length > 0
                                                    ? `${tailoringChanges.length} modification${tailoringChanges.length !== 1 ? 's' : ''} recorded`
                                                    : 'No section-level change details were provided for this version'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onSetShowInlineCvDiff(!showInlineCvDiff);
                                            }}
                                            disabled={tailoringChanges.length === 0}
                                            className="text-xs font-semibold px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {showInlineCvDiff ? 'Hide Inline Diff' : 'Show Inline Diff'}
                                        </button>
                                        <span className="text-zinc-400 group-open:rotate-180 transition-transform duration-200">
                                            <span className="material-symbols-outlined text-[20px]">expand_more</span>
                                        </span>
                                    </div>
                                </summary>
                                <div className="p-4 pt-0 divide-y divide-slate-100 dark:divide-slate-800">
                                    {tailoringChanges.length === 0 && (
                                        <div className="py-4 text-sm text-zinc-600 dark:text-zinc-300">
                                            This tailored CV was generated, but the model did not return section-level diff details.
                                        </div>
                                    )}
                                    {tailoringChanges.map((change, index) => (
                                        <div key={index} className="py-4 first:pt-2 last:pb-2">
                                            <div className="flex items-start gap-4">
                                                <span className="flex-shrink-0 mt-0.5 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                                    {change.section}
                                                </span>
                                                <div className="flex-1 min-w-0 space-y-1.5">
                                                    <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-snug">
                                                        {change.before || change.after
                                                            ? `In ${change.section}, changed from "${change.before || '---'}" to "${change.after || '---'}".`
                                                            : change.description}
                                                    </p>
                                                    <p className="text-xs text-zinc-500 dark:text-zinc-500 flex items-center gap-2 italic">
                                                        <span className="w-1 h-1 rounded-full" style={{ background: 'var(--accent)' }}></span>
                                                        {change.reason}
                                                    </p>
                                                    {(change.before || change.after) && (
                                                        <details className="mt-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 p-2.5">
                                                            <summary className="cursor-pointer text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">View content diff</summary>
                                                            <div className="mt-2 space-y-2">
                                                                {change.before && (
                                                                    <div>
                                                                        <p className="text-[10px] font-bold uppercase tracking-wide text-secondary-color mb-1">Before</p>
                                                                        <p className="text-xs text-secondary-color whitespace-pre-wrap break-words">{change.before}</p>
                                                                    </div>
                                                                )}
                                                                {change.after && (
                                                                    <div>
                                                                        <p className="text-[10px] font-bold uppercase tracking-wide text-secondary-color mb-1">After</p>
                                                                        <p className="text-xs text-secondary-color whitespace-pre-wrap break-words">{change.after}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </details>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </div>
                    )}

                    {/* ATS Analysis Card */}
                    <div className="mb-6 bg-surface rounded-xl border border-theme shadow-sm overflow-hidden">
                        <details className="group">
                            <summary className="flex items-center justify-between cursor-pointer p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors border-b border-transparent group-open:border-zinc-100 dark:group-open:border-zinc-800">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg text-ink-950 shadow-sm" style={{ background: 'var(--accent)' }}>
                                        <span className="material-symbols-outlined text-[20px]">troubleshoot</span>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">ATS Analysis</h3>
                                        <p className="text-xs text-secondary-color">
                                            {isScanningAts ? 'Scanning...' : atsScores ? (() => {
                                                const total =
                                                    (atsScores.complianceDetails?.actionableFeedback?.length ?? 0) +
                                                    (atsScores.complianceDetails?.keywordsMissing?.length ?? 0) +
                                                    (atsScores.skillMatchDetails?.missingSkills?.length ?? 0);
                                                return total > 0 ? `${total} improvement${total !== 1 ? 's' : ''} available` : 'Looking good -- no issues found';
                                            })() : 'Run a scan to check compatibility'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {atsScores && (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${(atsScores.score ?? 0) >= 80 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                            : (atsScores.score ?? 0) >= 60 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                            }`}>
                                            {Math.round(atsScores.score ?? 0)}%
                                        </span>
                                    )}
                                    {atsScores && (
                                        <button
                                            onClick={(e) => { e.preventDefault(); onScanAts(); }}
                                            className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 transition-all"
                                            title="Re-scan ATS"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Re-scan
                                            <span className="text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-dim)', color: 'var(--text-on-accent)' }}>2 Credit</span>
                                        </button>
                                    )}
                                    <span className="text-zinc-400 group-open:rotate-180 transition-transform duration-200">
                                        <span className="material-symbols-outlined text-[20px]">expand_more</span>
                                    </span>
                                </div>
                            </summary>
                            <AtsInlinePanel
                                atsScores={atsScores}
                                isScanning={isScanningAts}
                                isLoading={isLoadingAts}
                                progressMessage={atsProgressMessage}
                                hasJobDescription={!!jobApplication?.jobDescriptionText}
                                isApplyingBatch={isApplyingAtsBatch}
                                onScan={onScanAts}
                                onRescan={onScanAts}
                                onApplyBatch={onApplyAtsSuggestionBatch}
                                onDelete={atsScores ? onDeleteAts : undefined}
                                hideHeader
                            />
                        </details>
                    </div>

                    {/* Analysis error */}
                    {analyzeError && (
                        <div className="mb-4">
                            <ErrorAlert
                                message={`Analysis Error: ${analyzeError}`}
                                onDismiss={() => onSetAnalyzeError(null)}
                            />
                        </div>
                    )}
                </CvEditorPanel>
            ) : (
                <div>
                    <div className="mb-6">
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Tailor Your CV</h2>
                        <p className="text-gray-600 dark:text-gray-400 text-lg">
                            Choose how you want to create this job's CV.
                        </p>
                    </div>

                    {/* Option picker */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                        <button
                            type="button"
                            onClick={() => onSetCvCreationMode('ai')}
                            className={`group relative flex flex-col items-start gap-3 rounded-2xl border-2 p-6 text-left transition-all focus:outline-none ${cvCreationMode === 'ai' ? 'border-gold-500 shadow-md' : 'hover:border-gold-400'}`}
                        >
                            <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${cvCreationMode === 'ai' ? 'text-ink-950' : 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400'}`} style={cvCreationMode === 'ai' ? { background: 'var(--accent)' } : {}}>
                                <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-gray-100">Generate with AI</p>
                                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Let the AI tailor your CV to the job description automatically.</p>
                            </div>
                            {cvCreationMode === 'ai' && (
                                <span className="absolute top-4 right-4 flex items-center justify-center w-5 h-5 rounded-full text-ink-950" style={{ background: 'var(--accent)' }}>
                                    <span className="material-symbols-outlined text-[14px]">check</span>
                                </span>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => onSetCvCreationMode('import')}
                            className={`group relative flex flex-col items-start gap-3 rounded-2xl border-2 p-6 text-left transition-all focus:outline-none ${cvCreationMode === 'import' ? 'border-gold-500 shadow-md' : 'hover:border-gold-400'}`}
                        >
                            <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${cvCreationMode === 'import' ? 'text-ink-950' : 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400'}`} style={cvCreationMode === 'import' ? { background: 'var(--accent)' } : {}}>
                                <span className="material-symbols-outlined text-[22px]">upload_file</span>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900 dark:text-gray-100">Use my own CV</p>
                                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Upload a PDF / DOCX file or pick an existing one from your library.</p>
                            </div>
                            {cvCreationMode === 'import' && (
                                <span className="absolute top-4 right-4 flex items-center justify-center w-5 h-5 rounded-full text-ink-950" style={{ background: 'var(--accent)' }}>
                                    <span className="material-symbols-outlined text-[14px]">check</span>
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Option B form: Import / Upload */}
                    {cvCreationMode === 'import' && (
                        <div className="card p-8 space-y-6">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                <span className="material-symbols-outlined" style={{ color: "var(--accent)" }}>folder_open</span>
                                Attach CV
                            </h3>
                            {applyCvError && (
                                <ErrorAlert message={applyCvError} onDismiss={() => onSetApplyCvError(null)} />
                            )}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Upload a file <span className="text-gray-400 font-normal">(PDF or DOCX)</span></label>
                                <input
                                    type="file"
                                    accept=".pdf,.docx"
                                    ref={cvImportFileRef}
                                    className="hidden"
                                    onChange={(e) => { const f = e.target.files?.[0] ?? null; onSetCvImportFile(f); if (f) onSetSelectedBaseCvIdForImport(''); }}
                                />
                                {cvImportFile ? (
                                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "var(--accent-bg)", borderColor: "var(--accent-dim)", border: "1px solid var(--accent-dim)" }}>
                                        <span className="material-symbols-outlined" style={{ color: "var(--accent)" }}>description</span>
                                        <span className="flex-1 truncate text-sm text-gray-800 dark:text-gray-200 font-medium">{cvImportFile.name}</span>
                                        <button
                                            onClick={() => { onSetCvImportFile(null); if (cvImportFileRef.current) cvImportFileRef.current.value = ''; }}
                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-base">close</span>
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => cvImportFileRef.current?.click()}
                                        disabled={isApplyingBaseCv}
                                        className="flex items-center gap-3 w-full px-4 py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:border-gold-400 hover:text-gold-600 dark:hover:text-gold-400 hover:bg-gold-50 dark:hover:bg-gold-900/10 transition-all disabled:opacity-50"
                                    >
                                        <span className="material-symbols-outlined text-2xl">upload_file</span>
                                        <span className="text-sm font-medium">Click to choose a PDF or DOCX file...</span>
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-4">
                                <hr className="flex-1 border-gray-200 dark:border-gray-700" />
                                <span className="text-sm font-medium text-gray-400">OR</span>
                                <hr className="flex-1 border-gray-200 dark:border-gray-700" />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select from your library</label>
                                <div className="relative">
                                    <select
                                        value={selectedBaseCvIdForImport}
                                        onChange={(e) => { onSetSelectedBaseCvIdForImport(e.target.value); onSetCvImportFile(null); if (cvImportFileRef.current) cvImportFileRef.current.value = ''; }}
                                        disabled={!!cvImportFile || isApplyingBaseCv}
                                        className="w-full px-4 py-3 pr-11 appearance-none bg-gray-50 dark:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 input-base disabled:opacity-50"
                                    >
                                        <option value="">-- choose a saved CV --</option>
                                        {availableCvs.map(cv => (
                                            <option key={cv.id} value={cv.id}>{cv.name || 'Unnamed CV'}</option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                                        <span className="material-symbols-outlined">expand_more</span>
                                    </div>
                                </div>
                                {availableCvs.length === 0 && (
                                    <p className="text-xs text-gray-400 dark:text-gray-500">No saved CVs yet. You can upload a file above.</p>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
                                <span className="material-symbols-outlined text-base shrink-0">lock</span>
                                A full independent copy will be stored for this job. Editing or deleting the original will not affect this application.
                            </p>
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    onClick={() => { onSetCvCreationMode('ai'); onSetApplyCvError(null); onSetCvImportFile(null); onSetSelectedBaseCvIdForImport(''); }}
                                    className="px-5 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium transition-colors"
                                >
                                    Switch to AI Generate
                                </button>
                                <button
                                    onClick={onApplyBaseCv}
                                    disabled={isApplyingBaseCv || (!selectedBaseCvIdForImport && !cvImportFile)}
                                    className="flex items-center gap-2 px-6 py-2.5 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isApplyingBaseCv ? <Spinner size="sm" /> : <span className="material-symbols-outlined text-base">attach_file</span>}
                                    Attach to Job
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Option A form: AI Generate */}
                    {cvCreationMode === 'ai' && (
                        <>
                            {generateError && (
                                <div className="mb-6">
                                    <ErrorAlert
                                        message={generateError}
                                        onDismiss={() => onSetGenerateCvError(null)}
                                    />
                                </div>
                            )}
                            <div className="card p-8 space-y-8">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="material-symbols-outlined" style={{ color: "var(--accent)" }}>work</span>
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Target Role</h3>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Job Title</label>
                                            <input
                                                type="text"
                                                value={tailoredJobTitle}
                                                onChange={(e) => onSetTailoredJobTitle(e.target.value)}
                                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-600 border border-gray-200 dark:border-gray-600 input-base"
                                                placeholder="e.g. Senior Product Manager"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company Name</label>
                                            <input
                                                type="text"
                                                value={tailoredCompanyName}
                                                onChange={(e) => onSetTailoredCompanyName(e.target.value)}
                                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-600 border border-gray-200 dark:border-gray-600 input-base"
                                                placeholder="e.g. Acme Innovations"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined" style={{ color: "var(--accent)" }}>description</span>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Job Description</h3>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <textarea
                                            value={tailoredJobDescription}
                                            onChange={(e) => onSetTailoredJobDescription(e.target.value)}
                                            className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-600 border border-gray-200 dark:border-gray-600 input-base min-h-[200px]"
                                            placeholder="Paste the full job description here... Our AI will analyze key requirements and skills."
                                        ></textarea>
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="material-symbols-outlined" style={{ color: "var(--accent)" }}>folder</span>
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Base Resume</h3>
                                            </div>
                                            <div className="relative">
                                                <select
                                                    value={selectedBaseCvId}
                                                    onChange={(e) => onSelectedBaseCvIdChange(e.target.value)}
                                                    className="w-full px-4 py-3 pr-11 appearance-none bg-gray-50 dark:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 input-base"
                                                >
                                                    <option value="">-- Not selected --</option>
                                                    {availableCvs.map(cv => (
                                                        <option key={cv.id} value={cv.id}>{cv.name || 'Unnamed CV'}</option>
                                                    ))}
                                                    {availableCvs.length === 0 && <option value="master">Loading CVs...</option>}
                                                </select>
                                                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                                                    <span className="material-symbols-outlined">expand_more</span>
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                Select the version you want to tailor for this application.
                                            </p>
                                        </div>
                                    </div>
                                    <PromptChecklist
                                        type="cv"
                                        onChange={onSetCustomInstructions}
                                    />
                                </div>
                            </div>
                            <div className="mt-8 flex items-center justify-end gap-4">
                                <button
                                    onClick={() => window.history.back()}
                                    className="px-6 py-2.5 text-gray-600 dark:text-gray-400 font-medium hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={onGenerateSpecificCv}
                                    disabled={isGenerating || !hasMasterCv || !tailoredJobDescription}
                                    className="btn-primary font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Spinner size="sm" className="text-white" />
                                            <span>Generating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-white">auto_awesome</span>
                                            <span>Generate Tailored CV</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default CvEditorTab;

