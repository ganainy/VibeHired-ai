// client/src/components/review-finalize/TailoredCvPage.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { JsonResumeSchema } from '../../../../server/src/types/jsonresume';
import CvEditorPanel from '../cv-workspace/CvEditorPanel';
import { CvSectionDescriptor } from '../../types/cvDescriptor';
import CvPreviewModal from '../cv-editor/CvPreviewModal';
import ConfirmModal from '../common/ConfirmModal';
import { Button, Card, Input, Select, Textarea } from '../common';
import ErrorAlert from '../common/ErrorAlert';
import Spinner from '../common/Spinner';
import SimpleLoader from '../common/SimpleLoader';
import PromptChecklist from '../common/PromptChecklist';
import { getCvOriginalPdf, detachJobCv, deleteCv, getJobCv, updateEditedPdf } from '../../services/cvApi';
import { AtsScores } from '../../services/atsApi';
import { JobApplication } from '../../services/jobApi';
import RawPdfPlaceholder from '../cv-workspace/RawPdfPlaceholder';
import TailoringChangesPanel from '../cv-workspace/TailoringChangesPanel';
import AtsAnalysisCard from '../cv-workspace/AtsAnalysisCard';

interface CVDocument {
    id: string;
    name: string;
    data: any;
}

type GenerationStep = 'idle' | 'analyzing' | 'matching' | 'tailoring' | 'finalizing';

interface TailoredCvPageProps {
    // CV State
    hasLocalCv: boolean;
    isCvTailored: boolean;
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
    handleUseBaseCvAsIs: () => Promise<void>;
    handleScanAts: () => Promise<void>;
    handleDeleteAts: () => Promise<void>;
    handleApplyAtsSuggestionBatch: (items: { suggestion: string; index: number }[]) => Promise<void>;
}

const TailoredCvPage: React.FC<TailoredCvPageProps> = ({
    hasLocalCv,
    isCvTailored,
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
    handleUseBaseCvAsIs,
    handleScanAts,
    handleDeleteAts,
    handleApplyAtsSuggestionBatch,
}) => {
    const [showRemoveCvConfirm, setShowRemoveCvConfirm] = React.useState(false);
    const [editingPdfBase64, setEditingPdfBase64] = React.useState<string | null>(null);
    const [isSavingPdf, setIsSavingPdf] = React.useState(false);

    // Load PDF for editing when component mounts (for raw PDF CVs)
    React.useEffect(() => {
        if (hasLocalCv && !isCvTailored && currentCvId) {
            // Pre-load PDF for inline editing
            let cancelled = false;
            const loadPdf = async () => {
                try {
                    const { pdfBase64 } = await getCvOriginalPdf(currentCvId);
                    if (!cancelled) {
                        setEditingPdfBase64(pdfBase64);
                    }
                } catch (err) {
                    console.error('Failed to load PDF for editing:', err);
                }
            };
            loadPdf();
            return () => { cancelled = true; };
        }
    }, [hasLocalCv, isCvTailored, currentCvId]);

    const handlePdfSave = async (updatedPdfBase64: string) => {
        if (!currentCvId) return;
        
        setIsSavingPdf(true);
        try {
            await updateEditedPdf(currentCvId, updatedPdfBase64);
            setEditingPdfBase64(updatedPdfBase64);
            showToast('PDF saved successfully', 'success');
        } catch (err: any) {
            console.error('Failed to save PDF:', err);
            showToast(`Failed to save PDF: ${err.message}`, 'error');
        } finally {
            setIsSavingPdf(false);
        }
    };

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
            {hasLocalCv ? (
                <CvEditorPanel
                    data={cvData}
                    onChange={handleCvChange}
                    onSave={handleManualSaveCv}
                    saveStatus={cvSaveStatus}
                    hasUnsavedChanges={
                        lastSavedCvDataRef.current !== null &&
                        JSON.stringify(cvData) !== lastSavedCvDataRef.current
                    }
                    defaultEditorOpen={false}
                    onImproveSection={handleImproveSection}
                    improvingSections={improvingSections}
                    cvId={currentCvId ?? undefined}
                    cvDescriptor={liveCvDescriptor}
                    cvData={liveCvData}
                    onDynamicChange={handleDynamicChange}
                    diffChanges={tailoringChanges || []}
                    showDiffOverlay={showInlineCvDiff}
                    pdfBase64={editingPdfBase64}
                    pdfFilename={currentCvFilename}
                    onPdfSave={handlePdfSave}
                    isPdfSaving={isSavingPdf}
                    isLoadingPdf={isLoadingRawPdf}
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
                    <TailoringChangesPanel
                        tailoringChanges={tailoringChanges}
                        showInlineCvDiff={showInlineCvDiff}
                        onToggleDiff={setShowInlineCvDiff}
                    />

                    <AtsAnalysisCard
                        atsScores={atsScores}
                        isScanningAts={isScanningAts}
                        isLoadingAts={isLoadingAts}
                        atsProgressMessage={atsProgressMessage}
                        isApplyingAtsBatch={isApplyingAtsBatch}
                        hasJobDescription={!!jobApplication?.jobDescriptionText}
                        onScan={handleScanAts}
                        onApplyBatch={handleApplyAtsSuggestionBatch}
                        onDelete={handleDeleteAts}
                    />
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
                            onClick={handleUseBaseCvAsIs}
                            disabled={isGeneratingCv || !hasMasterCv}
                            variant="secondary"
                            className="font-semibold shadow-md hover:shadow-lg"
                        >
                            {isGeneratingCv ? (
                                <>
                                    <Spinner size="sm" className="text-gray-700 dark:text-gray-300" />
                                    <span>Applying...</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined">description</span>
                                    <span>Use base CV as is</span>
                                </>
                            )}
                        </Button>
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