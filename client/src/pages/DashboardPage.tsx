// client/src/pages/DashboardPage.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  getJobs,
  createJob,
  deleteJob,
  updateJob,
  JobApplication,
  CreateJobPayload,
  createJobFromTextApi,
  CreateJobFromTextOptions,
  checkJobUrlDuplicateApi,
  DuplicateJobError,
} from '../services/jobApi';
import { getCvBranches, CVDocument, uploadCvForJob } from '../services/cvApi';
import { parseMultipleUrls, normalizeMultipleUrls } from '../lib/utils';

import linkedinLogo from '../assets/linkedin-svgrepo-com.svg';
import indeedLogo from '../assets/indeed-svgrepo-com.svg';
import xingLogo from '../assets/xing-logo-svgrepo-com.svg';
import stepstoneLogo from '../assets/stepstone-svgrepo-com.svg';
import Spinner from '../components/common/Spinner';
import SimpleLoader from '../components/common/SimpleLoader';
import Toast from '../components/common/Toast';
import { TableOrCards, ColumnDef, CardConfig } from '../components/common/TableOrCards';
import DuplicateJobWarningModal from '../components/jobs/DuplicateJobWarningModal';
import TourBanner from '../components/onboarding/TourBanner';
import { usePageTour } from '../hooks/usePageTour';
import { MOCK_JOB } from '../data/mockTourData';

type JobPlatform = 'linkedin' | 'indeed' | 'xing' | 'stepstone' | null;

const getJobPlatform = (url: string): JobPlatform => {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('linkedin.com')) return 'linkedin';
  if (lowerUrl.includes('indeed.com') || lowerUrl.includes('indeed.')) return 'indeed';
  if (lowerUrl.includes('xing.com') || lowerUrl.includes('xing.')) return 'xing';
  if (lowerUrl.includes('stepstone.de') || lowerUrl.includes('stepstone.com') || lowerUrl.includes('stepstone.')) return 'stepstone';
  return null;
};

const PlatformIcon: React.FC<{ platform: JobPlatform; className?: string }> = ({ platform, className = '' }) => {
  if (platform === 'linkedin') {
    return <img src={linkedinLogo} className={className} alt="LinkedIn" />;
  }
  if (platform === 'indeed') {
    return <img src={indeedLogo} className={className} alt="Indeed" />;
  }
  if (platform === 'xing') {
    return <img src={xingLogo} className={className} alt="Xing" />;
  }
  if (platform === 'stepstone') {
    return <img src={stepstoneLogo} className="h-5 w-auto" alt="Stepstone" />;
  }
  return null;
};

// Define type for the form data used in the Add modal
type JobFormData = Partial<Omit<JobApplication, '_id' | 'updatedAt' | 'generationStatus' | 'generatedCvFilename' | 'generatedCoverLetterFilename'>>;

// Explicitly list sortable keys for type safety
type SortableJobKeys = 'jobTitle' | 'companyName' | 'status' | 'createdAt' | 'jobType' | 'salary';

// Job type options for dropdown
const JOB_TYPE_OPTIONS = [
  { value: '', label: 'Auto-detect (AI will determine)' },
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'working-student', label: 'Working Student' },
  { value: 'internship', label: 'Internship' },
  { value: 'contract', label: 'Contract' },
  { value: 'freelance', label: 'Freelance' },
];

