// client/src/pages/JobApplicationWorkspacePage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getJobById, updateJob, JobApplication, deleteJob } from '../services/jobApi';

import { improveSection } from '../services/generatorApi';
import { JsonResumeSchema } from '../../../server/src/types/jsonresume';
// import { downloadCvAsPdf } from '../services/pdfService'; // Removed as we use react-to-print now
import { useAuth } from '../context/AuthContext';
import { getMasterCv, getJobCv } from '../services/cvApi';
import { CvSectionDescriptor } from '../types/cvDescriptor';
import CvPreviewModal from '../components/cv-editor/CvPreviewModal';
import ErrorAlert from '../components/common/ErrorAlert';
import { parseApiError } from '../utils/parseApiError';
import { hasMeaningfulContent } from '../utils/hasMeaningfulContent';
import Spinner from '../components/common/Spinner';
import SimpleLoader from '../components/common/SimpleLoader';
import Toast from '../components/common/Toast';
import { getJobRecommendation, JobRecommendation } from '../services/jobRecommendationApi';
import EmailFormatModal from '../components/EmailFormatModal';
import { JobChatWindow, FloatingChatButton } from '../components/chat';

import MockInterviewPanel from '../components/jobs/MockInterviewPanel';

import JobDetailsSection from '../components/jobs/JobDetailsSection';
import TailoredCvPage from '../components/review-finalize/TailoredCvPage';
import CoverLetterPage from '../components/review-finalize/CoverLetterPage';
import ReviewTabsNavigation from '../components/review-finalize/ReviewTabsNavigation';
import ReviewPageHeader from '../components/review-finalize/ReviewPageHeader';
import JobDescriptionTab from '../components/review-finalize/JobDescriptionTab';
import RecommendationModal from '../components/review-finalize/RecommendationModal';
import GenerationProgressModal from '../components/review-finalize/GenerationProgressModal';
import { useReviewTabState } from '../hooks/useReviewTabState';
import { formatDateForInput } from './review-finalize/jobDetailsFormUtils';
import { useReviewCvPersistence } from './review-finalize/hooks/useReviewCvPersistence';
import { useReviewCoverLetterPdf } from './review-finalize/hooks/useReviewCoverLetterPdf';
import { useReviewGeneration } from './review-finalize/hooks/useReviewGeneration';
import { useReviewJobDetails } from './review-finalize/hooks/useReviewJobDetails';
import { useReviewBaseAssets } from './review-finalize/hooks/useReviewBaseAssets';

interface ToastState {
 message: string;
 type: 'success' | 'error' | 'info';
}

const EMPTY_CV_DATA: JsonResumeSchema = { basics: {} };

