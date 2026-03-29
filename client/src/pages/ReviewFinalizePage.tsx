// client/src/pages/ReviewFinalizePage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { updateCustomPrompts } from '../services/settingsApi';
import { getJobById, updateJob, JobApplication, scrapeJobDescriptionApi, extractJobFromTextApi, deleteJob, IReminder } from '../services/jobApi';
import { getGoogleCalendarStatus } from '../services/googleCalendarApi';
import { renderFinalPdfs, renderCvPdf, renderCoverLetterPdf, getDownloadUrl, generateCvOnly, improveSection, applyAtsSuggestion } from '../services/generatorApi';
import { analyzeCv, AnalysisResult, getAnalysis } from '../services/analysisApi';
import { scanAts, getAtsScores, getAtsForJob, AtsScores, deleteAtsAnalysis } from '../services/atsApi';
import { JsonResumeSchema } from '../../../server/src/types/jsonresume';
import CvEditorPanel from '../components/cv-workspace/CvEditorPanel';
// import { downloadCvAsPdf } from '../services/pdfService'; // Removed as we use react-to-print now
import { DEFAULT_CV_PROMPT, DEFAULT_COVER_LETTER_PROMPT } from '../constants/prompts';
import { generateCoverLetter } from '../services/coverLetterApi';
import { useAuth } from '../context/AuthContext';
import { getMasterCv, previewCv, getCvBranches, CVDocument, getJobCv, createJobCv, createJobCvFromBase, uploadCvForJob, updateCv, deleteCv, getCvOriginalPdf, detachJobCv } from '../services/cvApi';
import { CvSectionDescriptor, CvDynamicPayload } from '../types/cvDescriptor';
import AtsInlinePanel from '../components/ats/AtsInlinePanel';
import CvPreviewModal from '../components/cv-editor/CvPreviewModal';
import axios from 'axios';
import ErrorAlert from '../components/common/ErrorAlert';
import { parseApiError, parseApiErrorMessage } from '../utils/parseApiError';
import { hasMeaningfulContent } from '../utils/hasMeaningfulContent';
import { PAYMENTS_ENABLED } from '../utils/featureFlags';
import SendToPhoneButton from '../components/jobs/SendToPhoneButton';
import Spinner from '../components/common/Spinner';
import SimpleLoader from '../components/common/SimpleLoader';
import Toast from '../components/common/Toast';
import JobStatusBadge from '../components/jobs/JobStatusBadge';
import { getJobRecommendation, JobRecommendation } from '../services/jobRecommendationApi';
import EmailFormatModal from '../components/EmailFormatModal';
import { JobChatWindow, FloatingChatButton } from '../components/chat';
import { parseMultipleUrls, normalizeMultipleUrls } from '../lib/utils';

import PromptCustomizer from '../components/common/PromptCustomizer';
import PromptChecklist from '../components/common/PromptChecklist';
import MockInterviewPanel from '../components/jobs/MockInterviewPanel';
import RemindersPanel from '../components/jobs/RemindersPanel';
import InterviewMaterialsPanel from '../components/jobs/InterviewMaterialsPanel';
import JobDetailsSection, { JobDetailsFormData } from '../components/jobs/JobDetailsSection';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { getBaseCoverLetters, applyBaseCoverLetterToJob, uploadCoverLetterForJob, saveCurrentCoverLetterForJob, CoverLetterBase } from '../services/coverLetterBaseApi';
import TailoredCvPage from '../components/review-finalize/TailoredCvPage';
import CoverLetterPage from '../components/review-finalize/CoverLetterPage';
import ReviewTabsNavigation from '../components/review-finalize/ReviewTabsNavigation';
import ReviewPageHeader from '../components/review-finalize/ReviewPageHeader';
import { useReviewTabState } from '../hooks/useReviewTabState';

interface ToastState {
    message: string;
    type: 'success' | 'error' | 'info';
}

const EMPTY_CV_DATA: JsonResumeSchema = { basics: {} };