// Status options for filter dropdown
const STATUS_OPTIONS = [
  { value: 'Not Applied', label: 'Not Applied', icon: '🕗' },
  { value: 'Applied', label: 'Applied', icon: '📤' },
  { value: 'Interview', label: 'Interview', icon: '💬' },
  { value: 'Assessment', label: 'Assessment', icon: '📝' },
  { value: 'Offer', label: 'Offer', icon: '🎉' },
  { value: 'Rejected', label: 'Rejected', icon: '❌' },
];

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  // --- Core State ---
  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // --- CV State ---
  const [cvs, setCvs] = useState<CVDocument[]>([]);
  const [isLoadingCvs, setIsLoadingCvs] = useState<boolean>(false);

  // --- Modal & Form State ---
  const [modalMode, setModalMode] = useState<'add' | null>(null);
  const [formData, setFormData] = useState<JobFormData>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // --- Create from Text State ---
  const [jobTextInput, setJobTextInput] = useState<string>('');
  const [isCreatingFromText, setIsCreatingFromText] = useState<boolean>(false);
  const [createFromTextError, setCreateFromTextError] = useState<string | null>(null);

  // --- Pre-Extraction Form State ---
  const [selectedCvBranchId, setSelectedCvBranchId] = useState<string | null>(() => {
    // Initialize from localStorage for persistence
    try {
      const saved = localStorage.getItem('dashboard_selectedCvBranchId');
      return saved || null;
    } catch (e) {
      console.error("Error reading selectedCvBranchId from localStorage", e);
      return null;
    }
  });
  const [preExtractionJobUrl, setPreExtractionJobUrl] = useState<string>('');
  const [preExtractionStatus, setPreExtractionStatus] = useState<string>(() => {
    // Initialize from localStorage for persistence
    try {
      const saved = localStorage.getItem('dashboard_preExtractionStatus');
      return saved || 'Not Applied';
    } catch (e) {
      console.error("Error reading preExtractionStatus from localStorage", e);
      return 'Not Applied';
    }
  });
  const [preExtractionJobType, setPreExtractionJobType] = useState<string>(() => {
    // Initialize from localStorage for persistence
    try {
      const saved = localStorage.getItem('dashboard_preExtractionJobType');
      return saved || '';
    } catch (e) {
      console.error("Error reading preExtractionJobType from localStorage", e);
      return '';
    }
  });

  // --- CV File Upload for New Job ---
  // Users can either select an existing CV branch OR upload a new file.
  // If a file is provided it takes precedence and is attached after job creation.
  const [preExtractionCvFile, setPreExtractionCvFile] = useState<File | null>(null);
  const cvFileInputRef = useRef<HTMLInputElement>(null);

  // --- Filtering & Sorting State ---
  const [filterText, setFilterText] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterFavorite, setFilterFavorite] = useState<boolean>(false);
  const [filterHasNotes, setFilterHasNotes] = useState<boolean>(false);
  const [filterJobType, setFilterJobType] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortableJobKeys>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // --- Toast State ---
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showOnlyDueFollowUps, setShowOnlyDueFollowUps] = useState<boolean>(false);

  // --- Add Job Form Collapse State (mobile only) ---
  const [addJobFormCollapsed, setAddJobFormCollapsed] = useState<boolean>(true);

  const getRecipientEmail = (job: JobApplication): string | null => {
    const direct = job.contactEmail?.trim();
    if (direct) return direct;

    const legacy = job.contact?.trim();
    if (!legacy) return null;

    const match = legacy.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match?.[0] ?? null;
  };

  const isOlderThanTwoWeeks = (job: JobApplication): boolean => {
    const anchor = job.dateApplied || job.createdAt;
    if (!anchor) return false;

    const appliedAt = new Date(anchor).getTime();
    if (Number.isNaN(appliedAt)) return false;

    const daysElapsed = Math.floor((Date.now() - appliedAt) / (1000 * 60 * 60 * 24));
    return daysElapsed > 14;
  };

  const favoriteCount = useMemo(() => jobs.filter((job) => job.isFavorite === true).length, [jobs]);
  const notesCount = useMemo(() => jobs.filter((job) => !!job.notes && job.notes.trim().length > 0).length, [jobs]);
  const needsFollowUpJobIds = useMemo(
    () => jobs
      .filter((job) => job.status === 'Applied' && Boolean(getRecipientEmail(job)) && isOlderThanTwoWeeks(job))
      .map((job) => job._id),
    [jobs]
  );
  const needsFollowUpCount = needsFollowUpJobIds.length;
  const needsFollowUpJobIdSet = useMemo(() => new Set(needsFollowUpJobIds), [needsFollowUpJobIds]);



  // --- Delete Confirmation Modal State ---
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ isOpen: boolean; jobId: string | null; jobTitle: string }>({
    isOpen: false,
    jobId: null,
    jobTitle: ''
  });

  // --- Duplicate Warning Modal State ---
  type DuplicateEntry = DuplicateJobError['duplicates'][number];
  const [duplicateWarning, setDuplicateWarning] = useState<{
    isOpen: boolean;
    duplicates: DuplicateEntry[];
    pendingPayload: { text: string; options: CreateJobFromTextOptions } | null;
  }>({
    isOpen: false,
    duplicates: [],
    pendingPayload: null,
  });


  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState<number>(1);



  const { showTour: showJobTour, dismiss: dismissJobTour } = usePageTour('dashboard');

  // --- useEffect: Fetch initial job data ---
  useEffect(() => {
    const fetchJobs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedJobs = await getJobs();
        setJobs(fetchedJobs);
      } catch (err: any) {
        console.error("Failed to fetch jobs:", err);
        setError(err.message || "Failed to load job applications.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchJobs();
  }, []);

  useEffect(() => {
    if (showOnlyDueFollowUps && needsFollowUpCount === 0) {
      setShowOnlyDueFollowUps(false);
    }
  }, [showOnlyDueFollowUps, needsFollowUpCount]);

  // --- useEffect: Fetch CV branches ---
  useEffect(() => {
    const fetchCvs = async () => {
      setIsLoadingCvs(true);
      try {
        const fetchedCvs = await getCvBranches();
        setCvs(fetchedCvs.branches);
      } catch (err: any) {
        console.error("Failed to fetch CVs:", err);
        // Don't set error state for CVs as it's not critical for job creation
      } finally {
        setIsLoadingCvs(false);
      }
    };
    fetchCvs();
  }, []);

  // --- useEffect: Persist selected CV branch to localStorage ---
  useEffect(() => {
    try {
      if (selectedCvBranchId) {
        localStorage.setItem('dashboard_selectedCvBranchId', selectedCvBranchId);
      } else {
        localStorage.removeItem('dashboard_selectedCvBranchId');
      }
    } catch (e) {
      console.error("Error saving selectedCvBranchId to localStorage", e);
    }
  }, [selectedCvBranchId]);

  // --- useEffect: Persist preExtractionStatus to localStorage ---
  useEffect(() => {
    try {
      localStorage.setItem('dashboard_preExtractionStatus', preExtractionStatus);
    } catch (e) {
      console.error("Error saving preExtractionStatus to localStorage", e);
    }
  }, [preExtractionStatus]);

  // --- useEffect: Persist preExtractionJobType to localStorage ---
  useEffect(() => {
    try {
      if (preExtractionJobType) {
        localStorage.setItem('dashboard_preExtractionJobType', preExtractionJobType);
      } else {
        localStorage.removeItem('dashboard_preExtractionJobType');
      }
    } catch (e) {
      console.error("Error saving preExtractionJobType to localStorage", e);
    }
  }, [preExtractionJobType]);


  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterText, filterStatus, filterFavorite, filterHasNotes, filterJobType, showOnlyDueFollowUps]);

  // --- Derived State: Filtered and Sorted Jobs ---
  const displayedJobs = useMemo(() => {
    let filteredJobs = [...jobs];

    // Apply Text Filter
    if (filterText) {
      const lowerCaseFilter = filterText.toLowerCase();
      filteredJobs = filteredJobs.filter(job =>
        job.jobTitle.toLowerCase().includes(lowerCaseFilter) ||
        job.companyName.toLowerCase().includes(lowerCaseFilter) ||
        (job.hiringManagerName && job.hiringManagerName.toLowerCase().includes(lowerCaseFilter))
      );
    }

    // Apply Status Filter
    if (filterStatus) {
      filteredJobs = filteredJobs.filter(job => job.status === filterStatus);
    }

    // Apply Job Type Filter
    if (filterJobType) {
      filteredJobs = filteredJobs.filter(job => job.jobType === filterJobType);
    }

    // Apply Favorite Filter
    if (filterFavorite) {
      filteredJobs = filteredJobs.filter(job => job.isFavorite === true);
    }

    // Apply Has Notes Filter
    if (filterHasNotes) {
      filteredJobs = filteredJobs.filter(job => !!job.notes && job.notes.trim().length > 0);
    }

    // Apply Follow-up Due Filter
    if (showOnlyDueFollowUps) {
      filteredJobs = filteredJobs.filter(job => needsFollowUpJobIdSet.has(job._id));
    }

    // Apply Sorting
    if (sortKey) {
      filteredJobs.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        if (sortKey === 'jobType') {
          aValue = a.jobType || '';
          bValue = b.jobType || '';
        } else if (sortKey === 'salary') {
          // Extract numeric salary for comparison
          const extractSalary = (salary: string | undefined): number => {
            if (!salary) return 0;
            // Try to extract numbers from the salary string (e.g., "€50,000" -> 50000)
            const numbers = salary.replace(/[^0-9]/g, '');
            return numbers ? parseInt(numbers, 10) : 0;
          };
          const aSalary = a.salary || a.extractedData?.salaryRaw || a.extractedData?.estimatedSalary;
          const bSalary = b.salary || b.extractedData?.salaryRaw || b.extractedData?.estimatedSalary;
          aValue = extractSalary(aSalary);
          bValue = extractSalary(bSalary);
        } else {
          aValue = a[sortKey as keyof JobApplication];
          bValue = b[sortKey as keyof JobApplication];
        }

        let comparison = 0;

        if (sortKey === 'createdAt') {
          const dateA = new Date(aValue).getTime();
          const dateB = new Date(bValue).getTime();
          comparison = (isNaN(dateA) ? 0 : dateA) - (isNaN(dateB) ? 0 : dateB);
        } else if (sortKey === 'salary') {
          // Numeric comparison for salary
          comparison = (aValue || 0) - (bValue || 0);
        } else if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else {
          const valA = aValue ?? '';
          const valB = bValue ?? '';
          if (valA < valB) comparison = -1;
          if (valA > valB) comparison = 1;
        }

        return sortDirection === 'asc' ? comparison : comparison * -1;
      });
    }

    return filteredJobs;
  }, [jobs, filterText, filterStatus, filterFavorite, filterHasNotes, filterJobType, showOnlyDueFollowUps, needsFollowUpJobIdSet, sortKey, sortDirection]);

  const handleToggleDueFollowUpFilter = () => {
    setShowOnlyDueFollowUps(prev => !prev);
  };

  // --- Modal Event Handlers ---
  const handleOpenAddModal = () => {
    const firstCv = cvs[0];
    setFormData({
      jobTitle: '',
      companyName: '',
      status: (preExtractionStatus as JobApplication['status']) || 'Not Applied',
      jobUrl: '',
      notes: '',
      language: 'en',
      baseCvId: firstCv?._id || null
    });
    setModalError(null);
    setModalMode('add');
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setModalMode(null);
    setFormData({});
    setModalError(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Keep selected status as default for future jobs across the dashboard flows.
    if (name === 'status' && statusOptions.includes(value as JobApplication['status'])) {
      setPreExtractionStatus(value);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setModalError(null);
    if (!formData.jobTitle || !formData.companyName) {
      setModalError("Job Title and Company Name are required.");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = formData as CreateJobPayload;
      const createdJob = await createJob(payload);
      setJobs(prevJobs => [createdJob, ...prevJobs]);
      handleCloseModal();
      setToast({ message: 'Job application added successfully!', type: 'success' });
    } catch (err: any) {
      console.error('Failed to add job:', err);
      setModalError(err.message || 'Failed to add job.');
      setToast({ message: err.message || 'Failed to add job.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Delete Handler ---
  const handleDeleteClick = (job: JobApplication, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent row click navigation
    setDeleteConfirmModal({
      isOpen: true,
      jobId: job._id,
      jobTitle: `${job.jobTitle} at ${job.companyName}`
    });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmModal.jobId) return;
    const jobId = deleteConfirmModal.jobId;
    setError(null);
    try {
      await deleteJob(jobId);
      setJobs(prevJobs => prevJobs.filter(job => job._id !== jobId));
      setDeleteConfirmModal({ isOpen: false, jobId: null, jobTitle: '' });
      setToast({ message: 'Job application deleted successfully!', type: 'success' });
    } catch (err: any) {
      console.error(`Failed to delete job ${jobId}:`, err);
      setError(err.message || `Failed to delete job application.`);
      setToast({ message: err.message || 'Failed to delete job application.', type: 'error' });
      setDeleteConfirmModal({ isOpen: false, jobId: null, jobTitle: '' });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmModal({ isOpen: false, jobId: null, jobTitle: '' });
  };

  // --- Toggle Favorite Handler ---
  const handleToggleFavorite = async (job: JobApplication, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent row click navigation
    try {
      const newFavoriteStatus = !job.isFavorite;
      const updatedJob = await updateJob(job._id, { isFavorite: newFavoriteStatus });
      setJobs(prevJobs => prevJobs.map(j => j._id === job._id ? updatedJob : j));
      setToast({
        message: newFavoriteStatus ? 'Job added to favorites!' : 'Job removed from favorites',
        type: 'success'
      });
    } catch (err: any) {
      console.error('Failed to toggle favorite:', err);
      setToast({ message: err.message || 'Failed to update favorite status', type: 'error' });
    }
  };


  // Helper to check if error is about missing API key
  const isApiKeyError = (errorMessage: string): boolean => {
    return errorMessage.toLowerCase().includes('api key') ||
      errorMessage.toLowerCase().includes('gemini') ||
      errorMessage.toLowerCase().includes('apify');
  };

  // --- Create from Text Handler ---
  const handleCreateFromTextSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!jobTextInput || jobTextInput.trim().length < 50) {
      setCreateFromTextError('Please paste more job description text (at least 50 characters).');
      return;
    }
    setIsCreatingFromText(true);
    setCreateFromTextError(null);
    setError(null);

    const options: CreateJobFromTextOptions = {
      baseCvId: selectedCvBranchId,
      jobUrl: preExtractionJobUrl || undefined,
      status: preExtractionStatus as JobApplication['status'],
      jobType: preExtractionJobType as JobApplication['jobType'] || undefined,
    };

    // --- URL pre-check (before calling AI) ---
    if (preExtractionJobUrl && preExtractionJobUrl.trim()) {
      const { duplicates } = await checkJobUrlDuplicateApi(preExtractionJobUrl.trim());
      if (duplicates.length > 0) {
        setIsCreatingFromText(false);
        setDuplicateWarning({ isOpen: true, duplicates, pendingPayload: { text: jobTextInput, options } });
        return;
      }
    }

    await doCreateFromText(jobTextInput, options);
  };

  // Performs the actual extraction + creation (called directly or after "Add Anyway")
  const doCreateFromText = async (text: string, options: CreateJobFromTextOptions) => {
    setIsCreatingFromText(true);
    setCreateFromTextError(null);
    try {
      const newJob = await createJobFromTextApi(text, options);

      // If the user selected a CV file to upload instead of a base CV, do it now
      if (preExtractionCvFile) {
        try {
          await uploadCvForJob(newJob._id, preExtractionCvFile);
        } catch (cvErr: any) {
          console.error('CV file upload failed after job creation:', cvErr);
          // Non-fatal: show warning but continue
          setToast({ message: `Job created but CV upload failed: ${cvErr.message || 'Unknown error'}`, type: 'error' });
        } finally {
          setPreExtractionCvFile(null);
          if (cvFileInputRef.current) cvFileInputRef.current.value = '';
        }
      }

      setJobs(prevJobs => [newJob, ...prevJobs]);
      setJobTextInput('');
      setPreExtractionJobUrl('');
      setPreExtractionJobType('');
      setDuplicateWarning({ isOpen: false, duplicates: [], pendingPayload: null });
      setToast({ message: 'Job application created successfully!', type: 'success' });
      navigate(`/jobs/${newJob._id}/review/job-description`);
    } catch (err: any) {
      console.error('Failed to create job from text:', err);
      // Server-side company+title duplicate check
      if (err?.code === 'DUPLICATE_JOB' && err?.duplicates?.length > 0) {
        setIsCreatingFromText(false);
        setDuplicateWarning({ isOpen: true, duplicates: err.duplicates, pendingPayload: { text, options } });
        return;
      }
      const errorMessage = err.message || 'Failed to extract job details.';
      setCreateFromTextError(errorMessage);
      setToast({ message: errorMessage, type: 'error' });
    } finally {
      setIsCreatingFromText(false);
    }
  };

  // Called when user clicks "Add Anyway" in the duplicate warning modal
  const handleAddAnywayConfirm = async () => {
    if (!duplicateWarning.pendingPayload) return;
    const { text, options } = duplicateWarning.pendingPayload;
    await doCreateFromText(text, { ...options, force: true });
  };

  const handleDuplicateWarningCancel = () => {
    setDuplicateWarning({ isOpen: false, duplicates: [], pendingPayload: null });
  };

  // --- Sort Handler ---
  const handleSort = (key: SortableJobKeys) => {
    if (sortKey === key) {
      setSortDirection(prevDir => prevDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // --- Navigation Handler ---
  const handleRowClick = (jobId: string) => {
    navigate(`/jobs/${jobId}/review`);
  };


  // --- Helper function to render sort indicators ---
  const renderSortArrow = (key: SortableJobKeys) => {
    if (sortKey !== key) return null;
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  // Define status options for filter dropdown
  const statusOptions: JobApplication['status'][] = ['Not Applied', 'Applied', 'Interview', 'Assessment', 'Rejected', 'Offer'];

  // Status colors for dropdown badge
  const statusColors: Record<JobApplication['status'], string> = {
    'Not Applied': 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    'Applied': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    'Interview': 'bg-gold-100 text-gold-700 dark:bg-gold-900/40 dark:text-gold-300',
    'Assessment': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    'Rejected': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    'Closed': 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    'Offer': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  };

  // Per-status colors for the dropdown option rows (dot + label)
  const statusOptionColors: Record<JobApplication['status'], { dot: string; text: string }> = {
    'Not Applied': { dot: 'bg-slate-400', text: 'text-slate-500 dark:text-slate-300' },
    'Applied': { dot: 'bg-green-400', text: 'text-green-700 dark:text-green-300' },
    'Interview': { dot: 'bg-gold-400', text: 'text-gold-700  dark:text-gold-300' },
    'Assessment': { dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-300' },
    'Rejected': { dot: 'bg-red-400', text: 'text-red-700   dark:text-red-300' },
    'Closed': { dot: 'bg-gray-500', text: 'text-gray-600  dark:text-gray-400' },
    'Offer': { dot: 'bg-emerald-400', text: 'text-emerald-700 dark:text-emerald-300' },
  };

  // Status hex colors for pill styling (matches inbox card style)
  const STATUS_COLORS: Record<JobApplication['status'], string> = {
    'Not Applied': '#64748b',
    'Applied': '#22c55e',
    'Interview': '#eab308',
    'Assessment': '#f59e0b',
    'Rejected': '#ef4444',
    'Closed': '#6b7280',
    'Offer': '#10b981',
  };

  // Handle status change
  const handleStatusChange = async (jobId: string, newStatus: JobApplication['status']) => {
    try {
      await updateJob(jobId, { status: newStatus });
      setJobs(prev => prev.map(j => j._id === jobId ? { ...j, status: newStatus } : j));
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  // Status dropdown component
  const StatusDropdown: React.FC<{ job: JobApplication }> = ({ job }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all hover:shadow-sm ${statusColors[job.status] || statusColors['Not Applied']}`}
        >
          {job.status}
          <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {isOpen && (
          <div className="absolute z-50 mt-1 w-44 rounded-xl shadow-xl py-1 overflow-hidden" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            {statusOptions.map((status) => (
              <button
                key={status}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange(job._id, status);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 transition-colors ${statusOptionColors[status]?.text ?? 'text-gray-700 dark:text-gray-200'}`}
                style={job.status === status ? { background: 'var(--bg-raised)' } : undefined}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusOptionColors[status]?.dot ?? 'bg-gray-400'}`} />
                {status}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Icon components
  const AddIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );

  const ClipboardIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );

  const SearchIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );

  const ArrowDownIcon = ({ className = '' }: { className?: string }) => (
    <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );


  const DeleteIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );

  const ChevronLeftIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );

  const ChevronRightIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );

  const SparklesIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );

  const StarIcon = ({ filled }: { filled: boolean }) => (
    <svg className="w-5 h-5" fill={filled ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );

  const FollowUpIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 4.26a2.25 2.25 0 002.22 0L21 8M5.25 19.5h13.5A2.25 2.25 0 0021 17.25V6.75A2.25 2.25 0 0018.75 4.5H5.25A2.25 2.25 0 003 6.75v10.5A2.25 2.25 0 005.25 19.5z" />
    </svg>
  );

  // --- TableOrCards Configuration ---

  const jobColumns: ColumnDef<JobApplication>[] = [
    {
      key: 'jobTitle',
      label: 'Job Title',
      sortable: true,
      onSort: () => handleSort('jobTitle'),
      sortDirection: sortKey === 'jobTitle' ? sortDirection : null,
      className: 'max-w-[200px]',
      render: (job) => (
        <span className="font-medium line-clamp-2 block" style={{ color: 'var(--text-primary)' }} title={job.jobTitle}>
          {job.jobTitle}
        </span>
      ),
    },
    {
      key: 'companyName',
      label: 'Company',
      className: 'max-w-[180px]',
      render: (job) => (
        <div className="flex items-center gap-2">
          {job.jobUrl && (() => {
            const urls = parseMultipleUrls(job.jobUrl);
            const platform = urls.length > 0 ? getJobPlatform(urls[0]) : null;
            return platform ? (
              <span className="flex-shrink-0" title={platform.charAt(0).toUpperCase() + platform.slice(1)}>
                <PlatformIcon platform={platform} className="w-4 h-4" />
              </span>
            ) : null;
          })()}
          <span className="line-clamp-2" style={{ color: 'var(--text-secondary)' }} title={job.companyName}>{job.companyName}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (job) => <StatusDropdown job={job} />,
    },
    {
      key: 'createdAt',
      label: 'Date Added',
      sortable: true,
      onSort: () => handleSort('createdAt'),
      sortDirection: sortKey === 'createdAt' ? sortDirection : null,
      render: (job) => (
        <div className="flex flex-col" style={{ color: 'var(--text-secondary)' }}>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {new Date(job.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span>
            {new Date(job.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </span>
        </div>
      ),
    },
    {
      key: 'jobType',
      label: 'Type',
      sortable: true,
      onSort: () => handleSort('jobType'),
      sortDirection: sortKey === 'jobType' ? sortDirection : null,
      mobileHidden: true,
      render: (job) => (
        <span style={{ color: 'var(--text-secondary)' }}>
          {job.jobType ? (
            <>
              {job.jobType === 'full-time' && 'Full-time'}
              {job.jobType === 'part-time' && 'Part-time'}
              {job.jobType === 'working-student' && 'Working Student'}
              {job.jobType === 'internship' && 'Internship'}
              {job.jobType === 'contract' && 'Contract'}
              {job.jobType === 'freelance' && 'Freelance'}
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>-</span>
          )}
        </span>
      ),
    },
    {
      key: 'salary',
      label: 'Salary',
      sortable: true,
      onSort: () => handleSort('salary'),
      sortDirection: sortKey === 'salary' ? sortDirection : null,
      mobileHidden: true,
      render: (job) => {
        const displaySalary = job.salary || job.extractedData?.salaryRaw || job.extractedData?.estimatedSalary;
        if (!displaySalary) return <span style={{ color: 'var(--text-muted)' }}>-</span>;
        const isEstimate = !job.salary && !job.extractedData?.salaryRaw && job.extractedData?.salaryIsEstimate;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-medium line-clamp-2" title={displaySalary}>{displaySalary}</span>
            {isEstimate && <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">AI Est.</span>}
          </div>
        );
      },
    },
    {
      key: 'contact',
      label: 'Contact',
      mobileHidden: true,
      render: (job) => {
        const hasStructuredContact = job.contactEmail || job.contactPhone || job.hiringManagerName;
        return (
          <div className="text-slate-600 dark:text-slate-400 max-w-[120px]" onClick={(e) => e.stopPropagation()}>
            {hasStructuredContact ? (
              <div className="flex flex-col gap-0.5 text-xs">
                {job.contactEmail && (
                  <a href={`mailto:${job.contactEmail}`} className="hover:underline truncate block" style={{ color: 'var(--accent)' }} title={`Email: ${job.contactEmail}`}>
                    📧 {job.contactEmail.length > 12 ? job.contactEmail.substring(0, 12) + '...' : job.contactEmail}
                  </a>
                )}
                {job.contactPhone && (
                  <span className="truncate block" title={`Phone: ${job.contactPhone}`}>
                    📞 {job.contactPhone.length > 12 ? job.contactPhone.substring(0, 12) + '...' : job.contactPhone}
                  </span>
                )}
                {job.hiringManagerName && (
                  <span className="truncate block text-slate-500 dark:text-slate-400" title={`Contact: ${job.hiringManagerName}`}>
                    👤 {job.hiringManagerName.length > 12 ? job.hiringManagerName.substring(0, 12) + '...' : job.hiringManagerName}
                  </span>
                )}
              </div>
            ) : job.contact ? (
              job.contact.includes('@') ? (
                <a href={`mailto:${job.contact}`} className="hover:underline truncate block" style={{ color: 'var(--accent)' }} title={`Email ${job.contact}`}>
                  {job.contact.length > 14 ? job.contact.substring(0, 14) + '...' : job.contact}
                </a>
              ) : job.contact.startsWith('http') ? (
                <a href={job.contact} target="_blank" rel="noopener noreferrer" className="hover:underline truncate block" style={{ color: 'var(--accent)' }} title={job.contact}>
                  {job.contact.length > 14 ? job.contact.substring(0, 14) + '...' : job.contact}
                </a>
              ) : (
                <span className="truncate block" title={job.contact}>{job.contact.length > 14 ? job.contact.substring(0, 14) + '...' : job.contact}</span>
              )
            ) : '-'}
          </div>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      render: (job) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {job.notes && job.notes.trim() && (
            <span className="flex items-center justify-center w-8 h-8 text-blue-500 dark:text-blue-400" title={`Note: ${job.notes.length > 100 ? job.notes.substring(0, 100) + '...' : job.notes}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </span>
          )}
          {job.jobUrl && parseMultipleUrls(job.jobUrl).slice(0, 2).map((url, idx, arr) => (
            <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors" style={{ color: 'var(--accent)' }} title={`Open: ${url}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {arr.length > 1 && <span className="text-xs ml-0.5">{idx + 1}</span>}
            </a>
          ))}
          {job.jobUrl && parseMultipleUrls(job.jobUrl).length > 2 && (
            <span className="text-xs text-slate-500 dark:text-slate-400 px-1" title={parseMultipleUrls(job.jobUrl).slice(2).join('\n')}>
              +{parseMultipleUrls(job.jobUrl).length - 2}
            </span>
          )}
          <button onClick={(e) => handleToggleFavorite(job, e)} className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${job.isFavorite ? 'text-amber-500 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 hover:bg-amber-200 dark:hover:bg-amber-900/70' : 'text-slate-400 dark:text-slate-500 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50'}`} title={job.isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
            <StarIcon filled={!!job.isFavorite} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${job._id}/review/reminders`); }} className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${needsFollowUpJobIdSet.has(job._id) ? 'text-amber-600 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60' : 'text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40'}`} title={needsFollowUpJobIdSet.has(job._id) ? 'Open follow-up email actions (recommended)' : 'Open follow-up email actions'}>
            <FollowUpIcon />
          </button>
          <button onClick={(e) => handleDeleteClick(job, e)} className="flex items-center justify-center w-8 h-8 rounded-md text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors" title="Delete">
            <DeleteIcon />
          </button>
        </div>
      ),
    },
  ];

  const jobCardConfig: CardConfig<JobApplication> = {
    title: (job) => job.jobTitle,
    subtitle: (job) => job.companyName,
    avatar: (job) => ({
      letter: job.companyName.substring(0, 1).toUpperCase(),
    }),
    fields: [
      {
        label: 'Status',
        value: (job) => {
          const color = STATUS_COLORS[job.status] || 'var(--text-muted)';
          return (
            <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: '0.02em' }}>
              {job.status}
            </span>
          );
        },
      },
      {
        label: 'Date',
        value: (job) => new Date(job.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      },
      {
        label: 'Type',
        value: (job) =>
          job.jobType === 'full-time' ? 'Full-time' :
          job.jobType === 'part-time' ? 'Part-time' :
          job.jobType === 'working-student' ? 'Working Student' :
          job.jobType === 'internship' ? 'Internship' :
          job.jobType === 'contract' ? 'Contract' :
          job.jobType === 'freelance' ? 'Freelance' : '-',
      },
      {
        label: 'Salary',
        value: (job) => job.salary || job.extractedData?.salaryRaw || job.extractedData?.estimatedSalary || '-',
      },
      {
        value: (job) => {
          const hasNotes = job.notes && job.notes.trim();
          const needsFollowUp = needsFollowUpJobIdSet.has(job._id);
          if (!hasNotes && !needsFollowUp) return null;
          return (
            <div className="flex flex-wrap gap-1.5">
              {hasNotes && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Note
                </span>
              )}
              {needsFollowUp && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 4.26a2.25 2.25 0 002.22 0L21 8M5.25 19.5h13.5A2.25 2.25 0 0021 17.25V6.75A2.25 2.25 0 0018.75 4.5H5.25A2.25 2.25 0 003 6.75v10.5A2.25 2.25 0 005.25 19.5z" />
                  </svg>
                  Follow-up
                </span>
              )}
            </div>
          );
        },
      },
    ],
    actions: (job) => (
      <>
        {job.notes && job.notes.trim() && (
          <span className="flex items-center justify-center w-8 h-8 text-blue-500 dark:text-blue-400" title={`Note: ${job.notes.length > 100 ? job.notes.substring(0, 100) + '...' : job.notes}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </span>
        )}
        {job.jobUrl && parseMultipleUrls(job.jobUrl).slice(0, 2).map((url, idx) => (
          <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors" style={{ color: 'var(--accent)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        ))}
        <button onClick={(e) => { e.stopPropagation(); handleToggleFavorite(job, e as any); }} className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${job.isFavorite ? 'text-amber-500 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50' : 'text-slate-400 dark:text-slate-500 hover:text-amber-500'}`}>
          <StarIcon filled={!!job.isFavorite} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${job._id}/review/reminders`); }} className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${needsFollowUpJobIdSet.has(job._id) ? 'text-amber-600 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60' : 'text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40'}`} title={needsFollowUpJobIdSet.has(job._id) ? 'Open follow-up email actions (recommended)' : 'Open follow-up email actions'}>
          <FollowUpIcon />
        </button>
        <button onClick={(e) => handleDeleteClick(job, e as any)} className="flex items-center justify-center w-8 h-8 rounded-md text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
          <DeleteIcon />
        </button>
      </>
    ),
  };

  // --- Render Loading State ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <SimpleLoader message="Loading dashboard..." height="auto" />
      </div>
    );
  }

  // --- Render Error State ---
  if (error && !isLoading) {
    return (
      <div className="h-full p-8">
        <div className="p-4 mb-4 text-sm text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded-lg border border-red-300 dark:border-red-800" role="alert">
          <span className="font-medium">Error:</span> {error}
          <button onClick={() => window.location.reload()} className='ml-4 underline text-xs'>Try Reloading</button>
        </div>
      </div>
    );
  }

  // Calculate pagination
  const itemsPerPage = 10;
  const totalPages = Math.ceil(displayedJobs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedJobs = displayedJobs.slice(startIndex, endIndex);

  // --- Main Dashboard Content ---
  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-950">

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h1 className="page-title">Job Dashboard</h1>
            <p style={{ color: 'var(--text-secondary)' }}>Manage your job applications and track your progress</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(() => {
              const todayCount = jobs.filter(job => {
                const jobDate = new Date(job.createdAt);
                const today = new Date();
                return jobDate.getDate() === today.getDate() &&
                  jobDate.getMonth() === today.getMonth() &&
                  jobDate.getFullYear() === today.getFullYear();
              }).length;
              return todayCount > 0 ? (
                <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-zinc-900/20 text-zinc-800 dark:text-zinc-300">
                  <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold bg-zinc-500 dark:bg-zinc-400 text-white dark:text-zinc-900">
                    {todayCount}
                  </span>
                  <span className="text-xs font-semibold tracking-wide">TODAY'S APPLICATIONS</span>
                </div>
              ) : null;
            })()}

            
          </div>
        </div>






        {/* Add Job Section */}
        <div className="bg-white dark:bg-zinc-900 p-3 sm:p-6 rounded-2xl border border-zinc-100 dark:border-zinc-800">
          {/* Mobile Header - always visible, collapsible */}
          <div className="sm:hidden flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Add New Job</h2>
            <button
              type="button"
              onClick={() => setAddJobFormCollapsed(!addJobFormCollapsed)}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            >
              <svg className={`w-4 h-4 transition-transform ${addJobFormCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Desktop Header - just a title, always visible */}
          <div className="hidden sm:block mb-4">
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Add New Job</h2>
          </div>

          {/* Form Content - collapsible on mobile, always visible on desktop */}
          <div className={`${addJobFormCollapsed ? 'hidden sm:block' : ''} space-y-4 sm:space-y-6`}>
            <div className="flex flex-col gap-4">
              <form onSubmit={handleCreateFromTextSubmit} className="w-full">
                {/* Pre-Extraction Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  {/* CV Selection or Upload */}
                  <div>
                    <label htmlFor="cvBranch" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      CV Branch
                    </label>
                    {/* Existing CV dropdown – hidden when a file is chosen */}
                    {!preExtractionCvFile && (
                      <select
                        id="cvBranch"
                        value={selectedCvBranchId || ''}
                        onChange={(e) => setSelectedCvBranchId(e.target.value || null)}
                        className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500"
                        disabled={isCreatingFromText}
                      >
                        <option value="">Select CV (optional)</option>
                        {cvs.filter(cv => !cv.jobApplication).map(cv => (
                          <option key={cv._id} value={cv._id}>
                            {cv.displayName || cv.category || 'CV'} {cv.isPrimary ? '(Primary)' : ''}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* File chosen – show name and remove button */}
                    {preExtractionCvFile && (
                      <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-dim)' }}>
                        <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-xs truncate flex-1" style={{ color: 'var(--accent)' }}>{preExtractionCvFile.name}</span>
                        <button
                          type="button"
                          onClick={() => { setPreExtractionCvFile(null); if (cvFileInputRef.current) cvFileInputRef.current.value = ''; }}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                          title="Remove file"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Hidden file input */}
                    <input
                      ref={cvFileInputRef}
                      type="file"
                      accept=".pdf,.docx"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        if (f) {
                          setPreExtractionCvFile(f);
                          setSelectedCvBranchId(null); // clear dropdown when file chosen
                        }
                      }}
                    />

                    {/* Upload button */}
                    {!preExtractionCvFile && (
                      <button
                        type="button"
                        onClick={() => cvFileInputRef.current?.click()}
                        disabled={isCreatingFromText}
                        className="mt-1.5 text-xs disabled:opacity-40 flex items-center gap-1 transition-opacity" style={{ color: 'var(--accent)' }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Or upload PDF / DOCX
                      </button>
                    )}
                  </div>

                  {/* Job URL */}
                  <div>
                    <label htmlFor="jobUrl" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Job URL(s)
                    </label>
                    <input
                      id="jobUrl"
                      type="text"
                      value={preExtractionJobUrl}
                      onChange={(e) => setPreExtractionJobUrl(e.target.value)}
                      onBlur={(e) => {
                        const normalized = normalizeMultipleUrls(e.target.value);
                        setPreExtractionJobUrl(normalized);
                      }}
                      placeholder="https://example.com/job-posting"
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent transition-all"
                      disabled={isCreatingFromText}
                    />
                    <p className="mt-1.5 text-[10px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
                      Separate multiples with commas or spaces
                    </p>
                  </div>

                  {/* Status */}
                  <div>
                    <label htmlFor="status" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Status
                    </label>
                    <select
                      id="status"
                      value={preExtractionStatus}
                      onChange={(e) => setPreExtractionStatus(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent transition-all"
                      disabled={isCreatingFromText}
                    >
                      <option value="Not Applied">Not Applied</option>
                      <option value="Applied">Applied</option>
                      <option value="Interview">Interview</option>
                      <option value="Assessment">Assessment</option>
                      <option value="Offer">Offer</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </div>

                  {/* Job Type */}
                  <div>
                    <label htmlFor="jobType" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Job Type
                    </label>
                    <select
                      id="jobType"
                      value={preExtractionJobType}
                      onChange={(e) => setPreExtractionJobType(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-white focus:border-transparent transition-all"
                      disabled={isCreatingFromText}
                    >
                      <option value="">Auto-detect</option>
                      <option value="full-time">Full-time</option>
                      <option value="part-time">Part-time</option>
                      <option value="working-student">Working Student</option>
                      <option value="internship">Internship</option>
                      <option value="contract">Contract</option>
                      <option value="freelance">Freelance</option>
                    </select>
                  </div>
                </div>

                {/* Job Description Text Area */}
                <div className="relative">
                  <div className="absolute left-4 top-4 text-slate-400 dark:text-slate-500 pointer-events-none">
                    <ClipboardIcon />
                  </div>
                  <textarea
                    value={jobTextInput}
                    onChange={(e) => { setJobTextInput(e.target.value); setCreateFromTextError(null); }}
                    placeholder="Paste job description here..."
                    title="Ctrl+A to select all, Ctrl+C to copy from job site, then Ctrl+V here"
                    className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-white focus:ring-zinc-900 dark:focus:ring-white rounded-xl pl-12 py-4 pr-4 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 disabled:opacity-50 resize-y min-h-[160px] sm:min-h-[160px] transition-all"
                    rows={6}
                    disabled={isCreatingFromText}
                  />
                  {/* Loading overlay */}
                  {isCreatingFromText && (
                    <div className="absolute inset-0 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center gap-3" style={{ background: 'color-mix(in srgb, var(--bg-surface) 85%, transparent)' }}>
                      <div className="relative">
                        <svg className="animate-spin h-10 w-10" style={{ color: 'var(--accent)' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Extracting job details...</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>AI is analyzing the job description</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
                  <button
                    type="submit"
                    className="w-full sm:w-auto bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold py-3 px-6 rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg flex items-center justify-center gap-2"
                    disabled={isCreatingFromText || !jobTextInput || jobTextInput.trim().length < 50}
                  >
                    {isCreatingFromText ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Extracting...</span>
                      </>
                    ) : (
                      <>
                        <SparklesIcon />
                        <span>Extract with AI</span>
                        <span className="text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded-full" style={{ background: '#e8b844', color: '#0e0e17' }}>1 cr</span>
                      </>
                    )}
                  </button>

                  <div className="hidden sm:block text-slate-400 text-sm">or</div>

                  <button
                    type="button"
                    onClick={handleOpenAddModal}
                    className="w-full sm:w-auto bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-medium py-3 px-6 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2"
                    disabled={isSubmitting || isCreatingFromText}
                  >
                    <AddIcon />
                    <span>Add Manually</span>
                  </button>
                </div>
              </form>
            </div>
            {createFromTextError && (
              <div className={`p-4 rounded-lg border ${isApiKeyError(createFromTextError)
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
                : 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-800'
                }`}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {isApiKeyError(createFromTextError) ? (
                      <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-semibold mb-1 ${isApiKeyError(createFromTextError)
                      ? 'text-amber-800 dark:text-amber-300'
                      : 'text-red-800 dark:text-red-300'
                      }`}>
                      {isApiKeyError(createFromTextError) ? 'API Key Required' : 'Error'}
                    </h3>
                    <p className={`text-sm mb-3 ${isApiKeyError(createFromTextError)
                      ? 'text-amber-700 dark:text-amber-400'
                      : 'text-red-700 dark:text-red-400'
                      }`}>
                      {createFromTextError}
                    </p>
                    {isApiKeyError(createFromTextError) && (
                      <Link
                        to="/settings"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors bg-amber-600 hover:bg-amber-700 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Go to Settings
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Job List Section */}
        <div className="space-y-6">
          {/* Filter Controls */}
          <div>
            <div className="flex flex-wrap items-end gap-3 mb-4">

              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium mb-1.5 label-overline" htmlFor="filter-title">Search (Title, Company, Contact)</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                    <SearchIcon />
                  </div>
                  <input
                    type="text"
                    id="filter-title"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Title, company or contact name…"
                    className="input-base w-full pl-9 h-10 text-sm"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="min-w-[150px]">
                <label className="block text-xs font-medium mb-1.5 label-overline" htmlFor="filter-status">Status</label>
                <select
                  id="filter-status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="input-base w-full h-10 text-sm"
                >
                  <option value="">All Statuses</option>
                  {statusOptions.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              {/* Job Type */}
              <div className="min-w-[150px]">
                <label className="block text-xs font-medium mb-1.5 label-overline" htmlFor="filter-jobtype">Job Type</label>
                <select
                  id="filter-jobtype"
                  value={filterJobType}
                  onChange={(e) => setFilterJobType(e.target.value)}
                  className="input-base w-full h-10 text-sm"
                >
                  <option value="">All Types</option>
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="working-student">Working Student</option>
                  <option value="internship">Internship</option>
                  <option value="contract">Contract</option>
                  <option value="freelance">Freelance</option>
                </select>
              </div>

              {/* Toggle pills */}
              <div className="flex flex-wrap items-end gap-3 pb-0">
                <div>
                  <label className="block text-xs font-medium mb-1.5 label-overline">Quick filters</label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setFilterFavorite(!filterFavorite)}
                      className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border text-sm font-medium transition-all ${filterFavorite
                        ? 'text-ink-950 border-transparent'
                        : 'border-transparent hover:opacity-80'
                        }`}
                      style={filterFavorite
                        ? { background: 'var(--accent)', color: '#0e0e17' }
                        : { background: 'var(--bg-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                      title="Favorites only"
                    >
                      <StarIcon filled={filterFavorite} />
                      <span>Favorites</span>
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                        {favoriteCount}
                      </span>
                    </button>

                    <button
                      onClick={() => setFilterHasNotes(!filterHasNotes)}
                      className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border text-sm font-medium transition-all hover:opacity-80"
                      style={filterHasNotes
                        ? { background: 'var(--accent)', color: '#0e0e17', border: '1px solid transparent' }
                        : { background: 'var(--bg-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                      title="Only show jobs with notes"
                    >
                      <span className="material-symbols-outlined text-base" style={{ fontSize: '16px' }}>sticky_note_2</span>
                      <span>Has Notes</span>
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                        {notesCount}
                      </span>
                    </button>

                    <button
                      onClick={handleToggleDueFollowUpFilter}
                      disabled={needsFollowUpCount === 0}
                      className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={showOnlyDueFollowUps
                        ? { background: 'var(--accent)', color: '#0e0e17', border: '1px solid transparent' }
                        : { background: 'var(--bg-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                      title={needsFollowUpCount > 0 ? 'Show jobs that need a follow-up email' : 'No jobs currently need a follow-up email'}
                    >
                      <FollowUpIcon />
                      <span>Needs Follow-up</span>
                      {needsFollowUpCount > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                          {needsFollowUpCount}
                        </span>
                      )}
                    </button>

                    
                  </div>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {displayedJobs.length === 0 ? (
                <div className="text-center py-12 px-4">
                  {jobs.length > 0 ? (
                    <>
                      <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">No matches found</h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        No job applications match your current filters. Try adjusting your search or filter criteria.
                      </p>
                      <div className="mt-6">
                        <button
                          onClick={() => { setFilterText(''); setFilterStatus(''); setFilterFavorite(false); setFilterHasNotes(false); setFilterJobType(''); setShowOnlyDueFollowUps(false); }}
                          className="btn-primary"
                        >
                          Clear Filters
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* ── Demo Tour Section: show mock only while tour is active ── */}
                      {showJobTour && (<div className="py-6 px-4 space-y-3">
                        <TourBanner pageLabel="Job Dashboard" onDismiss={dismissJobTour} />
                          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                            <table className="w-full text-left">
                              <thead>
                                <tr>
                                  <th className="p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Job Title</th>
                                  <th className="p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Company</th>
                                  <th className="p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Status</th>
                                  <th className="p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Date Added</th>
                                  <th className="p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Type</th>
                                  <th className="p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Salary</th>
                                  <th className="p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Contact</th>
                                  <th className="p-4 text-sm font-semibold text-slate-500 dark:text-slate-400 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr
                                  className="border-t border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                  onClick={() => navigate('/jobs/__mock_job__/review/job-description')}
                                >
                                  <td className="p-4 font-medium text-slate-800 dark:text-slate-100">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
                                        style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}
                                      >
                                        demo
                                      </span>
                                      {MOCK_JOB.jobTitle}
                                    </div>
                                  </td>
                                  <td className="p-4 text-slate-600 dark:text-slate-400">
                                    <div className="flex items-center gap-2">
                                      <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                                      <span>{MOCK_JOB.companyName}</span>
                                    </div>
                                  </td>
                                  <td className="p-4">
                                    <span
                                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                                      style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
                                    >
                                      {MOCK_JOB.status}
                                    </span>
                                  </td>
                                  <td className="p-4 text-slate-600 dark:text-slate-400">
                                    <div className="flex flex-col">
                                      <span className="text-xs text-slate-400 dark:text-slate-500">09:00</span>
                                      <span>Today</span>
                                    </div>
                                  </td>
                                  <td className="p-4 text-slate-600 dark:text-slate-400">Full-time</td>
                                  <td className="p-4 text-slate-600 dark:text-slate-400">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-xs font-medium">{MOCK_JOB.salary}</span>
                                    </div>
                                  </td>
                                  <td className="p-4 text-slate-400 dark:text-slate-500">—</td>
                                  <td className="p-4">
                                    <div className="flex items-center justify-end gap-1">
                                      <button className="flex items-center justify-center w-8 h-8 rounded-md text-slate-400 dark:text-slate-500">
                                        <StarIcon filled={false} />
                                      </button>
                                      <button className="flex items-center justify-center w-8 h-8 rounded-md text-red-400 dark:text-red-500">
                                        <DeleteIcon />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                      </div>)}
                    </>
                  )}
                </div>
              ) : (
                <>
                  <TableOrCards
                    data={paginatedJobs}
                    columns={jobColumns}
                    cardConfig={jobCardConfig}
                    onRowClick={(job) => handleRowClick(job._id)}
                  />
                  {/* Pagination */}
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Showing {startIndex + 1} to {Math.min(endIndex, displayedJobs.length)} of {displayedJobs.length} results
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="flex items-center justify-center w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronLeftIcon />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`flex items-center justify-center w-10 h-10 rounded-xl text-sm font-semibold transition-all ${currentPage === page
                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                            : 'border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                            }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="flex items-center justify-center w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronRightIcon />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Add/Edit Modal */}
        {modalMode && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50">
            <div className="card-elevated p-6 rounded-2xl shadow-2xl w-full max-w-lg mx-4 sm:mx-0 flex flex-col" style={{ maxHeight: '90vh' }}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                  Add New Job Manually
                </h2>
                <button
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="btn-ghost w-9 h-9 p-0 flex items-center justify-center disabled:opacity-50"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col min-h-0">
                {modalError && (
                  <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm rounded border border-red-300 dark:border-red-800">
                    {modalError}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto pr-1 min-h-0 pb-2">
                  {/* Job Title */}
                  <div className="mb-5">
                    <label htmlFor="jobTitle" className="label-overline mb-2 block">
                      Job Title <span style={{ color: 'var(--rose)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      id="jobTitle"
                      name="jobTitle"
                      value={formData.jobTitle || ''}
                      onChange={handleInputChange}
                      required
                      className="input-base w-full"
                    />
                  </div>

                  {/* Company Name */}
                  <div className="mb-5">
                    <label htmlFor="companyName" className="label-overline mb-2 block">
                      Company Name <span style={{ color: 'var(--rose)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      id="companyName"
                      name="companyName"
                      value={formData.companyName || ''}
                      onChange={handleInputChange}
                      required
                      className="input-base w-full"
                    />
                  </div>

                  {/* Status and Language - Side by Side */}
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    {/* Status */}
                    <div>
                      <label htmlFor="status" className="label-overline mb-2 block">Status</label>
                      <select
                        id="status"
                        name="status"
                        value={formData.status || 'Not Applied'}
                        onChange={handleInputChange}
                        className="input-base w-full cursor-pointer"
                      >
                        {statusOptions.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>

                    {/* Language */}
                    <div>
                      <label htmlFor="language" className="label-overline mb-2 block">Language</label>
                      <select
                        id="language"
                        name="language"
                        value={formData.language || 'en'}
                        onChange={handleInputChange}
                        className="input-base w-full cursor-pointer"
                      >
                        <option value="en">English</option>
                        <option value="de">German</option>
                      </select>
                    </div>
                  </div>

                  {/* CV Selection */}
                  <div className="mb-5">
                    <label htmlFor="baseCvId" className="label-overline mb-2 block">Base CV</label>
                    <select
                      id="baseCvId"
                      name="baseCvId"
                      value={formData.baseCvId || ''}
                      onChange={handleInputChange}
                      disabled={isLoadingCvs}
                      className="input-base w-full cursor-pointer disabled:opacity-50"
                    >
                      <option value="">
                        {isLoadingCvs ? 'Loading CVs...' : 'Select a CV (optional)'}
                      </option>
                      {cvs.map(cv => (
                        <option key={cv._id} value={cv._id}>
                          {cv.displayName || cv.category || 'Unnamed CV'}
                          {cv.isPrimary ? ' (Primary)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      Choose which CV version to use as the base for this job application
                    </p>
                  </div>

                  {/* Job Type */}
                  <div className="mb-5">
                    <label htmlFor="jobType" className="label-overline mb-2 block">Job Type</label>
                    <select
                      id="jobType"
                      name="jobType"
                      value={formData.jobType || ''}
                      onChange={handleInputChange}
                      className="input-base w-full cursor-pointer"
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

                  {/* Date Added */}
                  {(() => {
                    // Helper to format date for input
                    const formatDateForInput = (dateString?: string): string => {
                      if (!dateString) {
                        // For new jobs, default to today
                        if (modalMode === 'add') {
                          const today = new Date();
                          const year = today.getFullYear();
                          const month = String(today.getMonth() + 1).padStart(2, '0');
                          const day = String(today.getDate()).padStart(2, '0');
                          return `${year}-${month}-${day}`;
                        }
                        return '';
                      }
                      try {
                        const date = new Date(dateString);
                        if (isNaN(date.getTime())) return '';
                        // Format as YYYY-MM-DD for input type="date"
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                      } catch {
                        return '';
                      }
                    };

                    return (
                      <div className="mb-5">
                        <label htmlFor="createdAt" className="label-overline mb-2 block">
                          Date Added
                        </label>
                        <input
                          type="date"
                          id="createdAt"
                          name="createdAt"
                          value={formatDateForInput(formData.createdAt)}
                          onChange={(e) => {
                            const dateValue = e.target.value;
                            if (dateValue) {
                              // Convert to ISO string
                              const newDate = new Date(dateValue + 'T12:00:00');
                              setFormData(prev => ({ ...prev, createdAt: newDate.toISOString() }));
                            }
                          }}
                          className="input-base w-full"
                        />
                      </div>
                    );
                  })()}

                  {/* Job URL */}
                  <div className="mb-5">
                    <label htmlFor="jobUrl_modal" className="label-overline mb-2 block">Job URL(s)</label>
                    <input
                      id="jobUrl_modal"
                      name="jobUrl"
                      type="text"
                      value={formData.jobUrl || ''}
                      onChange={handleInputChange}
                      onBlur={(e) => {
                        const normalized = normalizeMultipleUrls(e.target.value);
                        setFormData(prev => ({ ...prev, jobUrl: normalized }));
                      }}
                      placeholder="https://example.com/job-posting"
                      className="input-base w-full"
                    />
                    <p className="mt-1.5 text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>
                      Separate multiples with commas or spaces
                    </p>
                  </div>

                  {/* Salary and Contact - Side by Side */}
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    {/* Salary */}
                    <div>
                      <label htmlFor="salary" className="label-overline mb-2 block">Salary</label>
                      <input
                        type="text"
                        id="salary"
                        name="salary"
                        value={formData.salary || ''}
                        onChange={handleInputChange}
                        className="input-base w-full"
                        placeholder="e.g., 50k-70k, $80,000"
                      />
                    </div>

                    {/* Contact */}
                    <div>
                      <label htmlFor="contact" className="label-overline mb-2 block">Contact</label>
                      <input
                        type="text"
                        id="contact"
                        name="contact"
                        value={formData.contact || ''}
                        onChange={handleInputChange}
                        className="input-base w-full"
                        placeholder="Email, link, or name"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="mb-5">
                    <label htmlFor="notes" className="label-overline mb-2 block">Notes</label>
                    <textarea
                      id="notes"
                      name="notes"
                      rows={3}
                      value={formData.notes || ''}
                      onChange={handleInputChange}
                      className="input-base w-full resize-none"
                    />
                  </div>
                </div>

                {/* Modal Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 mt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={isSubmitting}
                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Adding...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Add Job
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmModal.isOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50">
            <div className="card-elevated p-6 rounded-2xl shadow-2xl w-full max-w-md mx-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0 p-3 rounded-full" style={{ background: 'color-mix(in srgb, var(--rose) 15%, transparent)', color: 'var(--rose)' }}>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Delete Job Application</h3>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    Are you sure you want to delete this job application? This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="p-3 rounded-xl mb-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{deleteConfirmModal.jobTitle}</p>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={handleDeleteCancel} className="btn-secondary">
                  Cancel
                </button>
                <button onClick={handleDeleteConfirm} className="btn-danger">
                  Delete
                    </button>
                  </div>
                </div>
              </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>

      {/* Duplicate Job Warning Modal */}
      <DuplicateJobWarningModal
        isOpen={duplicateWarning.isOpen}
        duplicates={duplicateWarning.duplicates}
        onCancel={handleDuplicateWarningCancel}
        onAddAnyway={handleAddAnywayConfirm}
        isSubmitting={isCreatingFromText}
      />
    </div>
  );
};

export default DashboardPage;