const JobApplicationWorkspacePage: React.FC = () => {
 const { jobId, tab } = useParams<{ jobId: string; tab?: string }>();
 const navigate = useNavigate();
 const { refreshUsage } = useAuth();
 const [jobApplication, setJobApplication] = useState<JobApplication | null>(null);
 const [cvData, setCvData] = useState<JsonResumeSchema>(EMPTY_CV_DATA);
 const [currentCvId, setCurrentCvId] = useState<string | null>(null);
 const [currentCvFilename, setCurrentCvFilename] = useState<string | null>(null);
 const [liveCvDescriptor, setLiveCvDescriptor] = useState<CvSectionDescriptor[] | null>(null);
 const [liveCvData, setLiveCvData] = useState<Record<string, any> | null>(null);
 const [coverLetterText, setCoverLetterText] = useState<string>('');
 const [isLoading, setIsLoading] = useState<boolean>(true);
 const [fetchError, setFetchError] = useState<string | null>(null);
 const [finalPdfFiles, setFinalPdfFiles] = useState<{ cv: string | null, cl: string | null }>({ cv: null, cl: null });
 // Shared inline error for AI actions (improve section, ATS scan, apply suggestions)
 const [, setAiActionError] = useState<{ message: string; upgrade?: boolean } | null>(null);
 const [tailoringChanges, setTailoringChanges] = useState<Array<{ section: string; description: string; reason: string; before?: string; after?: string }> | null>(null);
 const [showInlineCvDiff, setShowInlineCvDiff] = useState<boolean>(false);

 const [hasMasterCv, setHasMasterCv] = useState<boolean>(false);
 const [toast, setToast] = useState<ToastState | null>(null);
 // --- AI Application Advice State ---
 const [recommendation, setRecommendation] = useState<JobRecommendation | null>(null);
 const [isLoadingRecommendation, setIsLoadingRecommendation] = useState<boolean>(false);
 const [isRefreshingRecommendation, setIsRefreshingRecommendation] = useState<boolean>(false);
 const [isRecommendationModalOpen, setIsRecommendationModalOpen] = useState<boolean>(false);
 const { activeTab, handleTabChange } = useReviewTabState({
 jobId,
 tab,
 navigate,
 });
 const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
 const isInitialLoadRef = useRef<boolean>(true);
 const lastSavedCvDataRef = useRef<string | null>(null);
 const lastSavedCoverLetterRef = useRef<string | null>(null);
 const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
 const [previewPdfBase64, setPreviewPdfBase64] = useState<string | null>(null);
 const [isGeneratingPreview] = useState<boolean>(false);
 const [isLoadingRawPdf, setIsLoadingRawPdf] = useState<boolean>(false);
 const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
 const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);



 // Tailor Job CV Form State
 const [tailoredJobTitle, setTailoredJobTitle] = useState<string>('');
 const [tailoredCompanyName, setTailoredCompanyName] = useState<string>('');
 const [tailoredJobDescription, setTailoredJobDescription] = useState<string>('');
 const [customInstructions, setCustomInstructions] = useState<string>('');
 const [clCustomInstructions, setClCustomInstructions] = useState<string>('');
 const [clHumanize, setClHumanize] = useState<boolean>(true);
 const clUploadFileRef = useRef<HTMLInputElement>(null);
 const cvImportFileRef = useRef<HTMLInputElement>(null);

 const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
 setToast({ message, type });
 };

 const fetchJobData = useCallback(async () => {
 if (!jobId) return;
 setIsLoading(true);
 setFetchError(null);
 try {
 const data = await getJobById(jobId);
 setJobApplication(data);


 // Fetch Job CV from Unified Model
 try {
 const cvResponse = await getJobCv(jobId);
 if (cvResponse.cv) {
 setCurrentCvId(cvResponse.cv._id);
 setCurrentCvFilename(cvResponse.cv.filename ?? null);
 setTailoringChanges(cvResponse.cv.tailoringChanges ?? []);
 setShowInlineCvDiff(false);
 setLiveCvDescriptor(cvResponse.cv.cvDescriptor ?? null);
 setLiveCvData(cvResponse.cv.cvData ?? null);

 if (cvResponse.cv.cvJson) {
 setCvData(cvResponse.cv.cvJson);
 lastSavedCvDataRef.current = JSON.stringify(cvResponse.cv.cvJson);
 } else {
 setCvData(EMPTY_CV_DATA);
 lastSavedCvDataRef.current = JSON.stringify(EMPTY_CV_DATA);
 }
 } else {
 // No CV document — clear all CV state
 setCurrentCvId(null);
 setCurrentCvFilename(null);
 setLiveCvDescriptor(null);
 setLiveCvData(null);
 setTailoringChanges([]);
 setShowInlineCvDiff(false);
 setCvData(EMPTY_CV_DATA);
 lastSavedCvDataRef.current = JSON.stringify(EMPTY_CV_DATA);
 }
 } catch (err) {
 // If 404 or other error, clear CV state
 setCurrentCvId(null);
 setCurrentCvFilename(null);
 setLiveCvDescriptor(null);
 setLiveCvData(null);
 setCvData(EMPTY_CV_DATA);
 lastSavedCvDataRef.current = JSON.stringify(EMPTY_CV_DATA);
 }

 setCoverLetterText(data.draftCoverLetterText || '');
 if (data.generatedCvFilename || data.generatedCoverLetterFilename) {
 setFinalPdfFiles({
 cv: data.generatedCvFilename || null,
 cl: data.generatedCoverLetterFilename || null
 });
 }

 // Initialize saved data refs
 lastSavedCoverLetterRef.current = data.draftCoverLetterText || '';

 try {
 const masterCvResponse = await getMasterCv();
 setHasMasterCv(!!masterCvResponse.cv);
 } catch (error) {
 console.error("Error checking master CV:", error);
 setHasMasterCv(false);
 }
 } catch (error: any) {
 console.error("Error fetching job application:", error);
 setFetchError(error.message || 'Failed to fetch job details.');
 } finally {
 setIsLoading(false);
 }
 }, [jobId]);

 useEffect(() => {
 fetchJobData();
 }, [fetchJobData]);

 const {
 availableCvs,
 selectedBaseCvId,
 setSelectedBaseCvId,
 selectedClBaseCvId,
 setSelectedClBaseCvId,
 handleSelectedBaseCvIdChange,
 handleSelectedClBaseCvIdChange,
 baseCoverLetters,
 showClLibraryPanel,
 setShowClLibraryPanel,
 clCreationMode,
 setClCreationMode,
 selectedBaseClId,
 setSelectedBaseClId,
 clUploadFile,
 setClUploadFile,
 isApplyingBaseCl,
 applyClError,
 setApplyClError,
 handleApplyBaseCoverLetter,
 handleSaveClSnapshot,
 } = useReviewBaseAssets({
 jobId,
 jobApplication,
 fetchJobData,
 showToast,
 setJobApplication,
 setCvData,
 setCurrentCvId,
 setCurrentCvFilename,
 cvImportFileRef,
 });

 const {
 jobDetailsForm,
 jobDetailsHasChanges,
 isSavingJobDetails,
 jobDetailsSaveError,
 setJobDetailsSaveError,
 isEditingJobDetails,
 setIsEditingJobDetails,
 handleJobDetailsInputChange,
 handleJobUrlFieldChange,
 handleAddJobUrlField,
 handleRemoveJobUrlField,
 handleSaveJobDetails,
 handleCancelJobDetails,
 } = useReviewJobDetails({
 jobId,
 jobApplication,
 showToast,
 setJobApplication,
 setTailoredJobTitle,
 setTailoredCompanyName,
 setTailoredJobDescription,
 setSelectedBaseCvId,
 setSelectedClBaseCvId,
 });



 // Reset initial load flag after data is loaded
 useEffect(() => {
 if (jobApplication && !isLoading) {
 // Small delay to ensure all data is set
 const timer = setTimeout(() => {
 isInitialLoadRef.current = false;
 }, 500);
 return () => clearTimeout(timer);
 }
 }, [jobApplication, isLoading]);

 const hasPersistableCvContent = React.useMemo(() => {
 return hasMeaningfulContent(cvData) || hasMeaningfulContent(liveCvData) || Boolean(liveCvDescriptor?.length);
 }, [cvData, liveCvData, liveCvDescriptor]);

 const {
 cvSaveStatus,
 setCvSaveStatus,
 handleManualSaveCv,
 handleDynamicChange,
 } = useReviewCvPersistence({
 jobId,
 jobApplication,
 cvData,
 coverLetterText,
 currentCvId,
 hasPersistableCvContent,
 liveCvDescriptor,
 liveCvData,
 isInitialLoadRef,
 autoSaveTimeoutRef,
 lastSavedCvDataRef,
 lastSavedCoverLetterRef,
 setCurrentCvId,
 setJobApplication,
 setLiveCvDescriptor,
 setLiveCvData,
 showToast,
 });

 const {
 isRenderingCoverLetterPdf,
 handleDownload,
 handleGenerateCoverLetterPdf,
 } = useReviewCoverLetterPdf({
 jobId,
 coverLetterText,
 jobApplication,
 setJobApplication,
 setFinalPdfFiles,
 showToast,
 });

 const {
 isGeneratingCoverLetter,
 coverLetterError,
 setCoverLetterError,
 isClCopied,
 handleGenerateCoverLetter,
 handleCopyCoverLetter,
 isGeneratingCv,
 generateCvError,
 setGenerateCvError,
 generationStep,
 generationProgress,
 generationStepLabel,
 generationDescription,
 estimatedTimeRemaining,
 handleGenerateSpecificCv,
 handleUseBaseCvAsIs,
 } = useReviewGeneration({
 jobId,
 jobApplication,
 hasMasterCv,
 tailoredJobTitle,
 tailoredCompanyName,
 tailoredJobDescription,
 customInstructions,
 clCustomInstructions,
 selectedBaseCvId,
 selectedClBaseCvId,
 availableCvs,
 cvData,
 coverLetterText,
 fetchJobData,
 refreshUsage,
 showToast,
 setCoverLetterText,
 setFinalPdfFiles,
 setJobApplication,
 humanize: clHumanize,
 });

 const resetLocalCvState = useCallback(() => {
 if (autoSaveTimeoutRef.current) {
 clearTimeout(autoSaveTimeoutRef.current);
 autoSaveTimeoutRef.current = null;
 }

 setCvData(EMPTY_CV_DATA);
 setCurrentCvId(null);
 setCurrentCvFilename(null);
 setLiveCvDescriptor(null);
 setLiveCvData(null);
 setTailoringChanges(null);
 setShowInlineCvDiff(false);
 setCvSaveStatus('idle');
 lastSavedCvDataRef.current = JSON.stringify(EMPTY_CV_DATA);
 }, []);

 // A CV doc is attached when currentCvId is set (even raw-PDF-only with no JSON)
 const hasLocalCv = React.useMemo(() => {
 if (currentCvId) return true;
 return hasPersistableCvContent;
 }, [currentCvId, hasPersistableCvContent]);

 // Sync state with jobApplication for the Tailor Form
 useEffect(() => {
 if (jobApplication) {
 setTailoredJobTitle(jobApplication.jobTitle || '');
 setTailoredCompanyName(jobApplication.companyName || '');
 setTailoredJobDescription(jobApplication.jobDescriptionText || '');
 }
 }, [jobApplication]);

 // Load available templates
 // (now handled inside CvEditorPanel)
 // Fetch AI recommendation when job application is loaded - DISABLED (now manual via button)
 // useEffect(() => {
 // const fetchRecommendation = async () => {
 // if (!jobId || !jobApplication?.jobDescriptionText) {
 // setRecommendation(null);
 // return;
 // }

 // setIsLoadingRecommendation(true);
 // try {
 // const result = await getJobRecommendation(jobId);
 // setRecommendation(result);
 // } catch (err: any) {
 // console.error('Failed to fetch recommendation:', err);
 // setRecommendation(null);
 // } finally {
 // setIsLoadingRecommendation(false);
 // }
 // };

 // if (jobApplication) {
 // fetchRecommendation();
 // }
 // }, [jobId, jobApplication?.jobDescriptionText]);

 // Handler to calculate match recommendation manually
 const handleCalculateMatch = async () => {
 if (!jobId || !jobApplication?.jobDescriptionText) {
 showToast('Please add a job description first', 'error');
 return;
 }
 const currentJobId = jobId;

 const baseCvIdForJob = selectedBaseCvId && selectedBaseCvId !== 'master' ? selectedBaseCvId : null;
 if (!baseCvIdForJob) {
 showToast('Please select a Base CV for this job.', 'error');
 return;
 }

 setIsLoadingRecommendation(true);
 setAiActionError(null);
 try {
 if (jobApplication.baseCvId !== baseCvIdForJob) {
 const updatedJob = await updateJob(currentJobId, { baseCvId: baseCvIdForJob });
 setJobApplication(prev => prev ? { ...prev, baseCvId: updatedJob.baseCvId ?? null } : prev);
 }

 console.log('[handleCalculateMatch] Starting calculation for jobId:', currentJobId);
 const result = await getJobRecommendation(currentJobId, true);
 console.log('[handleCalculateMatch] Result:', result);
 setRecommendation(result);
 if (result.error) {
 showToast(result.error, 'error');
 } else if (result.score !== null && result.score !== undefined) {
 showToast(`Match calculated: ${result.score}%`, 'success');
 } else {
 showToast('No match score returned. Please select a Base CV for this job.', 'error');
 }
 } catch (err: any) {
 console.error('[handleCalculateMatch] Failed to calculate recommendation:', err);
 const parsed = parseApiError(err);
 setAiActionError(parsed);
 setRecommendation({
 shouldApply: false,
 score: null,
 reason: '',
 cached: false,
 error: parsed.message
 });
 } finally {
 setIsLoadingRecommendation(false);
 }
 };

 // Handler to refresh AI recommendation
 const handleRefreshRecommendation = async () => {
 if (!jobId) return;

 setIsRefreshingRecommendation(true);
 setAiActionError(null);
 try {
 const result = await getJobRecommendation(jobId, true); // Force refresh
 setRecommendation(result);
 showToast('AI recommendation updated!', 'success');
 } catch (err: any) {
 console.error('Failed to refresh recommendation:', err);
 setAiActionError(parseApiError(err));
 } finally {
 setIsRefreshingRecommendation(false);
 }
 };

 const [improvingSections, setImprovingSections] = useState<Record<string, boolean>>({});

 const handleImproveSection = async (section: string, _index: number, data: any, instructions?: string) => {
 setImprovingSections(prev => ({ ...prev, [section]: true }));
 try {
 const result = await improveSection(section, data, instructions);

 // Show success message
 showToast(`${section.charAt(0).toUpperCase() + section.slice(1)} improved successfully!`, 'success');
 try { await refreshUsage(); } catch (e) { console.error('Failed to refresh credits UI:', e); }

 return result;
 } catch (error: any) {
 console.error(`Error improving ${section}:`, error);
 const parsed = parseApiError(error);
 setAiActionError(parsed);
 throw error;
 } finally {
 setImprovingSections(prev => ({ ...prev, [section]: false }));
 }
 };

 const handleCvChange = (updatedCv: JsonResumeSchema) => {
 setCvData(updatedCv);
 };

 const handleCoverLetterChange = (value: string) => {
 setCoverLetterText(value);
 };

 const handleMarkAsApplied = async () => {
 if (!jobId || !jobApplication) return;

 try {
 const updatePayload: any = {
 status: 'Applied',
 dateApplied: new Date()
 };

 await updateJob(jobId, updatePayload);
 setJobApplication(prev => prev ? { ...prev, ...updatePayload } : null);
 showToast('Job marked as Applied', 'success');
 } catch (error: any) {
 console.error("Error updating job status:", error);
 showToast('Failed to mark job as applied', 'error');
 }
 };

 const handleDeleteJob = async () => {
 if (!jobId || !window.confirm('Are you sure you want to delete this job application? This action cannot be undone.')) {
 return;
 }

 try {
 await deleteJob(jobId);
 showToast('Job application deleted successfully', 'success');
 navigate('/dashboard');
 } catch (error: any) {
 console.error('Error deleting job:', error);
 showToast(error.message || 'Failed to delete job application', 'error');
 }
 };

 const activeTabMaxWidth = 'max-w-7xl';


 if (isLoading) {
 return (
 <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
 <SimpleLoader message="Loading job details..." height="auto" />
 </div>
 );
 }

 if (fetchError) {
 return (
 <div className="min-h-screen bg-zinc-50">
 <div className="container mx-auto p-4">
 <div className="mb-4">
 <button
 onClick={() => navigate('/dashboard')}
 className="flex items-center gap-2 text-secondary-color hover:text-zinc-900 mb-4"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
 </svg>
 Back to Dashboard
 </button>
 </div>
 <ErrorAlert
 message={fetchError}
 onRetry={() => fetchJobData()}
 />
 </div>
 </div>
 );
 }

 if (!jobApplication) {
 return (
 <div className="min-h-screen bg-zinc-50">
 <div className="container mx-auto p-4 text-center">
 <p className="text-zinc-900 mb-4">Job application data not found.</p>
 <button
 onClick={() => navigate('/dashboard')}
 className="btn-primary"
 >
 Back to Dashboard
 </button>
 </div>
 </div>
 );
 }

 return (
 <div className="min-h-screen bg-zinc-50 pb-24">
 <div className="p-6 lg:p-8">
 <ReviewPageHeader
 jobApplication={jobApplication}
 recommendation={recommendation}
 isLoadingRecommendation={isLoadingRecommendation}
 onOpenRecommendationModal={() => setIsRecommendationModalOpen(true)}
 onCalculateMatch={handleCalculateMatch}
 onMarkAsApplied={handleMarkAsApplied}
 onDeleteJob={handleDeleteJob}
 />

 <ReviewTabsNavigation activeTab={activeTab} onTabChange={handleTabChange} />

 {/* Tab Contents */}
 <div className="mt-6">
 <section className={`mx-auto w-full ${activeTabMaxWidth}`}>
 <div className="animate-in fade-in duration-200">
  {activeTab === 'job-description' && (
  <>
  {isEditingJobDetails ? (
  <div className="w-full space-y-6">
  <JobDetailsSection
  jobApplication={jobApplication}
  isEditing={isEditingJobDetails}
  setIsEditing={setIsEditingJobDetails}
  formData={jobDetailsForm}
  hasChanges={jobDetailsHasChanges}
  isSaving={isSavingJobDetails}
  saveError={jobDetailsSaveError}
  setSaveError={setJobDetailsSaveError}
  onInputChange={handleJobDetailsInputChange}
  onUrlChange={handleJobUrlFieldChange}
  onAddUrl={handleAddJobUrlField}
  onRemoveUrl={handleRemoveJobUrlField}
  onSave={handleSaveJobDetails}
  onCancel={handleCancelJobDetails}
  availableCvs={availableCvs}
  formatDateForInput={formatDateForInput}
  />
  </div>
  ) : (
  <JobDescriptionTab
  jobApplication={jobApplication}
  isEditing={isEditingJobDetails}
  setIsEditing={setIsEditingJobDetails}
  />
  )}
  </>
  )}

 {activeTab === 'cover-letter' && (
 <CoverLetterPage
 // Job Application & Basic State
 jobApplication={jobApplication}
 jobId={jobId!}
 // Cover Letter State
 coverLetterText={coverLetterText}
 handleCoverLetterChange={handleCoverLetterChange}
 // Download & Actions
 finalPdfFiles={finalPdfFiles}
 isRenderingCoverLetterPdf={isRenderingCoverLetterPdf}
 isClCopied={isClCopied}
 handleCopyCoverLetter={handleCopyCoverLetter}
 handleDownload={handleDownload}
 handleGenerateCoverLetterPdf={handleGenerateCoverLetterPdf}
 setIsEmailModalOpen={setIsEmailModalOpen}
 // Cover Letter Generation
 isGeneratingCoverLetter={isGeneratingCoverLetter}
 coverLetterError={coverLetterError}
 setCoverLetterError={setCoverLetterError}
 // Creation Mode
 clCreationMode={clCreationMode}
 setClCreationMode={setClCreationMode}
 // Library Panel
 showClLibraryPanel={showClLibraryPanel}
 setShowClLibraryPanel={setShowClLibraryPanel}
 baseCoverLetters={baseCoverLetters}
 selectedBaseClId={selectedBaseClId}
 setSelectedBaseClId={setSelectedBaseClId}
 clUploadFile={clUploadFile}
 setClUploadFile={setClUploadFile}
 clUploadFileRef={clUploadFileRef}
 isApplyingBaseCl={isApplyingBaseCl}
 applyClError={applyClError}
 setApplyClError={setApplyClError}
 handleApplyBaseCoverLetter={handleApplyBaseCoverLetter}
 handleSaveClSnapshot={handleSaveClSnapshot}
 // AI Generation Form
 tailoredJobTitle={tailoredJobTitle}
 setTailoredJobTitle={setTailoredJobTitle}
 tailoredCompanyName={tailoredCompanyName}
 setTailoredCompanyName={setTailoredCompanyName}
 tailoredJobDescription={tailoredJobDescription}
 setTailoredJobDescription={setTailoredJobDescription}
 clCustomInstructions={clCustomInstructions}
 setClCustomInstructions={setClCustomInstructions}
 // CV Selection
 selectedClBaseCvId={selectedClBaseCvId}
 handleSelectedClBaseCvIdChange={handleSelectedClBaseCvIdChange}
 availableCvs={availableCvs}
 currentCvId={currentCvId}
 hasLocalCv={hasLocalCv}
 hasMasterCv={hasMasterCv}
 // Humanize option
 humanize={clHumanize}
 setHumanize={setClHumanize}
 // Actions
 handleGenerateCoverLetter={handleGenerateCoverLetter}
 updateJob={updateJob}
 showToast={showToast}
 onCoverLetterDeleted={() => {
 setJobApplication(prev => prev ? { ...prev, draftCoverLetterText: null } : prev);
 setCoverLetterText('');
 }}
 />
 )}

 {activeTab === 'cv' && jobId && (
 <TailoredCvPage
 hasLocalCv={hasLocalCv}
 isCvTailored={!!(tailoringChanges && tailoringChanges.length > 0) || jobApplication?.generationStatus === 'draft_ready'}
 cvData={cvData}
 currentCvId={currentCvId}
 currentCvFilename={currentCvFilename}
 liveCvDescriptor={liveCvDescriptor}
 liveCvData={liveCvData}
 tailoringChanges={tailoringChanges}
 showInlineCvDiff={showInlineCvDiff}
 setShowInlineCvDiff={setShowInlineCvDiff}

 tailoredJobTitle={tailoredJobTitle}
 setTailoredJobTitle={setTailoredJobTitle}
 tailoredCompanyName={tailoredCompanyName}
 setTailoredCompanyName={setTailoredCompanyName}
 tailoredJobDescription={tailoredJobDescription}
 setTailoredJobDescription={setTailoredJobDescription}
 setCustomInstructions={setCustomInstructions}
 selectedBaseCvId={selectedBaseCvId}
 handleSelectedBaseCvIdChange={handleSelectedBaseCvIdChange}
 availableCvs={availableCvs}
 hasMasterCv={hasMasterCv}
 isGeneratingCv={isGeneratingCv}
 generateCvError={generateCvError}
 setGenerateCvError={setGenerateCvError}

 generationStep={generationStep}
 generationProgress={generationProgress}
 generationStepLabel={generationStepLabel ?? ''}
 generationDescription={generationDescription ?? ''}
 estimatedTimeRemaining={estimatedTimeRemaining ?? null}

 cvSaveStatus={cvSaveStatus}
 lastSavedCvDataRef={lastSavedCvDataRef}
 improvingSections={improvingSections}

 isPreviewOpen={isPreviewOpen}
 setIsPreviewOpen={setIsPreviewOpen}
 previewPdfBase64={previewPdfBase64}
 setPreviewPdfBase64={setPreviewPdfBase64}
 isLoadingRawPdf={isLoadingRawPdf}
 setIsLoadingRawPdf={setIsLoadingRawPdf}
 isGeneratingPreview={isGeneratingPreview}

 jobApplication={jobApplication}
 jobId={jobId}

 handleCvChange={handleCvChange}
 handleManualSaveCv={handleManualSaveCv}
 handleImproveSection={handleImproveSection}
 handleDynamicChange={handleDynamicChange}
 resetLocalCvState={resetLocalCvState}
 showToast={showToast}
 handleGenerateSpecificCv={handleGenerateSpecificCv}
 handleUseBaseCvAsIs={handleUseBaseCvAsIs}
 />
 )}

  {/* Tab 5: Mock Interview */}
  {activeTab === 'mock-interview' && jobApplication && (
  <MockInterviewPanel jobApplication={jobApplication} jobId={jobId!} cvData={cvData} coverLetterText={coverLetterText} />
  )}
  </div>
 </section>
 </div>


 </div>

 <GenerationProgressModal
 isOpen={isGeneratingCv}
 generationStep={generationStep}
 generationProgress={generationProgress}
 stepLabel={generationStepLabel ?? ''}
 description={generationDescription ?? ''}
 estimatedTimeRemaining={estimatedTimeRemaining ?? null}
 />

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

 {/* Toast Notification */}
 {
 toast && (
 <Toast
 message={toast.message}
 type={toast.type}
 onClose={() => setToast(null)}
 />
 )
 }

 {/* Floating Chat Button - Only show if job description exists */}
 {
 jobApplication?.jobDescriptionText && !isChatOpen && (
 <FloatingChatButton
 onClick={() => setIsChatOpen(true)}
 />
 )
 }

 {/* Chat Window */}
 {
 isChatOpen && jobId && jobApplication && (
 <JobChatWindow
 jobId={jobId}
 jobTitle={`${jobApplication.jobTitle} at ${jobApplication.companyName}`}
 isOpen={isChatOpen}
 onClose={() => setIsChatOpen(false)}
 />
 )
 }

 {/* Cover Letter Generation Loading Overlay */}
 {
 isGeneratingCoverLetter && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
 <div className="bg-white rounded-xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full mx-4 border border-gray-200 animate-in fade-in zoom-in duration-200">
 <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2" style={{ background: "var(--accent-bg)" }}>
 <Spinner size="lg" />
 </div>
 <h3 className="text-xl font-bold text-gray-900">Generating Cover Letter</h3>
 <p className="text-gray-500 text-center text-sm">
 Analyzing job details and crafting your personalized letter...
 </p>
 </div>
 </div>
 )
 }

 <RecommendationModal
 isOpen={isRecommendationModalOpen}
 recommendation={recommendation}
 isLoadingRecommendation={isLoadingRecommendation}
 isRefreshingRecommendation={isRefreshingRecommendation}
 hasJobDescription={Boolean(jobApplication?.jobDescriptionText)}
 onRefreshRecommendation={handleRefreshRecommendation}
 onClose={() => setIsRecommendationModalOpen(false)}
 />

 {/* Email Format Modal */}
 <EmailFormatModal
 isOpen={isEmailModalOpen}
 onClose={() => setIsEmailModalOpen(false)}
 coverLetterText={coverLetterText}
 jobTitle={jobApplication?.jobTitle || ''}
 companyName={jobApplication?.companyName || ''}
 language={jobApplication?.language || 'en'}
 hiringManagerName={jobApplication?.hiringManagerName}
 contactEmail={jobApplication?.contactEmail}
 emailSubject={jobApplication?.coverLetterEmailSubject}
 emailBody={jobApplication?.coverLetterEmailBody}
 emailRecipient={jobApplication?.coverLetterEmailRecipient}
 />
 </div>
 );
};

export default JobApplicationWorkspacePage;


