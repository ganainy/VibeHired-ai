// client/src/pages/ReviewFinalizePage.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { updateCustomPrompts } from '../services/settingsApi';
import { getJobById, updateJob, JobApplication, scrapeJobDescriptionApi, extractJobFromTextApi, deleteJob } from '../services/jobApi';
import { renderFinalPdfs, renderCvPdf, renderCoverLetterPdf, getDownloadUrl, generateCvOnly, improveSection, applyAtsSuggestion } from '../services/generatorApi';
import { analyzeCv, AnalysisResult, getAnalysis } from '../services/analysisApi';
import { scanAts, getAtsScores, getAtsForJob, AtsScores, deleteAtsAnalysis } from '../services/atsApi';
import { JsonResumeSchema } from '../../../server/src/types/jsonresume';
import CvEditorPanel from '../components/cv-workspace/CvEditorPanel';
// import { downloadCvAsPdf } from '../services/pdfService'; // Removed as we use react-to-print now
import { DEFAULT_CV_PROMPT, DEFAULT_COVER_LETTER_PROMPT } from '../constants/prompts';
import { generateCoverLetter } from '../services/coverLetterApi';
import { getMasterCv, previewCv, getCvBranches, CVDocument, getJobCv, createJobCv, createJobCvFromBase, uploadCvForJob, updateCv, deleteCv } from '../services/cvApi';
import AtsInlinePanel from '../components/ats/AtsInlinePanel';
import CvPreviewModal from '../components/cv-editor/CvPreviewModal';
import axios from 'axios';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import ErrorAlert from '../components/common/ErrorAlert';
import Spinner from '../components/common/Spinner';
import Toast from '../components/common/Toast';
import JobStatusBadge from '../components/jobs/JobStatusBadge';
import { getJobRecommendation, JobRecommendation } from '../services/jobRecommendationApi';
import CoverLetterEditor from '../components/CoverLetterEditor';
import EmailFormatModal from '../components/EmailFormatModal';
import { JobChatWindow, FloatingChatButton } from '../components/chat';
import { parseMultipleUrls, normalizeMultipleUrls } from '../lib/utils';

import PromptCustomizer from '../components/common/PromptCustomizer';
import PromptChecklist from '../components/common/PromptChecklist';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { getBaseCoverLetters, applyBaseCoverLetterToJob, uploadCoverLetterForJob, saveCurrentCoverLetterForJob, CoverLetterBase } from '../services/coverLetterBaseApi';

interface ToastState {
    message: string;
    type: 'success' | 'error' | 'info';
}

type JobDetailsFormData = {
    jobTitle: string;
    companyName: string;
    status: JobApplication['status'];
    language: 'en' | 'de';
    baseCvId: string;
    jobType: JobApplication['jobType'] | '';
    createdAt: string;
    jobUrls: string[];
    salary: string;
    contactEmail: string;
    contactPhone: string;
    hiringManagerName: string;
    applicationUrl: string;
    notes: string;
};

