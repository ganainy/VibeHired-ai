// client/src/pages/DashboardPage.tsx
import React, { useState, useEffect, useMemo } from 'react';
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
import { getCvBranches, CVDocument } from '../services/cvApi';
import { parseMultipleUrls, normalizeMultipleUrls } from '../lib/utils';

import JobStatusBadge from '../components/jobs/JobStatusBadge';
import LoadingSkeleton from '../components/common/LoadingSkeleton';
import Toast from '../components/common/Toast';
import DuplicateJobWarningModal from '../components/jobs/DuplicateJobWarningModal';

// Define type for the form data used in the Add modal
type JobFormData = Partial<Omit<JobApplication, '_id' | 'updatedAt' | 'generationStatus' | 'generatedCvFilename' | 'generatedCoverLetterFilename'>>;

// Explicitly list sortable keys for type safety
type SortableJobKeys = 'jobTitle' | 'companyName' | 'status' | 'createdAt';

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

  // --- Filtering & Sorting State ---
  const [filterText, setFilterText] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterFavorite, setFilterFavorite] = useState<boolean>(false);
  const [sortKey, setSortKey] = useState<SortableJobKeys>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // --- Toast State ---
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);



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
  }, [filterText, filterStatus, filterFavorite]);

  // --- Derived State: Filtered and Sorted Jobs ---
  const displayedJobs = useMemo(() => {
    let filteredJobs = [...jobs];

    // Apply Text Filter
    if (filterText) {
      const lowerCaseFilter = filterText.toLowerCase();
      filteredJobs = filteredJobs.filter(job =>
        job.jobTitle.toLowerCase().includes(lowerCaseFilter) ||
        job.companyName.toLowerCase().includes(lowerCaseFilter)
      );
    }

    // Apply Status Filter
    if (filterStatus) {
      filteredJobs = filteredJobs.filter(job => job.status === filterStatus);
    }

    // Apply Favorite Filter
    if (filterFavorite) {
      filteredJobs = filteredJobs.filter(job => job.isFavorite === true);
    }

    // Apply Sorting
    if (sortKey) {
      filteredJobs.sort((a, b) => {
        const aValue = a[sortKey as keyof JobApplication] as any;
        const bValue = b[sortKey as keyof JobApplication] as any;

        let comparison = 0;

        if (sortKey === 'createdAt') {
          const dateA = new Date(aValue).getTime();
          const dateB = new Date(bValue).getTime();
          comparison = (isNaN(dateA) ? 0 : dateA) - (isNaN(dateB) ? 0 : dateB);
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
  }, [jobs, filterText, filterStatus, filterFavorite, sortKey, sortDirection]);

  // --- Modal Event Handlers ---
  const handleOpenAddModal = () => {
    const primaryCv = cvs.find(cv => cv.isPrimary);
    setFormData({
      jobTitle: '',
      companyName: '',
      status: 'Not Applied',
      jobUrl: '',
      notes: '',
      language: 'en',
      baseCvId: primaryCv?._id || null
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
  const statusOptions: JobApplication['status'][] = ['Not Applied', 'Applied', 'Interview', 'Assessment', 'Rejected', 'Closed', 'Offer'];

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

  const ArrowDownIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
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

  // --- Render Loading State ---
  if (isLoading) {
    return (
      <div className="h-full p-8">
        <LoadingSkeleton lines={5} />
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
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Job Dashboard</h1>
            <p className="mt-1 text-slate-600 dark:text-slate-400">Manage your job applications and track your progress.</p>
          </div>
          {(() => {
            const todayCount = jobs.filter(job => {
              const jobDate = new Date(job.createdAt);
              const today = new Date();
              return jobDate.getDate() === today.getDate() &&
                jobDate.getMonth() === today.getMonth() &&
                jobDate.getFullYear() === today.getFullYear();
            }).length;
            return todayCount > 0 ? (
              <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-lg">
                <span className="text-sm text-slate-600 dark:text-slate-400">Today's Applications:</span>
                <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{todayCount}</span>
              </div>
            ) : null;
          })()}
        </div>


        {/* Add Job Section */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="flex flex-col gap-4">
            <form onSubmit={handleCreateFromTextSubmit} className="w-full">
              {/* Pre-Extraction Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {/* CV Branch Selection */}
                <div>
                  <label htmlFor="cvBranch" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    CV Branch
                  </label>
                  <select
                    id="cvBranch"
                    value={selectedCvBranchId || ''}
                    onChange={(e) => setSelectedCvBranchId(e.target.value || null)}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isCreatingFromText}
                  >
                    <option value="">Select CV (optional)</option>
                    {cvs.filter(cv => !cv.jobApplication).map(cv => (
                      <option key={cv._id} value={cv._id}>
                        {cv.displayName || cv.category || 'CV'} {cv.isPrimary ? '(Primary)' : ''}
                      </option>
                    ))}
                  </select>
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
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    disabled={isCreatingFromText}
                  >
                    <option value="Not Applied">Not Applied</option>
                    <option value="Applied">Applied</option>
                    <option value="Interview">Interview</option>
                    <option value="Assessment">Assessment</option>
                    <option value="Offer">Offer</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Closed">Closed</option>
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
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                  className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-indigo-600 dark:focus:border-indigo-500 focus:ring-indigo-600 dark:focus:ring-indigo-500 rounded-md pl-12 py-4 pr-4 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-50 resize-y min-h-[160px] transition-all"
                  rows={6}
                  disabled={isCreatingFromText}
                />
                {/* Loading overlay */}
                {isCreatingFromText && (
                  <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-md flex flex-col items-center justify-center gap-3">
                    <div className="relative">
                      <svg className="animate-spin h-10 w-10 text-indigo-600 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Extracting job details...</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">AI is analyzing the job description</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
                <button
                  type="submit"
                  className="w-full sm:w-auto bg-indigo-600 dark:bg-indigo-600 text-white font-medium py-2.5 px-6 rounded-md text-sm hover:bg-indigo-700 dark:hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center gap-2"
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
                    </>
                  )}
                </button>

                <div className="hidden sm:block text-slate-400 text-sm">or</div>

                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="w-full sm:w-auto text-slate-600 dark:text-slate-400 font-medium py-2.5 px-4 rounded-md text-sm hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
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

        {/* Job List Section */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 space-y-6">
          {/* Filter Controls */}
          <div>
            <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
              <div className="w-full md:w-1/3">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1" htmlFor="filter-title">Filter by Title/Company</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
                    <SearchIcon />
                  </div>
                  <input
                    type="text"
                    id="filter-title"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Enter text..."
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-indigo-600 dark:focus:border-indigo-500 focus:ring-indigo-600 dark:focus:ring-indigo-500 rounded-md pl-10 h-10 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <div className="w-full md:w-auto">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1" htmlFor="filter-status">Filter by Status</label>
                <select
                  id="filter-status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 focus:border-indigo-600 dark:focus:border-indigo-500 focus:ring-indigo-600 dark:focus:ring-indigo-500 rounded-md h-10 px-3 text-slate-900 dark:text-slate-100"
                >
                  <option value="">All Statuses</option>
                  {statusOptions.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div className="w-full md:w-auto">
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Favorites</label>
                <button
                  onClick={() => setFilterFavorite(!filterFavorite)}
                  className={`flex items-center gap-2 px-4 h-10 rounded-md border transition-colors ${filterFavorite
                      ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                      : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                >
                  <StarIcon filled={filterFavorite} />
                  <span>{filterFavorite ? 'Favorites Only' : 'All Jobs'}</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-700">
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
                          onClick={() => { setFilterText(''); setFilterStatus(''); setFilterFavorite(false); }}
                          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                          Clear Filters
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">No job applications</h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Get started by adding a new job application manually or by pasting a job URL above.
                      </p>
                      <div className="mt-6">
                        <button
                          onClick={handleOpenAddModal}
                          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                        >
                          <AddIcon />
                          <span className="ml-2">Add Your First Job</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th className="p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Job Title</th>
                        <th className="p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Company</th>
                        <th className="p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Status</th>
                        <th
                          onClick={() => handleSort('createdAt')}
                          className="p-4 text-sm font-semibold text-slate-500 dark:text-slate-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <div className="flex items-center gap-1">
                            <span>Date Added</span>
                            {sortKey === 'createdAt' && <ArrowDownIcon />}
                          </div>
                        </th>
                        <th className="p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Type</th>
                        <th className="p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Contact</th>
                        <th className="p-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Link</th>
                        <th className="p-4 text-sm font-semibold text-slate-500 dark:text-slate-400 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedJobs.map((job) => (
                        <tr
                          key={job._id}
                          onClick={() => handleRowClick(job._id)}
                          className="border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                        >
                          <td className="p-4 font-medium text-slate-800 dark:text-slate-100">{job.jobTitle}</td>
                          <td className="p-4 text-slate-600 dark:text-slate-400">{job.companyName}</td>
                          <td className="p-4">
                            <JobStatusBadge type="application" status={job.status} />
                          </td>
                          <td className="p-4 text-slate-600 dark:text-slate-400">
                            <div className="flex flex-col">
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                {new Date(job.createdAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span>
                                {new Date(job.createdAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-slate-600 dark:text-slate-400">
                            {job.jobType ? (
                              <span>
                                {job.jobType === 'full-time' && 'Full-time'}
                                {job.jobType === 'part-time' && 'Part-time'}
                                {job.jobType === 'working-student' && 'Working Student'}
                                {job.jobType === 'internship' && 'Internship'}
                                {job.jobType === 'contract' && 'Contract'}
                                {job.jobType === 'freelance' && 'Freelance'}
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500">-</span>
                            )}
                          </td>
                          <td className="p-4 text-slate-600 dark:text-slate-400 max-w-[120px]" onClick={(e) => e.stopPropagation()}>
                            {/* Display structured contact info if available, otherwise fall back to legacy contact field */}
                            {job.contactEmail || job.contactPhone || job.hiringManagerName ? (
                              <div className="flex flex-col gap-0.5 text-xs">
                                {job.contactEmail && (
                                  <a href={`mailto:${job.contactEmail}`} className="text-indigo-500 dark:text-indigo-400 hover:underline truncate block" title={`Email: ${job.contactEmail}`}>
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
                              // Legacy contact field fallback
                              job.contact.includes('@') ? (
                                <a href={`mailto:${job.contact}`} className="text-indigo-500 dark:text-indigo-400 hover:underline truncate block" title={`Email ${job.contact}`}>
                                  {job.contact.length > 14 ? job.contact.substring(0, 14) + '...' : job.contact}
                                </a>
                              ) : job.contact.startsWith('http') ? (
                                <a href={job.contact} target="_blank" rel="noopener noreferrer" className="text-indigo-500 dark:text-indigo-400 hover:underline truncate block" title={job.contact}>
                                  {job.contact.length > 14 ? job.contact.substring(0, 14) + '...' : job.contact}
                                </a>
                              ) : (
                                <span className="truncate block" title={job.contact}>{job.contact.length > 14 ? job.contact.substring(0, 14) + '...' : job.contact}</span>
                              )
                            ) : '-'}
                          </td>
                          <td className="p-4" onClick={(e) => e.stopPropagation()}>
                            {job.jobUrl ? (
                              <div className="flex items-center gap-1">
                                {parseMultipleUrls(job.jobUrl).slice(0, 3).map((url, idx, arr) => (
                                  <a
                                    key={idx}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-md text-indigo-500 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                    title={`Open: ${url}`}
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    {arr.length > 1 && <span className="text-xs ml-0.5">{idx + 1}</span>}
                                  </a>
                                ))}
                                {parseMultipleUrls(job.jobUrl).length > 3 && (
                                  <span className="text-xs text-slate-500 dark:text-slate-400 ml-1" title={parseMultipleUrls(job.jobUrl).slice(3).join('\n')}>
                                    +{parseMultipleUrls(job.jobUrl).length - 3} more
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500">-</span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => handleToggleFavorite(job, e)}
                                className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${job.isFavorite
                                    ? 'text-amber-500 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 hover:bg-amber-200 dark:hover:bg-amber-900/70'
                                    : 'text-slate-400 dark:text-slate-500 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/50'
                                  }`}
                                title={job.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                              >
                                <StarIcon filled={!!job.isFavorite} />
                              </button>
                              <button
                                onClick={(e) => handleDeleteClick(job, e)}
                                className="flex items-center justify-center w-8 h-8 rounded-md text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                                title="Delete"
                              >
                                <DeleteIcon />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Pagination */}
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Showing {startIndex + 1} to {Math.min(endIndex, displayedJobs.length)} of {displayedJobs.length} results
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="flex items-center justify-center w-9 h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeftIcon />
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`flex items-center justify-center w-9 h-9 rounded-md text-sm font-semibold transition-colors ${currentPage === page
                            ? 'bg-indigo-600 dark:bg-indigo-600 text-white'
                            : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="flex items-center justify-center w-9 h-9 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          <div className="fixed inset-0 bg-black bg-opacity-60 dark:bg-opacity-80 flex justify-center items-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg mx-4 sm:mx-0 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Add New Job Manually
                </h2>
                <button
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50 transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col">
                {modalError && (
                  <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm rounded border border-red-300 dark:border-red-800">
                    {modalError}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto pr-1">
                  {/* Job Title */}
                  <div className="mb-5">
                    <label htmlFor="jobTitle" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Job Title <span className="text-red-500 dark:text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="jobTitle"
                      name="jobTitle"
                      value={formData.jobTitle || ''}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                    />
                  </div>

                  {/* Company Name */}
                  <div className="mb-5">
                    <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Company Name <span className="text-red-500 dark:text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="companyName"
                      name="companyName"
                      value={formData.companyName || ''}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                    />
                  </div>

                  {/* Status and Language - Side by Side */}
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    {/* Status */}
                    <div>
                      <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Status
                      </label>
                      <select
                        id="status"
                        name="status"
                        value={formData.status || 'Not Applied'}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors appearance-none cursor-pointer"
                      >
                        {statusOptions.map(status => (
                          <option key={status} value={status} className="bg-white dark:bg-gray-700">{status}</option>
                        ))}
                      </select>
                    </div>

                    {/* Language */}
                    <div>
                      <label htmlFor="language" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Language
                      </label>
                      <select
                        id="language"
                        name="language"
                        value={formData.language || 'en'}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors appearance-none cursor-pointer"
                      >
                        <option value="en" className="bg-white dark:bg-gray-700">English</option>
                        <option value="de" className="bg-white dark:bg-gray-700">German</option>
                      </select>
                    </div>
                  </div>

                  {/* CV Selection */}
                  <div className="mb-5">
                    <label htmlFor="baseCvId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Base CV
                    </label>
                    <select
                      id="baseCvId"
                      name="baseCvId"
                      value={formData.baseCvId || ''}
                      onChange={handleInputChange}
                      disabled={isLoadingCvs}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors appearance-none cursor-pointer disabled:opacity-50"
                    >
                      <option value="">
                        {isLoadingCvs ? 'Loading CVs...' : 'Select a CV (optional)'}
                      </option>
                      {cvs.map(cv => (
                        <option key={cv._id} value={cv._id} className="bg-white dark:bg-gray-700">
                          {cv.displayName || cv.category || 'Unnamed CV'}
                          {cv.isPrimary ? ' (Primary)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Choose which CV version to use as the base for this job application
                    </p>
                  </div>

                  {/* Job Type */}
                  <div className="mb-5">
                    <label htmlFor="jobType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Job Type
                    </label>
                    <select
                      id="jobType"
                      name="jobType"
                      value={formData.jobType || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors appearance-none cursor-pointer"
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
                        <label htmlFor="createdAt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                        />
                      </div>
                    );
                  })()}

                  {/* Job URL */}
                  <div className="mb-5">
                    <label htmlFor="jobUrl_modal" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Job URL(s)
                    </label>
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
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                    />
                    <p className="mt-1.5 text-[10px] uppercase tracking-wider font-semibold text-gray-400 dark:text-gray-500">
                      Separate multiples with commas or spaces
                    </p>
                  </div>

                  {/* Salary and Contact - Side by Side */}
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    {/* Salary */}
                    <div>
                      <label htmlFor="salary" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Salary
                      </label>
                      <input
                        type="text"
                        id="salary"
                        name="salary"
                        value={formData.salary || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                        placeholder="e.g., 50k-70k, $80,000"
                      />
                    </div>

                    {/* Contact */}
                    <div>
                      <label htmlFor="contact" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Contact
                      </label>
                      <input
                        type="text"
                        id="contact"
                        name="contact"
                        value={formData.contact || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                        placeholder="Email, link, or name"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="mb-5">
                    <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Notes
                    </label>
                    <textarea
                      id="notes"
                      name="notes"
                      rows={3}
                      value={formData.notes || ''}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors resize-none"
                    />
                  </div>
                </div>

                {/* Modal Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-purple-600 dark:bg-purple-600 text-white rounded-md hover:bg-purple-700 dark:hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors flex items-center gap-2"
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
          <div className="fixed inset-0 bg-black bg-opacity-60 dark:bg-opacity-80 flex justify-center items-center z-50">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md mx-4">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0 bg-red-100 dark:bg-red-900/30 p-3 rounded-full">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Delete Job Application</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Are you sure you want to delete this job application? This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md mb-4">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{deleteConfirmModal.jobTitle}</p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleDeleteCancel}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-md hover:bg-red-700 dark:hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
                >
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