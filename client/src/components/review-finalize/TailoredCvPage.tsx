// client/src/components/review-finalize/TailoredCvPage.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { JsonResumeSchema } from '../../../../server/src/types/jsonresume';
import CvEditorPanel from '../cv-workspace/CvEditorPanel';
import { CvSectionDescriptor } from '../../types/cvDescriptor';
import AtsInlinePanel from '../ats/AtsInlinePanel';
import CvPreviewModal from '../cv-editor/CvPreviewModal';
import ConfirmModal from '../common/ConfirmModal';
import { Button, Card, Input, Select, Textarea } from '../common';
import ErrorAlert from '../common/ErrorAlert';
import Spinner from '../common/Spinner';
import SimpleLoader from '../common/SimpleLoader';
import PromptChecklist from '../common/PromptChecklist';
import { getCvOriginalPdf, detachJobCv, deleteCv, getJobCv } from '../../services/cvApi';
import { AtsScores } from '../../services/atsApi';
import { JobApplication } from '../../services/jobApi';

interface CVDocument {
    id: string;
    name: string;
    data: any;
}

type GenerationStep = 'idle' | 'analyzing' | 'matching' | 'tailoring' | 'finalizing';

interface TailoredCvPageProps {
    // CV State
    hasLocalCv: boolean;
    cvData: JsonResumeSchema;
    currentCvId: string | null;
    currentCvFilename: string | null;
    liveCvDescriptor: CvSectionDescriptor[] | null;
    liveCvData: Record<string, any> | null;
    tailoringChanges: Array<{ section: string; description: string; reason: string; before?: string; after?: string }> | null;
    showInlineCvDiff: boolean;
    setShowInlineCvDiff: (show: boolean) => void;
    
    // AI Generation State
    tailoredJobTitle: string;
    setTailoredJobTitle: (title: string) => void;
    tailoredCompanyName: string;
    setTailoredCompanyName: (company: string) => void;
    tailoredJobDescription: string;
    setTailoredJobDescription: (description: string) => void;
    setCustomInstructions: (instructions: string) => void;
    selectedBaseCvId: string;
    handleSelectedBaseCvIdChange: (id: string) => void;
    availableCvs: CVDocument[];
    hasMasterCv: boolean;
    isGeneratingCv: boolean;
    generateCvError: string | null;
    setGenerateCvError: (error: string | null) => void;
    
    // Generation Progress
    generationStep: GenerationStep;
    generationProgress: number;
    
    // CV Editor State
    selectedTemplate: string;
    setSelectedTemplate: (template: string) => void;
    cvSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
    lastSavedCvDataRef: React.MutableRefObject<string | null>;
    improvingSections: Record<string, boolean>;
    
    // ATS State
    atsScores: AtsScores | null;
    isLoadingAts: boolean;
    isScanningAts: boolean;
    atsProgressMessage: string;
    isApplyingAtsBatch: boolean;
    
    // Preview State
    isPreviewOpen: boolean;
    setIsPreviewOpen: (open: boolean) => void;
    previewPdfBase64: string | null;
    setPreviewPdfBase64: (pdf: string | null) => void;
    isLoadingRawPdf: boolean;
    setIsLoadingRawPdf: (loading: boolean) => void;
    isGeneratingPreview: boolean;
    
    // Job Application
    jobApplication: JobApplication | null;
    jobId: string;
    
    // Handlers
    handleCvChange: (updatedCv: JsonResumeSchema) => void;
    handleManualSaveCv: () => Promise<void>;
    handleImproveSection: (section: string, index: number, data: any, instructions?: string) => Promise<any>;
    handleDynamicChange: (payload: any) => void;
    resetLocalCvState: () => void;
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    handleGenerateSpecificCv: () => Promise<void>;
    handleScanAts: () => Promise<void>;
    handleDeleteAts: () => Promise<void>;
    handleApplyAtsSuggestionBatch: (items: { suggestion: string; index: number }[]) => Promise<void>;
}