const ReviewFinalizePage: React.FC = () => {
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
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isRenderingPdf, setIsRenderingPdf] = useState<boolean>(false);
    const [isRenderingCvPdf, setIsRenderingCvPdf] = useState<boolean>(false);
    const [isRenderingCoverLetterPdf, setIsRenderingCoverLetterPdf] = useState<boolean>(false);
    const [renderError, setRenderError] = useState<string | null>(null);
    const [refreshError, setRefreshError] = useState<string | null>(null);
    const [analyzeError, setAnalyzeError] = useState<string | null>(null);
    const [finalPdfFiles, setFinalPdfFiles] = useState<{ cv: string | null, cl: string | null }>({ cv: null, cl: null });
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [analyzingSections, setAnalyzingSections] = useState<Record<string, boolean>>({});
    const pollingIntervalId = useRef<NodeJS.Timeout | null>(null);
    const POLLING_INTERVAL_MS = 2000;
    const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState<boolean>(false);
    const [coverLetterError, setCoverLetterError] = useState<string | null>(null);
    const [isGeneratingCv, setIsGeneratingCv] = useState<boolean>(false);
    const [generateCvError, setGenerateCvError] = useState<string | null>(null);
    // Shared inline error for AI actions (improve section, ATS scan, apply suggestions)
    const [aiActionError, setAiActionError] = useState<{ message: string; upgrade?: boolean } | null>(null);
    const [tailoringChanges, setTailoringChanges] = useState<Array<{ section: string; description: string; reason: string; before?: string; after?: string }> | null>(null);
    const [showInlineCvDiff, setShowInlineCvDiff] = useState<boolean>(false);

    // New state for generation progress
    type GenerationStep = 'idle' | 'analyzing' | 'matching' | 'tailoring' | 'finalizing';
    const [generationStep, setGenerationStep] = useState<GenerationStep>('idle');
    const [generationProgress, setGenerationProgress] = useState(0);
    const [hasMasterCv, setHasMasterCv] = useState<boolean>(false);
    const [jobDetailsForm, setJobDetailsForm] = useState<JobDetailsFormData | null>(null);
    const [jobDetailsInitialForm, setJobDetailsInitialForm] = useState<JobDetailsFormData | null>(null);
    const [jobDetailsSourceJobId, setJobDetailsSourceJobId] = useState<string | null>(null);
    const [isSavingJobDetails, setIsSavingJobDetails] = useState<boolean>(false);
    const [jobDetailsSaveError, setJobDetailsSaveError] = useState<string | null>(null);
    const [isEditingJobDetails, setIsEditingJobDetails] = useState<boolean>(false);
    const [toast, setToast] = useState<ToastState | null>(null);
    const [isJobDescriptionExpanded, setIsJobDescriptionExpanded] = useState<boolean>(false);
    const [atsScores, setAtsScores] = useState<AtsScores | null>(null);
    const [isLoadingAts, setIsLoadingAts] = useState<boolean>(false);
    const [isScanningAts, setIsScanningAts] = useState<boolean>(false);
    const [atsAnalysisId, setAtsAnalysisId] = useState<string | null>(null);
    const [atsPollingIntervalId, setAtsPollingIntervalId] = useState<NodeJS.Timeout | null>(null);
    const [atsProgressMessage, setAtsProgressMessage] = useState<string>('');
    const [isApplyingAtsBatch, setIsApplyingAtsBatch] = useState<boolean>(false);
    const [appliedAtsSuggestions, setAppliedAtsSuggestions] = useState<string[]>([]);
    // --- AI Application Advice State ---
    const [recommendation, setRecommendation] = useState<JobRecommendation | null>(null);
    const [isLoadingRecommendation, setIsLoadingRecommendation] = useState<boolean>(false);
    const [isRefreshingRecommendation, setIsRefreshingRecommendation] = useState<boolean>(false);
    const [isRecommendationModalOpen, setIsRecommendationModalOpen] = useState<boolean>(false);
    const [isClCopied, setIsClCopied] = useState<boolean>(false);
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
    const [isGeneratingPreview, setIsGeneratingPreview] = useState<boolean>(false);
    const [isLoadingRawPdf, setIsLoadingRawPdf] = useState<boolean>(false);
    const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);

    // Reminders & Google Calendar
    const [reminders, setReminders] = useState<IReminder[]>([]);
    const [googleCalConnected, setGoogleCalConnected] = useState<boolean>(false);

    const [selectedTemplate, setSelectedTemplate] = useState<string>('german-latex');
    const [cvSaveStatus, setCvSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    // Ref for accessing the CV preview element for PDF generation
    // (print refs are now managed inside CvEditorPanel)

    // Helper to generate a clean filename
    const getPdfFilename = () => {
        if (!jobApplication) return 'CV_Export';

        const sanitize = (str: string) => str?.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_') || 'Unknown';
        const companyName = sanitize(jobApplication.companyName);
        const jobTitle = sanitize(jobApplication.jobTitle);
        // Determine document type based on language (default to Resume if not de)
        const docType = (jobApplication.language === 'de') ? 'Lebenslauf' : 'Resume';

        return `${docType}_${companyName}_${jobTitle}`;
    };

    // React-to-print hooks are now handled inside CvEditorPanel

    // Tailor Job CV Form State
    const [tailoredJobTitle, setTailoredJobTitle] = useState<string>('');
    const [tailoredCompanyName, setTailoredCompanyName] = useState<string>('');
    const [tailoredJobDescription, setTailoredJobDescription] = useState<string>('');
    const [customInstructions, setCustomInstructions] = useState<string>('');
    const [clCustomInstructions, setClCustomInstructions] = useState<string>('');
    // Base CV Selection State
    const [availableCvs, setAvailableCvs] = useState<{ id: string; name: string; data: any }[]>([]);
    const [selectedBaseCvId, setSelectedBaseCvId] = useState<string>(() => {
        // Read from localStorage for persistence per job
        if (jobId) {
            try {
                const saved = localStorage.getItem(`job_selectedBaseCvId_${jobId}`);
                if (saved) {
                    return saved;
                }
            } catch (e) {
                console.error("Error reading selectedBaseCvId from localStorage", e);
            }
        }
        return '';
    });
    const [selectedClBaseCvId, setSelectedClBaseCvId] = useState<string>(() => {
        // Read from localStorage for persistence per job
        if (jobId) {
            try {
                const saved = localStorage.getItem(`job_selectedClBaseCvId_${jobId}`);
                if (saved) {
                    return saved;
                }
            } catch (e) {
                console.error("Error reading selectedClBaseCvId from localStorage", e);
            }
        }
        return 'master';
    });

    // Cover Letter Library Panel State
    const [baseCoverLetters, setBaseCoverLetters] = useState<CoverLetterBase[]>([]);
    const [showClLibraryPanel, setShowClLibraryPanel] = useState<boolean>(false);
    const [clCreationMode, setClCreationMode] = useState<'ai' | 'import'>('ai');
    const [selectedBaseClId, setSelectedBaseClId] = useState<string>('');
    const [clUploadFile, setClUploadFile] = useState<File | null>(null);
    const [isApplyingBaseCl, setIsApplyingBaseCl] = useState<boolean>(false);
    const [applyClError, setApplyClError] = useState<string | null>(null);
    const clUploadFileRef = useRef<HTMLInputElement>(null);

    // CV creation mode state (for the CV tab picker)
    const [cvCreationMode, setCvCreationMode] = useState<'ai' | 'import'>('ai');
    const [cvImportFile, setCvImportFile] = useState<File | null>(null);
    const [selectedBaseCvIdForImport, setSelectedBaseCvIdForImport] = useState<string>('');
    const [isApplyingBaseCv, setIsApplyingBaseCv] = useState<boolean>(false);
    const [applyCvError, setApplyCvError] = useState<string | null>(null);
    const cvImportFileRef = useRef<HTMLInputElement>(null);

    // Extract with AI State
    const [pastedJobText, setPastedJobText] = useState<string>('');
    const [isExtractingWithAi, setIsExtractingWithAi] = useState<boolean>(false);
    const [showExtractWithAi, setShowExtractWithAi] = useState<boolean>(false);

    // Handlers for Base CV selection that persist to localStorage
    const handleSelectedBaseCvIdChange = (newId: string) => {
        setSelectedBaseCvId(newId);
        if (jobId) {
            const currentJobId = jobId;
            try {
                localStorage.setItem(`job_selectedBaseCvId_${currentJobId}`, newId);
            } catch (e) {
                console.error("Error saving selectedBaseCvId to localStorage", e);
            }

            const baseCvIdForJob = (newId === 'master' || newId === '') ? null : newId;
            void updateJob(currentJobId, { baseCvId: baseCvIdForJob })
                .then((updatedJob) => {
                    setJobApplication(prev => prev ? { ...prev, baseCvId: updatedJob.baseCvId ?? null } : prev);
                })
                .catch((error: any) => {
                    console.error('Error saving baseCvId to job:', error);
                });
        }
    };

    const handleSelectedClBaseCvIdChange = (newId: string) => {
        setSelectedClBaseCvId(newId);
        if (jobId) {
            try {
                localStorage.setItem(`job_selectedClBaseCvId_${jobId}`, newId);
            } catch (e) {
                console.error("Error saving selectedClBaseCvId to localStorage", e);
            }
        }
    };

    // Load base cover letters when the library panel opens or import mode is selected
    useEffect(() => {
        if (!showClLibraryPanel && clCreationMode !== 'import') return;
        getBaseCoverLetters()
            .then(setBaseCoverLetters)
            .catch((err: any) => console.error('Failed to load base cover letters', err));
    }, [showClLibraryPanel, clCreationMode]);

    // Apply / upload a base cover letter to this job
    const handleApplyBaseCoverLetter = async () => {
        if (!jobId) return;
        setIsApplyingBaseCl(true);
        setApplyClError(null);
        try {
            if (clUploadFile) {
                await uploadCoverLetterForJob(jobId, clUploadFile, (jobApplication?.language as 'en' | 'de') ?? 'en');
                setClUploadFile(null);
            } else if (selectedBaseClId) {
                await applyBaseCoverLetterToJob(jobId, selectedBaseClId);
            } else {
                setApplyClError('Please select a cover letter or upload a file.');
                return;
            }
            await fetchJobData();
            setShowClLibraryPanel(false);
            showToast('Cover letter attached to this job', 'success');
        } catch (err: any) {
            setApplyClError(err?.response?.data?.message || err?.message || 'Failed to apply cover letter.');
        } finally {
            setIsApplyingBaseCl(false);
        }
    };

    // Apply / upload a CV for this job without AI tailoring
    const handleApplyBaseCv = async () => {
        if (!jobId) return;
        setIsApplyingBaseCv(true);
        setApplyCvError(null);
        try {
            let result;
            if (cvImportFile) {
                result = await uploadCvForJob(jobId, cvImportFile);
                setCvImportFile(null);
                if (cvImportFileRef.current) cvImportFileRef.current.value = '';
            } else if (selectedBaseCvIdForImport) {
                result = await createJobCvFromBase(jobId, selectedBaseCvIdForImport === 'master' ? undefined : selectedBaseCvIdForImport);
            } else {
                setApplyCvError('Please select a CV or upload a file.');
                return;
            }
            if (result.cv.cvJson) setCvData(result.cv.cvJson);
            setCurrentCvId(result.cv._id);
            setCurrentCvFilename(result.cv.filename ?? null);
            setSelectedBaseCvIdForImport('');
            showToast('CV attached to this job', 'success');
        } catch (err: any) {
            setApplyCvError(err?.response?.data?.message || err?.message || 'Failed to attach CV.');
        } finally {
            setIsApplyingBaseCv(false);
        }
    };

    // Snapshot the current cover letter text as an independent document
    const handleSaveClSnapshot = async () => {
        if (!jobId) return;
        try {
            await saveCurrentCoverLetterForJob(jobId);
            showToast('Cover letter snapshot saved', 'success');
        } catch (err: any) {
            showToast('Failed to save snapshot', 'error');
        }
    };

    // Update selected CV IDs when jobId changes (switching between jobs)
    useEffect(() => {
        if (jobId) {
            try {
                const savedBaseCvId = localStorage.getItem(`job_selectedBaseCvId_${jobId}`);
                if (savedBaseCvId) {
                    setSelectedBaseCvId(savedBaseCvId);
                } else {
                    setSelectedBaseCvId('');
                }

                const savedClBaseCvId = localStorage.getItem(`job_selectedClBaseCvId_${jobId}`);
                if (savedClBaseCvId) {
                    setSelectedClBaseCvId(savedClBaseCvId);
                } else {
                    setSelectedClBaseCvId('master');
                }
            } catch (e) {
                console.error("Error reading CV selection from localStorage", e);
                setSelectedBaseCvId('');
                setSelectedClBaseCvId('master');
            }
        }
    }, [jobId]);

    // Sync selected CV IDs from job's baseCvId when job is loaded (if no localStorage entry exists)
    useEffect(() => {
        if (!jobApplication || !jobId) return;

        try {
            // Check if we already have a saved selection in localStorage
            const savedBaseCvId = localStorage.getItem(`job_selectedBaseCvId_${jobId}`);
            const savedClBaseCvId = localStorage.getItem(`job_selectedClBaseCvId_${jobId}`);

            // If job has a baseCvId and we don't have a saved selection, sync from job
            if (jobApplication.baseCvId) {
                if (!savedBaseCvId) {
                    setSelectedBaseCvId(jobApplication.baseCvId);
                    localStorage.setItem(`job_selectedBaseCvId_${jobId}`, jobApplication.baseCvId);
                }
                if (!savedClBaseCvId) {
                    setSelectedClBaseCvId(jobApplication.baseCvId);
                    localStorage.setItem(`job_selectedClBaseCvId_${jobId}`, jobApplication.baseCvId);
                }
            }
        } catch (e) {
            console.error("Error syncing CV selection from job:", e);
        }
    }, [jobApplication, jobId]);

    const ATS_POLLING_INTERVAL_MS = 3000; // Poll more frequently for ATS
    const ATS_POLLING_TIMEOUT_MS = 120000; // 2 minutes timeout
    const AUTO_SAVE_DELAY_MS = 2000; // Auto-save after 2 seconds of inactivity
    const jobStatusOptions: JobApplication['status'][] = ['Not Applied', 'Applied', 'Interview', 'Assessment', 'Rejected', 'Closed', 'Offer'];

    const buildJobDetailsForm = useCallback((job: JobApplication): JobDetailsFormData => {
        const legacyContact = job.contact || '';
        let contactEmail = job.contactEmail || '';
        let contactPhone = job.contactPhone || '';
        let hiringManagerName = job.hiringManagerName || '';
        let applicationUrl = job.applicationUrl || '';

        if (legacyContact) {
            if (!contactEmail && legacyContact.includes('@')) {
                contactEmail = legacyContact;
            } else if (!applicationUrl && /^https?:\/\//i.test(legacyContact)) {
                applicationUrl = legacyContact;
            } else if (!hiringManagerName) {
                hiringManagerName = legacyContact;
            }
        }

        const parsedUrls = parseMultipleUrls(job.jobUrl || '');

        return {
            jobTitle: job.jobTitle || '',
            companyName: job.companyName || '',
            status: job.status || 'Not Applied',
            language: job.language || 'en',
            baseCvId: job.baseCvId || '',
            jobType: job.jobType || '',
            createdAt: job.createdAt || '',
            jobUrls: parsedUrls.length > 0 ? parsedUrls : [''],
            salary: job.salary || '',
            contactEmail,
            contactPhone,
            hiringManagerName,
            applicationUrl,
            notes: job.notes || '',
        };
    }, []);

    const formatDateForInput = useCallback((dateString?: string): string => {
        if (!dateString) {
            return '';
        }
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return '';
            }
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch {
            return '';
        }
    }, []);

    const jobDetailsHasChanges = React.useMemo(() => {
        if (!jobDetailsForm || !jobDetailsInitialForm) {
            return false;
        }

        return JSON.stringify(jobDetailsForm) !== JSON.stringify(jobDetailsInitialForm);
    }, [jobDetailsForm, jobDetailsInitialForm]);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ message, type });
    };

    useEffect(() => {
        if (!jobApplication) {
            return;
        }

        const nextForm = buildJobDetailsForm(jobApplication);
        const isSwitchingJob = jobDetailsSourceJobId !== jobApplication._id;

        if (isSwitchingJob || !jobDetailsHasChanges) {
            setJobDetailsForm(nextForm);
            setJobDetailsInitialForm(nextForm);
            setJobDetailsSourceJobId(jobApplication._id);
            setJobDetailsSaveError(null);
        }
    }, [jobApplication, buildJobDetailsForm, jobDetailsSourceJobId, jobDetailsHasChanges]);

    const fetchJobData = useCallback(async () => {
        if (!jobId) return;
        setIsLoading(true);
        setFetchError(null);
        try {
            const data = await getJobById(jobId);
            setJobApplication(data);
            // Initialize reminders from loaded job
            setReminders(data.reminders ?? []);
            // Seed applied ATS suggestions history from DB
            if (data.appliedAtsSuggestions && data.appliedAtsSuggestions.length > 0) {
                setAppliedAtsSuggestions(data.appliedAtsSuggestions);
            }

            // Fetch Job CV from Unified Model
            try {
                const cvResponse = await getJobCv(jobId);
                if (cvResponse.cv && cvResponse.cv.cvJson) {
                    setCvData(cvResponse.cv.cvJson);
                    setCurrentCvId(cvResponse.cv._id);
                    setCurrentCvFilename(cvResponse.cv.filename ?? null);
                    setTailoringChanges(cvResponse.cv.tailoringChanges ?? []);
                    setShowInlineCvDiff(false);
                    lastSavedCvDataRef.current = JSON.stringify(cvResponse.cv.cvJson);
                    setLiveCvDescriptor(cvResponse.cv.cvDescriptor ?? null);
                    setLiveCvData(cvResponse.cv.cvData ?? null);
                } else {
                    // No CV document — clear all CV state first
                    setCurrentCvId(null);
                    setCurrentCvFilename(null);
                    setLiveCvDescriptor(null);
                    setLiveCvData(null);
                    setTailoringChanges([]);
                    setShowInlineCvDiff(false);
                    // Fallback to legacy draftCvJson if no CV document yet
                    if (data.draftCvJson) {
                        setCvData(data.draftCvJson);
                        lastSavedCvDataRef.current = JSON.stringify(data.draftCvJson);
                    } else {
                        setCvData({ basics: {} });
                        lastSavedCvDataRef.current = JSON.stringify({ basics: {} });
                    }
                }
            } catch (err) {
                // If 404 or other error, clear CV state and fallback to legacy
                setCurrentCvId(null);
                setCurrentCvFilename(null);
                setLiveCvDescriptor(null);
                setLiveCvData(null);
                if (data.draftCvJson) {
                    setCvData(data.draftCvJson);
                    lastSavedCvDataRef.current = JSON.stringify(data.draftCvJson);
                } else {
                    setCvData({ basics: {} });
                    lastSavedCvDataRef.current = JSON.stringify({ basics: {} });
                }
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
                const cvResponse = await getMasterCv();
                setHasMasterCv(!!cvResponse.cv);
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

    // Fetch Google Calendar connection status once on mount
    useEffect(() => {
        getGoogleCalendarStatus()
            .then((s) => setGoogleCalConnected(s.connected))
            .catch(() => { /* Google Calendar not configured — not a fatal error */ });
    }, []);

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

    // Fetch Available CVs (Primary + Branches only, exclude job-specific CVs)
    useEffect(() => {
        const loadCvs = async () => {
            try {
                const response = await getCvBranches();
                const branches = response.branches;

                const options: { id: string; name: string; data: any }[] = [];

                // Add Primary CV first
                const primaryCv = branches.find((cv: CVDocument) => cv.isPrimary);
                if (primaryCv) {
                    const primaryName = primaryCv.displayName
                        ? `${primaryCv.displayName} (Primary)`
                        : primaryCv.filename
                            ? `${primaryCv.filename} (Primary)`
                            : 'Primary CV';
                    options.push({ id: primaryCv._id, name: primaryName, data: primaryCv.cvJson });
                }

                // Add CV Branches (CVs without jobApplication - these are branches, not job-specific CVs)
                branches.forEach((cv: CVDocument) => {
                    // Only include CVs that are NOT job-specific (no jobApplication field)
                    // and are not the primary CV (already added above)
                    if (!cv.jobApplicationId && cv._id !== primaryCv?._id) {
                        const branchName = cv.displayName
                            ? cv.displayName
                            : cv.category
                                ? `${cv.category} CV`
                                : 'CV Branch';
                        options.push({
                            id: cv._id,
                            name: branchName,
                            data: cv.cvJson
                        });
                    }
                });
                setAvailableCvs(options);
            } catch (err) {
                console.error("Failed to load CVs", err);
            }
        };
        loadCvs();
    }, [jobId]);

    // Ensure selected Base CV is always a valid option once CVs are loaded
    useEffect(() => {
        if (availableCvs.length === 0 || !jobId) return;

        // '' means "not selected" — always valid, don't auto-select
        if (selectedBaseCvId === '' || selectedBaseCvId === 'master') return;

        const hasValidSelection = availableCvs.some(cv => cv.id === selectedBaseCvId);
        if (hasValidSelection) return;

        // Previously selected CV no longer exists — reset to "not selected"
        handleSelectedBaseCvIdChange('');
    }, [availableCvs, selectedBaseCvId, jobId]);

    // Fetch existing ATS scores when job application is loaded
    useEffect(() => {
        const fetchExistingAtsScores = async () => {
            if (jobId && jobApplication) {
                setIsLoadingAts(true);
                try {
                    // Try to find existing ATS analysis for this job
                    const response = await getAtsForJob(jobId);
                    if (response.atsScores && response.analysisId) {
                        setAtsScores(response.atsScores);
                        setAtsAnalysisId(response.analysisId);
                        console.log(`[DEBUG Frontend] Found existing ATS scores for job ${jobId}`);
                    } else {
                        console.log(`[DEBUG Frontend] No existing ATS scores found for job ${jobId}`);
                    }
                } catch (error: any) {
                    console.error('Error fetching existing ATS scores:', error);
                    // Don't show error toast, just log it - ATS scores are optional
                } finally {
                    setIsLoadingAts(false);
                }
            }
        };

        if (jobApplication) {
            fetchExistingAtsScores();
        }
    }, [jobId, jobApplication]);

    // Cleanup ATS polling on unmount
    useEffect(() => {
        return () => {
            if (atsPollingIntervalId) {
                clearInterval(atsPollingIntervalId);
            }
        };
    }, [atsPollingIntervalId]);

    // Load available templates
    // (now handled inside CvEditorPanel)
    // Fetch AI recommendation when job application is loaded - DISABLED (now manual via button)
    // useEffect(() => {
    //     const fetchRecommendation = async () => {
    //         if (!jobId || !jobApplication?.jobDescriptionText) {
    //             setRecommendation(null);
    //             return;
    //         }

    //         setIsLoadingRecommendation(true);
    //         try {
    //             const result = await getJobRecommendation(jobId);
    //             setRecommendation(result);
    //         } catch (err: any) {
    //             console.error('Failed to fetch recommendation:', err);
    //             setRecommendation(null);
    //         } finally {
    //             setIsLoadingRecommendation(false);
    //         }
    //     };

    //     if (jobApplication) {
    //         fetchRecommendation();
    //     }
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

    const pollAtsScores = useCallback(async (analysisIdToPoll: string, startTime: number, intervalIdRef: NodeJS.Timeout | null) => {
        try {
            const response = await getAtsScores(analysisIdToPoll);

            // Debug logging
            console.log('[ATS Poll] Response:', response);
            console.log('[ATS Poll] ATS Scores:', response.atsScores);

            // Check if we have valid scores - check for score OR any details
            const hasScores = response.atsScores && (
                (response.atsScores.score !== null && response.atsScores.score !== undefined) ||
                (response.atsScores.skillMatchDetails && (
                    response.atsScores.skillMatchDetails.skillMatchPercentage !== undefined ||
                    (response.atsScores.skillMatchDetails.matchedSkills && response.atsScores.skillMatchDetails.matchedSkills.length > 0) ||
                    (response.atsScores.skillMatchDetails.missingSkills && response.atsScores.skillMatchDetails.missingSkills.length > 0)
                )) ||
                (response.atsScores.complianceDetails && (
                    (response.atsScores.complianceDetails.keywordsMatched && response.atsScores.complianceDetails.keywordsMatched.length > 0) ||
                    (response.atsScores.complianceDetails.keywordsMissing && response.atsScores.complianceDetails.keywordsMissing.length > 0) ||
                    (response.atsScores.complianceDetails.formattingIssues && response.atsScores.complianceDetails.formattingIssues.length > 0) ||
                    (response.atsScores.complianceDetails.suggestions && response.atsScores.complianceDetails.suggestions.length > 0)
                )) ||
                response.atsScores.error
            );

            console.log('[ATS Poll] Has scores:', hasScores);

            if (hasScores) {
                // Results are ready!
                console.log('[ATS Poll] Setting ATS scores:', response.atsScores);
                setAtsScores(response.atsScores);
                setIsScanningAts(false);
                setAtsProgressMessage('');
                if (intervalIdRef) {
                    clearInterval(intervalIdRef);
                    setAtsPollingIntervalId(null);
                }
                showToast('ATS analysis completed successfully!', 'success');
                return true;
            }

            // Check for timeout
            const elapsed = Date.now() - startTime;
            if (elapsed > ATS_POLLING_TIMEOUT_MS) {
                setIsScanningAts(false);
                setAtsProgressMessage('');
                if (intervalIdRef) {
                    clearInterval(intervalIdRef);
                    setAtsPollingIntervalId(null);
                }
                showToast('ATS analysis is taking longer than expected. Please try again later.', 'info');
                return true;
            }

            // Update progress message
            const elapsedSeconds = Math.floor(elapsed / 1000);
            setAtsProgressMessage(`Analyzing your CV... (${elapsedSeconds}s)`);
            return false;
        } catch (error: any) {
            console.error('Error polling ATS scores:', error);
            // Continue polling on error (might be temporary)
            return false;
        }
    }, []);

    const [improvingSections, setImprovingSections] = useState<Record<string, boolean>>({});

    const handleImproveSection = async (section: string, index: number, data: any, instructions?: string) => {
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

    const handleScanAts = async () => {
        if (!jobApplication || !jobId) {
            showToast('Job application not loaded', 'error');
            return;
        }

        // Require a tailored CV to be generated before ATS scan
        // ATS should analyze the tailored CV, not the master CV
        if (!cvData || Object.keys(cvData).length === 0) {
            showToast('Please generate a tailored CV first before running ATS scan', 'error');
            return;
        }

        if (!jobApplication.jobDescriptionText) {
            showToast('Please scrape the job description first', 'error');
            return;
        }

        // Clear any existing polling
        if (atsPollingIntervalId) {
            clearInterval(atsPollingIntervalId);
            setAtsPollingIntervalId(null);
        }

        setIsScanningAts(true);
        setAtsProgressMessage('Starting ATS analysis...');
        setAtsScores(null); // Clear previous scores

        try {
            // Always create a new analysis for a fresh scan (don't reuse existing analysisId)
            // This ensures we get updated results instead of cached values
            const response = await scanAts(jobId, undefined, appliedAtsSuggestions.length > 0 ? appliedAtsSuggestions : undefined);
            setAtsAnalysisId(response.analysisId);
            showToast('ATS scan started. Analyzing your tailored CV...', 'info');

            const startTime = Date.now();

            // Set up interval polling
            const intervalId = setInterval(async () => {
                const result = await pollAtsScores(response.analysisId, startTime, intervalId);
                if (result) {
                    clearInterval(intervalId);
                    setAtsPollingIntervalId(null);
                }
            }, ATS_POLLING_INTERVAL_MS);

            setAtsPollingIntervalId(intervalId);

            // Start polling immediately
            const checkResult = await pollAtsScores(response.analysisId, startTime, intervalId);
            if (checkResult) {
                clearInterval(intervalId);
                setAtsPollingIntervalId(null);
            }
        } catch (error: any) {
            console.error('Error starting ATS scan:', error);
            setAiActionError(parseApiError(error));
            setIsScanningAts(false);
            setAtsProgressMessage('');
        }
    };

    // progress interval effect
    useEffect(() => {
        let interval: NodeJS.Timeout | undefined;
        if (isGeneratingCv && generationProgress < 90) {
            interval = setInterval(() => {
                setGenerationProgress(prev => {
                    const increment = Math.random() * 8; // Faster increment
                    const newProgress = Math.min(prev + increment, 90);
                    if (newProgress >= 20 && generationStep === 'analyzing') {
                        setGenerationStep('matching');
                    } else if (newProgress >= 50 && generationStep === 'matching') {
                        setGenerationStep('tailoring');
                    } else if (newProgress >= 80 && generationStep === 'tailoring') {
                        setGenerationStep('finalizing');
                    }
                    return newProgress;
                });
            }, 500); // Faster interval
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isGeneratingCv, generationProgress, generationStep]);

    const handleDeleteAts = async () => {
        if (!atsAnalysisId) return;
        if (!window.confirm('Are you sure you want to delete this ATS analysis? This cannot be undone.')) return;

        try {
            await deleteAtsAnalysis(atsAnalysisId);
            setAtsScores(null);
            setAtsAnalysisId(null);
            showToast('ATS analysis deleted successfully', 'success');
        } catch (error: any) {
            console.error('Error deleting ATS analysis:', error);
            showToast(error.message || 'Failed to delete ATS analysis', 'error');
        }
    };

    const handleApplyAtsSuggestionBatch = async (items: { suggestion: string; index: number }[]) => {
        if (!jobApplication) return;
        setIsApplyingAtsBatch(true);
        try {
            const updatedCv = await applyAtsSuggestion(
                cvData,
                items.map(i => i.suggestion),
                jobApplication.jobDescriptionText ?? undefined
            );
            setCvData(updatedCv);
            // Persist applied suggestions list to DB
            const newApplied = [...appliedAtsSuggestions, ...items.map(i => i.suggestion)];
            setAppliedAtsSuggestions(newApplied);
            await updateJob(jobId!, { appliedAtsSuggestions: newApplied });
            const count = items.length;
            showToast(`CV updated — ${count} ATS improvement${count !== 1 ? 's' : ''} applied ✓`, 'success');
            try { await refreshUsage(); } catch (e) { console.error('Failed to refresh credits UI:', e); }
        } catch (error: any) {
            console.error('Error applying ATS suggestions:', error);
            setAiActionError(parseApiError(error));
            throw error; // re-throw so AtsInlinePanel doesn't mark items as applied
        } finally {
            setIsApplyingAtsBatch(false);
        }
    };

    const handleCvChange = (updatedCv: JsonResumeSchema) => {
        setCvData(updatedCv);
    };

    const handleCoverLetterChange = (value: string) => {
        setCoverLetterText(value);
    };

    // Auto-save effect - debounced
    useEffect(() => {
        // Skip auto-save on initial load
        if (isInitialLoadRef.current || !jobId || !jobApplication) {
            return;
        }

        // Serialize current data for comparison
        const currentCvDataStr = JSON.stringify(cvData);
        const currentCoverLetterStr = coverLetterText;

        // Check if data has actually changed
        if (
            currentCvDataStr === lastSavedCvDataRef.current &&
            currentCoverLetterStr === lastSavedCoverLetterRef.current
        ) {
            // No changes, skip auto-save
            return;
        }

        // Clear existing timeout
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }

        // Set new timeout for auto-save
        autoSaveTimeoutRef.current = setTimeout(async () => {
            if (!jobId || !jobApplication) return;

            // Double-check data hasn't changed during the delay
            const cvDataStr = JSON.stringify(cvData);
            const coverLetterStr = coverLetterText;

            if (
                cvDataStr === lastSavedCvDataRef.current &&
                coverLetterStr === lastSavedCoverLetterRef.current
            ) {
                // Data hasn't changed, skip save
                return;
            }

            setIsSaving(true);
            setSaveError(null);
            try {
                // 1. Update Job Application (Cover Letter)
                const updatePayload: any = {
                    draftCoverLetterText: coverLetterText,
                };

                if (hasPersistableCvContent && coverLetterText && coverLetterText.trim().length > 0) {
                    const currentStatus = jobApplication.generationStatus;
                    if (currentStatus !== 'finalized') {
                        updatePayload.generationStatus = 'draft_ready';
                    }
                }

                await updateJob(jobId, updatePayload);

                // 2. Update CV in Unified Model
                if (currentCvId && hasPersistableCvContent) {
                    await updateCv(currentCvId, { cvJson: cvData });
                } else if (hasPersistableCvContent) {
                    const newCvResponse = await createJobCv(jobId, { cvJson: cvData });
                    setCurrentCvId(newCvResponse.cv._id);
                }

                // Update refs with saved values
                lastSavedCvDataRef.current = JSON.stringify(cvData);
                lastSavedCoverLetterRef.current = coverLetterText;

                setJobApplication(prev => prev ? { ...prev, ...updatePayload } : null);
            } catch (error: any) {
                console.error("Error auto-saving changes:", error);
                setSaveError(error.message || 'Failed to save changes.');
            } finally {
                setIsSaving(false);
            }
        }, AUTO_SAVE_DELAY_MS);

        // Cleanup timeout on unmount or when dependencies change
        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [cvData, coverLetterText, jobId, jobApplication, currentCvId, hasPersistableCvContent]);

    const handleRefreshJobDetails = async () => {
        if (!jobId || !jobApplication?.jobUrl || parseMultipleUrls(jobApplication.jobUrl || '').length === 0) return;

        setIsRefreshing(true);
        setRefreshError(null);
        try {
            const response = await scrapeJobDescriptionApi(jobId);
            setJobApplication(response.job);
            showToast('Job details refreshed successfully', 'success');
        } catch (error: any) {
            console.error("Error refreshing job details:", error);
            setRefreshError(error.message || 'Failed to refresh job details.');
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleExtractWithAi = async () => {
        if (!jobId || !pastedJobText || pastedJobText.trim().length < 50) return;

        setIsExtractingWithAi(true);
        setRefreshError(null);
        try {
            // Use AI to extract job data from the pasted text
            const updatedJob = await extractJobFromTextApi(jobId, pastedJobText.trim());
            setJobApplication(updatedJob);
            setPastedJobText(''); // Clear the textarea
            setShowExtractWithAi(false); // Close the extract UI
            showToast('Job details extracted successfully', 'success');
            // Redirect to the job page after successful extraction
            navigate(`/jobs/${jobId}/review/job-description`);
        } catch (error: any) {
            console.error("Error extracting job details:", error);
            setRefreshError(error.message || 'Failed to extract job details.');
            showToast('Failed to extract job details', 'error');
        } finally {
            setIsExtractingWithAi(false);
        }
    };

    // Re-extract from existing job description
    const handleReExtractWithAi = async () => {
        if (!jobId || !jobApplication?.jobDescriptionText || jobApplication.jobDescriptionText.trim().length < 50) return;

        setIsExtractingWithAi(true);
        setRefreshError(null);
        try {
            // Use AI to extract job data from the existing description
            const updatedJob = await extractJobFromTextApi(jobId, jobApplication.jobDescriptionText.trim());
            setJobApplication(updatedJob);
            setShowExtractWithAi(false); // Close the extract UI
            showToast('Job details re-extracted successfully', 'success');
        } catch (error: any) {
            console.error("Error re-extracting job details:", error);
            setRefreshError(error.message || 'Failed to re-extract job details.');
            showToast('Failed to re-extract job details', 'error');
        } finally {
            setIsExtractingWithAi(false);
        }
    };

    const pollAnalysisResults = useCallback(async (id: string) => {
        try {
            const response = await getAnalysis(id);

            if (response.status === 'completed') {
                setAnalysisResult(prev => ({
                    ...prev,
                    ...response
                }));
                if (pollingIntervalId.current) {
                    clearInterval(pollingIntervalId.current);
                    pollingIntervalId.current = null;
                }
                try { await refreshUsage(); } catch (e) { console.error('Failed to refresh credits UI:', e); }
            } else if (response.status === 'failed') {
                setAnalyzeError(response.errorInfo || 'Analysis failed');
                if (pollingIntervalId.current) {
                    clearInterval(pollingIntervalId.current);
                    pollingIntervalId.current = null;
                }
            }
        } catch (error: any) {
            console.error('Error polling analysis results:', error);
            setAnalyzeError(parseApiErrorMessage(error));
        }
    }, [refreshUsage]);

    const handleAnalyzeSection = async (section: string) => {
        if (!jobId || !cvData) return;

        setAnalyzingSections(prev => ({ ...prev, [section]: true }));
        setAnalyzeError(null);

        try {
            const sectionData = {
                ...cvData,
                basics: cvData.basics,
                work: section === 'work' ? cvData.work : undefined,
                education: section === 'education' ? cvData.education : undefined,
                skills: section === 'skills' ? cvData.skills : undefined,
                projects: section === 'projects' ? cvData.projects : undefined,
                languages: section === 'languages' ? cvData.languages : undefined,
                certificates: section === 'certificates' ? cvData.certificates : undefined,
            };

            const jobContext = jobApplication?.jobDescriptionText ? { jobDescription: jobApplication.jobDescriptionText } : undefined;
            const response = await analyzeCv(sectionData, jobContext);

            if (pollingIntervalId.current) {
                clearInterval(pollingIntervalId.current);
            }
            pollAnalysisResults(response.id);
            pollingIntervalId.current = setInterval(() => pollAnalysisResults(response.id), POLLING_INTERVAL_MS);

        } catch (error: any) {
            console.error(`Error analyzing ${section}:`, error);
            setAnalyzeError(parseApiErrorMessage(error));
        } finally {
            setAnalyzingSections(prev => ({ ...prev, [section]: false }));
        }
    };

    useEffect(() => {
        return () => {
            if (pollingIntervalId.current) {
                clearInterval(pollingIntervalId.current);
                pollingIntervalId.current = null;
            }
        };
    }, []);

    const handleSaveChanges = async () => {
        if (!jobId || !jobApplication) return false;

        setIsSaving(true);
        setSaveError(null);
        try {
            // 1. Update Job Application (Cover Letter, Status)
            const updatePayload: any = {
                draftCoverLetterText: coverLetterText,
            };

            if (hasPersistableCvContent && coverLetterText && coverLetterText.trim().length > 0) {
                const currentStatus = jobApplication.generationStatus;
                if (currentStatus !== 'finalized') {
                    updatePayload.generationStatus = 'draft_ready';
                }
            }

            await updateJob(jobId, updatePayload);

            // 2. Update/Create CV in Unified Model
            if (currentCvId && hasPersistableCvContent) {
                await updateCv(currentCvId, { cvJson: cvData });
            } else if (hasPersistableCvContent) {
                const newCvResponse = await createJobCv(jobId, { cvJson: cvData });
                setCurrentCvId(newCvResponse.cv._id);
            }

            // Update refs with saved values
            lastSavedCvDataRef.current = JSON.stringify(cvData);
            lastSavedCoverLetterRef.current = coverLetterText;

            setJobApplication(prev => prev ? { ...prev, ...updatePayload } : null);
            showToast('Changes saved successfully', 'success');
            return true;
        } catch (error: any) {
            console.error("Error saving changes:", error);
            setSaveError(error.message || 'Failed to save changes.');
            return false;
        } finally {
            setIsSaving(false);
        }
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

    const handleGenerateFinalPdfs = async () => {
        if (!jobId) return;

        setIsRenderingPdf(true);
        setRenderError(null);
        setFinalPdfFiles({ cv: null, cl: null });

        try {
            // Ensure latest changes are saved before generating PDFs
            const updatePayload: any = {
                draftCoverLetterText: coverLetterText,
            };

            if (hasPersistableCvContent && coverLetterText && coverLetterText.trim().length > 0) {
                const currentStatus = jobApplication?.generationStatus;
                if (currentStatus !== 'finalized') {
                    updatePayload.generationStatus = 'draft_ready';
                }
            }

            await updateJob(jobId, updatePayload);

            // Save CV to Unified Model
            if (currentCvId && hasPersistableCvContent) {
                await updateCv(currentCvId, { cvJson: cvData });
            } else if (hasPersistableCvContent) {
                const newCvResponse = await createJobCv(jobId, { cvJson: cvData });
                setCurrentCvId(newCvResponse.cv._id);
            }

            setJobApplication(prev => prev ? { ...prev, ...updatePayload } : null);

            const result = await renderFinalPdfs(jobId);
            setFinalPdfFiles({ cv: result.cvFilename, cl: result.coverLetterFilename });
            setJobApplication(prev => prev ? { ...prev, generationStatus: 'finalized' } : null);
            showToast('PDFs generated successfully', 'success');
        } catch (error: any) {
            console.error("Error generating final PDFs:", error);
            setRenderError(error.message || 'Failed to generate final PDFs.');
        } finally {
            setIsRenderingPdf(false);
        }
    };

    const handleGenerateCvPdf = async () => {
        if (!jobId) return;

        setIsRenderingCvPdf(true);
        setRenderError(null);

        try {
            // Ensure latest CV changes are saved before generating PDF
            const updatePayload: any = {};

            if (hasPersistableCvContent) {
                const currentStatus = jobApplication?.generationStatus;
                if (currentStatus !== 'finalized') {
                    updatePayload.generationStatus = 'draft_ready';
                }
            }

            if (Object.keys(updatePayload).length > 0) {
                await updateJob(jobId, updatePayload);
                setJobApplication(prev => prev ? { ...prev, ...updatePayload } : null);
            }

            // Save CV to Unified Model
            if (currentCvId && hasPersistableCvContent) {
                await updateCv(currentCvId, { cvJson: cvData });
            } else if (hasPersistableCvContent) {
                const newCvResponse = await createJobCv(jobId, { cvJson: cvData });
                setCurrentCvId(newCvResponse.cv._id);
            }

            const result = await renderCvPdf(jobId);
            setFinalPdfFiles(prev => ({ ...prev, cv: result.cvFilename }));
            setJobApplication(prev => prev ? { ...prev, generationStatus: 'finalized', generatedCvFilename: result.cvFilename } : null);
            showToast('CV PDF generated successfully', 'success');
        } catch (error: any) {
            console.error("Error generating CV PDF:", error);
            setRenderError(error.message || 'Failed to generate CV PDF.');
        } finally {
            setIsRenderingCvPdf(false);
        }
    };

    const handlePreviewCv = async () => {
        if (!cvData || !hasLocalCv) {
            showToast('No CV data available to preview.', 'error');
            return;
        }

        setIsGeneratingPreview(true);
        try {
            const response = await previewCv(cvData);
            setPreviewPdfBase64(response.pdfBase64);
            setIsPreviewOpen(true);
        } catch (error: any) {
            console.error("Error generating CV preview:", error);
            showToast(error.message || 'Failed to generate CV preview.', 'error');
        } finally {
            setIsGeneratingPreview(false);
        }
    };

    const handleGenerateCoverLetterPdf = async () => {
        if (!jobId) return;

        setIsRenderingCoverLetterPdf(true);
        setRenderError(null);

        try {
            // Ensure latest cover letter changes are saved before generating PDF
            const updatePayload: any = {
                draftCoverLetterText: coverLetterText,
            };

            if (coverLetterText && coverLetterText.trim().length > 0) {
                const currentStatus = jobApplication?.generationStatus;
                if (currentStatus !== 'finalized') {
                    updatePayload.generationStatus = 'draft_ready';
                }
            }

            await updateJob(jobId, updatePayload);
            setJobApplication(prev => prev ? { ...prev, ...updatePayload } : null);

            const result = await renderCoverLetterPdf(jobId);
            setFinalPdfFiles(prev => ({ ...prev, cl: result.coverLetterFilename }));
            setJobApplication(prev => prev ? { ...prev, generationStatus: 'finalized', generatedCoverLetterFilename: result.coverLetterFilename } : null);
            showToast('Cover Letter PDF generated successfully', 'success');

            // Auto-download the file
            handleDownload(result.coverLetterFilename);
        } catch (error: any) {
            console.error("Error generating Cover Letter PDF:", error);
            setRenderError(error.message || 'Failed to generate Cover Letter PDF.');
        } finally {
            setIsRenderingCoverLetterPdf(false);
        }
    };

    const handleDownload = async (filename: string | null) => {
        if (!filename) return;
        try {
            const url = getDownloadUrl(filename);
            const response = await axios.get(url, {
                responseType: 'blob',
            });

            const blob = new Blob([response.data], { type: response.headers['content-type'] });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
            showToast('Download started', 'success');
        } catch (error: any) {
            const errorMessage = error.response?.data instanceof Blob ?
                await error.response.data.text() :
                error.response?.data?.message || error.message || 'An unknown error occurred during download.';
            showToast(`Failed to download: ${errorMessage}`, 'error');
        }
    };

    /**
     * Explicit manual save of the CV (triggered by the Save button in CvEditorPanel).
     * Auto-save continues to run in the background as a safety net.
     */
    const handleManualSaveCv = async () => {
        if (!currentCvId || !cvData) return;
        setCvSaveStatus('saving');
        try {
            await updateCv(currentCvId, {
                cvJson: cvData,
                cvDescriptor: liveCvDescriptor ?? undefined,
                cvData: liveCvData ?? undefined,
            });
            lastSavedCvDataRef.current = JSON.stringify(cvData);
            setCvSaveStatus('saved');
            setTimeout(() => setCvSaveStatus('idle'), 3000);
        } catch (error: any) {
            console.error('Error saving CV:', error);
            setCvSaveStatus('error');
            showToast(error.message || 'Failed to save CV.', 'error');
            setTimeout(() => setCvSaveStatus('idle'), 5000);
        }
    };

    const handleDynamicChange = useCallback((payload: CvDynamicPayload) => {
        setLiveCvDescriptor(payload.descriptor);
        setLiveCvData(payload.data);
        setCvSaveStatus('idle');
        // Auto-save after a short debounce
        setTimeout(() => handleManualSaveCv(), 800);
    }, [liveCvDescriptor, liveCvData]);

    const handleGenerateCoverLetter = async () => {

        if (!jobId || !jobApplication) return;

        setIsGeneratingCoverLetter(true);
        setCoverLetterError(null);

        try {
            // 1. Update Job Details if changed (using the tailored fields)
            if (
                tailoredJobTitle !== jobApplication.jobTitle ||
                tailoredCompanyName !== jobApplication.companyName ||
                tailoredJobDescription !== jobApplication.jobDescriptionText
            ) {
                await updateJob(jobId, {
                    jobTitle: tailoredJobTitle,
                    companyName: tailoredCompanyName,
                    jobDescriptionText: tailoredJobDescription
                });
                // Update local state to reflect saved
                setJobApplication(prev => prev ? ({
                    ...prev,
                    jobTitle: tailoredJobTitle,
                    companyName: tailoredCompanyName,
                    jobDescriptionText: tailoredJobDescription
                }) : null);
            }

            if (!tailoredJobDescription) {
                setCoverLetterError('Please provide a job description.');
                return;
            }

            if (!hasMasterCv) {
                setCoverLetterError('Please upload a CV first at the CV Management page.');
                return;
            }

            // 2. Update Custom Prompt with Instructions
            if (clCustomInstructions) {
                const fullPrompt = DEFAULT_COVER_LETTER_PROMPT + "\n\n**USER INSTRUCTIONS:**\n" + clCustomInstructions;
                await updateCustomPrompts({ coverLetterPrompt: fullPrompt });
            } else {
                await updateCustomPrompts({ coverLetterPrompt: null });
            }

            const language = jobApplication.language || 'en';

            // Determine Base CV Data for Cover Letter
            let baseCvDataToUse = undefined;
            if (selectedClBaseCvId === '__job_cv__') {
                // Use the job-specific CV that was uploaded/attached to this job
                baseCvDataToUse = cvData;
            } else if (selectedClBaseCvId !== 'master') {
                const selectedOption = availableCvs.find(cv => cv.id === selectedClBaseCvId);
                if (selectedOption) {
                    baseCvDataToUse = selectedOption.data;
                }
            }

            const response = await generateCoverLetter(jobId, language as 'en' | 'de', baseCvDataToUse);
            const { text: generatedText, suggestedFilename } = response;

            await updateJob(jobId, {
                draftCoverLetterText: generatedText,
                suggestedCoverLetterFilename: suggestedFilename,
                generatedCoverLetterFilename: null
            });

            // Optimistic update - update local state immediately
            setCoverLetterText(generatedText);
            setFinalPdfFiles(prev => ({ ...prev, cl: null }));
            setJobApplication(prev => prev ? {
                ...prev,
                draftCoverLetterText: generatedText,
                suggestedCoverLetterFilename: suggestedFilename || prev.suggestedCoverLetterFilename,
                generatedCoverLetterFilename: undefined
            } : null);

            await fetchJobData();
            // fetchJobData may restore stale cl from DB — keep it cleared
            setFinalPdfFiles(prev => ({ ...prev, cl: null }));
            showToast('Cover letter generated successfully', 'success');
            // Refresh credits in the sidebar
            try { await refreshUsage(); } catch (e) { console.error('Failed to refresh credits UI:', e); }

        } catch (error: any) {
            console.error('Error generating cover letter:', error);
            setCoverLetterError(parseApiErrorMessage(error));
        } finally {
            setIsGeneratingCoverLetter(false);
        }
    };

    const handleCopyCoverLetter = () => {
        if (!coverLetterText) return;
        navigator.clipboard.writeText(coverLetterText);
        setIsClCopied(true);
        showToast('Cover letter copied to clipboard', 'success');
        setTimeout(() => setIsClCopied(false), 2000);
    };

    const handleDownloadWord = async () => {
        if (!coverLetterText || !jobApplication) return;

        try {
            // Split text by newlines to create paragraphs
            const paragraphs = coverLetterText.split('\n').map(line => {
                return new Paragraph({
                    children: [
                        new TextRun({
                            text: line,
                            font: "Calibri",
                            size: 24, // 12pt
                        }),
                    ],
                    spacing: {
                        after: 0, // Minimize spacing to look like plain text lines unless double newline
                    }
                });
            });

            const doc = new Document({
                sections: [{
                    properties: {},
                    children: paragraphs,
                }],
            });

            const blob = await Packer.toBlob(doc);

            // Use AI-suggested filename (same source as PDF download)
            const sanitize = (str: string) => str?.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_') || 'Unknown';
            const aiName = (jobApplication.suggestedCoverLetterFilename || '').replace(/\.pdf$/i, '');
            const filename = (aiName || sanitize(jobApplication.companyName + '_Anschreiben')) + '.docx';

            saveAs(blob, filename);
            showToast('Word document downloaded', 'success');
        } catch (error: any) {
            console.error('Error generating Word document:', error);
            showToast('Failed to generate Word document', 'error');
        }
    };

    const handleGenerateSpecificCv = async () => {
        if (!jobId || !jobApplication) return;

        if (!tailoredJobDescription) { // Simplified check as base CV is optional/defaults
            showToast('Please ensure job description is present', 'error');
            return;
        }

        setIsGeneratingCv(true);
        setGenerateCvError(null);
        setGenerationStep('analyzing');
        setGenerationProgress(5); // Start at 5%

        try {
            // 1. Update Job Details if changed
            if (
                tailoredJobTitle !== jobApplication.jobTitle ||
                tailoredCompanyName !== jobApplication.companyName ||
                tailoredJobDescription !== jobApplication.jobDescriptionText
            ) {
                await updateJob(jobId, {
                    jobTitle: tailoredJobTitle,
                    companyName: tailoredCompanyName,
                    jobDescriptionText: tailoredJobDescription
                });
                // Update local state to reflect saved
                setJobApplication(prev => prev ? ({
                    ...prev,
                    jobTitle: tailoredJobTitle,
                    companyName: tailoredCompanyName,
                    jobDescriptionText: tailoredJobDescription
                }) : null);
            }

            if (!hasMasterCv) {
                setGenerateCvError('Please upload a CV first at the CV Management page.');
                return;
            }

            // 2. Update Custom Prompt with Instructions
            // We append the custom instructions to the default prompt
            if (customInstructions) {
                const fullPrompt = DEFAULT_CV_PROMPT + "\n\n**USER INSTRUCTIONS:**\n" + customInstructions;
                await updateCustomPrompts({ cvPrompt: fullPrompt });
            } else {
                // Reset to default if empty (optional, but good practice to ensure clean state)
                // Or we could just not update it, but the user might want to clear previous instructions
                // Let's reset it to null to use system default if user cleared the box
                await updateCustomPrompts({ cvPrompt: null });
            }

            const language = jobApplication.language || 'en';

            // Simulate progress steps before the actual API call
            await new Promise(resolve => setTimeout(resolve, 800)); // Analyzing
            setGenerationStep('matching');
            setGenerationProgress(25);

            await new Promise(resolve => setTimeout(resolve, 800)); // Matching
            setGenerationStep('tailoring');
            setGenerationProgress(45);

            const response = await generateCvOnly(jobId, language as 'en' | 'de', {
                baseCvId: selectedBaseCvId === 'master' ? undefined : selectedBaseCvId,
                jobDescription: tailoredJobDescription,
                customInstructions: customInstructions,
                maxOutputTokens: 16384 // Passed to the generator call
            });

            setGenerationStep('finalizing');
            setGenerationProgress(100);

            // Brief delay to show completion
            await new Promise(resolve => setTimeout(resolve, 600));

            if (response.status === 'draft_ready') {
                await fetchJobData();
                const changesMsg = response.changesCount
                    ? ` with ${response.changesCount} tailoring changes`
                    : '';
                showToast(`CV generated successfully${changesMsg}`, 'success');
                try { await refreshUsage(); } catch (e) { console.error('Failed to refresh credits UI:', e); }
            } else if (response.status === 'pending_input') {
                setGenerateCvError('Generation requires additional input. Please check the console for details.');
            } else {
                setGenerateCvError('Unexpected response from generation service.');
            }
        } catch (error: any) {
            console.error('Error generating specific CV:', error);
            setGenerateCvError(parseApiErrorMessage(error));
        } finally {
            setIsGeneratingCv(false);
            setGenerationProgress(0);
            setGenerationStep('idle');
        }
    };

    const handleJobDetailsInputChange = (field: keyof JobDetailsFormData, value: string) => {
        setJobDetailsForm(prev => {
            if (!prev) {
                return prev;
            }

            return {
                ...prev,
                [field]: value,
            };
        });

        if (jobDetailsSaveError) {
            setJobDetailsSaveError(null);
        }
    };

    const handleJobUrlFieldChange = (index: number, value: string) => {
        setJobDetailsForm(prev => {
            if (!prev) {
                return prev;
            }

            const nextUrls = [...prev.jobUrls];
            nextUrls[index] = value;
            return {
                ...prev,
                jobUrls: nextUrls,
            };
        });

        if (jobDetailsSaveError) {
            setJobDetailsSaveError(null);
        }
    };

    const handleAddJobUrlField = () => {
        setJobDetailsForm(prev => {
            if (!prev) {
                return prev;
            }

            return {
                ...prev,
                jobUrls: [...prev.jobUrls, ''],
            };
        });
    };

    const handleRemoveJobUrlField = (index: number) => {
        setJobDetailsForm(prev => {
            if (!prev) {
                return prev;
            }

            const nextUrls = prev.jobUrls.filter((_, idx) => idx !== index);
            return {
                ...prev,
                jobUrls: nextUrls.length > 0 ? nextUrls : [''],
            };
        });
    };

    const handleSaveJobDetails = async () => {
        if (!jobId || !jobDetailsForm) {
            return;
        }

        const title = jobDetailsForm.jobTitle.trim();
        const company = jobDetailsForm.companyName.trim();

        if (!title || !company) {
            setJobDetailsSaveError('Job title and company name are required.');
            return;
        }

        setIsSavingJobDetails(true);
        setJobDetailsSaveError(null);
        try {
            const normalizedJobUrl = normalizeMultipleUrls(jobDetailsForm.jobUrls.join('\n'));
            const legacyContact =
                jobDetailsForm.contactEmail.trim() ||
                jobDetailsForm.contactPhone.trim() ||
                jobDetailsForm.hiringManagerName.trim() ||
                jobDetailsForm.applicationUrl.trim() ||
                undefined;
            const updatePayload: Partial<JobApplication> = {
                jobTitle: title,
                companyName: company,
                status: jobDetailsForm.status,
                language: jobDetailsForm.language,
                baseCvId: jobDetailsForm.baseCvId || null,
                jobType: jobDetailsForm.jobType || null,
                createdAt: jobDetailsForm.createdAt,
                jobUrl: normalizedJobUrl || undefined,
                salary: jobDetailsForm.salary.trim() || undefined,
                contactEmail: jobDetailsForm.contactEmail.trim() || undefined,
                contactPhone: jobDetailsForm.contactPhone.trim() || undefined,
                hiringManagerName: jobDetailsForm.hiringManagerName.trim() || undefined,
                applicationUrl: jobDetailsForm.applicationUrl.trim() || undefined,
                contact: legacyContact,
                notes: jobDetailsForm.notes,
            };

            const updatedJob = await updateJob(jobId, updatePayload);
            const updatedForm = buildJobDetailsForm(updatedJob);

            setJobApplication(updatedJob);
            setJobDetailsForm(updatedForm);
            setJobDetailsInitialForm(updatedForm);
            setTailoredJobTitle(updatedJob.jobTitle || '');
            setTailoredCompanyName(updatedJob.companyName || '');
            setTailoredJobDescription(updatedJob.jobDescriptionText || '');

            const syncedBaseCvId = updatedJob.baseCvId || 'master';
            setSelectedBaseCvId(syncedBaseCvId);
            setSelectedClBaseCvId(syncedBaseCvId);
            if (jobId) {
                try {
                    localStorage.setItem(`job_selectedBaseCvId_${jobId}`, syncedBaseCvId);
                    localStorage.setItem(`job_selectedClBaseCvId_${jobId}`, syncedBaseCvId);
                } catch (storageError) {
                    console.error('Error saving base CV selection to localStorage', storageError);
                }
            }

            showToast('Job details updated successfully', 'success');
            setIsEditingJobDetails(false);
        } catch (error: any) {
            console.error('Failed to update job details:', error);
            setJobDetailsSaveError(error.message || 'Failed to update job details.');
            showToast(error.message || 'Failed to update job details.', 'error');
        } finally {
            setIsSavingJobDetails(false);
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


    if (isLoading) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
                <SimpleLoader message="Loading job details..." height="auto" />
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
                <div className="container mx-auto p-4">
                    <div className="mb-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-4"
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
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
                <div className="container mx-auto p-4 text-center">
                    <p className="text-zinc-900 dark:text-zinc-300 mb-4">Job application data not found.</p>
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
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
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
                {activeTab === 'job-description' && (
                        <div className="w-full space-y-6">

                            {/* Job Details - Read-only / Edit */}
                            <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 md:p-6">
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">{isEditingJobDetails ? 'edit_square' : 'work'}</span>
                                        <h2 className="text-lg font-bold text-text-main-light dark:text-text-main-dark">Job Details</h2>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isEditingJobDetails ? (
                                            <>
                                                {jobDetailsHasChanges && (
                                                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Unsaved changes</span>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setIsEditingJobDetails(false);
                                                        // Revert unsaved changes
                                                        if (jobDetailsInitialForm) {
                                                            setJobDetailsForm(jobDetailsInitialForm);
                                                        }
                                                        setJobDetailsSaveError(null);
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-sm">close</span>
                                                    <span>Cancel</span>
                                                </button>
                                                <button
                                                    onClick={handleSaveJobDetails}
                                                    disabled={!jobDetailsHasChanges || isSavingJobDetails || !jobDetailsForm}
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-ink-950 bg-primary hover:bg-primaryLight focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                >
                                                    {isSavingJobDetails ? (
                                                        <>
                                                            <Spinner size="sm" />
                                                            <span>Saving...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className="material-symbols-outlined text-sm">save</span>
                                                            <span>Save</span>
                                                        </>
                                                    )}
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => setIsEditingJobDetails(true)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-sm">edit</span>
                                                <span>Edit</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {jobDetailsSaveError && isEditingJobDetails && (
                                    <div className="mb-4">
                                        <ErrorAlert
                                            message={jobDetailsSaveError}
                                            onDismiss={() => setJobDetailsSaveError(null)}
                                        />
                                    </div>
                                )}

                                {isEditingJobDetails && jobDetailsForm ? (
                                    /* Edit mode */
                                    <div className="space-y-5 md:space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Job Title <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    value={jobDetailsForm.jobTitle}
                                                    onChange={(e) => handleJobDetailsInputChange('jobTitle', e.target.value)}
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company Name <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    value={jobDetailsForm.companyName}
                                                    onChange={(e) => handleJobDetailsInputChange('companyName', e.target.value)}
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                                                <select
                                                    value={jobDetailsForm.status}
                                                    onChange={(e) => handleJobDetailsInputChange('status', e.target.value)}
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                >
                                                    {jobStatusOptions.map(status => (
                                                        <option key={status} value={status}>{status}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Language</label>
                                                <select
                                                    value={jobDetailsForm.language}
                                                    onChange={(e) => handleJobDetailsInputChange('language', e.target.value)}
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                >
                                                    <option value="en">English</option>
                                                    <option value="de">German</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date Added</label>
                                                <input
                                                    type="date"
                                                    value={formatDateForInput(jobDetailsForm.createdAt)}
                                                    onChange={(e) => {
                                                        const nextDate = e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : '';
                                                        handleJobDetailsInputChange('createdAt', nextDate);
                                                    }}
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Employment Type</label>
                                                <select
                                                    value={jobDetailsForm.jobType || ''}
                                                    onChange={(e) => handleJobDetailsInputChange('jobType', e.target.value)}
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                >
                                                    <option value="">Not specified</option>
                                                    <option value="full-time">Full-time</option>
                                                    <option value="part-time">Part-time</option>
                                                    <option value="working-student">Working Student</option>
                                                    <option value="internship">Internship</option>
                                                    <option value="contract">Contract</option>
                                                    <option value="freelance">Freelance</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Base CV</label>
                                                <select
                                                    value={jobDetailsForm.baseCvId}
                                                    onChange={(e) => handleJobDetailsInputChange('baseCvId', e.target.value)}
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                >
                                                    <option value="">Use master/primary CV</option>
                                                    {jobDetailsForm.baseCvId && !availableCvs.some(cv => cv.id === jobDetailsForm.baseCvId) && (
                                                        <option value={jobDetailsForm.baseCvId}>Current saved CV ({jobDetailsForm.baseCvId})</option>
                                                    )}
                                                    {availableCvs.map((cv) => (
                                                        <option key={cv.id} value={cv.id}>{cv.name || 'Unnamed CV'}</option>
                                                    ))}
                                                </select>
                                                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Choose which CV version to use as the default for this job.</p>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Job URL(s)</label>
                                            <div className="space-y-2">
                                                {jobDetailsForm.jobUrls.map((urlValue, idx) => (
                                                    <div key={idx} className="flex items-center gap-2">
                                                        <input
                                                            type="url"
                                                            value={urlValue}
                                                            onChange={(e) => handleJobUrlFieldChange(idx, e.target.value)}
                                                            onBlur={(e) => handleJobUrlFieldChange(idx, normalizeMultipleUrls(e.target.value))}
                                                            placeholder={`Job URL ${idx + 1}`}
                                                            className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                        />
                                                        {jobDetailsForm.jobUrls.length > 1 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveJobUrlField(idx)}
                                                                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 hover:text-red-500 hover:border-red-300 dark:hover:border-red-700 transition-colors"
                                                                title="Remove URL"
                                                            >
                                                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={handleAddJobUrlField}
                                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primaryLight transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">add</span>
                                                    <span>Add another URL</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Salary</label>
                                                <input
                                                    type="text"
                                                    value={jobDetailsForm.salary}
                                                    onChange={(e) => handleJobDetailsInputChange('salary', e.target.value)}
                                                    placeholder="e.g., 50k-70k, $80,000"
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                />
                                                {!jobDetailsForm.salary && (jobApplication.extractedData?.salaryRaw || jobApplication.extractedData?.estimatedSalary) && (
                                                    <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                                        {jobApplication.extractedData?.salaryIsEstimate === false
                                                            ? `Ô£à From posting: ${jobApplication.extractedData.salaryRaw}`
                                                            : `­ƒñû AI estimate: ${jobApplication.extractedData.estimatedSalary}`}
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contact Email</label>
                                                <input
                                                    type="email"
                                                    value={jobDetailsForm.contactEmail}
                                                    onChange={(e) => handleJobDetailsInputChange('contactEmail', e.target.value)}
                                                    placeholder="name@company.com"
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contact Phone</label>
                                                <input
                                                    type="text"
                                                    value={jobDetailsForm.contactPhone}
                                                    onChange={(e) => handleJobDetailsInputChange('contactPhone', e.target.value)}
                                                    placeholder="+49 ..."
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Hiring Manager</label>
                                                <input
                                                    type="text"
                                                    value={jobDetailsForm.hiringManagerName}
                                                    onChange={(e) => handleJobDetailsInputChange('hiringManagerName', e.target.value)}
                                                    placeholder="Recruiter or manager name"
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Application URL</label>
                                                <input
                                                    type="url"
                                                    value={jobDetailsForm.applicationUrl}
                                                    onChange={(e) => handleJobDetailsInputChange('applicationUrl', e.target.value)}
                                                    placeholder="https://company.com/apply"
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes</label>
                                            <textarea
                                                value={jobDetailsForm.notes}
                                                onChange={(e) => handleJobDetailsInputChange('notes', e.target.value)}
                                                rows={3}
                                                placeholder="Add notes for this application"
                                                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm resize-y"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    /* Read-only mode */
                                    jobDetailsForm && (
                                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                                            {/* Job Title – always shown */}
                                            <div className="flex flex-col gap-0.5">
                                                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Job Title</dt>
                                                <dd className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">{jobDetailsForm.jobTitle || <span className="italic text-gray-400">–</span>}</dd>
                                            </div>
                                            {/* Company – always shown */}
                                            <div className="flex flex-col gap-0.5">
                                                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Company</dt>
                                                <dd className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">{jobDetailsForm.companyName || <span className="italic text-gray-400">–</span>}</dd>
                                            </div>
                                            {/* Status – always shown */}
                                            <div className="flex flex-col gap-0.5">
                                                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Status</dt>
                                                <dd><JobStatusBadge type="application" status={jobDetailsForm.status} /></dd>
                                            </div>
                                            {/* Language */}
                                            {jobDetailsForm.language && (
                                                <div className="flex flex-col gap-0.5">
                                                    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Language</dt>
                                                    <dd className="text-sm text-text-main-light dark:text-text-main-dark">{jobDetailsForm.language === 'de' ? 'German' : 'English'}</dd>
                                                </div>
                                            )}
                                            {/* Employment Type */}
                                            {jobDetailsForm.jobType && (
                                                <div className="flex flex-col gap-0.5">
                                                    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Employment Type</dt>
                                                    <dd className="text-sm text-text-main-light dark:text-text-main-dark capitalize">{jobDetailsForm.jobType.replace(/-/g, ' ')}</dd>
                                                </div>
                                            )}
                                            {/* Date Added */}
                                            {jobDetailsForm.createdAt && (
                                                <div className="flex flex-col gap-0.5">
                                                    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Date Added</dt>
                                                    <dd className="text-sm text-text-main-light dark:text-text-main-dark">{new Date(jobDetailsForm.createdAt).toLocaleDateString()}</dd>
                                                </div>
                                            )}
                                            {/* Base CV */}
                                            {jobDetailsForm.baseCvId && (
                                                <div className="flex flex-col gap-0.5">
                                                    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Base CV</dt>
                                                    <dd className="text-sm text-text-main-light dark:text-text-main-dark">
                                                        {availableCvs.find(cv => cv.id === jobDetailsForm.baseCvId)?.name || jobDetailsForm.baseCvId}
                                                    </dd>
                                                </div>
                                            )}
                                            {/* Job URL(s) */}
                                            {jobDetailsForm.jobUrls.filter(u => u.trim()).length > 0 && (
                                                <div className="flex flex-col gap-0.5 sm:col-span-2">
                                                    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Job URL{jobDetailsForm.jobUrls.filter(u => u.trim()).length > 1 ? 's' : ''}</dt>
                                                    <dd className="flex flex-col gap-1">
                                                        {jobDetailsForm.jobUrls.filter(u => u.trim()).map((url, idx) => (
                                                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="text-sm truncate max-w-xs hover:underline" style={{ color: 'var(--accent)' }}>{url}</a>
                                                        ))}
                                                    </dd>
                                                </div>
                                            )}
                                            {/* Salary */}
                                            {jobDetailsForm.salary && (
                                                <div className="flex flex-col gap-0.5">
                                                    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Salary</dt>
                                                    <dd className="text-sm text-text-main-light dark:text-text-main-dark">{jobDetailsForm.salary}</dd>
                                                </div>
                                            )}
                                            {/* Email */}
                                            {jobDetailsForm.contactEmail && (
                                                <div className="flex flex-col gap-0.5">
                                                    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Contact Email</dt>
                                                    <dd className="text-sm truncate hover:underline cursor-pointer" style={{ color: 'var(--accent)' }} onClick={() => window.location.href = `mailto:${jobDetailsForm.contactEmail}`}>{jobDetailsForm.contactEmail}</dd>
                                                </div>
                                            )}
                                            {/* Phone */}
                                            {jobDetailsForm.contactPhone && (
                                                <div className="flex flex-col gap-0.5">
                                                    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Contact Phone</dt>
                                                    <dd className="text-sm cursor-pointer hover:underline" style={{ color: 'var(--accent)' }} onClick={() => window.location.href = `tel:${jobDetailsForm.contactPhone}`}>{jobDetailsForm.contactPhone}</dd>
                                                </div>
                                            )}
                                            {/* Hiring Manager */}
                                            {jobDetailsForm.hiringManagerName && (
                                                <div className="flex flex-col gap-0.5">
                                                    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Hiring Manager</dt>
                                                    <dd className="text-sm text-text-main-light dark:text-text-main-dark">{jobDetailsForm.hiringManagerName}</dd>
                                                </div>
                                            )}
                                            {/* Application URL */}
                                            {jobDetailsForm.applicationUrl && (
                                                <div className="flex flex-col gap-0.5">
                                                    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Application URL</dt>
                                                    <dd><a href={jobDetailsForm.applicationUrl} target="_blank" rel="noopener noreferrer" className="text-sm truncate max-w-xs hover:underline" style={{ color: 'var(--accent)' }}>{jobDetailsForm.applicationUrl}</a></dd>
                                                </div>
                                            )}
                                            {/* Notes */}
                                            {jobDetailsForm.notes && (
                                                <div className="flex flex-col gap-0.5 sm:col-span-2">
                                                    <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Notes</dt>
                                                    <dd className="text-sm text-text-main-light dark:text-text-main-dark whitespace-pre-wrap">{jobDetailsForm.notes}</dd>
                                                </div>
                                            )}
                                        </dl>
                                    )
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'job-description' && (
                        <>
                            {/* Key Highlights Card */}
                            <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mt-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-primary">lightbulb</span>
                                    <h2 className="text-lg font-bold text-text-main-light dark:text-text-main-dark">Key Highlights</h2>
                                </div>
                                <ul className="space-y-3">
                                    {jobApplication.extractedData?.location && (
                                        <li className="flex items-start gap-3">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                                            <span className="text-sm text-text-sub-light dark:text-text-sub-dark">
                                                <strong className="text-text-main-light dark:text-text-main-dark">Location:</strong> {jobApplication.extractedData.location}
                                            </span>
                                        </li>
                                    )}
                                    {(jobApplication.extractedData?.salaryRaw || jobApplication.extractedData?.estimatedSalary) && (
                                        <li className="flex items-start gap-3">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                                            <span className="text-sm text-text-sub-light dark:text-text-sub-dark">
                                                <strong className="text-text-main-light dark:text-text-main-dark">Salary:</strong>{' '}
                                                {jobApplication.extractedData?.salaryRaw
                                                    ? jobApplication.extractedData.salaryRaw
                                                    : jobApplication.extractedData?.estimatedSalary}
                                                {' '}
                                                {jobApplication.extractedData?.salaryIsEstimate === false ? (
                                                    <span className="inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                                                        From posting
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" title="This salary is an AI estimate based on the job data">
                                                        AI Estimate
                                                    </span>
                                                )}
                                            </span>
                                        </li>
                                    )}
                                    {jobApplication.contactEmail && (
                                        <li className="flex items-start gap-3">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                                            <span className="text-sm text-text-sub-light dark:text-text-sub-dark">
                                                <strong className="text-text-main-light dark:text-text-main-dark">Contact Email:</strong>{' '}
                                                <a href={`mailto:${jobApplication.contactEmail}`} className="hover:underline" style={{ color: 'var(--accent)' }}>
                                                    {jobApplication.contactEmail}
                                                </a>
                                            </span>
                                        </li>
                                    )}
                                    {jobApplication.contactPhone && (
                                        <li className="flex items-start gap-3">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                                            <span className="text-sm text-text-sub-light dark:text-text-sub-dark flex flex-wrap items-center gap-2">
                                                <strong className="text-text-main-light dark:text-text-main-dark">Contact Phone:</strong>
                                                {jobApplication.contactPhone}
                                            </span>
                                        </li>
                                    )}
                                    {jobApplication.hiringManagerName && (
                                        <li className="flex items-start gap-3">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                                            <span className="text-sm text-text-sub-light dark:text-text-sub-dark">
                                                <strong className="text-text-main-light dark:text-text-main-dark">Hiring Manager:</strong> {jobApplication.hiringManagerName}
                                            </span>
                                        </li>
                                    )}
                                    {jobApplication.applicationUrl && (
                                        <li className="flex items-start gap-3">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                                            <span className="text-sm text-text-sub-light dark:text-text-sub-dark">
                                                <strong className="text-text-main-light dark:text-text-main-dark">Application Portal:</strong>{' '}
                                                <a href={jobApplication.applicationUrl} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--accent)' }}>
                                                    {jobApplication.applicationUrl.length > 50 ? jobApplication.applicationUrl.substring(0, 50) + '...' : jobApplication.applicationUrl}
                                                </a>
                                            </span>
                                        </li>
                                    )}
                                    {jobApplication.extractedData?.keyDetails && (
                                        Array.isArray(jobApplication.extractedData.keyDetails) ? (
                                            jobApplication.extractedData.keyDetails.map((item: { key: string; value: string }, idx: number) => (
                                                <li key={idx} className="flex items-start gap-3">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                                                    <span className="text-sm text-text-sub-light dark:text-text-sub-dark">
                                                        <strong className="text-text-main-light dark:text-text-main-dark">{item.key}:</strong> {item.value}
                                                    </span>
                                                </li>
                                            ))
                                        ) : (
                                            (jobApplication.extractedData.keyDetails as string).split('\n').filter((line: string) => line.trim()).map((line: string, idx: number) => (
                                                <li key={idx} className="flex items-start gap-3">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                                                    <span className="text-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                                                        {line.replace(/^[\*\-]\s*/, '')}
                                                    </span>
                                                </li>
                                            ))
                                        )
                                    )}
                                </ul>
                            </div>

                            {/* Job Prerequisites Card */}
                            {jobApplication.jobPrerequisites && (
                                <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mt-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-lg font-bold text-text-main-light dark:text-text-main-dark flex items-center gap-2">
                                            <span className="material-symbols-outlined">checklist</span>
                                            Requirements Description
                                        </h2>
                                    </div>
                                    <div className="text-sm text-text-main-light dark:text-text-main-dark leading-relaxed">
                                        <div className="whitespace-pre-wrap">
                                            {jobApplication.jobPrerequisites}
                                        </div>
                                    </div>
                                </div>
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
                            // Actions
                            handleGenerateCoverLetter={handleGenerateCoverLetter}
                            updateJob={updateJob}
                            showToast={showToast}
                        />
                    )}

                    {activeTab === 'cv' && jobId && (
                        <TailoredCvPage
                            // CV State
                            hasLocalCv={hasLocalCv}
                            cvData={cvData}
                            currentCvId={currentCvId}
                            currentCvFilename={currentCvFilename}
                            liveCvDescriptor={liveCvDescriptor}
                            liveCvData={liveCvData}
                            tailoringChanges={tailoringChanges}
                            showInlineCvDiff={showInlineCvDiff}
                            setShowInlineCvDiff={setShowInlineCvDiff}
                            
                            // CV Creation Mode
                            cvCreationMode={cvCreationMode}
                            setCvCreationMode={setCvCreationMode}
                            cvImportFile={cvImportFile}
                            setCvImportFile={setCvImportFile}
                            selectedBaseCvIdForImport={selectedBaseCvIdForImport}
                            setSelectedBaseCvIdForImport={setSelectedBaseCvIdForImport}
                            isApplyingBaseCv={isApplyingBaseCv}
                            applyCvError={applyCvError}
                            setApplyCvError={setApplyCvError}
                            cvImportFileRef={cvImportFileRef}
                            
                            // AI Generation State
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
                            
                            // Generation Progress
                            generationStep={generationStep}
                            generationProgress={generationProgress}
                            
                            // CV Editor State
                            selectedTemplate={selectedTemplate}
                            setSelectedTemplate={setSelectedTemplate}
                            cvSaveStatus={cvSaveStatus}
                            lastSavedCvDataRef={lastSavedCvDataRef}
                            improvingSections={improvingSections}

                            
                            // ATS State
                            atsScores={atsScores}
                            isLoadingAts={isLoadingAts}
                            isScanningAts={isScanningAts}
                            atsProgressMessage={atsProgressMessage}
                            isApplyingAtsBatch={isApplyingAtsBatch}
                            
                            // Preview State
                            isPreviewOpen={isPreviewOpen}
                            setIsPreviewOpen={setIsPreviewOpen}
                            previewPdfBase64={previewPdfBase64}
                            setPreviewPdfBase64={setPreviewPdfBase64}
                            isLoadingRawPdf={isLoadingRawPdf}
                            setIsLoadingRawPdf={setIsLoadingRawPdf}
                            isGeneratingPreview={isGeneratingPreview}
                            
                            // Job Application
                            jobApplication={jobApplication}
                            jobId={jobId}
                            
                            // Handlers
                            handleCvChange={handleCvChange}
                            handleManualSaveCv={handleManualSaveCv}
                            handleImproveSection={handleImproveSection}
                            handleDynamicChange={handleDynamicChange}
                            resetLocalCvState={resetLocalCvState}
                            showToast={showToast}
                            handleApplyBaseCv={handleApplyBaseCv}
                            handleGenerateSpecificCv={handleGenerateSpecificCv}
                            handleScanAts={handleScanAts}
                            handleDeleteAts={handleDeleteAts}
                            handleApplyAtsSuggestionBatch={handleApplyAtsSuggestionBatch}
                        />
                    )}

                    {/* Tab 5: Mock Interview */}
                    {activeTab === 'mock-interview' && jobApplication && (
                        <MockInterviewPanel jobApplication={jobApplication} jobId={jobId!} cvData={cvData} coverLetterText={coverLetterText} />
                    )}

                    {/* Tab 6: Reminders */}
                    {activeTab === 'reminders' && jobApplication && (
                        <div className="max-w-2xl mx-auto">
                            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-5">
                                <RemindersPanel
                                    jobId={jobId!}
                                    jobTitle={jobApplication.jobTitle}
                                    companyName={jobApplication.companyName}
                                    reminders={reminders}
                                    googleConnected={googleCalConnected}
                                    language={jobApplication.language}
                                    onRemindersChange={setReminders}
                                    onToast={showToast}
                                />
                            </div>
                        </div>
                    )}

                    {/* Tab 7: Prep Materials */}
                    {activeTab === 'materials' && jobId && (
                        <div className="max-w-3xl mx-auto">
                            <div className="rounded-xl shadow-sm border p-5" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                                <InterviewMaterialsPanel jobId={jobId} />
                            </div>
                        </div>
                    )}
                </div>


            </div>

            {/* Tailoring Progress Modal */}
            {
                isGeneratingCv && (
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
                )
            }

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
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full mx-4 border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-200">
                            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-2" style={{ background: "var(--accent-bg)" }}>
                                <Spinner size="lg" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Generating Cover Letter</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-center text-sm">
                                Analyzing job details and crafting your personalized letter...
                            </p>
                        </div>
                    </div>
                )
            }

            {/* AI Application Advice Modal */}
            {
                isRecommendationModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="relative w-full max-w-xl max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                            {/* Modal Header */}
                            <div className="flex items-center gap-3 mb-6">
                                <span className={`material-symbols-outlined text-2xl ${recommendation?.shouldApply
                                    ? 'text-green-600 dark:text-green-400'
                                    : recommendation?.error
                                        ? 'text-red-500 dark:text-red-400'
                                        : recommendation && !recommendation.shouldApply
                                            ? 'text-amber-600 dark:text-amber-400'
                                            : 'text-primary'
                                    }`}>smart_toy</span>
                                <h2 className="text-xl font-bold text-text-main-light dark:text-text-main-dark">AI Application Advice</h2>
                                <div className="ml-auto flex items-center gap-2">
                                    <button
                                        onClick={handleRefreshRecommendation}
                                        disabled={isLoadingRecommendation || isRefreshingRecommendation || !jobApplication?.jobDescriptionText}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        title={!jobApplication?.jobDescriptionText ? 'Job description required' : 'Refresh analysis (2 credits)'}
                                    >
                                        {isRefreshingRecommendation ? (
                                            <Spinner size="sm" />
                                        ) : (
                                            <span className="material-symbols-outlined text-sm">refresh</span>
                                        )}
                                        <span>Refresh</span>
                                        <span className="text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded-full" style={{ background: '#e8b844', color: '#0e0e17' }}>2 Credit</span>
                                    </button>
                                    {/* Close Button */}
                                    <button
                                        onClick={() => setIsRecommendationModalOpen(false)}
                                        className="p-1.5 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                        title="Close"
                                    >
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                            </div>

                            {/* Loading State */}
                            {isLoadingRecommendation && (
                                <div className="flex items-center gap-3 py-8 justify-center">
                                    <Spinner size="md" />
                                    <span className="text-gray-500 dark:text-gray-400">Analyzing job match...</span>
                                </div>
                            )}

                            {/* No Job Description */}
                            {!isLoadingRecommendation && !jobApplication?.jobDescriptionText && (
                                <div className="flex items-start gap-3 py-4">
                                    <span className="material-symbols-outlined text-gray-400 dark:text-gray-500 mt-0.5">info</span>
                                    <div>
                                        <p className="text-gray-600 dark:text-gray-400">
                                            Job description is required to provide AI application advice.
                                        </p>
                                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-500">
                                            Go to the Job Description tab and paste the job description.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Error State - CV not found */}
                            {!isLoadingRecommendation && recommendation?.error && recommendation.error.toLowerCase().includes('cv') && (
                                <div className="flex items-start gap-3 py-4">
                                    <span className="material-symbols-outlined text-amber-500 dark:text-amber-400 mt-0.5">upload_file</span>
                                    <div>
                                        <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">CV Required</p>
                                        <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">
                                            Please upload a CV first to get AI-powered application advice.
                                        </p>
                                        <Link
                                            to="/manage-cv"
                                            onClick={() => setIsRecommendationModalOpen(false)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-sm">description</span>
                                            <span>Upload CV</span>
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {/* Error State - Other errors */}
                            {!isLoadingRecommendation && recommendation?.error && !recommendation.error.toLowerCase().includes('cv') && (
                                <div className="flex items-start gap-3 py-4">
                                    <span className="material-symbols-outlined text-red-500 dark:text-red-400 mt-0.5">error</span>
                                    <div>
                                        <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Analysis Error</p>
                                        <p className="text-sm text-red-600 dark:text-red-400">{recommendation.error}</p>
                                    </div>
                                </div>
                            )}

                            {/* Recommendation Result */}
                            {!isLoadingRecommendation && recommendation && !recommendation.error && (
                                <div className="space-y-5">
                                    {/* Main Verdict */}
                                    <div className={`flex items-center gap-4 p-5 rounded-xl ${recommendation.shouldApply
                                        ? 'bg-green-100 dark:bg-green-900/40'
                                        : 'bg-amber-100 dark:bg-amber-900/40'
                                        }`}>
                                        <div className={`flex items-center justify-center w-14 h-14 rounded-full ${recommendation.shouldApply ? 'bg-green-500' : 'bg-amber-500'
                                            }`}>
                                            <span className="material-symbols-outlined text-white text-3xl">
                                                {recommendation.shouldApply ? 'thumb_up' : 'warning'}
                                            </span>
                                        </div>
                                        <div className="flex-1">
                                            <p className={`text-xl font-bold ${recommendation.shouldApply
                                                ? 'text-green-800 dark:text-green-200'
                                                : 'text-amber-800 dark:text-amber-200'
                                                }`}>
                                                {recommendation.shouldApply ? 'Apply!' : 'Consider Carefully'}
                                            </p>
                                            {recommendation.score !== null && (
                                                <p className={`text-sm ${recommendation.shouldApply
                                                    ? 'text-green-700 dark:text-green-300'
                                                    : 'text-amber-700 dark:text-amber-300'
                                                    }`}>
                                                    Match Score: <span className="font-bold text-lg">{recommendation.score}%</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Reason */}
                                    <div>
                                        <p className="text-sm font-medium text-text-main-light dark:text-text-main-dark mb-2">Why?</p>
                                        <p className="text-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                                            {recommendation.reason}
                                        </p>
                                    </div>

                                    {/* Keyword Analysis Section */}
                                    {recommendation.keywordAnalysis && (
                                        recommendation.keywordAnalysis.matchedKeywords.length > 0 ||
                                        recommendation.keywordAnalysis.missingKeywords.length > 0
                                    ) && (
                                            <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                                                <p className="text-sm font-medium text-text-main-light dark:text-text-main-dark mb-3">
                                                    Keyword Analysis
                                                </p>
                                                <p className="text-xs text-text-sub-light dark:text-text-sub-dark mb-3">
                                                    <span className="text-green-600 dark:text-green-400 font-medium">Matched</span> keywords in your CV |
                                                    <span className="text-amber-600 dark:text-amber-400 font-medium"> Missing</span> from your CV
                                                </p>
                                                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                                                    {recommendation.keywordAnalysis.matchedKeywords.map((keyword, idx) => (
                                                        <span
                                                            key={`matched-${idx}`}
                                                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800"
                                                        >
                                                            {keyword}
                                                        </span>
                                                    ))}
                                                    {recommendation.keywordAnalysis.missingKeywords.map((keyword, idx) => (
                                                        <span
                                                            key={`missing-${idx}`}
                                                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                                        >
                                                            {keyword}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                    {/* Cached Info */}
                                    {recommendation.cached && recommendation.cachedAt && (
                                        <p className="text-xs text-gray-400 dark:text-gray-500 pt-2">
                                            Last analyzed: {new Date(recommendation.cachedAt).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* No recommendation yet but has job description */}
                            {!isLoadingRecommendation && !recommendation && jobApplication?.jobDescriptionText && (
                                <div className="flex flex-col items-center justify-center py-8 gap-4">
                                    <span className="material-symbols-outlined text-gray-400 dark:text-gray-500 text-4xl">auto_awesome</span>
                                    <p className="text-gray-600 dark:text-gray-400 text-center">
                                        AI recommendation not yet generated.
                                    </p>
                                    <button
                                        onClick={handleRefreshRecommendation}
                                        disabled={isRefreshingRecommendation}
                                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-ink-950 hover:bg-primaryLight disabled:opacity-50 transition-colors"
                                    >
                                        {isRefreshingRecommendation ? (
                                            <Spinner size="sm" />
                                        ) : (
                                            <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                        )}
                                        <span>Generate Recommendation</span>
                                        <span className="text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded-full" style={{ background: '#e8b844', color: '#0e0e17' }}>2 Credit</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

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

export default ReviewFinalizePage;

