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
import { JobApplication } from '../../services/jobApi';
import RawPdfPlaceholder from '../cv-workspace/RawPdfPlaceholder';
import TailoringChangesPanel from '../cv-workspace/TailoringChangesPanel';

interface CVDocument {
 id: string;
 name: string;
 data: any;
}

export interface TailoringSettings {
 matchAddress: boolean;
 showChanges: boolean;
}

const DEFAULT_TAILORING_SETTINGS: TailoringSettings = {
 matchAddress: false,
 showChanges: true,
};

function loadTailoringSettings(jobId: string): TailoringSettings {
 try {
 const raw = localStorage.getItem(`tailoring_settings_${jobId}`);
 if (raw) return { ...DEFAULT_TAILORING_SETTINGS, ...JSON.parse(raw) };
 } catch { /* ignore */ }
 return DEFAULT_TAILORING_SETTINGS;
}

function saveTailoringSettings(jobId: string, settings: TailoringSettings) {
 localStorage.setItem(`tailoring_settings_${jobId}`, JSON.stringify(settings));
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
 generationStepLabel: string;
 generationDescription: string;
 estimatedTimeRemaining: number | null;
 
 // CV Editor State
 cvSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
 lastSavedCvDataRef: React.MutableRefObject<string | null>;
 improvingSections: Record<string, boolean>;
 
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
 handleGenerateSpecificCv: (settings?: TailoringSettings) => Promise<void>;
 handleUseBaseCvAsIs: () => Promise<void>;
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
 generationStepLabel,
 generationDescription,
 estimatedTimeRemaining,
 cvSaveStatus,
 lastSavedCvDataRef,
 improvingSections,
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
}) => {
 const [showRemoveCvConfirm, setShowRemoveCvConfirm] = React.useState(false);
 const [editingPdfBase64, setEditingPdfBase64] = React.useState<string | null>(null);
 const [isSavingPdf, setIsSavingPdf] = React.useState(false);
 const [showRetractForm, setShowRetractForm] = React.useState(false);
 const [tailoringSettings, setTailoringSettings] = React.useState<TailoringSettings>(() => loadTailoringSettings(jobId));

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

 const handleDownloadOriginalPdf = React.useCallback(() => {
 if (!editingPdfBase64) {
 showToast('Original PDF is not available', 'error');
 return;
 }
 const link = document.createElement('a');
 link.href = `data:application/pdf;base64,${editingPdfBase64}`;
 link.download = currentCvFilename?.endsWith('.pdf') ? currentCvFilename : `${currentCvFilename || 'cv'}.pdf`;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 }, [editingPdfBase64, currentCvFilename, showToast]);

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
 {hasLocalCv && !showRetractForm ? (
 <>
 {!isCvTailored && (
<div className="mb-4 p-4 rounded-xl border border-[var(--ember)] bg-[var(--ember-bg)] flex items-center gap-3">
  <span className="material-symbols-outlined text-ember mt-0.5 flex-shrink-0">info</span>
  <div className="flex-1 min-w-0">
  <h3 className="font-semibold text-ember text-sm">Base CV — not yet tailored</h3>
  <p className="text-ember text-sm mt-0.5">
 This is your base CV copied without AI modifications. Tailor it to match this job's requirements for a stronger application.
 </p>
 </div>
 <Button
 onClick={() => setShowRetractForm(true)}
 className="flex-shrink-0 font-semibold whitespace-nowrap"
 >
 {isGeneratingCv ? (
 <>
 <Spinner size="sm" className="text-white" />
 <span>Tailoring...</span>
 </>
 ) : (
 <>
 <span className="material-symbols-outlined text-white" style={{ fontSize: '16px' }}>auto_awesome</span>
 <span>Tailor for this job</span>
 </>
 )}
 </Button>
 </div>
 )}
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
 onDownload={handleDownloadOriginalPdf}
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
 {isCvTailored && tailoringSettings.showChanges && (
 <TailoringChangesPanel
 tailoringChanges={tailoringChanges}
 showInlineCvDiff={showInlineCvDiff}
 onToggleDiff={setShowInlineCvDiff}
 />
 )}
 </CvEditorPanel>
 </>
 ) : !hasMasterCv ? (
 <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
<div className="flex items-center justify-center w-20 h-20 rounded-full bg-[var(--bg-raised)] mb-6">
  <span className="material-symbols-outlined text-[40px] text-muted-color">back_hand</span>
</div>
  <h2 className="text-2xl font-bold text-primary-color mb-2">No base CV yet</h2>
  <p className="text-secondary-color text-base max-w-md mb-8">
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
 {showRetractForm && (
 <button
 onClick={() => setShowRetractForm(false)}
 className="flex items-center gap-1 text-sm text-secondary-color hover:text-primary-color transition-colors mb-3"
 >
 <span className="material-symbols-outlined text-[18px]">arrow_back</span>
 Back to CV editor
 </button>
 )}
<h2 className="text-3xl font-bold text-primary-color mb-2">Tailor Your CV</h2>
  <p className="text-secondary-color text-lg">
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
 <h3 className="text-lg font-bold text-primary-color">Target Role</h3>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="space-y-2">
<label className="block text-sm font-medium text-secondary-color">
  Job Title
  </label>
  <Input
  type="text"
  value={tailoredJobTitle}
  onChange={(e) => setTailoredJobTitle(e.target.value)}
  className="w-full px-4 py-3 bg-elevated border border-theme"
 placeholder="e.g. Senior Product Manager"
 />
 </div>
 <div className="space-y-2">
<label className="block text-sm font-medium text-secondary-color">
  Company Name
  </label>
  <Input
  type="text"
  value={tailoredCompanyName}
  onChange={(e) => setTailoredCompanyName(e.target.value)}
  className="w-full px-4 py-3 bg-elevated border border-theme"
 placeholder="e.g. Acme Innovations"
 />
 </div>
 </div>
 </div>

 <div className="space-y-4">
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center gap-2">
 <span className="material-symbols-outlined" style={{ color: "var(--accent)" }}>description</span>
 <h3 className="text-lg font-bold text-primary-color">Job Description</h3>
 </div>
 </div>
 <div className="relative">
<Textarea
  value={tailoredJobDescription}
  onChange={(e) => setTailoredJobDescription(e.target.value)}
  className="w-full px-4 py-4 bg-elevated border border-theme min-h-[200px]"
 placeholder="Paste the full job description here... Our AI will analyze key requirements and skills."
 />
 </div>
 </div>

 <div className="pt-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
 <div className="space-y-4">
 <div className="flex items-center gap-2 mb-2">
 <span className="material-symbols-outlined" style={{ color: "var(--accent)" }}>folder</span>
 <h3 className="text-lg font-bold text-primary-color">Base Resume</h3>
 </div>
 <div className="relative">
 <Select
 value={selectedBaseCvId}
 onChange={(e) => handleSelectedBaseCvIdChange(e.target.value)}
 className="w-full px-4 py-3 pr-11 appearance-none bg-elevated border border-theme rounded-lg text-secondary-color"
 >
 <option value="">— Not selected —</option>
 {availableCvs.map(cv => (
 <option key={cv.id} value={cv.id}>{cv.name || 'Unnamed CV'}</option>
 ))}
 {availableCvs.length === 0 && <option value="master">Loading CVs...</option>}
 </Select>
 <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-secondary-color">
 <span className="material-symbols-outlined">expand_more</span>
 </div>
 </div>
 <p className="text-xs text-secondary-color">
 Select the version you want to tailor for this application.
 </p>
 </div>
 </div>

 <PromptChecklist
 type="cv"
 onChange={setCustomInstructions}
 />

<div className="pt-4 space-y-3 border-t border-theme">
  <div className="flex items-center gap-2 pt-1">
  <span className="material-symbols-outlined" style={{ color: "var(--accent)" }}>tune</span>
  <h3 className="text-lg font-bold text-primary-color">Options</h3>
 </div>

 {/* Match Address Toggle */}
 <div className="flex items-center justify-between gap-4">
 <div className="flex-1 min-w-0">
 <label className="block text-sm font-semibold text-primary-color" htmlFor="gen-toggle-match-address">
 Match address to job location
 </label>
<p className="text-xs text-secondary-color mt-0.5">
  Replace your CV's address with the job posting's location.
  </p>
  </div>
  <button
  id="gen-toggle-match-address"
 role="switch"
 aria-checked={tailoringSettings.matchAddress}
 onClick={() => {
 const next = { ...tailoringSettings, matchAddress: !tailoringSettings.matchAddress };
 setTailoringSettings(next);
 saveTailoringSettings(jobId, next);
 }}
 className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${tailoringSettings.matchAddress ? 'bg-[var(--accent)] focus:ring-[var(--accent)]' : 'bg-[var(--bg-raised)] focus:ring-[var(--border)]'}`}
 >
 <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${tailoringSettings.matchAddress ? 'translate-x-5' : 'translate-x-0'}`} />
 </button>
 </div>

 {/* Show Changes Toggle */}
 <div className="flex items-center justify-between gap-4">
 <div className="flex-1 min-w-0">
<label className="block text-sm font-semibold text-primary-color" htmlFor="gen-toggle-show-changes">
  Show tailoring changes
  </label>
  <p className="text-xs text-secondary-color mt-0.5">
 Generate a summary of changes made to your base CV. Disabling saves tokens.
 </p>
 </div>
 <button
 id="gen-toggle-show-changes"
 role="switch"
 aria-checked={tailoringSettings.showChanges}
 onClick={() => {
 const next = { ...tailoringSettings, showChanges: !tailoringSettings.showChanges };
 setTailoringSettings(next);
 saveTailoringSettings(jobId, next);
 }}
 className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${tailoringSettings.showChanges ? 'bg-[var(--accent)] focus:ring-[var(--accent)]' : 'bg-[var(--bg-raised)] focus:ring-[var(--border)]'}`}
 >
 <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${tailoringSettings.showChanges ? 'translate-x-5' : 'translate-x-0'}`} />
 </button>
 </div>
 </div>
 </div>
 </Card>

 <div className="mt-8 space-y-3">
 <div className="flex items-center justify-end gap-4">
 <Button
 onClick={handleUseBaseCvAsIs}
 disabled={isGeneratingCv || !hasMasterCv}
 variant="secondary"
 className="font-semibold shadow-md hover:shadow-lg"
 >
 {isGeneratingCv ? (
 <>
 <Spinner size="sm" className="text-secondary-color" />
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
 onClick={() => handleGenerateSpecificCv(tailoringSettings)}
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
 <div className="flex items-center justify-end gap-6 text-xs text-secondary-color">
 <span className="max-w-[200px] text-right">Copies your base CV without AI modifications</span>
 <span className="max-w-[200px] text-right">AI tailors your CV to match this job</span>
 </div>
 </div>
 </div>
 )}

 {/* Tailoring Progress Modal */}
 {isGeneratingCv && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
 <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-[var(--border-subtle)]">
 <div className="p-8">
 <div className="flex justify-center mb-6">
 <SimpleLoader
 message={generationStepLabel || (
 generationStep === 'analyzing' ? 'Analyzing Job Requirements...' :
 generationStep === 'matching' ? 'Matching Skills & Experience...' :
 generationStep === 'tailoring' ? 'Tailoring Your Resume...' :
 'Finalizing Document...'
 )}
 description={generationDescription || (
 generationStep === 'analyzing' ? 'Identifying key keywords and requirements from the job description.' :
 generationStep === 'matching' ? 'Finding the best projects and experiences from your history.' :
 generationStep === 'tailoring' ? 'Rewriting descriptions to highlight relevance and impact.' :
 'Formatting your new CV for maximum impact.'
 )}
 height="auto"
 />
 </div>

 {/* Progress Steps */}
 <div className="space-y-4">
 <div className="relative pt-1">
 <div className="flex mb-2 items-center justify-between">
 {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && (
<span className="text-xs text-secondary-color">
  ~{estimatedTimeRemaining}s remaining
  </span>
  )}
  {estimatedTimeRemaining === 0 && generationProgress >= 100 && (
  <span className="text-xs text-secondary-color">
 Done!
 </span>
 )}
 <div className="text-right">
 <span className="text-xs font-semibold inline-block" style={{ color: 'var(--accent)' }}>
 {Math.round(generationProgress)}%
 </span>
 </div>
 </div>
 <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-[var(--bg-raised)]">
 <div style={{ width: `${generationProgress}%`, background: 'var(--accent)' }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ease-out"></div>
 </div>
 </div>

 <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-medium text-muted-color">
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