const TailoredCvPage: React.FC<TailoredCvPageProps> = ({
    hasLocalCv,
    cvData,
    currentCvId,
    currentCvFilename,
    liveCvDescriptor,
    liveCvData,
    tailoringChanges,
    showInlineCvDiff,
    setShowInlineCvDiff,
    tailoredJobTitle,
    setTailoredJobTitle,
    tailoredCompanyName,
    setTailoredCompanyName,
    tailoredJobDescription,
    setTailoredJobDescription,
    setCustomInstructions,
    selectedBaseCvId,
    handleSelectedBaseCvIdChange,
    availableCvs,
    hasMasterCv,
    isGeneratingCv,
    generateCvError,
    setGenerateCvError,
    generationStep,
    generationProgress,
    selectedTemplate,
    setSelectedTemplate,
    cvSaveStatus,
    lastSavedCvDataRef,
    improvingSections,
    atsScores,
    isLoadingAts,
    isScanningAts,
    atsProgressMessage,
    isApplyingAtsBatch,
    isPreviewOpen,
    setIsPreviewOpen,
    previewPdfBase64,
    setPreviewPdfBase64,
    isLoadingRawPdf,
    setIsLoadingRawPdf,
    isGeneratingPreview,
    jobApplication,
    jobId,
    handleCvChange,
    handleManualSaveCv,
    handleImproveSection,
    handleDynamicChange,
    resetLocalCvState,
    showToast,
    handleGenerateSpecificCv,
    handleScanAts,
    handleDeleteAts,
    handleApplyAtsSuggestionBatch,
}) => {
    const [showRemoveCvConfirm, setShowRemoveCvConfirm] = React.useState(false);

    const handleRemoveAttachedCv = async () => {
        try {
            if (jobId) {
                await detachJobCv(jobId);
            } else if (currentCvId) {
                await deleteCv(currentCvId);
            } else {
                showToast('Could not find the attached CV. Please refresh and try again.', 'error');
                return;
            }
        } catch (err: any) {
            // 'No CV attached' is not a real error — proceed anyway
            const msg: string = err?.message ?? '';
            if (!msg.toLowerCase().includes('no cv was attached') && !msg.toLowerCase().includes('not found')) {
                showToast(`Failed to remove CV: ${msg}`, 'error');
                return;
            }
        }

        resetLocalCvState();
        showToast('CV removed', 'success');
    };

    return (
        <div>
            {/* Raw PDF attached — no JSON, show placeholder */}
            {hasLocalCv && (!cvData || !cvData.basics || Object.keys(cvData.basics).length === 0) && !liveCvDescriptor ? (
                <div className="p-10 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col items-center gap-4 text-center">
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
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={isLoadingRawPdf}
                            onClick={async () => {
                                setIsLoadingRawPdf(true);
                                try {
                                    let cvIdToPreview = currentCvId;
                                    if (!cvIdToPreview && jobId) {
                                        const latestJobCv = await getJobCv(jobId);
                                        cvIdToPreview = latestJobCv.cv?._id ?? null;
                                    }

                                    if (!cvIdToPreview) {
                                        showToast('Could not find the attached CV. Please refresh and try again.', 'error');
                                        return;
                                    }

                                    const { pdfBase64 } = await getCvOriginalPdf(cvIdToPreview);
                                    setPreviewPdfBase64(pdfBase64);
                                    setIsPreviewOpen(true);
                                } catch {
                                    showToast('Failed to load PDF preview', 'error');
                                } finally {
                                    setIsLoadingRawPdf(false);
                                }
                            }}
                            className="text-sm"
                        >
                            {isLoadingRawPdf ? (
                                <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                            ) : (
                                <span className="material-symbols-outlined text-base">visibility</span>
                            )}
                            Preview PDF
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            onClick={() => setShowRemoveCvConfirm(true)}
                            className="text-sm"
                        >
                            <span className="material-symbols-outlined text-base">delete</span>
                            Remove &amp; re-attach
                        </Button>
                    </div>
                </div>
            ) : hasLocalCv ? (
                <CvEditorPanel
                    data={cvData}
                    onChange={handleCvChange}
                    onSave={handleManualSaveCv}
                    saveStatus={cvSaveStatus}
                    hasUnsavedChanges={
                        lastSavedCvDataRef.current !== null &&
                        JSON.stringify(cvData) !== lastSavedCvDataRef.current
                    }
                    templateId={selectedTemplate}
                    onTemplateChange={setSelectedTemplate}
                    defaultEditorOpen={false}
                    onImproveSection={handleImproveSection}
                    improvingSections={improvingSections}
                    cvId={currentCvId ?? undefined}
                    cvDescriptor={liveCvDescriptor}
                    cvData={liveCvData}
                    onDynamicChange={handleDynamicChange}
                    diffChanges={tailoringChanges || []}
                    showDiffOverlay={showInlineCvDiff}
                    onDelete={async () => {
                        if (window.confirm('Are you sure you want to delete this CV? You will need to regenerate it.')) {
                            if (currentCvId) {
                                try {
                                    await deleteCv(currentCvId);
                                    resetLocalCvState();
                                    showToast('CV deleted successfully', 'success');
                                } catch (err: any) {
                                    console.error('Failed to delete CV', err);
                                    showToast(`Failed to delete CV: ${err.message}`, 'error');
                                }
                            }
                        }
                    }}
                >
                    {/* Tailoring Changes Panel - Show what AI changed */}
                    {tailoringChanges !== null && (
                        <div className="mb-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                            <details className="group">
                                <summary className="flex items-center justify-between cursor-pointer p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors border-b border-transparent group-open:border-zinc-100 dark:group-open:border-zinc-800">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-lg text-ink-950 shadow-sm" style={{ background: 'var(--accent)' }}>
                                            <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
                                                Tailoring Changes
                                            </h3>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
                                                setShowInlineCvDiff(!showInlineCvDiff);
                                            }}
                                            disabled={tailoringChanges.length === 0}
                                            className="text-xs font-semibold px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Show changed sections directly in CV preview"
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
                                            Regenerate to capture richer change details.
                                        </div>
                                    )}

                                    {tailoringChanges.map((change, index) => (
                                        <div
                                            key={index}
                                            className="py-4 first:pt-2 last:pb-2"
                                        >
                                            <div className="flex items-start gap-4">
                                                <span className="flex-shrink-0 mt-0.5 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                                    {change.section}
                                                </span>
                                                <div className="flex-1 min-w-0 space-y-1.5">
                                                    <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-snug">
                                                        {change.before || change.after
                                                            ? `In ${change.section}, changed from "${change.before || '—'}" to "${change.after || '—'}".`
                                                            : change.description}
                                                    </p>
                                                    <p className="text-xs text-zinc-500 dark:text-zinc-500 flex items-center gap-2 italic">
                                                        <span className="w-1 h-1 rounded-full" style={{ background: 'var(--accent)' }}></span>
                                                        {change.reason}
                                                    </p>

                                                    {(change.before || change.after) && (
                                                        <details className="mt-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 p-2.5">
                                                            <summary className="cursor-pointer text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                                                                View content diff
                                                            </summary>
                                                            <div className="mt-2 space-y-2">
                                                                {change.before && (
                                                                    <div>
                                                                        <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">Before</p>
                                                                        <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">{change.before}</p>
                                                                    </div>
                                                                )}
                                                                {change.after && (
                                                                    <div>
                                                                        <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1">After</p>
                                                                        <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">{change.after}</p>
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
                    <div className="mb-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                        <details className="group">
                            <summary className="flex items-center justify-between cursor-pointer p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors border-b border-transparent group-open:border-zinc-100 dark:group-open:border-zinc-800">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg text-ink-950 shadow-sm" style={{ background: 'var(--accent)' }}>
                                        <span className="material-symbols-outlined text-[20px]">troubleshoot</span>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">ATS Analysis</h3>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                            {isScanningAts ? 'Scanning…' : atsScores ? (() => {
                                                const total =
                                                    (atsScores.complianceDetails?.actionableFeedback?.length ?? 0) +
                                                    (atsScores.complianceDetails?.keywordsMissing?.length ?? 0) +
                                                    (atsScores.skillMatchDetails?.missingSkills?.length ?? 0);
                                                return total > 0 ? `${total} improvement${total !== 1 ? 's' : ''} available` : 'Looking good — no issues found';
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
                                            onClick={(e) => { e.preventDefault(); handleScanAts(); }}
                                            className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 transition-all"
                                            title="Re-scan ATS"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Re-scan
                                            <span className="text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded-full" style={{ background: '#e8b844', color: '#0e0e17' }}>2 Credit</span>
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
                                onScan={handleScanAts}
                                onRescan={handleScanAts}
                                onApplyBatch={handleApplyAtsSuggestionBatch}
                                onDelete={atsScores ? handleDeleteAts : undefined}
                                hideHeader
                            />
                        </details>
                    </div>
                </CvEditorPanel>
            ) : !hasMasterCv ? (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                    <div className="flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-zinc-800 mb-6">
                        <span className="material-symbols-outlined text-[40px] text-gray-400 dark:text-zinc-500">back_hand</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">No base CV yet</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-base max-w-md mb-8">
                        You need at least one base CV to generate a tailored CV for this job. Create one in the CV Management page first.
                    </p>
                    <Link to="/manage-cv">
                        <Button className="font-semibold shadow-md hover:shadow-lg">
                            <span className="material-symbols-outlined text-white">add</span>
                            Create a Base CV
                        </Button>
                    </Link>
                </div>
            ) : (
                <div>
                    <div className="mb-6">
                        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Tailor Your CV</h2>
                        <p className="text-gray-600 dark:text-gray-400 text-lg">
                            Generate a tailored version of your base CV for this job.
                        </p>
                    </div>

                    {generateCvError && (
                        <div className="mb-6">
                            <ErrorAlert
                                message={generateCvError}
                                onDismiss={() => setGenerateCvError(null)}
                            />
                        </div>
                    )}

                    <Card padding="none" className="p-8 space-y-8">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="material-symbols-outlined" style={{ color: "var(--accent)" }}>work</span>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Target Role</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Job Title
                                    </label>
                                    <Input
                                        type="text"
                                        value={tailoredJobTitle}
                                        onChange={(e) => setTailoredJobTitle(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-600 border border-gray-200 dark:border-gray-600"
                                        placeholder="e.g. Senior Product Manager"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Company Name
                                    </label>
                                    <Input
                                        type="text"
                                        value={tailoredCompanyName}
                                        onChange={(e) => setTailoredCompanyName(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-600 border border-gray-200 dark:border-gray-600"
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
                                <Textarea
                                    value={tailoredJobDescription}
                                    onChange={(e) => setTailoredJobDescription(e.target.value)}
                                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-600 border border-gray-200 dark:border-gray-600 min-h-[200px]"
                                    placeholder="Paste the full job description here... Our AI will analyze key requirements and skills."
                                />
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
                                        <Select
                                            value={selectedBaseCvId}
                                            onChange={(e) => handleSelectedBaseCvIdChange(e.target.value)}
                                            className="w-full px-4 py-3 pr-11 appearance-none bg-gray-50 dark:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
                                        >
                                            <option value="">— Not selected —</option>
                                            {availableCvs.map(cv => (
                                                <option key={cv.id} value={cv.id}>{cv.name || 'Unnamed CV'}</option>
                                            ))}
                                            {availableCvs.length === 0 && <option value="master">Loading CVs...</option>}
                                        </Select>
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
                                onChange={setCustomInstructions}
                            />
                        </div>
                    </Card>

                    <div className="mt-8 flex items-center justify-end gap-4">
                        <Button
                            onClick={handleGenerateSpecificCv}
                            disabled={isGeneratingCv || !hasMasterCv || !tailoredJobDescription}
                            className="font-semibold shadow-md hover:shadow-lg"
                        >
                            {isGeneratingCv ? (
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
                        </Button>
                    </div>
                </div>
            )}

            {/* Tailoring Progress Modal */}
            {isGeneratingCv && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
                        <div className="p-8">
                            <div className="flex justify-center mb-6">
                                <SimpleLoader
                                    message={
                                        generationStep === 'analyzing' ? 'Analyzing Job Requirements...' :
                                            generationStep === 'matching' ? 'Matching Skills & Experience...' :
                                                generationStep === 'tailoring' ? 'Tailoring Your Resume...' :
                                                    'Finalizing Document...'
                                    }
                                    description={
                                        generationStep === 'analyzing' ? 'Identifying key keywords and requirements from the job description.' :
                                            generationStep === 'matching' ? 'Finding the best projects and experiences from your history.' :
                                                generationStep === 'tailoring' ? 'Rewriting descriptions to highlight relevance and impact.' :
                                                    'Formatting your new CV for maximum impact.'
                                    }
                                    height="auto"
                                />
                            </div>

                            {/* Progress Steps */}
                            <div className="space-y-4">
                                <div className="relative pt-1">
                                    <div className="flex mb-2 items-center justify-between">
                                        <div className="text-right">
                                            <span className="text-xs font-semibold inline-block" style={{ color: 'var(--accent)' }}>
                                                {Math.round(generationProgress)}%
                                            </span>
                                        </div>
                                    </div>
                                    <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200 dark:bg-gray-600">
                                        <div style={{ width: `${generationProgress}%`, background: 'var(--accent)' }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ease-out"></div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-medium text-gray-400">
                                    <div style={generationStep === 'analyzing' || generationStep === 'matching' || generationStep === 'tailoring' || generationStep === 'finalizing' ? { color: "var(--accent)" } : {}}>Analyze</div>
                                    <div style={generationStep === 'matching' || generationStep === 'tailoring' || generationStep === 'finalizing' ? { color: "var(--accent)" } : {}}>Match</div>
                                    <div style={generationStep === 'tailoring' || generationStep === 'finalizing' ? { color: "var(--accent)" } : {}}>Tailor</div>
                                    <div style={generationStep === 'finalizing' ? { color: "var(--accent)" } : {}}>Finalize</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CV Preview Modal */}
            <CvPreviewModal
                isOpen={isPreviewOpen}
                onClose={() => {
                    setIsPreviewOpen(false);
                    setPreviewPdfBase64(null);
                }}
                pdfBase64={previewPdfBase64}
                isLoading={isGeneratingPreview}
            />

            <ConfirmModal
                show={showRemoveCvConfirm}
                title="Remove attached CV?"
                message="This removes the CV attached to this job only. You can attach a different CV right after."
                confirmLabel="Remove CV"
                cancelLabel="Keep CV"
                danger
                onConfirm={() => { void handleRemoveAttachedCv(); }}
                onClose={() => setShowRemoveCvConfirm(false)}
            />
        </div>
    );
};

export default TailoredCvPage;