const ReviewFinalizePage: React.FC = () => {
    const { jobId, tab } = useParams<{ jobId: string; tab?: string }>();
    const navigate = useNavigate();
    const [jobApplication, setJobApplication] = useState<JobApplication | null>(null);
    const [cvData, setCvData] = useState<JsonResumeSchema>({ basics: {} });
    const [currentCvId, setCurrentCvId] = useState<string | null>(null);
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
    const [tailoringChanges, setTailoringChanges] = useState<any[] | null>(null); // New state for changes

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
    const [activeTab, setActiveTab] = useState<'job-description' | 'cover-letter' | 'cv'>(() => {
        // Priority 1: URL Param
        if (tab && ['job-description', 'cover-letter', 'cv'].includes(tab)) {
            return tab as any;
        }
        // Priority 2: Local Storage
        if (jobId) {
            try {
                const saved = localStorage.getItem(`job_tab_${jobId}`);
                if (saved && ['job-description', 'cover-letter', 'cv'].includes(saved)) {
                    return saved as any;
                }
            } catch (e) {
                console.error("Error reading tab from localStorage", e);
            }
        }
        // Priority 3: Default
        return 'job-description';
    });

    const handleTabChange = (newTab: 'job-description' | 'cover-letter' | 'cv') => {
        // setActiveTab(newTab); // Not needed as we rely on URL change or we can do optimistic update
        // Let's do optimistic update + navigation
        setActiveTab(newTab);
        if (jobId) {
            localStorage.setItem(`job_tab_${jobId}`, newTab);
            navigate(`/jobs/${jobId}/review/${newTab}`);
        }
    };

    // Update active tab when URL param changes
    useEffect(() => {
        if (tab && ['job-description', 'cover-letter', 'cv'].includes(tab)) {
            setActiveTab(tab as any);
        } else if (!tab && jobId) {
            // If no tab in URL, check localStorage or default logic (though initial state handles this, 
            // this handles navigation from /review/cv to /review)
            // But actually, we probably want to Redirect /review to /review/job-description or whatever is saved?
            // For now, let's just stick to what `activeTab` is if tab is invalid or missing, to avoid loops
        }
    }, [tab]);

    // Update active tab when switching jobs (if component doesn't unmount) - keeping existing logic but ensuring it respects URL first
    useEffect(() => {
        if (jobId && !tab) { // Only checking localStorage if no tab param is provided
            const saved = localStorage.getItem(`job_tab_${jobId}`);
            if (saved && ['job-description', 'cover-letter', 'cv'].includes(saved)) {
                setActiveTab(saved as any);
            } else {
                setActiveTab('job-description');
            }
        }
    }, [jobId]);
    const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isInitialLoadRef = useRef<boolean>(true);
    const lastSavedCvDataRef = useRef<string | null>(null);
    const lastSavedCoverLetterRef = useRef<string | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
    const [previewPdfBase64, setPreviewPdfBase64] = useState<string | null>(null);
    const [isGeneratingPreview, setIsGeneratingPreview] = useState<boolean>(false);
    const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);

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
        return 'master';
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

            const baseCvIdForJob = newId === 'master' ? null : newId;
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
            setCvData(result.cv.cvJson);
            setCurrentCvId(result.cv._id);
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
                    setSelectedBaseCvId('master');
                }

                const savedClBaseCvId = localStorage.getItem(`job_selectedClBaseCvId_${jobId}`);
                if (savedClBaseCvId) {
                    setSelectedClBaseCvId(savedClBaseCvId);
                } else {
                    setSelectedClBaseCvId('master');
                }
            } catch (e) {
                console.error("Error reading CV selection from localStorage", e);
                setSelectedBaseCvId('master');
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
            // Seed applied ATS suggestions history from DB
            if (data.appliedAtsSuggestions && data.appliedAtsSuggestions.length > 0) {
                setAppliedAtsSuggestions(data.appliedAtsSuggestions);
            }

            // Fetch Job CV from Unified Model
            try {
                const cvResponse = await getJobCv(jobId);
                if (cvResponse.cv) {
                    setCvData(cvResponse.cv.cvJson);
                    setCurrentCvId(cvResponse.cv._id);
                    setTailoringChanges(cvResponse.cv.tailoringChanges || null);
                    lastSavedCvDataRef.current = JSON.stringify(cvResponse.cv.cvJson);
                } else {
                    // Fallback to legacy draftCvJson if no CV document yet
                    if (data.draftCvJson) {
                        setCvData(data.draftCvJson);
                        lastSavedCvDataRef.current = JSON.stringify(data.draftCvJson);
                    } else {
                        lastSavedCvDataRef.current = JSON.stringify({ basics: {} });
                    }
                    setTailoringChanges(null);
                }
            } catch (err) {
                // If 404 or other error, fallback to legacy
                if (data.draftCvJson) {
                    setCvData(data.draftCvJson);
                    lastSavedCvDataRef.current = JSON.stringify(data.draftCvJson);
                } else {
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

    // Check if we have a valid CV loaded (either from unified model or legacy fallback)
    const hasLocalCv = React.useMemo(() => {
        return !!(cvData && cvData.basics && Object.keys(cvData.basics).length > 0);
    }, [cvData]);

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

        const hasValidSelection = availableCvs.some(cv => cv.id === selectedBaseCvId);
        if (hasValidSelection) return;

        const fallbackCvId = availableCvs[0]?.id;
        if (!fallbackCvId) return;

        handleSelectedBaseCvIdChange(fallbackCvId);
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
            showToast(err?.message || 'Failed to calculate match', 'error');
            setRecommendation({
                shouldApply: false,
                score: null,
                reason: '',
                cached: false,
                error: err?.message || 'Failed to calculate match'
            });
        } finally {
            setIsLoadingRecommendation(false);
        }
    };

    // Handler to refresh AI recommendation
    const handleRefreshRecommendation = async () => {
        if (!jobId) return;

        setIsRefreshingRecommendation(true);
        try {
            const result = await getJobRecommendation(jobId, true); // Force refresh
            setRecommendation(result);
            showToast('AI recommendation updated!', 'success');
        } catch (err: any) {
            console.error('Failed to refresh recommendation:', err);
            showToast('Failed to update recommendation', 'error');
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

            return result;
        } catch (error: any) {
            console.error(`Error improving ${section}:`, error);
            showToast(error.message || `Failed to improve ${section}`, 'error');
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
            showToast(error.message || 'Failed to start ATS scan.', 'error');
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
        } catch (error: any) {
            console.error('Error applying ATS suggestions:', error);
            showToast(error.message || 'Failed to apply ATS suggestions', 'error');
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

                if (cvData && typeof cvData === 'object' && Object.keys(cvData).length > 0 && coverLetterText && coverLetterText.trim().length > 0) {
                    const currentStatus = jobApplication.generationStatus;
                    if (currentStatus !== 'finalized') {
                        updatePayload.generationStatus = 'draft_ready';
                    }
                }

                await updateJob(jobId, updatePayload);

                // 2. Update CV in Unified Model
                if (currentCvId) {
                    await updateCv(currentCvId, { cvJson: cvData });
                } else {
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
    }, [cvData, coverLetterText, jobId, jobApplication, currentCvId]);

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
            } else if (response.status === 'failed') {
                setAnalyzeError(response.errorInfo || 'Analysis failed');
                if (pollingIntervalId.current) {
                    clearInterval(pollingIntervalId.current);
                    pollingIntervalId.current = null;
                }
            }
        } catch (error: any) {
            console.error('Error polling analysis results:', error);
            setAnalyzeError(error.message || 'Failed to get analysis results');
        }
    }, []);

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
            setAnalyzeError(error.message || `Failed to analyze ${section}.`);
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

            if (cvData && typeof cvData === 'object' && Object.keys(cvData).length > 0 && coverLetterText && coverLetterText.trim().length > 0) {
                const currentStatus = jobApplication.generationStatus;
                if (currentStatus !== 'finalized') {
                    updatePayload.generationStatus = 'draft_ready';
                }
            }

            await updateJob(jobId, updatePayload);

            // 2. Update/Create CV in Unified Model
            if (currentCvId) {
                await updateCv(currentCvId, { cvJson: cvData });
            } else {
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

            if (cvData && typeof cvData === 'object' && Object.keys(cvData).length > 0 && coverLetterText && coverLetterText.trim().length > 0) {
                const currentStatus = jobApplication?.generationStatus;
                if (currentStatus !== 'finalized') {
                    updatePayload.generationStatus = 'draft_ready';
                }
            }

            await updateJob(jobId, updatePayload);

            // Save CV to Unified Model
            if (currentCvId) {
                await updateCv(currentCvId, { cvJson: cvData });
            } else {
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

            if (cvData && typeof cvData === 'object' && Object.keys(cvData).length > 0) {
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
            if (currentCvId) {
                await updateCv(currentCvId, { cvJson: cvData });
            } else {
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
            await updateCv(currentCvId, { cvJson: cvData });
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

        } catch (error: any) {
            console.error('Error generating cover letter:', error);
            setCoverLetterError(error.message || 'Failed to generate cover letter');
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
            } else if (response.status === 'pending_input') {
                setGenerateCvError('Generation requires additional input. Please check the console for details.');
            } else {
                setGenerateCvError('Unexpected response from generation service.');
            }
        } catch (error: any) {
            console.error('Error generating specific CV:', error);
            setGenerateCvError(error.message || 'Failed to generate job-specific CV.');
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

    // Calculate progress steps
    const getProgressSteps = () => {
        if (!jobApplication) return [];
        return [
            {
                label: 'Job Details',
                completed: !!jobApplication.jobDescriptionText,
            },
            {
                label: 'CV Generated',
                completed: hasLocalCv,
            },
            {
                label: 'Cover Letter Generated',
                completed: !!jobApplication.draftCoverLetterText,
            },
            {
                label: 'AI Review',
                completed: !!atsScores,
            },
        ];
    };

    // Format date helper with relative time
    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

            if (diffDays === 0) return 'Today';
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays} days ago`;

            // For older dates, show full date
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });
        } catch {
            return 'N/A';
        }
    };

    // Get full date for tooltip
    const getFullDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return 'N/A';
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
                <div className="container mx-auto p-4">
                    <div className="mb-6">
                        <LoadingSkeleton lines={2} />
                    </div>
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                        <LoadingSkeleton lines={5} />
                    </div>
                </div>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
                <div className="container mx-auto p-4">
                    <div className="mb-4">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 mb-4"
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
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
                <div className="container mx-auto p-4 text-center">
                    <p className="text-slate-900 dark:text-slate-300 mb-4">Job application data not found.</p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="px-4 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    const progressSteps = getProgressSteps();

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
            {/* Toast Notification */}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}



            <div className="p-6 lg:p-8">
                {/* Page Header */}
                <div className="flex items-start justify-between gap-4 mb-6">
                    {/* Left: Job Info */}
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                            {jobApplication.jobTitle}
                        </h1>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[18px]">apartment</span>
                                {jobApplication.companyName}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[18px]">schedule</span>
                                Created: {formatDate(jobApplication.createdAt)}
                            </span>
                        </div>
                    </div>

                    {/* Right: Status & Match Info */}
                    <div className="flex items-start gap-6 flex-shrink-0">
                        {/* Status Column */}
                        <div className="text-center">
                            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Status</p>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                {jobApplication.status}
                            </p>
                        </div>

                        {/* Match Column - Clickable or Calculate Button */}
                        {recommendation && recommendation.score !== null && recommendation.score !== undefined ? (
                            <button
                                onClick={() => setIsRecommendationModalOpen(true)}
                                className="text-center cursor-pointer hover:opacity-80 transition-opacity"
                                title="Click to view AI Application Advice"
                            >
                                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Match</p>
                                <p className={`text-sm font-semibold ${recommendation.shouldApply
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-amber-600 dark:text-amber-400'
                                    }`}>
                                    {`${recommendation.score}%`}
                                </p>
                            </button>
                        ) : (
                            <button
                                onClick={handleCalculateMatch}
                                disabled={isLoadingRecommendation || !jobApplication?.jobDescriptionText}
                                className="text-center cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                title={!jobApplication?.jobDescriptionText ? "Add job description first" : "Click to calculate match"}
                            >
                                <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">Match</p>
                                {isLoadingRecommendation ? (
                                    <span className="inline-flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                                    </span>
                                ) : recommendation?.error ? (
                                    <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-md hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
                                        Retry
                                    </span>
                                ) : (
                                    <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                                        Calculate
                                    </span>
                                )}
                            </button>
                        )}


                        {/* Open Job Link Button */}
                        {jobApplication.jobUrl && parseMultipleUrls(jobApplication.jobUrl || '').length > 0 && (
                            <div className="flex items-center gap-1">
                                {parseMultipleUrls(jobApplication.jobUrl || '').slice(0, 3).map((url, idx) => (
                                    <a
                                        key={idx}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-3 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 rounded-lg shadow-sm transition-all flex items-center justify-center hover:scale-105 active:scale-95 self-stretch"
                                        title={`View Job Posting ${parseMultipleUrls(jobApplication.jobUrl || '').length > 1 ? `(${idx + 1})` : ''}: ${url}`}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                                        {parseMultipleUrls(jobApplication.jobUrl || '').length > 1 && (
                                            <span className="text-xs ml-0.5">{idx + 1}</span>
                                        )}
                                    </a>
                                ))}
                                {parseMultipleUrls(jobApplication.jobUrl || '').length > 3 && (
                                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-1" title={parseMultipleUrls(jobApplication.jobUrl || '').slice(3).join('\n')}>
                                        +{parseMultipleUrls(jobApplication.jobUrl || '').length - 3} more
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Mark as Applied Button */}
                        {jobApplication.status !== 'Applied' && (
                            <button
                                onClick={handleMarkAsApplied}
                                className="px-4 py-3 text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500 rounded-lg shadow-sm transition-all flex items-center gap-1.5 hover:scale-105 active:scale-95 self-stretch"
                                title="Mark this job as Applied"
                            >
                                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                <span>Mark as Applied</span>
                            </button>
                        )}

                        {/* Delete Job Button */}
                        <button
                            onClick={handleDeleteJob}
                            className="p-3 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-lg shadow-sm transition-all flex items-center justify-center hover:scale-105 active:scale-95 self-stretch"
                            title="Delete this job application"
                        >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                    </div>
                </div>



                {/* Tabs Navigation with Integrated Progress Indicators */}
                <div className="mb-6 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-4">
                    <div className="relative flex items-center justify-between w-full max-w-4xl mx-auto">
                        <div className="absolute left-0 top-1/2 w-full h-0.5 bg-gray-200 dark:bg-gray-700 -z-10 transform -translate-y-1/2"></div>

                        {/* Tab 1: Job Details */}
                        <button
                            onClick={() => handleTabChange('job-description')}
                            className="group flex flex-col items-center focus:outline-none"
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-gray-800 transition-all duration-200 ${activeTab === 'job-description'
                                ? 'bg-primary text-white shadow-lg scale-125'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}>
                                <span className="material-symbols-outlined text-sm">check</span>
                            </div>
                            <span className={`text-xs font-medium mt-2 transition-colors duration-200 ${activeTab === 'job-description'
                                ? 'text-primary font-bold'
                                : 'text-gray-500 dark:text-gray-400'
                                }`}>Job Details</span>
                        </button>

                        {/* Tab 2: CV Generated */}
                        <button
                            onClick={() => handleTabChange('cv')}
                            className="group flex flex-col items-center focus:outline-none"
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-gray-800 transition-all duration-200 ${activeTab === 'cv'
                                ? 'bg-primary text-white shadow-lg scale-125'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}>
                                <span className="material-symbols-outlined text-sm">article</span>
                            </div>
                            <span className={`text-xs font-medium mt-2 transition-colors duration-200 ${activeTab === 'cv'
                                ? 'text-primary font-bold'
                                : 'text-gray-500 dark:text-gray-400'
                                }`}>Tailored CV</span>
                        </button>

                        {/* Tab 3: Cover Letter */}
                        <button
                            onClick={() => handleTabChange('cover-letter')}
                            className="group flex flex-col items-center focus:outline-none"
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-gray-800 transition-all duration-200 ${activeTab === 'cover-letter'
                                ? 'bg-primary text-white shadow-lg scale-125'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}>
                                <span className="material-symbols-outlined text-sm">mail</span>
                            </div>
                            <span className={`text-xs font-medium mt-2 transition-colors duration-200 ${activeTab === 'cover-letter'
                                ? 'text-primary font-bold'
                                : 'text-gray-500 dark:text-gray-400'
                                }`}>Cover Letter</span>
                        </button>

                    </div>
                </div>      {/* Tab Content */}
                <div className="px-0 py-6">

                    {/* Tab 2: Job Description */}
                    {activeTab === 'job-description' && (
                        <div className="w-full space-y-6">

                            {/* Editable Job Details */}
                            <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 md:p-6">
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-5 md:mb-6">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">edit_square</span>
                                        <h2 className="text-lg font-bold text-text-main-light dark:text-text-main-dark">Job Details</h2>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {jobDetailsHasChanges && (
                                            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Unsaved changes</span>
                                        )}
                                        <button
                                            onClick={handleSaveJobDetails}
                                            disabled={!jobDetailsHasChanges || isSavingJobDetails || !jobDetailsForm}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primaryLight focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            {isSavingJobDetails ? (
                                                <>
                                                    <Spinner size="sm" />
                                                    <span>Saving...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined text-sm">save</span>
                                                    <span>Save Changes</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {jobDetailsSaveError && (
                                    <div className="mb-4">
                                        <ErrorAlert
                                            message={jobDetailsSaveError}
                                            onDismiss={() => setJobDetailsSaveError(null)}
                                        />
                                    </div>
                                )}

                                {jobDetailsForm && (
                                    <div className="space-y-5 md:space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Job Title <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    value={jobDetailsForm.jobTitle}
                                                    onChange={(e) => handleJobDetailsInputChange('jobTitle', e.target.value)}
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company Name <span className="text-red-500">*</span></label>
                                                <input
                                                    type="text"
                                                    value={jobDetailsForm.companyName}
                                                    onChange={(e) => handleJobDetailsInputChange('companyName', e.target.value)}
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                                                <select
                                                    value={jobDetailsForm.status}
                                                    onChange={(e) => handleJobDetailsInputChange('status', e.target.value)}
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
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
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
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
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Employment Type</label>
                                                <select
                                                    value={jobDetailsForm.jobType || ''}
                                                    onChange={(e) => handleJobDetailsInputChange('jobType', e.target.value)}
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
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
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                >
                                                    <option value="">Use master/primary CV</option>
                                                    {jobDetailsForm.baseCvId && !availableCvs.some(cv => cv.id === jobDetailsForm.baseCvId) && (
                                                        <option value={jobDetailsForm.baseCvId}>Current saved CV ({jobDetailsForm.baseCvId})</option>
                                                    )}
                                                    {availableCvs.map((cv) => (
                                                        <option key={cv.id} value={cv.id}>{cv.name}</option>
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
                                                            className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
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
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contact Email</label>
                                                <input
                                                    type="email"
                                                    value={jobDetailsForm.contactEmail}
                                                    onChange={(e) => handleJobDetailsInputChange('contactEmail', e.target.value)}
                                                    placeholder="name@company.com"
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
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
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Hiring Manager</label>
                                                <input
                                                    type="text"
                                                    value={jobDetailsForm.hiringManagerName}
                                                    onChange={(e) => handleJobDetailsInputChange('hiringManagerName', e.target.value)}
                                                    placeholder="Recruiter or manager name"
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Application URL</label>
                                                <input
                                                    type="url"
                                                    value={jobDetailsForm.applicationUrl}
                                                    onChange={(e) => handleJobDetailsInputChange('applicationUrl', e.target.value)}
                                                    placeholder="https://company.com/apply"
                                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
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
                                                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm resize-y"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Highlights Card */}
                            <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
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
                                    {jobApplication.extractedData?.salaryRaw && (
                                        <li className="flex items-start gap-3">
                                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                                            <span className="text-sm text-text-sub-light dark:text-text-sub-dark">
                                                <strong className="text-text-main-light dark:text-text-main-dark">Salary Estimate:</strong> {jobApplication.extractedData.salaryRaw}
                                            </span>
                                        </li>
                                    )}

                                    {/* Contact Information */}
                                    {jobApplication.contactEmail && (
                                        <li className="flex items-start gap-3">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                                            <span className="text-sm text-text-sub-light dark:text-text-sub-dark">
                                                <strong className="text-text-main-light dark:text-text-main-dark">Contact Email:</strong>{' '}
                                                <a href={`mailto:${jobApplication.contactEmail}`} className="text-indigo-500 dark:text-indigo-400 hover:underline">
                                                    {jobApplication.contactEmail}
                                                </a>
                                            </span>
                                        </li>
                                    )}
                                    {jobApplication.contactPhone && (
                                        <li className="flex items-start gap-3">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                                            <span className="text-sm text-text-sub-light dark:text-text-sub-dark">
                                                <strong className="text-text-main-light dark:text-text-main-dark">Contact Phone:</strong> {jobApplication.contactPhone}
                                            </span>
                                        </li>
                                    )}
                                    {jobApplication.hiringManagerName && (
                                        <li className="flex items-start gap-3">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                                            <span className="text-sm text-text-sub-light dark:text-text-sub-dark">
                                                <strong className="text-text-main-light dark:text-text-main-dark">Hiring Manager:</strong> {jobApplication.hiringManagerName}
                                            </span>
                                        </li>
                                    )}
                                    {jobApplication.applicationUrl && (
                                        <li className="flex items-start gap-3">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></span>
                                            <span className="text-sm text-text-sub-light dark:text-text-sub-dark">
                                                <strong className="text-text-main-light dark:text-text-main-dark">Application Portal:</strong>{' '}
                                                <a href={jobApplication.applicationUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-500 dark:text-indigo-400 hover:underline">
                                                    {jobApplication.applicationUrl.length > 50 ? jobApplication.applicationUrl.substring(0, 50) + '...' : jobApplication.applicationUrl}
                                                </a>
                                            </span>
                                        </li>
                                    )}

                                    {jobApplication.extractedData?.keyDetails && (
                                        Array.isArray(jobApplication.extractedData.keyDetails) ? (
                                            jobApplication.extractedData.keyDetails.map((item, idx) => (
                                                <li key={idx} className="flex items-start gap-3">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                                                    <span className="text-sm text-text-sub-light dark:text-text-sub-dark">
                                                        <strong className="text-text-main-light dark:text-text-main-dark">{item.key}:</strong> {item.value}
                                                    </span>
                                                </li>
                                            ))
                                        ) : (
                                            (jobApplication.extractedData.keyDetails as string).split('\n').filter(line => line.trim()).map((line, idx) => (
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
                                <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-lg font-bold text-text-main-light dark:text-text-main-dark flex items-center gap-2">
                                            <span className="material-symbols-outlined text-indigo-500">checklist</span>
                                            Requirements
                                        </h2>
                                    </div>
                                    <div className="text-sm text-text-main-light dark:text-text-main-dark leading-relaxed">
                                        <div className="whitespace-pre-wrap">
                                            {jobApplication.jobPrerequisites}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Description Card */}
                            <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-bold text-text-main-light dark:text-text-main-dark">Description</h2>
                                    {/* Only show Extract with AI button if no job description exists */}
                                    {(!jobApplication.jobDescriptionText || jobApplication.jobDescriptionText.trim().length < 50) && (
                                        <button
                                            onClick={() => setShowExtractWithAi(!showExtractWithAi)}
                                            disabled={isExtractingWithAi}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isExtractingWithAi
                                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                                : showExtractWithAi
                                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                                    : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                                                }`}
                                            title="Extract job details using AI"
                                        >
                                            {isExtractingWithAi ? (
                                                <>
                                                    <Spinner size="sm" />
                                                    <span>Extracting...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5A2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5Z" />
                                                    </svg>
                                                    <span>{showExtractWithAi ? 'Cancel' : 'Extract with AI'}</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>

                                {refreshError && (
                                    <div className="mb-4">
                                        <ErrorAlert
                                            message={refreshError}
                                            onDismiss={() => setRefreshError(null)}
                                            onRetry={handleRefreshJobDetails}
                                        />
                                    </div>
                                )}

                                {/* Extract with AI Section - Only shown when no job description exists */}
                                {showExtractWithAi && (!jobApplication.jobDescriptionText || jobApplication.jobDescriptionText.trim().length < 50) && (
                                    <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                                            Paste the job description text below and click "Extract" to update the job details using AI.
                                        </p>
                                        <div className="relative">
                                            <textarea
                                                value={pastedJobText}
                                                onChange={(e) => setPastedJobText(e.target.value)}
                                                placeholder="Paste job description here..."
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-50 resize-y min-h-[120px] text-sm transition-all"
                                                rows={5}
                                                disabled={isExtractingWithAi}
                                            />
                                            {isExtractingWithAi && (
                                                <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center gap-2">
                                                    <Spinner size="md" />
                                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Extracting job details...</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between mt-3">
                                            <div>
                                                {pastedJobText && pastedJobText.trim().length > 0 && pastedJobText.trim().length < 50 && (
                                                    <p className="text-xs text-amber-600 dark:text-amber-400">
                                                        Please paste more text (at least 50 characters)
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                onClick={handleExtractWithAi}
                                                disabled={isExtractingWithAi || !pastedJobText || pastedJobText.trim().length < 50}
                                                className="bg-indigo-600 text-white font-medium py-2 px-5 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-2"
                                            >
                                                {isExtractingWithAi ? (
                                                    <>
                                                        <Spinner size="sm" />
                                                        <span>Extracting...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5A2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5Z" />
                                                        </svg>
                                                        <span>Extract with AI</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className={`custom-scrollbar overflow-y-auto pr-2 text-sm text-text-main-light dark:text-text-main-dark leading-relaxed space-y-4 ${isJobDescriptionExpanded ? 'max-h-none' : 'max-h-[500px]'}`}>
                                    {jobApplication.jobDescriptionText ? (
                                        <div className="whitespace-pre-wrap">
                                            {jobApplication.jobDescriptionText}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-8 text-center">
                                            <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600 mb-2">description</span>
                                            <p className="text-text-sub-light dark:text-text-sub-dark mb-6">No job description available.</p>

                                            {/* Extract with AI Section */}
                                            <div className="w-full max-w-2xl">
                                                <div className="relative">
                                                    <textarea
                                                        value={pastedJobText}
                                                        onChange={(e) => setPastedJobText(e.target.value)}
                                                        placeholder="Paste job description here..."
                                                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-4 py-3 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50 resize-y min-h-[120px] text-sm transition-all"
                                                        rows={5}
                                                        disabled={isExtractingWithAi}
                                                    />
                                                    {isExtractingWithAi && (
                                                        <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center gap-2">
                                                            <Spinner size="md" />
                                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Extracting job details...</p>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex justify-center gap-3 mt-4">
                                                    <button
                                                        onClick={handleExtractWithAi}
                                                        disabled={isExtractingWithAi || !pastedJobText || pastedJobText.trim().length < 50}
                                                        className="bg-indigo-600 text-white font-medium py-2 px-5 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center gap-2"
                                                    >
                                                        {isExtractingWithAi ? (
                                                            <>
                                                                <Spinner size="sm" />
                                                                <span>Extracting...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                                                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5A2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5Z" />
                                                                </svg>
                                                                <span>Extract with AI</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                                {pastedJobText && pastedJobText.trim().length > 0 && pastedJobText.trim().length < 50 && (
                                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                                                        Please paste more text (at least 50 characters)
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {jobApplication.jobDescriptionText && (
                                    <div className="mt-4 flex justify-center pt-2 border-t border-gray-100 dark:border-gray-700">
                                        <button
                                            onClick={() => setIsJobDescriptionExpanded(!isJobDescriptionExpanded)}
                                            className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
                                        >
                                            {isJobDescriptionExpanded ? 'Show less' : 'Read full description'}
                                            <span className="material-symbols-outlined text-base">
                                                {isJobDescriptionExpanded ? 'expand_less' : 'expand_more'}
                                            </span>
                                        </button>
                                    </div>
                                )}
                            </div>


                        </div>
                    )}

                    {/* Tab 3: Cover Letter */}
                    {activeTab === 'cover-letter' && (
                        <div>
                            {jobApplication.draftCoverLetterText ? (
                                <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col h-[calc(100vh-280px)] min-h-[800px]">
                                    {/* Header part */}
                                    <div className="bg-gray-50 dark:bg-gray-800/80 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Edit Cover Letter</h2>

                                            {/* Action buttons - positioned on the right */}
                                            <div className="flex items-center gap-3">
                                                {/* Download Buttons Group */}
                                                <div className="flex items-center gap-2">
                                                    {/* Copy Button */}
                                                    <button
                                                        onClick={handleCopyCoverLetter}
                                                        className="group flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-all duration-200 font-medium text-xs shadow-sm hover:shadow-md"
                                                        title="Copy to clipboard"
                                                    >
                                                        {isClCopied ? (
                                                            <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-sm">check</span>
                                                        ) : (
                                                            <span className="material-symbols-outlined text-sm">content_copy</span>
                                                        )}
                                                        <span>{isClCopied ? 'Copied' : 'Copy'}</span>
                                                    </button>

                                                    {/* Download PDF Button */}
                                                    <button
                                                        onClick={finalPdfFiles.cl ? () => handleDownload(finalPdfFiles.cl) : handleGenerateCoverLetterPdf}
                                                        disabled={isRenderingCoverLetterPdf}
                                                        className="group flex items-center gap-2 px-3 py-2 bg-blue-600 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-700 active:bg-blue-800 dark:active:bg-blue-800 transition-all duration-200 font-medium text-xs shadow-sm hover:shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
                                                        title="Download as PDF"
                                                    >
                                                        {isRenderingCoverLetterPdf ? (
                                                            <Spinner size="sm" />
                                                        ) : (
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                            </svg>
                                                        )}
                                                        <span>PDF</span>
                                                    </button>

                                                    {/* Download Word Button */}
                                                    <button
                                                        onClick={handleDownloadWord}
                                                        className="group flex items-center gap-2 px-3 py-2 bg-blue-500 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-600 active:bg-blue-700 dark:active:bg-blue-700 transition-all duration-200 font-medium text-xs shadow-sm hover:shadow-md"
                                                        title="Download as Word Document"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                                        </svg>
                                                        <span>Word</span>
                                                    </button>

                                                    {/* Email Format Button */}
                                                    <button
                                                        onClick={() => setIsEmailModalOpen(true)}
                                                        className="group flex items-center gap-2 px-3 py-2 bg-emerald-500 dark:bg-emerald-600 text-white rounded-lg hover:bg-emerald-600 dark:hover:bg-emerald-700 active:bg-emerald-700 dark:active:bg-emerald-800 transition-all duration-200 font-medium text-xs shadow-sm hover:shadow-md"
                                                        title="View as Email Format"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">mail</span>
                                                        <span>Email</span>
                                                    </button>
                                                </div>

                                                {/* Delete Cover Letter Button */}
                                                <button
                                                    onClick={async () => {
                                                        if (window.confirm('Are you sure you want to delete this cover letter? You will need to regenerate it.')) {
                                                            if (jobId) {
                                                                try {
                                                                    // Optimistic update
                                                                    setJobApplication(prev => prev ? { ...prev, draftCoverLetterText: undefined } : null);
                                                                    setClCreationMode('ai');
                                                                    // Update backend
                                                                    await updateJob(jobId, { draftCoverLetterText: null });
                                                                } catch (err) {
                                                                    console.error('Failed to delete cover letter', err);
                                                                }
                                                            }
                                                        }
                                                    }}
                                                    className="group flex items-center gap-2.5 px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md"
                                                    title="Delete cover letter to regenerate with new instructions"
                                                >
                                                    <span className="material-symbols-outlined text-sm">delete</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm border border-blue-100 dark:border-blue-900/30">
                                            <span className="material-symbols-outlined text-base">info</span>
                                            <p>
                                                To regenerate the cover letter with different instructions, please delete the current cover letter using the trash icon above.
                                            </p>
                                        </div>

                                        {/* Cover Letter Library Panel */}
                                        {showClLibraryPanel && (
                                            <div className="mt-4 p-4 border border-purple-200 dark:border-purple-700/50 bg-purple-50 dark:bg-purple-900/20 rounded-xl space-y-4">
                                                <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-200 flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-base">folder_open</span>
                                                    Attach Cover Letter from Library
                                                </h3>

                                                {applyClError && (
                                                    <p className="text-xs text-red-600 dark:text-red-400">{applyClError}</p>
                                                )}

                                                {/* Select from existing base cover letters */}
                                                <div className="space-y-1">
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Select from library</label>
                                                    <select
                                                        value={selectedBaseClId}
                                                        onChange={(e) => { setSelectedBaseClId(e.target.value); setClUploadFile(null); }}
                                                        disabled={!!clUploadFile || isApplyingBaseCl}
                                                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 disabled:opacity-50"
                                                    >
                                                        <option value="">— choose a cover letter —</option>
                                                        {baseCoverLetters.map(cl => (
                                                            <option key={cl._id} value={cl._id}>{cl.displayName}</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* OR divider */}
                                                <div className="flex items-center gap-3">
                                                    <hr className="flex-1 border-gray-300 dark:border-gray-600" />
                                                    <span className="text-xs text-gray-400">OR</span>
                                                    <hr className="flex-1 border-gray-300 dark:border-gray-600" />
                                                </div>

                                                {/* Upload a file */}
                                                <div className="space-y-1">
                                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Upload a file (PDF / DOCX)</label>
                                                    <input
                                                        type="file"
                                                        accept=".pdf,.docx"
                                                        ref={clUploadFileRef}
                                                        className="hidden"
                                                        onChange={(e) => { const f = e.target.files?.[0] ?? null; setClUploadFile(f); if (f) setSelectedBaseClId(''); }}
                                                    />
                                                    {clUploadFile ? (
                                                        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm">
                                                            <span className="material-symbols-outlined text-base text-gray-500">description</span>
                                                            <span className="flex-1 truncate text-gray-800 dark:text-gray-200">{clUploadFile.name}</span>
                                                            <button onClick={() => { setClUploadFile(null); if (clUploadFileRef.current) clUploadFileRef.current.value = ''; }} className="text-gray-400 hover:text-red-500 transition-colors">
                                                                <span className="material-symbols-outlined text-base">close</span>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => clUploadFileRef.current?.click()}
                                                            disabled={isApplyingBaseCl}
                                                            className="flex items-center gap-2 px-3 py-2 text-sm border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors disabled:opacity-50"
                                                        >
                                                            <span className="material-symbols-outlined text-base">upload_file</span>
                                                            Choose file…
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Isolation notice */}
                                                <p className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1">
                                                    <span className="material-symbols-outlined text-base shrink-0">lock</span>
                                                    A full independent copy will be stored for this job. Editing or deleting the original will not affect this application.
                                                </p>

                                                {/* Actions */}
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={handleApplyBaseCoverLetter}
                                                        disabled={isApplyingBaseCl || (!selectedBaseClId && !clUploadFile)}
                                                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {isApplyingBaseCl ? <Spinner size="sm" /> : <span className="material-symbols-outlined text-base">attach_file</span>}
                                                        Attach to Job
                                                    </button>
                                                    <button
                                                        onClick={() => { setShowClLibraryPanel(false); setApplyClError(null); }}
                                                        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Editor part */}
                                    <div className="flex-1 overflow-hidden p-6 bg-gray-50/50 dark:bg-gray-900/20">
                                        {coverLetterError && (
                                            <div className="mb-4">
                                                <ErrorAlert
                                                    message={coverLetterError}
                                                    onDismiss={() => setCoverLetterError(null)}
                                                />
                                            </div>
                                        )}
                                        <CoverLetterEditor
                                            value={coverLetterText}
                                            onChange={handleCoverLetterChange}
                                            placeholder="Edit your cover letter here..."
                                            className="h-full"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div className="mb-8">
                                        <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Cover Letter</h2>
                                        <p className="text-gray-600 dark:text-gray-400 text-lg">
                                            How would you like to add a cover letter for this job?
                                        </p>
                                    </div>

                                    {/* ── Option picker ── */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                        {/* Option A – AI Generate */}
                                        <button
                                            type="button"
                                            onClick={() => setClCreationMode('ai')}
                                            className={`group relative flex flex-col items-start gap-3 rounded-2xl border-2 p-6 text-left transition-all focus:outline-none ${
                                                clCreationMode === 'ai'
                                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-md'
                                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-300 dark:hover:border-purple-700'
                                            }`}
                                        >
                                            <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${clCreationMode === 'ai' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                                                <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-gray-100">Generate with AI</p>
                                                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Let the AI write a tailored cover letter based on your CV and the job description.</p>
                                            </div>
                                            {clCreationMode === 'ai' && (
                                                <span className="absolute top-4 right-4 flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white">
                                                    <span className="material-symbols-outlined text-[14px]">check</span>
                                                </span>
                                            )}
                                        </button>

                                        {/* Option B – Upload / Library */}
                                        <button
                                            type="button"
                                            onClick={() => setClCreationMode('import')}
                                            className={`group relative flex flex-col items-start gap-3 rounded-2xl border-2 p-6 text-left transition-all focus:outline-none ${
                                                clCreationMode === 'import'
                                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-md'
                                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-300 dark:hover:border-purple-700'
                                            }`}
                                        >
                                            <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${clCreationMode === 'import' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                                                <span className="material-symbols-outlined text-[22px]">upload_file</span>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-gray-100">Use my own cover letter</p>
                                                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Upload a PDF / DOCX file or pick an existing one from your library.</p>
                                            </div>
                                            {clCreationMode === 'import' && (
                                                <span className="absolute top-4 right-4 flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white">
                                                    <span className="material-symbols-outlined text-[14px]">check</span>
                                                </span>
                                            )}
                                        </button>
                                    </div>

                                    {/* ── Option B form: Import / Upload ── */}
                                    {clCreationMode === 'import' && (
                                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 space-y-6">
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">folder_open</span>
                                                Attach Cover Letter
                                            </h3>

                                            {applyClError && (
                                                <ErrorAlert message={applyClError} onDismiss={() => setApplyClError(null)} />
                                            )}

                                            {/* Upload a file */}
                                            <div className="space-y-2">
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Upload a file <span className="text-gray-400 font-normal">(PDF or DOCX)</span></label>
                                                <input
                                                    type="file"
                                                    accept=".pdf,.docx"
                                                    ref={clUploadFileRef}
                                                    className="hidden"
                                                    onChange={(e) => { const f = e.target.files?.[0] ?? null; setClUploadFile(f); if (f) setSelectedBaseClId(''); }}
                                                />
                                                {clUploadFile ? (
                                                    <div className="flex items-center gap-3 px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/50 rounded-xl">
                                                        <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">description</span>
                                                        <span className="flex-1 truncate text-sm text-gray-800 dark:text-gray-200 font-medium">{clUploadFile.name}</span>
                                                        <button
                                                            onClick={() => { setClUploadFile(null); if (clUploadFileRef.current) clUploadFileRef.current.value = ''; }}
                                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-base">close</span>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => clUploadFileRef.current?.click()}
                                                        disabled={isApplyingBaseCl}
                                                        className="flex items-center gap-3 w-full px-4 py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all disabled:opacity-50"
                                                    >
                                                        <span className="material-symbols-outlined text-2xl">upload_file</span>
                                                        <span className="text-sm font-medium">Click to choose a PDF or DOCX file…</span>
                                                    </button>
                                                )}
                                            </div>

                                            {/* OR divider */}
                                            <div className="flex items-center gap-4">
                                                <hr className="flex-1 border-gray-200 dark:border-gray-700" />
                                                <span className="text-sm font-medium text-gray-400">OR</span>
                                                <hr className="flex-1 border-gray-200 dark:border-gray-700" />
                                            </div>

                                            {/* Select from library */}
                                            <div className="space-y-2">
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select from your library</label>
                                                <div className="relative">
                                                    <select
                                                        value={selectedBaseClId}
                                                        onChange={(e) => { setSelectedBaseClId(e.target.value); setClUploadFile(null); if (clUploadFileRef.current) clUploadFileRef.current.value = ''; }}
                                                        disabled={!!clUploadFile || isApplyingBaseCl}
                                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 appearance-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all disabled:opacity-50"
                                                    >
                                                        <option value="">— choose a saved cover letter —</option>
                                                        {baseCoverLetters.map(cl => (
                                                            <option key={cl._id} value={cl._id}>{cl.displayName}</option>
                                                        ))}
                                                    </select>
                                                    <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                                                        <span className="material-symbols-outlined">expand_more</span>
                                                    </div>
                                                </div>
                                                {baseCoverLetters.length === 0 && (
                                                    <p className="text-xs text-gray-400 dark:text-gray-500">No saved cover letters yet. You can upload a file above.</p>
                                                )}
                                            </div>

                                            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
                                                <span className="material-symbols-outlined text-base shrink-0">lock</span>
                                                A full independent copy will be stored for this job. Editing or deleting the original will not affect this application.
                                            </p>

                                            {/* Actions */}
                                            <div className="flex items-center justify-end gap-3 pt-2">
                                                <button
                                                    onClick={() => { setClCreationMode('ai'); setApplyClError(null); setClUploadFile(null); setSelectedBaseClId(''); }}
                                                    className="px-5 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium transition-colors"
                                                >
                                                    Switch to AI Generate
                                                </button>
                                                <button
                                                    onClick={handleApplyBaseCoverLetter}
                                                    disabled={isApplyingBaseCl || (!selectedBaseClId && !clUploadFile)}
                                                    className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isApplyingBaseCl ? <Spinner size="sm" /> : <span className="material-symbols-outlined text-base">attach_file</span>}
                                                    Attach to Job
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Option A form: AI Generate ── */}
                                    {clCreationMode === 'ai' && (
                                    <>
                                    {coverLetterError && (
                                        <div className="mb-6">
                                            <ErrorAlert
                                                message={coverLetterError}
                                                onDismiss={() => setCoverLetterError(null)}
                                            />
                                        </div>
                                    )}

                                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 space-y-8">
                                        {/* Target Role Section */}
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">work</span>
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Target Role</h3>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                        Job Title
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={tailoredJobTitle}
                                                        onChange={(e) => setTailoredJobTitle(e.target.value)}
                                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-gray-900 dark:text-gray-100"
                                                        placeholder="e.g. Senior Product Manager"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                        Company Name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={tailoredCompanyName}
                                                        onChange={(e) => setTailoredCompanyName(e.target.value)}
                                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-gray-900 dark:text-gray-100"
                                                        placeholder="e.g. Acme Innovations"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Job Description Section */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">description</span>
                                                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Job Description</h3>
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <textarea
                                                    value={tailoredJobDescription}
                                                    onChange={(e) => setTailoredJobDescription(e.target.value)}
                                                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-gray-900 dark:text-gray-100 min-h-[200px]"
                                                    placeholder="Paste the full job description here... Our AI will analyze key requirements."
                                                ></textarea>
                                            </div>
                                        </div>

                                        {/* Base Resume Selection */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">folder</span>
                                                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Base Resume</h3>
                                                </div>
                                                <div className="relative">
                                                    <select
                                                        value={selectedClBaseCvId}
                                                        onChange={(e) => handleSelectedClBaseCvIdChange(e.target.value)}
                                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 appearance-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                                                    >
                                                        {currentCvId && hasLocalCv && (
                                                            <option value="__job_cv__">📄 This Job's CV (attached)</option>
                                                        )}
                                                        {availableCvs.map(cv => (
                                                            <option key={cv.id} value={cv.id}>{cv.name}</option>
                                                        ))}
                                                        {availableCvs.length === 0 && <option value="master">Loading CVs...</option>}
                                                    </select>
                                                    <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                                                        <span className="material-symbols-outlined">expand_more</span>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    Select the CV version to use for this cover letter.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Custom Instructions */}
                                        <PromptChecklist
                                            type="coverLetter"
                                            onChange={setClCustomInstructions}
                                        />

                                        {/* Footer Actions */}
                                        <div className="mt-8 flex items-center justify-end gap-4">
                                            <button
                                                onClick={() => navigate('/dashboard')}
                                                className="px-6 py-2.5 text-gray-600 dark:text-gray-400 font-medium hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleGenerateCoverLetter}
                                                disabled={isGeneratingCoverLetter || !hasMasterCv || !tailoredJobDescription}
                                                className="group relative flex items-center gap-2 px-8 py-3 bg-purple-600 dark:bg-purple-600 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-700 active:bg-purple-800 transition-all font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                            >
                                                {isGeneratingCoverLetter ? (
                                                    <>
                                                        <Spinner size="sm" className="text-white" />
                                                        <span>Generating...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="material-symbols-outlined text-white">auto_awesome</span>
                                                        <span>Generate Cover Letter</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {!hasMasterCv && (
                                            <div className="mt-4 text-center">
                                                <p className="text-sm text-amber-600 dark:text-amber-400">
                                                    ⚠️ You need to upload a CV first. Go to <Link to="/manage-cv" className="underline font-medium">CV Management</Link> to upload it.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tab 4: CV */}
                    {activeTab === 'cv' && (
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
                                    templateId={selectedTemplate}
                                    onTemplateChange={setSelectedTemplate}
                                    onImproveSection={handleImproveSection}
                                    improvingSections={improvingSections}
                                    onDelete={async () => {
                                        if (window.confirm('Are you sure you want to delete this CV? You will need to regenerate it.')) {
                                            if (currentCvId) {
                                                try {
                                                    await deleteCv(currentCvId);
                                                    setCvData({ basics: {} });
                                                    setCurrentCvId(null);
                                                    setJobApplication(prev => prev ? { ...prev, draftCvJson: undefined } : null);
                                                    showToast('CV deleted successfully', 'success');
                                                } catch (err: any) {
                                                    console.error('Failed to delete CV', err);
                                                    showToast(`Failed to delete CV: ${err.message}`, 'error');
                                                }
                                            } else if (jobId && jobApplication?.draftCvJson) {
                                                try {
                                                    await updateJob(jobId, { draftCvJson: null });
                                                    setCvData({ basics: {} });
                                                    setJobApplication(prev => prev ? { ...prev, draftCvJson: undefined } : null);
                                                    showToast('CV deleted successfully', 'success');
                                                } catch (err: any) {
                                                    console.error('Failed to delete legacy CV', err);
                                                    showToast(`Failed to delete CV: ${err.message}`, 'error');
                                                }
                                            }
                                        }
                                    }}
                                >
                                    {/* Tailoring Changes Panel - Show what AI changed */}
                                    {tailoringChanges && tailoringChanges.length > 0 && (
                                        <div className="mb-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                            <details className="group">
                                                <summary className="flex items-center justify-between cursor-pointer p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-transparent group-open:border-slate-100 dark:group-open:border-slate-800">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm">
                                                            <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                                                        </div>
                                                        <div>
                                                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                                                Tailoring Changes
                                                            </h3>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                                                {tailoringChanges.length} modification{tailoringChanges.length !== 1 ? 's' : ''} recorded
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <span className="text-slate-400 group-open:rotate-180 transition-transform duration-200">
                                                        <span className="material-symbols-outlined text-[20px]">expand_more</span>
                                                    </span>
                                                </summary>
                                                <div className="p-4 pt-0 divide-y divide-slate-100 dark:divide-slate-800">
                                                    {tailoringChanges.map((change, index) => (
                                                        <div
                                                            key={index}
                                                            className="py-4 first:pt-2 last:pb-2"
                                                        >
                                                            <div className="flex items-start gap-4">
                                                                <span className="flex-shrink-0 mt-0.5 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                                                    {change.section}
                                                                </span>
                                                                <div className="flex-1 min-w-0 space-y-1.5">
                                                                    <p className="text-sm text-slate-800 dark:text-slate-200 leading-snug">
                                                                        {change.description}
                                                                    </p>
                                                                    <p className="text-xs text-slate-500 dark:text-slate-500 flex items-center gap-2 italic">
                                                                        <span className="w-1 h-1 rounded-full bg-indigo-400 dark:bg-indigo-500"></span>
                                                                        {change.reason}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </details>
                                        </div>
                                    )}

                                    {/* ATS Analysis Card */}
                                    <div className="mb-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                        <details className="group">
                                            <summary className="flex items-center justify-between cursor-pointer p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-transparent group-open:border-slate-100 dark:group-open:border-slate-800">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 dark:bg-blue-500 text-white shadow-sm">
                                                        <span className="material-symbols-outlined text-[20px]">troubleshoot</span>
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">ATS Analysis</h3>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">
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
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                            (atsScores.score ?? 0) >= 80 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                            : (atsScores.score ?? 0) >= 60 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                                        }`}>
                                                            {Math.round(atsScores.score ?? 0)}%
                                                        </span>
                                                    )}
                                                    {atsScores && (
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); handleScanAts(); }}
                                                            className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 transition-all"
                                                            title="Re-scan ATS"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                            </svg>
                                                            Re-scan
                                                        </button>
                                                    )}
                                                    <span className="text-slate-400 group-open:rotate-180 transition-transform duration-200">
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

                                    {/* Analysis error */}
                                    {analyzeError && (
                                        <div className="mb-4">
                                            <ErrorAlert
                                                message={`Analysis Error: ${analyzeError}`}
                                                onDismiss={() => setAnalyzeError(null)}
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

                                    {/* ── Option picker ── */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                        {/* Option A – AI Generate */}
                                        <button
                                            type="button"
                                            onClick={() => setCvCreationMode('ai')}
                                            className={`group relative flex flex-col items-start gap-3 rounded-2xl border-2 p-6 text-left transition-all focus:outline-none ${
                                                cvCreationMode === 'ai'
                                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-md'
                                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-300 dark:hover:border-purple-700'
                                            }`}
                                        >
                                            <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${cvCreationMode === 'ai' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                                                <span className="material-symbols-outlined text-[22px]">auto_awesome</span>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-gray-100">Generate with AI</p>
                                                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Let the AI tailor your CV to the job description automatically.</p>
                                            </div>
                                            {cvCreationMode === 'ai' && (
                                                <span className="absolute top-4 right-4 flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white">
                                                    <span className="material-symbols-outlined text-[14px]">check</span>
                                                </span>
                                            )}
                                        </button>

                                        {/* Option B – Upload / Library */}
                                        <button
                                            type="button"
                                            onClick={() => setCvCreationMode('import')}
                                            className={`group relative flex flex-col items-start gap-3 rounded-2xl border-2 p-6 text-left transition-all focus:outline-none ${
                                                cvCreationMode === 'import'
                                                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 shadow-md'
                                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-purple-300 dark:hover:border-purple-700'
                                            }`}
                                        >
                                            <div className={`flex items-center justify-center w-11 h-11 rounded-xl ${cvCreationMode === 'import' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
                                                <span className="material-symbols-outlined text-[22px]">upload_file</span>
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900 dark:text-gray-100">Use my own CV</p>
                                                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Upload a PDF / DOCX file or pick an existing one from your library.</p>
                                            </div>
                                            {cvCreationMode === 'import' && (
                                                <span className="absolute top-4 right-4 flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white">
                                                    <span className="material-symbols-outlined text-[14px]">check</span>
                                                </span>
                                            )}
                                        </button>
                                    </div>

                                    {/* ── Option B form: Import / Upload ── */}
                                    {cvCreationMode === 'import' && (
                                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 space-y-6">
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">folder_open</span>
                                                Attach CV
                                            </h3>

                                            {applyCvError && (
                                                <ErrorAlert message={applyCvError} onDismiss={() => setApplyCvError(null)} />
                                            )}

                                            {/* Upload a file */}
                                            <div className="space-y-2">
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Upload a file <span className="text-gray-400 font-normal">(PDF or DOCX)</span></label>
                                                <input
                                                    type="file"
                                                    accept=".pdf,.docx"
                                                    ref={cvImportFileRef}
                                                    className="hidden"
                                                    onChange={(e) => { const f = e.target.files?.[0] ?? null; setCvImportFile(f); if (f) setSelectedBaseCvIdForImport(''); }}
                                                />
                                                {cvImportFile ? (
                                                    <div className="flex items-center gap-3 px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/50 rounded-xl">
                                                        <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">description</span>
                                                        <span className="flex-1 truncate text-sm text-gray-800 dark:text-gray-200 font-medium">{cvImportFile.name}</span>
                                                        <button
                                                            onClick={() => { setCvImportFile(null); if (cvImportFileRef.current) cvImportFileRef.current.value = ''; }}
                                                            className="text-gray-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-base">close</span>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => cvImportFileRef.current?.click()}
                                                        disabled={isApplyingBaseCv}
                                                        className="flex items-center gap-3 w-full px-4 py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all disabled:opacity-50"
                                                    >
                                                        <span className="material-symbols-outlined text-2xl">upload_file</span>
                                                        <span className="text-sm font-medium">Click to choose a PDF or DOCX file…</span>
                                                    </button>
                                                )}
                                            </div>

                                            {/* OR divider */}
                                            <div className="flex items-center gap-4">
                                                <hr className="flex-1 border-gray-200 dark:border-gray-700" />
                                                <span className="text-sm font-medium text-gray-400">OR</span>
                                                <hr className="flex-1 border-gray-200 dark:border-gray-700" />
                                            </div>

                                            {/* Select from library */}
                                            <div className="space-y-2">
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Select from your library</label>
                                                <div className="relative">
                                                    <select
                                                        value={selectedBaseCvIdForImport}
                                                        onChange={(e) => { setSelectedBaseCvIdForImport(e.target.value); setCvImportFile(null); if (cvImportFileRef.current) cvImportFileRef.current.value = ''; }}
                                                        disabled={!!cvImportFile || isApplyingBaseCv}
                                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 appearance-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all disabled:opacity-50"
                                                    >
                                                        <option value="">— choose a saved CV —</option>
                                                        {availableCvs.map(cv => (
                                                            <option key={cv.id} value={cv.id}>{cv.name}</option>
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

                                            {/* Actions */}
                                            <div className="flex items-center justify-end gap-3 pt-2">
                                                <button
                                                    onClick={() => { setCvCreationMode('ai'); setApplyCvError(null); setCvImportFile(null); setSelectedBaseCvIdForImport(''); }}
                                                    className="px-5 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 font-medium transition-colors"
                                                >
                                                    Switch to AI Generate
                                                </button>
                                                <button
                                                    onClick={handleApplyBaseCv}
                                                    disabled={isApplyingBaseCv || (!selectedBaseCvIdForImport && !cvImportFile)}
                                                    className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isApplyingBaseCv ? <Spinner size="sm" /> : <span className="material-symbols-outlined text-base">attach_file</span>}
                                                    Attach to Job
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Option A form: AI Generate ── */}
                                    {cvCreationMode === 'ai' && (
                                    <>
                                    {generateCvError && (
                                        <div className="mb-6">
                                            <ErrorAlert
                                                message={generateCvError}
                                                onDismiss={() => setGenerateCvError(null)}
                                            />
                                        </div>
                                    )}

                                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 space-y-8">
                                        {/* Target Role Section */}
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">work</span>
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Target Role</h3>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-2">
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                        Job Title
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={tailoredJobTitle}
                                                        onChange={(e) => setTailoredJobTitle(e.target.value)}
                                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-gray-900 dark:text-gray-100"
                                                        placeholder="e.g. Senior Product Manager"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                        Company Name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={tailoredCompanyName}
                                                        onChange={(e) => setTailoredCompanyName(e.target.value)}
                                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-gray-900 dark:text-gray-100"
                                                        placeholder="e.g. Acme Innovations"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Job Description Section */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">description</span>
                                                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Job Description</h3>
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <textarea
                                                    value={tailoredJobDescription}
                                                    onChange={(e) => setTailoredJobDescription(e.target.value)}
                                                    className="w-full px-4 py-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-gray-900 dark:text-gray-100 min-h-[200px]"
                                                    placeholder="Paste the full job description here... Our AI will analyze key requirements and skills."
                                                ></textarea>
                                            </div>
                                        </div>

                                        <div className="pt-4">
                                            {/* Base Resume - Now Full Width or in a grid if we add more items later, currently logic kept it in grid but requested full width for prompt means prompt moves out */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="material-symbols-outlined text-purple-600 dark:text-purple-400">folder</span>
                                                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Base Resume</h3>
                                                    </div>
                                                    <div className="relative">
                                                        <select
                                                            value={selectedBaseCvId}
                                                            onChange={(e) => handleSelectedBaseCvIdChange(e.target.value)}
                                                            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 appearance-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                                                        >
                                                            {availableCvs.map(cv => (
                                                                <option key={cv.id} value={cv.id}>{cv.name}</option>
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

                                            {/* Custom Instructions - Full Width */}
                                            <PromptChecklist
                                                type="cv"
                                                onChange={setCustomInstructions}
                                            />
                                        </div>
                                    </div>

                                    {/* Footer Actions */}
                                    <div className="mt-8 flex items-center justify-end gap-4">
                                        <button
                                            onClick={() => navigate('/dashboard')}
                                            className="px-6 py-2.5 text-gray-600 dark:text-gray-400 font-medium hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleGenerateSpecificCv}
                                            disabled={isGeneratingCv || !hasMasterCv || !tailoredJobDescription}
                                            className="group relative flex items-center gap-2 px-8 py-3 bg-purple-600 dark:bg-purple-600 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-700 active:bg-purple-800 transition-all font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
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
                                        </button>
                                    </div>
                                    </>)}
                                </div>
                            )}
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
                                <div className="flex justify-center mb-8">
                                    <div className="relative">
                                        <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center animate-pulse">
                                            <span className="material-symbols-outlined text-4xl text-purple-600 dark:text-purple-400">auto_awesome</span>
                                        </div>
                                        <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
                                    </div>
                                </div>

                                <h3 className="text-xl font-bold text-center text-gray-900 dark:text-gray-100 mb-2">
                                    {generationStep === 'analyzing' && 'Analyzing Job Requirements...'}
                                    {generationStep === 'matching' && 'Matching Skills & Experience...'}
                                    {generationStep === 'tailoring' && 'Tailoring Your Resume...'}
                                    {generationStep === 'finalizing' && 'Finalizing Document...'}
                                </h3>

                                <p className="text-center text-gray-500 dark:text-gray-400 mb-8 text-sm">
                                    {generationStep === 'analyzing' && 'Identifying key keywords and requirements from the job description.'}
                                    {generationStep === 'matching' && 'Finding the best projects and experiences from your history.'}
                                    {generationStep === 'tailoring' && 'Rewriting descriptions to highlight relevance and impact.'}
                                    {generationStep === 'finalizing' && 'Formatting your new CV for maximum impact.'}
                                </p>

                                {/* Progress Steps */}
                                <div className="space-y-4">
                                    <div className="relative pt-1">
                                        <div className="flex mb-2 items-center justify-between">
                                            <div className="text-right">
                                                <span className="text-xs font-semibold inline-block text-purple-600 dark:text-purple-400">
                                                    {Math.round(generationProgress)}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-purple-100 dark:bg-gray-700">
                                            <div style={{ width: `${generationProgress}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-purple-600 transition-all duration-500 ease-out"></div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-medium text-gray-400">
                                        <div className={generationStep === 'analyzing' || generationStep === 'matching' || generationStep === 'tailoring' || generationStep === 'finalizing' ? "text-purple-600 dark:text-purple-400" : ""}>Analyze</div>
                                        <div className={generationStep === 'matching' || generationStep === 'tailoring' || generationStep === 'finalizing' ? "text-purple-600 dark:text-purple-400" : ""}>Match</div>
                                        <div className={generationStep === 'tailoring' || generationStep === 'finalizing' ? "text-purple-600 dark:text-purple-400" : ""}>Tailor</div>
                                        <div className={generationStep === 'finalizing' ? "text-purple-600 dark:text-purple-400" : ""}>Finalize</div>
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
                            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-2">
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
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        title={!jobApplication?.jobDescriptionText ? 'Job description required' : 'Refresh analysis'}
                                    >
                                        {isRefreshingRecommendation ? (
                                            <Spinner size="sm" />
                                        ) : (
                                            <span className="material-symbols-outlined text-sm">refresh</span>
                                        )}
                                        <span>Refresh</span>
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
                                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primaryLight disabled:opacity-50 transition-colors"
                                    >
                                        {isRefreshingRecommendation ? (
                                            <Spinner size="sm" />
                                        ) : (
                                            <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                        )}
                                        <span>Generate Recommendation</span>
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
        </div >
    );
};

export default ReviewFinalizePage;
