// client/src/pages/DashboardPage.tsx
import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
 getJobs,
 createJob,
 deleteJob,
 updateJob,
 JobApplication,
 CreateJobPayload,
 JobsResponse,
 GetJobsParams,
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
import SimpleLoader from '../components/common/SimpleLoader';
import Toast from '../components/common/Toast';
import { TableOrCards, ColumnDef } from '../components/common/TableOrCards';
import DuplicateJobWarningModal from '../components/jobs/DuplicateJobWarningModal';
type JobPlatform = 'linkedin' | 'indeed' | 'xing' | 'stepstone' | null;

const ExpandableText: React.FC<{
 text: string;
 maxChars?: number;
 containerClassName?: string;
 textClassName?: string;
 textStyle?: React.CSSProperties;
}> = ({
 text,
 maxChars = 28,
 containerClassName = '',
 textClassName = '',
 textStyle,
}) => {
 const [isOpen, setIsOpen] = useState(false);
 const anchorRef = useRef<HTMLSpanElement>(null);
 const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
 const trimmed = text?.trim() || '';

 if (!trimmed) {
 return <span className={containerClassName}>-</span>;
 }

 const isLong = trimmed.length > maxChars;
 const preview = isLong ? `${trimmed.slice(0, maxChars).trim()}...` : trimmed;

 useLayoutEffect(() => {
 if (!isOpen || !anchorRef.current) return;

 const updatePosition = () => {
 if (!anchorRef.current) return;
 const rect = anchorRef.current.getBoundingClientRect();
 const maxWidth = Math.min(240, window.innerWidth - 32);
 let left = rect.left;
 if (left + maxWidth > window.innerWidth - 16) {
 left = Math.max(16, window.innerWidth - maxWidth - 16);
 }
 setPopoverStyle({
 position: 'fixed',
 top: rect.bottom + 8,
 left,
 width: maxWidth,
 zIndex: 60,
 });
 };

 updatePosition();
 window.addEventListener('scroll', updatePosition, true);
 window.addEventListener('resize', updatePosition);
 return () => {
 window.removeEventListener('scroll', updatePosition, true);
 window.removeEventListener('resize', updatePosition);
 };
 }, [isOpen]);

 return (
 <span
 ref={anchorRef}
 className={`relative inline-flex max-w-full items-center gap-2 ${containerClassName}`}
 onClick={(event) => event.stopPropagation()}
 >
 <span className={`block truncate ${textClassName}`} style={textStyle} title={trimmed}>
 {preview}
 </span>
 {isLong && (
 <>
 <button
 type="button"
 className="text-[10px] uppercase tracking-wide"
 style={{ color: 'var(--accent)' }}
 onClick={(event) => {
 event.stopPropagation();
 setIsOpen((prev) => !prev);
 }}
 >
 {isOpen ? 'Less' : 'More'}
 </button>
 {isOpen && createPortal(
 <span
 className="rounded-lg border px-3 py-2 text-xs shadow-lg"
 style={{
 ...popoverStyle,
 background: 'var(--bg-elevated)',
 borderColor: 'var(--border)',
 color: 'var(--text-secondary)'
 }}
 >
 {trimmed}
 </span>,
 document.body
 )}
 </>
 )}
 </span>
 );
};

const TagCards: React.FC<{
 tags: string[];
 max?: number;
 size?: 'xs' | 'sm';
}> = ({ tags, max = 4, size = 'sm' }) => {
 const visibleTags = tags.slice(0, max);
 const remaining = tags.length - visibleTags.length;
 const sizeClasses = size === 'xs'
 ? 'text-[10px] px-2 py-0.5'
 : 'text-[11px] px-2.5 py-1';

 return (
 <div className="flex flex-wrap gap-1.5">
 {visibleTags.map((tag) => (
 <span
 key={tag}
 className={`inline-flex items-center rounded-md border ${sizeClasses}`}
 style={{
 background: 'var(--bg-raised)',
 color: 'var(--text-secondary)',
 borderColor: 'var(--border)',
 boxShadow: '0 1px 2px rgba(0, 0, 0, 0.12)'
 }}
 >
 {tag}
 </span>
 ))}
 {remaining > 0 && (
 <span
 className={`inline-flex items-center rounded-md border ${sizeClasses}`}
 style={{
 background: 'var(--bg-elevated)',
 color: 'var(--text-muted)',
 borderColor: 'var(--border)',
 boxShadow: '0 1px 2px rgba(0, 0, 0, 0.12)'
 }}
 >
 +{remaining}
 </span>
 )}
 </div>
 );
};

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

const DashboardPage: React.FC = () => {
 const navigate = useNavigate();
 const [searchParams, setSearchParams] = useSearchParams();

 const MAX_JOB_TAGS = 6;
 const UNTAGGED_FILTER_KEY = '__untagged__';

 // --- Core State ---
 const [jobs, setJobs] = useState<JobApplication[]>([]);
 const [allJobs, setAllJobs] = useState<JobApplication[]>([]);
 const [isLoading, setIsLoading] = useState<boolean>(true);
 const [error, setError] = useState<string | null>(null);

 // --- Server-side Pagination State ---
 const [totalJobs, setTotalJobs] = useState<number>(0);
 const [totalPagesServer, setTotalPagesServer] = useState<number>(0);

 // --- CV State ---
 const [cvs, setCvs] = useState<CVDocument[]>([]);
 const [isLoadingCvs, setIsLoadingCvs] = useState<boolean>(false);
 const [cvsFetched, setCvsFetched] = useState<boolean>(false);
 const cvsFetchPromiseRef = useRef<Promise<void> | null>(null);

 // --- Modal & Form State ---
 const [modalMode, setModalMode] = useState<'add' | null>(null);
 const [formData, setFormData] = useState<JobFormData>({});
 const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
 const [modalError, setModalError] = useState<string | null>(null);
 const [jobTagInput, setJobTagInput] = useState<string>('');
 const modalRef = useRef<HTMLDivElement>(null);
 const modalTriggerRef = useRef<HTMLButtonElement | null>(null);

 // Focus trap for modal
 useEffect(() => {
 if (modalMode && modalRef.current) {
 // Store the trigger element that opened the modal
 modalTriggerRef.current = document.activeElement as HTMLButtonElement;

 // Focus first focusable element
 const firstFocusable = modalRef.current.querySelector<HTMLInputElement>( 'input, select, textarea, button');
 if (firstFocusable) {
 firstFocusable.focus();
 }

 // Trap focus within modal
 const handleTabKey = (e: KeyboardEvent) => {
 if (e.key !== 'Tab') return;

 const focusableElements = modalRef.current?.querySelectorAll<HTMLInputElement>(
 'input, select, textarea, button:not([disabled])'
 );
 if (!focusableElements || focusableElements.length === 0) return;

 const firstElement = focusableElements[0] as HTMLElement;
 const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

 if (e.shiftKey) {
 if (document.activeElement === firstElement) {
 e.preventDefault();
 lastElement.focus();
 }
 } else {
 if (document.activeElement === lastElement) {
 e.preventDefault();
 firstElement.focus();
 }
 }
 };

 document.addEventListener('keydown', handleTabKey);

 return () => {
 document.removeEventListener('keydown', handleTabKey);
 // Return focus to trigger when modal closes
 if (modalTriggerRef.current) {
 modalTriggerRef.current.focus();
 }
 };
 }
 }, [modalMode]);

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
 const [debouncedFilterText, setDebouncedFilterText] = useState<string>('');
 const [filterStatus, setFilterStatus] = useState<string>('');
 const [filterFavorite, setFilterFavorite] = useState<boolean>(false);
 const [filterHasNotes, setFilterHasNotes] = useState<boolean>(false);
 const [filterJobType, setFilterJobType] = useState<string>('');
 const [filterTags, setFilterTags] = useState<string[]>([]);
 const [groupByTag, setGroupByTag] = useState<boolean>(false);
 const [sortKey, setSortKey] = useState<SortableJobKeys>('createdAt');
 const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
 const [isFieldMenuOpen, setIsFieldMenuOpen] = useState(false);
 const fieldMenuRef = useRef<HTMLDivElement>(null);
 const fieldMenuTriggerRef = useRef<HTMLButtonElement>(null);
 const [fieldMenuStyle, setFieldMenuStyle] = useState<React.CSSProperties>({});

 useEffect(() => {
 const timer = setTimeout(() => setDebouncedFilterText(filterText), 400);
 return () => clearTimeout(timer);
 }, [filterText]);

 useEffect(() => {
 setCurrentPage(1);
 }, [debouncedFilterText]);

// --- Toast State ---
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // --- Add Job Popup Modal State ---
 const [isAddJobPopupOpen, setIsAddJobPopupOpen] = useState<boolean>(false);
 const addJobPopupRef = useRef<HTMLDivElement>(null);
 const addJobTriggerRef = useRef<HTMLButtonElement | null>(null);

 const handleCloseAddJobPopup = useCallback(() => {
 if (isCreatingFromText) return;
 setIsAddJobPopupOpen(false);
 setCreateFromTextError(null);
 }, [isCreatingFromText]);

 // Focus trap for Add Job popup
 useEffect(() => {
 if (isAddJobPopupOpen && addJobPopupRef.current) {
 addJobTriggerRef.current = document.activeElement as HTMLButtonElement;
 const firstFocusable = addJobPopupRef.current.querySelector<HTMLInputElement>('input, select, textarea, button');
 if (firstFocusable) firstFocusable.focus();

 const handleTabKey = (e: KeyboardEvent) => {
 if (e.key !== 'Tab') return;
 const focusableElements = addJobPopupRef.current?.querySelectorAll<HTMLInputElement>('input, select, textarea, button:not([disabled])');
 if (!focusableElements || focusableElements.length === 0) return;
 const firstElement = focusableElements[0] as HTMLElement;
 const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
 if (e.shiftKey) {
 if (document.activeElement === firstElement) { e.preventDefault(); lastElement.focus(); }
 } else {
 if (document.activeElement === lastElement) { e.preventDefault(); firstElement.focus(); }
 }
 };

 const handleEscape = (e: KeyboardEvent) => {
 if (e.key === 'Escape') handleCloseAddJobPopup();
 };

 document.addEventListener('keydown', handleTabKey);
 document.addEventListener('keydown', handleEscape);
 return () => {
 document.removeEventListener('keydown', handleTabKey);
 document.removeEventListener('keydown', handleEscape);
 if (addJobTriggerRef.current) addJobTriggerRef.current.focus();
 };
 }
 }, [isAddJobPopupOpen, handleCloseAddJobPopup]);



 const normalizeTagValue = (value: string): string => value.trim().replace(/\s+/g, ' ');

 const getJobTags = (job: JobApplication): string[] => {
 const tags: string[] = [];
 const seen = new Set<string>();
 const pushTag = (tag?: string | null) => {
 if (!tag) return;
 const normalized = normalizeTagValue(tag);
 if (!normalized) return;
 const key = normalized.toLowerCase();
 if (seen.has(key)) return;
 seen.add(key);
 tags.push(normalized);
 };

 if (Array.isArray(job.jobTags)) {
 job.jobTags.forEach(pushTag);
 }
 if (job.jobCategory) {
 pushTag(job.jobCategory);
 }

 return tags;
 };

 const tagCounts = useMemo(() => {
 const counts = new Map<string, number>();
 allJobs.forEach((job) => {
 getJobTags(job).forEach((tag) => {
 const key = tag.toLowerCase();
 counts.set(key, (counts.get(key) || 0) + 1);
 });
 });
 return counts;
 }, [allJobs]);

 const availableTags = useMemo(() => {
 const tags = new Map<string, string>();
 allJobs.forEach((job) => {
 getJobTags(job).forEach((tag) => {
 const key = tag.toLowerCase();
 if (!tags.has(key)) {
 tags.set(key, tag);
 }
 });
 });
 return Array.from(tags.values()).sort((a, b) => {
 const countDiff = (tagCounts.get(b.toLowerCase()) || 0) - (tagCounts.get(a.toLowerCase()) || 0);
 if (countDiff !== 0) return countDiff;
 return a.localeCompare(b);
 });
 }, [allJobs, tagCounts]);

 const hasUntaggedJobs = useMemo(
 () => allJobs.some((job) => getJobTags(job).length === 0),
 [allJobs]
 );

 const hasFieldOptions = availableTags.length > 0;

 const fieldFilterOptions = useMemo(() => {
 const options = availableTags.map((tag) => ({ key: tag, label: tag, count: tagCounts.get(tag.toLowerCase()) || 0 }));
 if (hasUntaggedJobs) {
 options.push({ key: UNTAGGED_FILTER_KEY, label: 'Untagged', count: 0 });
 }
 return options;
 }, [availableTags, hasUntaggedJobs, tagCounts]);

 const addTagsToForm = (rawValue: string) => {
 const currentTags = Array.isArray(formData.jobTags) ? [...formData.jobTags] : [];
 const seen = new Set(currentTags.map((tag) => normalizeTagValue(tag).toLowerCase()));
 const parts = rawValue.split(',');

 for (const part of parts) {
 if (currentTags.length >= MAX_JOB_TAGS) break;
 const normalized = normalizeTagValue(part);
 if (!normalized) continue;
 const key = normalized.toLowerCase();
 if (seen.has(key)) continue;
 seen.add(key);
 currentTags.push(normalized);
 }

 setFormData((prev) => ({ ...prev, jobTags: currentTags }));
 };

 const removeTagFromForm = (tagToRemove: string) => {
 const keyToRemove = normalizeTagValue(tagToRemove).toLowerCase();
 setFormData((prev) => ({
 ...prev,
 jobTags: (prev.jobTags || []).filter((tag) => normalizeTagValue(tag).toLowerCase() !== keyToRemove),
 }));
 };

 const toggleTagFilter = (tag: string) => {
 setFilterTags((prev) =>
 prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
 );
 };

 const renderTagCards = (tags: string[], size: 'xs' | 'sm' = 'sm') => {
 if (tags.length === 0) return null;
 return <TagCards tags={tags} max={4} size={size} />;
 };

 const MAX_VISIBLE_FIELDS = 8;
 const visibleFieldOptions = fieldFilterOptions.slice(0, MAX_VISIBLE_FIELDS);
 const hiddenFieldOptions = fieldFilterOptions.slice(MAX_VISIBLE_FIELDS);

 useEffect(() => {
 if (!hasFieldOptions && groupByTag) {
 setGroupByTag(false);
 }
 }, [hasFieldOptions, groupByTag]);

 useEffect(() => {
 if (!isFieldMenuOpen) return;

 const handleClickOutside = (event: MouseEvent) => {
 if (fieldMenuRef.current && !fieldMenuRef.current.contains(event.target as Node)) {
 setIsFieldMenuOpen(false);
 }
 };

 const handleEscape = (event: KeyboardEvent) => {
 if (event.key === 'Escape') {
 setIsFieldMenuOpen(false);
 }
 };

 document.addEventListener('mousedown', handleClickOutside);
 document.addEventListener('keydown', handleEscape);

 return () => {
 document.removeEventListener('mousedown', handleClickOutside);
 document.removeEventListener('keydown', handleEscape);
 };
 }, [isFieldMenuOpen]);

 useEffect(() => {
 if (!isFieldMenuOpen) return;

 const updatePosition = () => {
 const rect = fieldMenuTriggerRef.current?.getBoundingClientRect();
 if (!rect) return;
 const maxWidth = Math.min(520, window.innerWidth - 32);
 const left = Math.max(16, Math.min(rect.right - maxWidth, window.innerWidth - maxWidth - 16));
 const maxHeight = Math.min(360, window.innerHeight - rect.bottom - 24);
 setFieldMenuStyle({
 position: 'fixed',
 top: rect.bottom + 8,
 left,
 width: maxWidth,
 maxHeight,
 zIndex: 80,
 });
 };

 updatePosition();
 window.addEventListener('resize', updatePosition);
 window.addEventListener('scroll', updatePosition, true);
 return () => {
 window.removeEventListener('resize', updatePosition);
 window.removeEventListener('scroll', updatePosition, true);
 };
 }, [isFieldMenuOpen]);

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

const favoriteCount = useMemo(() => allJobs.filter((job) => job.isFavorite === true).length, [allJobs]);
  const notesCount = useMemo(() => allJobs.filter((job) => !!job.notes && job.notes.trim().length > 0).length, [allJobs]);



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



 const hasAnyCv = cvsFetched ? cvs.length > 0 : true; // Assume true until fetched to avoid blocking journey banner
 const hasAnyJob = totalJobs > 0;
 const everHadJobsRef = useRef(false);
 if (totalJobs > 0) everHadJobsRef.current = true;
 const hasAnyCoverLetter = useMemo(
 // Note: With server-side pagination, this only checks jobs on the current page.
 // For accuracy, we accept this limitation as cover letter check is primarily for the onboarding journey.
 () => jobs.some(job => Boolean(job.generatedCoverLetterFilename || job.draftCoverLetterText || job.coverLetterEmailBody)),
 [jobs]
 );
 const isJourneyComplete = hasAnyCv && hasAnyJob && hasAnyCoverLetter;

 const handleJourneyPrimaryAction = () => {
 if (!hasAnyCv) {
 navigate('/manage-cv');
 return;
 }

 if (!hasAnyJob) {
 handleOpenAddJobPopup();
 return;
 }

 const targetJob = jobs.find(job => !job.generatedCoverLetterFilename && !job.draftCoverLetterText) || jobs[0];
 navigate(`/jobs/${targetJob._id}/workspace/cover-letter`);
 };

 // --- useEffect: Fetch initial job data (server-side pagination & filtering) ---
 useEffect(() => {
 const fetchJobs = async () => {
 setIsLoading(true);
 setError(null);
 try {
 const params: GetJobsParams = {
 page: currentPage,
 limit: 10,
 sortBy: sortKey,
sortOrder: sortDirection,
  };

  if (filterStatus) params.status = filterStatus;
  if (filterJobType) params.jobType = filterJobType;
  if (debouncedFilterText) params.search = debouncedFilterText;
  if (filterFavorite) params.isFavorite = true;
  if (filterHasNotes) params.hasNotes = true;
  if (filterTags.length > 0) params.tags = filterTags;

  const result: JobsResponse = await getJobs(params);
  setJobs(result.jobs);
 setTotalJobs(result.pagination.total);
 setTotalPagesServer(result.pagination.pages);
 if (result.jobs.length > 0 && typeof window !== 'undefined') {
 window.localStorage.setItem('vh:has-created-first-job', '1');
 }
 } catch (err: any) {
 console.error("Failed to fetch jobs:", err);
 setError(err.message || "Failed to load job applications.");
 } finally {
 setIsLoading(false);
 }
};
  fetchJobs();
  }, [currentPage, debouncedFilterText, filterStatus, filterFavorite, filterHasNotes, filterJobType, filterTags, sortKey, sortDirection]);

  // --- Lazy CV Fetch: Only fetch when actually needed ---
 const fetchCvsIfNeeded = () => {
 if (cvsFetched || cvsFetchPromiseRef.current) return; // Already fetched or in-flight

 const promise = (async () => {
 setIsLoadingCvs(true);
 try {
 const fetchedCvs = await getCvBranches({ lite: true });
 setCvs(fetchedCvs.branches);
 setCvsFetched(true);
 } catch (err: any) {
 console.error("Failed to fetch CVs:", err);
 } finally {
 setIsLoadingCvs(false);
 cvsFetchPromiseRef.current = null;
 }
 })();

 cvsFetchPromiseRef.current = promise;
 };

 const handleOpenAddJobPopup = useCallback(() => {
 fetchCvsIfNeeded();
 setIsAddJobPopupOpen(true);
 }, [fetchCvsIfNeeded]);

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


 // --- Fetch all matching jobs (unpaginated) for tag/filter computation ---
 useEffect(() => {
 const fetchAllJobsForFilters = async () => {
 try {
 const params: GetJobsParams = {
 limit: 'all',
 sortBy: sortKey,
 sortOrder: sortDirection,
 };

if (filterStatus) params.status = filterStatus;
  if (filterJobType) params.jobType = filterJobType;
  if (debouncedFilterText) params.search = debouncedFilterText;
  if (filterFavorite) params.isFavorite = true;
  if (filterHasNotes) params.hasNotes = true;
  if (filterTags.length > 0) params.tags = filterTags;

  const result: JobsResponse = await getJobs(params);
  setAllJobs(result.jobs);
 } catch (err: any) {
 console.error("Failed to fetch all jobs for filters:", err);
 }
};
  fetchAllJobsForFilters();
  }, [debouncedFilterText, filterStatus, filterFavorite, filterHasNotes, filterJobType, filterTags, sortKey, sortDirection]);

 // Note: Page reset is handled automatically by the fetchJobs useEffect dependencies above.

 // --- Derived State: Jobs from server (filtering & sorting done server-side) ---
 const displayedJobs = useMemo(() => {
 // If groupByTag mode is active, show all unpaginated jobs so grouping covers the full dataset
 if (groupByTag) return allJobs;
 // Otherwise just return the paginated jobs from the server
 return jobs;
 }, [jobs, allJobs, groupByTag]);

 const groupedJobs = useMemo(() => {
 if (!groupByTag) return null;

 const selectedTags = filterTags.filter((tag) => tag !== UNTAGGED_FILTER_KEY);
 const selectedOrder = selectedTags.length > 0 ? selectedTags : availableTags;
 const groups = new Map<string, { label: string; jobs: JobApplication[] }>();
 const untagged: JobApplication[] = [];

 const matchesTag = (tags: string[], target: string) =>
 tags.some((tag) => normalizeTagValue(tag).toLowerCase() === normalizeTagValue(target).toLowerCase());

 displayedJobs.forEach((job) => {
 const tags = getJobTags(job);
 if (tags.length === 0) {
 untagged.push(job);
 return;
 }

 let primaryTag = tags[0];
 if (selectedOrder.length > 0) {
 const matched = selectedOrder.find((tag) => matchesTag(tags, tag));
 if (matched) primaryTag = matched;
 }

 const key = normalizeTagValue(primaryTag).toLowerCase();
 if (!groups.has(key)) {
 groups.set(key, { label: primaryTag, jobs: [] });
 }
 groups.get(key)!.jobs.push(job);
 });

 const orderedGroups: Array<{ label: string; jobs: JobApplication[] }> = [];
 selectedOrder.forEach((tag) => {
 const key = normalizeTagValue(tag).toLowerCase();
 const group = groups.get(key);
 if (group && group.jobs.length > 0) {
 orderedGroups.push(group);
 }
 });

 groups.forEach((group, key) => {
 if (!orderedGroups.some((item) => normalizeTagValue(item.label).toLowerCase() === key)) {
 orderedGroups.push(group);
 }
 });

 if (untagged.length > 0) {
 orderedGroups.push({ label: 'Untagged', jobs: untagged });
 }

return orderedGroups;
  }, [groupByTag, displayedJobs, filterTags, availableTags]);

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
 setJobTagInput('');
 setModalError(null);
 setModalMode('add');
 };

 const handleCloseModal = () => {
 if (isSubmitting) return;
 setModalMode(null);
 setFormData({});
 setJobTagInput('');
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
 setAllJobs(prevJobs => [createdJob, ...prevJobs]);
 if (typeof window !== 'undefined') {
 window.localStorage.setItem('vh:has-created-first-job', '1');
 }
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
 setAllJobs(prevJobs => prevJobs.filter(job => job._id !== jobId));
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
 setAllJobs(prevJobs => prevJobs.map(j => j._id === job._id ? updatedJob : j));
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
 setAllJobs(prevJobs => [newJob, ...prevJobs]);
 if (typeof window !== 'undefined') {
 window.localStorage.setItem('vh:has-created-first-job', '1');
 }
 setJobTextInput('');
 setPreExtractionJobUrl('');
 setPreExtractionJobType('');
 setDuplicateWarning({ isOpen: false, duplicates: [], pendingPayload: null });
 setToast({ message: 'Job application created successfully!', type: 'success' });
 navigate(`/jobs/${newJob._id}/workspace/job-description`);
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
 navigate(`/jobs/${jobId}/workspace/`);
 };


 // Define status options for filter dropdown
 const statusOptions: JobApplication['status'][] = ['Not Applied', 'Applied', 'Interview', 'Assessment', 'Rejected', 'Offer'];

 // Status colors for dropdown badge
const statusColors: Record<JobApplication['status'], string> = {
    'Not Applied': 'bg-elevated text-secondary-color',
    'Applied': 'bg-[var(--jade-bg)] text-green',
    'Interview': 'bg-gold-lightest text-gold-dark',
    'Assessment': 'bg-[var(--ember-bg)] text-ember',
    'Rejected': 'bg-[var(--rose-bg)] text-error',
    'Closed': 'bg-elevated text-secondary-color',
    'Offer': 'bg-[var(--jade-bg)] text-[var(--jade)]',
  };

 // Per-status colors for the dropdown option rows (dot + label)
const statusOptionColors: Record<JobApplication['status'], { dot: string; text: string }> = {
    'Not Applied': { dot: 'bg-[var(--text-muted)]', text: 'text-muted-color' },
    'Applied': { dot: 'bg-green-400', text: 'text-green' },
    'Interview': { dot: 'bg-gold', text: 'text-gold-dark' },
    'Assessment': { dot: 'bg-amber-400', text: 'text-ember' },
    'Rejected': { dot: 'bg-red-400', text: 'text-error' },
    'Closed': { dot: 'bg-[var(--text-muted)]', text: 'text-secondary-color' },
    'Offer': { dot: 'bg-green', text: 'text-green' },
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
 setAllJobs(prev => prev.map(j => j._id === jobId ? { ...j, status: newStatus } : j));
 } catch (error) {
 console.error('Failed to update status:', error);
 }
 };

 // Status dropdown component
 const StatusDropdown: React.FC<{ job: JobApplication }> = ({ job }) => {
 const [isOpen, setIsOpen] = useState(false);
 const [focusedIndex, setFocusedIndex] = useState(-1);
 const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
 const dropdownRef = useRef<HTMLDivElement>(null);
 const triggerRef = useRef<HTMLButtonElement>(null);
 const menuRef = useRef<HTMLDivElement>(null);
 const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

 useEffect(() => {
 const handleClickOutside = (event: MouseEvent) => {
 const target = event.target as Node;
 if (dropdownRef.current?.contains(target) || menuRef.current?.contains(target)) {
 return;
 }
 setIsOpen(false);
 setFocusedIndex(-1);
 };
 document.addEventListener('mousedown', handleClickOutside);
 return () => document.removeEventListener('mousedown', handleClickOutside);
 }, []);

 useEffect(() => {
 if (!isOpen) return;

 const updatePosition = () => {
 const rect = triggerRef.current?.getBoundingClientRect();
 if (!rect) return;
 setMenuStyle({
 position: 'fixed',
 top: rect.bottom + 6,
 left: rect.left,
 minWidth: Math.max(rect.width, 176),
 zIndex: 9999,
 });
 };

 updatePosition();
 window.addEventListener('resize', updatePosition);
 window.addEventListener('scroll', updatePosition, true);
 return () => {
 window.removeEventListener('resize', updatePosition);
 window.removeEventListener('scroll', updatePosition, true);
 };
 }, [isOpen]);

 const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
 switch (e.key) {
 case 'Enter':
 case ' ':
 case 'ArrowDown':
 e.preventDefault();
 setIsOpen(true);
 setFocusedIndex(0);
 setTimeout(() => optionRefs.current[0]?.focus(), 0);
 break;
 case 'ArrowUp':
 e.preventDefault();
 setIsOpen(true);
 setFocusedIndex(statusOptions.length - 1);
 setTimeout(() => optionRefs.current[statusOptions.length - 1]?.focus(), 0);
 break;
 case 'Escape':
 e.preventDefault();
 setIsOpen(false);
 triggerRef.current?.focus();
 break;
 }
 };

 const handleOptionKeyDown = (e: React.KeyboardEvent, index: number) => {
 switch (e.key) {
 case 'Enter':
 case ' ':
 e.preventDefault();
 handleStatusChange(job._id, statusOptions[index]);
 setIsOpen(false);
 triggerRef.current?.focus();
 break;
 case 'Escape':
 e.preventDefault();
 setIsOpen(false);
 setFocusedIndex(-1);
 triggerRef.current?.focus();
 break;
 case 'ArrowDown':
 e.preventDefault();
 const nextIndex = (index + 1) % statusOptions.length;
 setFocusedIndex(nextIndex);
 optionRefs.current[nextIndex]?.focus();
 break;
 case 'ArrowUp':
 e.preventDefault();
 const prevIndex = (index - 1 + statusOptions.length) % statusOptions.length;
 setFocusedIndex(prevIndex);
 optionRefs.current[prevIndex]?.focus();
 break;
 case 'Tab':
 e.preventDefault();
 setIsOpen(false);
 triggerRef.current?.focus();
 break;
 }
 };

 return (
 <div className="relative" ref={dropdownRef}>
 <button
 ref={triggerRef}
 onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
 onKeyDown={handleTriggerKeyDown}
 className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all hover:shadow-sm ${statusColors[job.status] || statusColors['Not Applied']}`}
 aria-label={`Change status for ${job.jobTitle} at ${job.companyName}, currently ${job.status}`}
 aria-haspopup="listbox"
 aria-expanded={isOpen}
 >
 {job.status}
 <svg className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </button>
 {isOpen && createPortal(
 <div
 ref={menuRef}
 className="rounded-xl shadow-xl py-1 overflow-hidden bg-white#1a1a28]"
 style={{
 ...menuStyle,
 backgroundColor: 'var(--bg-surface)',
 backgroundImage: 'none',
 border: '1px solid var(--border)',
 boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
 opacity: 1,
 mixBlendMode: 'normal',
 isolation: 'isolate',
 filter: 'none',
 backdropFilter: 'none'
 }}
 role="listbox"
 aria-label={`Select status for ${job.jobTitle} at ${job.companyName}`}
 aria-activedescendant={focusedIndex >= 0 ? `status-option-${focusedIndex}` : undefined}
 >
 {statusOptions.map((status, index) => (
 <button
 key={status}
 ref={el => optionRefs.current[index] = el}
 id={`status-option-${index}`}
 onClick={(e) => {
 e.stopPropagation();
 handleStatusChange(job._id, status);
 setIsOpen(false);
 triggerRef.current?.focus();
 }}
 onKeyDown={(e) => handleOptionKeyDown(e, index)}
 className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 transition-colors ${statusOptionColors[status]?.text ?? 'text-secondary-color'}`}
 style={job.status === status ? { background: 'var(--bg-raised)' } : undefined}
 role="option"
 aria-selected={job.status === status}
 >
 <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusOptionColors[status]?.dot ?? 'bg-[var(--text-muted)]'}`} />
 {status}
 </button>
 ))}
 </div>,
 document.body
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

  // --- JobCard Component (new card layout) ---
 const JobCard: React.FC<{ job: JobApplication }> = ({ job }) => {
 const isArchived = ['Rejected', 'Closed', 'Withdrawn'].includes(job.status);
 const platform = job.jobUrl ? (() => {
 const urls = parseMultipleUrls(job.jobUrl);
 return urls.length > 0 ? getJobPlatform(urls[0]) : null;
 })() : null;

 const getStatusBadgeStyles = (status: string) => {
 switch (status) {
 case 'Interview':
 return { bg: '#faf6ee', color: '#cba258', border: 'rgba(223,196,157,0.30)' };
 case 'Applied':
 return { bg: '#d4e9e2', color: '#006241', border: 'rgba(0,117,74,0.20)' };
 case 'Offer':
 return { bg: '#d4e9e2', color: '#006241', border: 'rgba(0,117,74,0.20)' };
 case 'Assessment':
 return { bg: 'var(--ember-bg)', color: '#d4a017', border: 'rgba(212,160,23,0.20)' };
 case 'Rejected':
 return { bg: 'var(--rose-bg)', color: '#c82014', border: 'rgba(200,32,20,0.20)' };
 case 'Closed':
 return { bg: '#f5f5f4', color: '#78716c', border: '#e7e5e4' };
 default:
 return { bg: '#f5f5f4', color: '#78716c', border: '#e7e5e4' };
 }
 };

 const badgeStyles = getStatusBadgeStyles(job.status);
 const appliedDate = job.dateApplied || job.createdAt;

 return (
 <div
 className={`bg-white rounded-2xl p-6 whisper-shadow border flex flex-col md:flex-row items-center justify-between gap-6 cursor-pointer hover:shadow-lg transition-all group ${isArchived ? 'opacity-80' : ''}`}
 style={{
 borderColor: isArchived ? 'rgba(231,229,228,0.50)' : '#f5f5f4',
 background: isArchived ? 'rgba(255,255,255,0.60)' : '#ffffff'
 }}
 onClick={() => handleRowClick(job._id)}
 >
 <div className="flex items-center gap-6 w-full md:w-auto">
 {/* Company avatar */}
 <div
 className="w-16 h-16 bg-stone-50 rounded-xl flex items-center justify-center p-3 border shrink-0 group-hover:scale-105 transition-transform"
 style={{ borderColor: '#f5f5f4' }}
 >
 {platform ? (
 <PlatformIcon platform={platform} className="w-8 h-8" />
 ) : (
 <span className="text-2xl font-black" style={{ color: 'var(--accent)' }}>
 {(job.companyName || '?')[0].toUpperCase()}
 </span>
 )}
 </div>
 <div>
 <h3 className={`font-manrope font-extrabold text-xl tracking-tight ${isArchived ? 'line-through opacity-60' : ''}`} style={{ color: isArchived ? '#a8a29e' : 'var(--accent)' }}>
 {job.jobTitle}
 </h3>
 <p className="font-semibold text-sm" style={{ color: isArchived ? '#a8a29e' : '#78716c' }}>{job.companyName}</p>
 </div>
 </div>
 <div className="flex flex-wrap items-center gap-8 w-full md:w-auto justify-between md:justify-end">
 <div className="flex flex-col">
 <span className="text-[10px] uppercase font-black tracking-widest mb-1.5" style={{ color: isArchived ? '#d6d3d1' : '#a8a29e' }}>Status</span>
 <StatusDropdown job={job} />
 </div>
 <div className="flex flex-col">
 <span className="text-[10px] uppercase font-black tracking-widest mb-1.5" style={{ color: isArchived ? '#d6d3d1' : '#a8a29e' }}>Applied Date</span>
 <span className="text-sm font-bold" style={{ color: isArchived ? '#a8a29e' : '#44403c' }}>
 {appliedDate ? new Date(appliedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
 </span>
 </div>
 <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
 <button
 onClick={(e) => handleToggleFavorite(job, e)}
 className={`w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-90 ${job.isFavorite ? 'text-gold bg-gold-lightest' : 'text-stone-400 hover:text-green-600'}`}
 title={job.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
 aria-label={job.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
 >
 <StarIcon filled={!!job.isFavorite} />
 </button>
 <button
 onClick={(e) => handleDeleteClick(job, e)}
 className="w-10 h-10 flex items-center justify-center text-stone-400 hover:text-red-500 rounded-full transition-all active:scale-90"
 title="Delete"
 aria-label="Delete job application"
 >
 <DeleteIcon />
 </button>
 </div>
 </div>
 </div>
 );
 };

  // --- TableOrCards Configuration ---
 const jobColumns: ColumnDef<JobApplication>[] = [
 {
 key: 'jobTitle',
 label: 'Job Title',
 sortable: true,
 onSort: () => handleSort('jobTitle'),
 sortDirection: sortKey === 'jobTitle' ? sortDirection : null,
 wrap: true,
 className: 'max-w-[200px]',
 render: (job) => (
 <div>
 <span className="font-medium line-clamp-1 block" style={{ color: 'var(--text-primary)' }} title={job.jobTitle}>
 {job.jobTitle}
 </span>
 {(() => {
 const tags = getJobTags(job);
 return tags.length > 0 ? (
 <div className="mt-1">
 {renderTagCards(tags, 'xs')}
 </div>
 ) : null;
 })()}
 </div>
 ),
 },
 {
 key: 'companyName',
 label: 'Company',
 wrap: true,
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
 <span className="line-clamp-1" style={{ color: 'var(--text-secondary)' }} title={job.companyName}>{job.companyName}</span>
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
 key: 'contact',
 label: 'Contact',
 render: (job) => {
 const hasStructuredContact = job.contactEmail || job.contactPhone || job.hiringManagerName;
 return (
 <div className="text-secondary-color max-w-[120px]" onClick={(e) => e.stopPropagation()}>
 {hasStructuredContact ? (
 <div className="flex flex-col gap-0.5 text-xs">
 {job.contactEmail && (
 <a href={`mailto:${job.contactEmail}`} className="hover:underline truncate block" style={{ color: 'var(--accent)' }} title={`Email: ${job.contactEmail}`}>
 {job.contactEmail.length > 12 ? job.contactEmail.substring(0, 12) + '...' : job.contactEmail}
 </a>
 )}
 {job.contactPhone && (
 <span className="truncate block" title={`Phone: ${job.contactPhone}`}>
 {job.contactPhone.length > 12 ? job.contactPhone.substring(0, 12) + '...' : job.contactPhone}
 </span>
 )}
 {job.hiringManagerName && (
 <span className="truncate block text-secondary-color" title={`Contact: ${job.hiringManagerName}`}>
 {job.hiringManagerName.length > 12 ? job.hiringManagerName.substring(0, 12) + '...' : job.hiringManagerName}
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
 <span className="flex items-center justify-center w-8 h-8 min-h-[44px] text-blue-500" title={`Note: ${job.notes.length > 100 ? job.notes.substring(0, 100) + '...' : job.notes}`}>
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
 </svg>
 </span>
 )}
 {job.jobUrl && parseMultipleUrls(job.jobUrl).slice(0, 2).map((url, idx, arr) => (
 <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-8 h-8 min-h-[44px] rounded-md transition-colors" style={{ color: 'var(--accent)' }} title={`Open: ${url}`} aria-label={`Open job posting ${idx + 1}`}>
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
 </svg>
 {arr.length > 1 && <span className="text-xs ml-0.5">{idx + 1}</span>}
 </a>
 ))}
 {job.jobUrl && parseMultipleUrls(job.jobUrl).length > 2 && (
 <span className="text-xs text-secondary-color px-1" title={parseMultipleUrls(job.jobUrl).slice(2).join('\n')}>
 +{parseMultipleUrls(job.jobUrl).length - 2}
 </span>
 )}
<button onClick={(e) => handleToggleFavorite(job, e)} className={`flex items-center justify-center w-8 h-8 min-h-[44px] rounded-md transition-colors ${job.isFavorite ? 'text-ember bg-[var(--ember-bg)] hover:bg-amber-200' : 'text-muted-color hover:text-amber-500 hover:bg-amber-100'}`} title={job.isFavorite ? 'Remove from favorites' : 'Add to favorites'} aria-label={job.isFavorite ? "Remove from favorites" : "Add to favorites"}>
  <StarIcon filled={!!job.isFavorite} />
  </button>
  <button onClick={(e) => handleDeleteClick(job, e)} className="flex items-center justify-center w-8 h-8 min-h-[44px] rounded-md text-error hover:bg-red-100 transition-colors" title="Delete" aria-label="Delete job application">
 <DeleteIcon />
 </button>
 </div>
 ),
 },
 ];


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
 <div className="p-4 mb-4 text-sm text-error bg-[var(--rose-bg)] rounded-lg border border-red-300" role="alert">
 <span className="font-medium">Error:</span> {error}
 <button onClick={() => window.location.reload()} className='ml-4 underline text-xs'>Try Reloading</button>
 </div>
 </div>
 );
 }

 // Pagination info (server-side)
 const itemsPerPage = 10;
 const startIndex = (currentPage - 1) * itemsPerPage;
 const endIndex = startIndex + itemsPerPage;
 const paginatedJobs = displayedJobs; // Already paginated from server

 // --- Main Dashboard Content ---
 return (
 <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--bg-base)' }}>
 {/* Skip link for keyboard users */}
 <a
 href="#main-content"
 className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--text-primary)] focus:text-white focus:rounded-lg"
 >
 Skip to main content
 </a>

 {/* Main Content */}
 <div id="main-content" className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-6xl mx-auto w-full">
 {/* Title and Stats Brief */}
 <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
 <div>
 <h1 className="text-3xl font-black tracking-tight font-manrope" style={{ color: 'var(--accent)' }}>Applications</h1>
 <p className="font-medium mt-1" style={{ color: '#78716c' }}>Tracking your career journey</p>
 </div>
 <div className="flex gap-4 text-sm font-bold" style={{ color: '#57534e' }}>
 {(() => {
 const activeCount = allJobs.filter(j => !['Rejected', 'Archived', 'Withdrawn'].includes(j.status)).length;
 const interviewCount = allJobs.filter(j => j.status && j.status.toLowerCase().includes('interview')).length;
 return (
 <>
 <div className="px-4 py-2 rounded-xl border" style={{ background: 'rgba(255,255,255,0.50)', borderColor: 'rgba(231,229,228,0.50)' }}>
 <span style={{ color: 'var(--accent)' }}>{activeCount}</span> Active
 </div>
 <div className="px-4 py-2 rounded-xl border" style={{ background: 'rgba(255,255,255,0.50)', borderColor: 'rgba(231,229,228,0.50)' }}>
 <span style={{ color: 'var(--amber)' }}>{interviewCount}</span> Interviews
 </div>
 </>
 );
 })()}
 </div>
 </div>

 {/* Start Here Journey */}
 {!isJourneyComplete && (
 <div
 className="rounded-2xl border p-4 sm:p-6"
 style={{
 background: 'linear-gradient(130deg, color-mix(in srgb, var(--accent-bg) 65%, var(--bg-surface) 35%), var(--bg-surface))',
 borderColor: 'color-mix(in srgb, var(--accent) 20%, var(--border) 80%)'
 }}
 >
 <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
 <div>
 <p className="text-[11px] uppercase tracking-[0.12em] font-semibold" style={{ color: 'var(--accent)' }}>
 Start Here
 </p>
 <h2 className="text-lg sm:text-xl font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
 Get your first tailored application in 3 steps
 </h2>
 <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
 Keep this sequence: add your CV first, then add a job, then generate a tailored CV + cover letter and keep going.
 </p>
 </div>
 <button
 type="button"
 onClick={handleJourneyPrimaryAction}
 className="w-full lg:w-auto px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 border-2"
 style={{ background: 'transparent', color: 'var(--accent)', borderColor: 'var(--accent)' }}
 >
 {!hasAnyCv ? 'Step 1: Add your CV' : !hasAnyJob ? 'Step 2: Add a target job' : 'Step 3: Tailor CV + cover letter'}
 </button>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
 {[
 {
 key: 'cv',
 label: '1. Add your CV',
 hint: 'Upload once and reuse for every application.',
 done: hasAnyCv,
 eta: 'About 1 min'
 },
 {
 key: 'job',
 label: '2. Add a target job',
 hint: 'Paste a URL or job description text.',
 done: hasAnyJob,
 eta: 'About 1 min'
 },
 {
 key: 'cover',
 label: '3. Tailor CV + cover letter',
 hint: 'Generate the tailored CV + cover letter, then add reminders, mock interview prep, and more.',
 done: hasAnyCoverLetter,
 eta: 'About 30 sec'
 }
 ].map(step => (
 <div
 key={step.key}
 className="rounded-xl border p-3.5"
 style={{
 background: step.done ? 'color-mix(in srgb, var(--accent-bg) 45%, var(--bg-elevated) 55%)' : 'var(--bg-elevated)',
 borderColor: step.done ? 'color-mix(in srgb, var(--accent) 40%, var(--border) 60%)' : 'var(--border)'
 }}
 >
 <div className="flex items-center justify-between gap-2 mb-1.5">
 <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{step.label}</p>
 <span
 className="text-[10px] uppercase tracking-wide font-bold px-2 py-1 rounded-full"
 style={step.done
 ? { background: 'var(--accent)', color: 'var(--text-on-accent)' }
 : { background: 'var(--bg-raised)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
 >
 {step.done ? 'Done' : 'Pending'}
 </span>
 </div>
 <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{step.hint}</p>
 <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>{step.eta}</p>
 </div>
 ))}
 </div>
 </div>
 )}






 {/* Job List Section */}
 <div className="space-y-6">
 {/* Filters Section */}
 <section className="mb-8">
 <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
 <div className="flex flex-wrap gap-2">
 {/* All Apps pill - active when no filters */}
 {(() => {
 const isAllActive = !filterStatus && !filterFavorite && !filterHasNotes && !filterJobType && filterTags.length === 0;
 return (
 <button
 onClick={() => { setFilterStatus(''); setFilterFavorite(false); setFilterHasNotes(false); setFilterJobType(''); setFilterTags([]); }}
 className={`px-6 py-2.5 rounded-full font-bold text-sm shadow-md active:scale-95 transition-all ${isAllActive ? 'text-white' : 'bg-white text-stone-600 border hover:bg-stone-50 hover:border-stone-300 active:scale-95'}`}
 style={isAllActive
 ? { background: 'var(--accent)' }
 : { borderColor: '#e7e5e4' }}
 aria-pressed={isAllActive}
 >
 All Apps
 </button>
 );
 })()}

 {/* Favorites pill */}
 <button
 onClick={() => { setFilterFavorite(!filterFavorite); }}
 className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95 ${filterFavorite ? 'text-white shadow-md' : 'bg-white text-stone-600 border hover:bg-stone-50 hover:border-stone-300'}`}
 style={filterFavorite
 ? { background: 'var(--accent)' }
 : { borderColor: '#e7e5e4' }}
 aria-pressed={filterFavorite}
 >
 Favorites ({favoriteCount})
 </button>

 {/* Applied pill */}
 <button
 onClick={() => setFilterStatus(filterStatus === 'Applied' ? '' : 'Applied')}
 className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95 ${filterStatus === 'Applied' ? 'text-white shadow-md' : 'bg-white text-stone-600 border hover:bg-stone-50 hover:border-stone-300'}`}
 style={filterStatus === 'Applied'
 ? { background: 'var(--accent)' }
 : { borderColor: '#e7e5e4' }}
 aria-pressed={filterStatus === 'Applied'}
 >
 Applied
 </button>

 {/* Needs Follow-up pill - jobs with interview status */}
 <button
 onClick={() => setFilterStatus(filterStatus === 'Interview' ? '' : 'Interview')}
 className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95 ${filterStatus === 'Interview' ? 'text-white shadow-md' : 'bg-white text-stone-600 border hover:bg-stone-50 hover:border-stone-300'}`}
 style={filterStatus === 'Interview'
 ? { background: 'var(--accent)' }
 : { borderColor: '#e7e5e4' }}
 aria-pressed={filterStatus === 'Interview'}
 >
 Needs Follow-up
 </button>
 </div>

 <div className="w-full lg:w-auto flex gap-3">
 {/* Search */}
 <div className="relative flex-grow lg:w-72">
 <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-xl">search</span>
 <input
 type="text"
 id="filter-title"
 value={filterText}
 onChange={(e) => setFilterText(e.target.value)}
 placeholder="Search company or role..."
 className="w-full pl-11 pr-4 py-3 bg-white rounded-full focus:ring-2 focus:border-transparent text-sm font-medium"
 style={{ border: '1px solid #e7e5e4', focusRingColor: 'var(--accent)' }}
 aria-label="Search jobs by title, company, or contact name"
 />
 </div>

 {/* Filter dropdown button */}
 <div className="relative" ref={fieldMenuRef}>
 <button
 onClick={() => setIsFieldMenuOpen((prev) => !prev)}
 ref={fieldMenuTriggerRef}
 className="p-3 bg-white border rounded-full text-stone-600 hover:bg-stone-50 active:scale-95 transition-all flex items-center justify-center"
 style={{ borderColor: '#e7e5e4' }}
 aria-label="More filters"
 aria-expanded={isFieldMenuOpen}
 aria-haspopup="true"
 >
 <span className="material-symbols-outlined">filter_list</span>
 </button>
 {isFieldMenuOpen && (
 <div
 className="rounded-xl border p-4 shadow-lg overflow-y-auto"
 style={{
 ...fieldMenuStyle,
 background: '#ffffff',
 borderColor: '#e7e5e4'
 }}
 >
 <div className="space-y-3">
 {/* Status filter */}
 <div>
 <label className="block text-[10px] uppercase font-black tracking-widest mb-2" style={{ color: '#a8a29e' }}>Status</label>
 <div className="flex flex-wrap gap-1.5">
 {['', ...statusOptions].map((status) => (
 <button
 key={status || 'all'}
 onClick={() => setFilterStatus(status)}
 className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filterStatus === status ? 'text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
 style={filterStatus === status ? { background: 'var(--accent)' } : {}}
 >
 {status || 'All'}
 </button>
 ))}
 </div>
 </div>

 {/* Job Type filter */}
 <div>
 <label className="block text-[10px] uppercase font-black tracking-widest mb-2" style={{ color: '#a8a29e' }}>Job Type</label>
 <div className="flex flex-wrap gap-1.5">
 {['', 'full-time', 'part-time', 'working-student', 'internship', 'contract', 'freelance'].map((type) => (
 <button
 key={type || 'all'}
 onClick={() => setFilterJobType(type)}
 className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filterJobType === type ? 'text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
 style={filterJobType === type ? { background: 'var(--accent)' } : {}}
 >
 {type ? type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ') : 'All'}
 </button>
 ))}
 </div>
 </div>

 {/* Tags filter */}
 {fieldFilterOptions.length > 0 && (
 <div>
 <label className="block text-[10px] uppercase font-black tracking-widest mb-2" style={{ color: '#a8a29e' }}>Tags</label>
 <div className="flex flex-wrap gap-1.5">
 {fieldFilterOptions.map((option) => {
 const isActive = filterTags.includes(option.key);
 return (
 <button
 key={option.key}
 onClick={() => toggleTagFilter(option.key)}
 className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${isActive ? 'text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
 style={isActive ? { background: 'var(--accent)' } : {}}
 aria-pressed={isActive}
 >
 {option.label}
 </button>
 );
 })}
 </div>
 </div>
 )}

 {/* Quick toggles */}
 <div className="flex flex-wrap gap-1.5 pt-1">
 <button
 onClick={() => setFilterHasNotes(!filterHasNotes)}
 className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${filterHasNotes ? 'text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
 style={filterHasNotes ? { background: 'var(--accent)' } : {}}
 aria-pressed={filterHasNotes}
 >
 <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>sticky_note_2</span>
 Has Notes
 </button>
 <button
 onClick={() => setGroupByTag(prev => !prev)}
 disabled={!hasFieldOptions}
 className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${groupByTag ? 'text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
 style={groupByTag ? { background: 'var(--accent)' } : {}}
 aria-pressed={groupByTag}
 >
 <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>view_list</span>
 Group by tag
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 </section>

 {/* Job Cards List */}
 <section className="space-y-4">
 {jobs.length === 0 ? (
 <div className="text-center py-12 px-4">
 {everHadJobsRef.current ? (
 <>
 <h3 className="mt-2 text-sm font-medium text-primary-color">No matches found</h3>
 <p className="mt-1 text-sm text-secondary-color">
 No job applications match your current filters. Try adjusting your search or filter criteria.
 </p>
 <div className="mt-6">
 <button
 onClick={() => { setFilterText(''); setFilterStatus(''); setFilterFavorite(false); setFilterHasNotes(false); setFilterJobType(''); setFilterTags([]); setGroupByTag(false); }}
 className="btn-primary"
 >
 Clear Filters
 </button>
 </div>
 </>
  ) : (
  <>
  <h3 className="mt-2 text-sm font-medium text-primary-color">No jobs yet</h3>
  <p className="mt-1 text-sm text-secondary-color">
  Add your first job application to get started.
  </p>
  </>
  )}
 </div>
 ) : (
 <>
 {groupByTag && groupedJobs ? (
 <div className="space-y-6">
 {groupedJobs.map((group) => (
 <div key={group.label} className="space-y-3">
 <div className="flex items-center gap-2">
 <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{group.label}</span>
 <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-raised)', color: 'var(--text-muted)' }}>
 {group.jobs.length}
 </span>
 </div>
 <div className="space-y-4">
 {group.jobs.map((job) => (
 <JobCard key={job._id} job={job} />
 ))}
 </div>
 </div>
 ))}
 </div>
 ) : (
 <>
 <div className="space-y-4">
 {paginatedJobs.map((job) => (
 <JobCard key={job._id} job={job} />
 ))}
 </div>
 {/* Pagination */}
 <div className="flex items-center justify-between pt-4">
 <p className="text-sm text-secondary-color">
 Showing {totalJobs === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, totalJobs)} of {totalJobs} results
 </p>
 <div className="flex items-center gap-2">
 <button
 onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
 disabled={currentPage === 1}
 className="flex items-center justify-center w-10 h-10 rounded-xl border bg-white hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
 style={{ borderColor: '#e7e5e4' }}
 >
 <ChevronLeftIcon />
 </button>
 {Array.from({ length: totalPagesServer }, (_, i) => i + 1).map((page) => (
 <button
 key={page}
 onClick={() => setCurrentPage(page)}
 className={`flex items-center justify-center w-10 h-10 rounded-xl text-sm font-semibold transition-all ${currentPage === page
 ? 'text-white'
 : 'bg-white hover:bg-stone-50'
 }`}
 style={currentPage === page
 ? { background: 'var(--accent)' }
 : { color: '#78716c', border: '1px solid #e7e5e4' }}
 >
 {page}
 </button>
 ))}
 <button
 onClick={() => setCurrentPage(prev => Math.min(totalPagesServer, prev + 1))}
 disabled={currentPage === totalPagesServer}
 className="flex items-center justify-center w-10 h-10 rounded-xl border bg-white hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
 style={{ borderColor: '#e7e5e4' }}
 >
 <ChevronRightIcon />
 </button>
 </div>
 </div>
 </>
 )}
 </>
 )}
 </section>
 </div>
 </div>

 {/* Add Job Popup Modal */}
 {isAddJobPopupOpen && (
 <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50 p-4">
 <div
 ref={addJobPopupRef}
 className="rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden"
 style={{
 maxHeight: '90vh',
 background: 'var(--bg-surface)',
 border: '1px solid var(--border)',
 }}
 role="dialog"
 aria-modal="true"
 aria-labelledby="add-job-popup-title"
 >
 {/* Header */}
 <div className="flex items-center justify-between px-6 pt-6 pb-4">
 <div>
 <p className="text-[11px] uppercase tracking-[0.12em] font-semibold" style={{ color: 'var(--accent)' }}>
 Step 2
 </p>
 <h2 id="add-job-popup-title" className="text-lg font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
 Add a target job
 </h2>
 <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
 Paste a job description or add details manually to start tailoring.
 </p>
 </div>
 <button
 onClick={handleCloseAddJobPopup}
 disabled={isCreatingFromText}
 className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors disabled:opacity-50"
 style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
 aria-label="Close"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 {/* Form Content */}
 <div className="flex-1 overflow-y-auto px-6 pb-6">
 <form onSubmit={handleCreateFromTextSubmit}>
 {/* Fields Row */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
 {/* CV Branch */}
 <div>
 <label htmlFor="cvBranch-popup" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
 CV Branch
 </label>
 {!preExtractionCvFile ? (
 <select
 id="cvBranch-popup"
 value={selectedCvBranchId || ''}
 onChange={(e) => {
 fetchCvsIfNeeded();
 setSelectedCvBranchId(e.target.value || null);
 }}
 onFocus={fetchCvsIfNeeded}
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all"
 style={{
 background: 'var(--bg-elevated)',
 border: '1px solid var(--border)',
 color: 'var(--text-primary)',
 }}
 disabled={isCreatingFromText}
 >
 <option value="">Select CV (optional)</option>
 {cvs.filter(cv => !cv.jobApplication).map(cv => (
 <option key={cv._id} value={cv._id}>
 {cv.displayName || cv.category || 'CV'} {cv.isDefault ? '(Default)' : ''}
 </option>
 ))}
 </select>
 ) : (
 <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-dim)' }}>
 <svg className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
 </svg>
 <span className="text-xs truncate flex-1" style={{ color: 'var(--accent)' }}>{preExtractionCvFile.name}</span>
 <button
 type="button"
 onClick={() => { setPreExtractionCvFile(null); if (cvFileInputRef.current) cvFileInputRef.current.value = ''; }}
 className="text-muted-color hover:text-red-500 transition-colors p-1 min-h-[44px] min-w-[44px]"
 title="Remove file"
 aria-label="Remove selected CV file"
 >
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 )}
 <input
 ref={cvFileInputRef}
 type="file"
 accept=".pdf,.docx"
 className="hidden"
 onChange={(e) => {
 const f = e.target.files?.[0] ?? null;
 if (f) {
 setPreExtractionCvFile(f);
 setSelectedCvBranchId(null);
 }
 }}
 />
 </div>

 {/* Job URL */}
 <div>
 <label htmlFor="jobUrl-popup" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
 Job URL(s)
 </label>
 <input
 id="jobUrl-popup"
 type="text"
 value={preExtractionJobUrl}
 onChange={(e) => setPreExtractionJobUrl(e.target.value)}
 onBlur={(e) => {
 const normalized = normalizeMultipleUrls(e.target.value);
 setPreExtractionJobUrl(normalized);
 }}
 placeholder="https://example.com/job-posting"
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all"
 style={{
 background: 'var(--bg-elevated)',
 border: '1px solid var(--border)',
 color: 'var(--text-primary)',
 }}
 disabled={isCreatingFromText}
 />
 <p className="mt-1 text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--text-muted)' }}>
 Separate multiples with commas or spaces
 </p>
 </div>

 {/* Status */}
 <div>
 <label htmlFor="status-popup" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
 Status
 </label>
 <select
 id="status-popup"
 value={preExtractionStatus}
 onChange={(e) => setPreExtractionStatus(e.target.value)}
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all"
 style={{
 background: 'var(--bg-elevated)',
 border: '1px solid var(--border)',
 color: 'var(--text-primary)',
 }}
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
 <label htmlFor="jobType-popup" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
 Job Type
 </label>
 <select
 id="jobType-popup"
 value={preExtractionJobType}
 onChange={(e) => setPreExtractionJobType(e.target.value)}
 className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all"
 style={{
 background: 'var(--bg-elevated)',
 border: '1px solid var(--border)',
 color: 'var(--text-primary)',
 }}
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
 <div className="relative mb-4">
 <div className="absolute left-3 top-3 pointer-events-none" style={{ color: 'var(--text-muted)' }}>
 <ClipboardIcon />
 </div>
 <textarea
 id="jobDescription-popup"
 value={jobTextInput}
 onChange={(e) => { setJobTextInput(e.target.value); setCreateFromTextError(null); }}
 placeholder="Paste job description here..."
 title="Ctrl+A to select all, Ctrl+C to copy from job site, then Ctrl+V here"
 className="w-full rounded-xl pl-10 py-3 pr-3 text-sm focus:outline-none focus:ring-2 transition-all resize-y min-h-[140px]"
 style={{
 background: 'var(--bg-elevated)',
 border: '1px solid var(--border)',
 color: 'var(--text-primary)',
 }}
 rows={5}
 disabled={isCreatingFromText}
 />
 {isCreatingFromText && (
 <div className="absolute inset-0 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center gap-3" style={{ background: 'color-mix(in srgb, var(--bg-surface) 85%, transparent)' }}>
 <div className="relative">
 <svg className="animate-spin h-8 w-8" style={{ color: 'var(--accent)' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 </div>
 <div className="text-center">
 <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Extracting job details...</p>
 <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>AI is analyzing the job description</p>
 </div>
 </div>
 )}
 </div>

 {/* Error Display */}
 {createFromTextError && (
 <div className={`mb-4 p-3 rounded-xl text-sm ${isApiKeyError(createFromTextError)
? 'bg-[var(--ember-bg)] border border-[var(--ember)] text-ember'
  : 'bg-red-50 border border-red-300 text-error'
 }`}>
 <div className="flex items-start gap-2">
 {isApiKeyError(createFromTextError) ? (
 <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
 </svg>
 ) : (
 <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
 </svg>
 )}
 <div className="flex-1 min-w-0">
 <span className="font-semibold">{isApiKeyError(createFromTextError) ? 'API Key Required' : 'Error'}: </span>
 {createFromTextError}
 {isApiKeyError(createFromTextError) && (
 <Link to="/settings" className="inline-flex items-center gap-1 ml-2 text-xs font-semibold underline">
 Go to Settings
 </Link>
 )}
 </div>
 </div>
 </div>
 )}

 {/* Action Buttons */}
 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
 <button
 type="submit"
 className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
 style={{ background: 'var(--text-primary)', color: 'var(--bg-surface)' }}
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
 <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-dim)', color: 'var(--text-on-accent)' }}>1 Credit</span>
 </>
 )}
 </button>

 <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>or</span>

 <button
 type="button"
 onClick={() => { handleCloseAddJobPopup(); handleOpenAddModal(); }}
 className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
 style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
 disabled={isCreatingFromText}
 >
 <AddIcon />
 <span>Add Manually</span>
 </button>
 </div>
 </form>
 </div>
 </div>
 </div>
 )}

 {/* Add/Edit Modal */}
 {modalMode && (
 <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50">
 <div
 ref={modalRef}
 className="card-elevated p-6 rounded-2xl shadow-2xl w-full max-w-lg mx-4 sm:mx-0 flex flex-col"
 style={{ maxHeight: '90vh' }}
 role="dialog"
 aria-modal="true"
 aria-labelledby="modal-title"
 >
 <div className="flex justify-between items-center mb-6">
 <h2 id="modal-title" className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
 Add New Job Manually
 </h2>
 <button
 onClick={handleCloseModal}
 disabled={isSubmitting}
 className="btn-ghost w-9 h-9 min-h-[44px] p-0 flex items-center justify-center disabled:opacity-50"
 aria-label="Close modal"
 >
 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 <form onSubmit={handleFormSubmit} className="flex-1 flex flex-col min-h-0">
 {modalError && (
 <div className="mb-4 p-3 bg-[var(--rose-bg)] text-error text-sm rounded border border-red-300">
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
 onFocus={fetchCvsIfNeeded}
 disabled={isLoadingCvs}
 className="input-base w-full cursor-pointer disabled:opacity-50"
 >
 <option value="">
 {isLoadingCvs ? 'Loading CVs...' : 'Select a CV (optional)'}
 </option>
 {cvs.map(cv => (
 <option key={cv._id} value={cv._id}>
 {cv.displayName || cv.category || 'Unnamed CV'}
 {cv.isDefault ? ' (Default)' : ''}
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

 {/* Field Tags */}
 <div className="mb-5">
 <label htmlFor="jobTags" className="label-overline mb-2 block">Field Tags</label>
 <div className="space-y-2">
 {Array.isArray(formData.jobTags) && formData.jobTags.length > 0 && (
 <div className="flex flex-wrap gap-2">
 {formData.jobTags.map((tag) => (
 <span
 key={tag}
 className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold"
 style={{ background: 'var(--bg-raised)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
 >
 {tag}
 <button
 type="button"
 onClick={() => removeTagFromForm(tag)}
 className="text-muted-color hover:text-red-500 transition-colors"
 aria-label={`Remove tag ${tag}`}
 >
 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </span>
 ))}
 </div>
 )}
 <input
 id="jobTags"
 type="text"
 value={jobTagInput}
 onChange={(e) => setJobTagInput(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ',') {
 e.preventDefault();
 if (jobTagInput.trim()) {
 addTagsToForm(jobTagInput);
 setJobTagInput('');
 }
 }
 }}
 onBlur={() => {
 if (jobTagInput.trim()) {
 addTagsToForm(jobTagInput);
 setJobTagInput('');
 }
 }}
 className="input-base w-full"
 placeholder={Array.isArray(formData.jobTags) && formData.jobTags.length >= MAX_JOB_TAGS ? 'Tag limit reached' : 'Add tags, press Enter'}
 disabled={Array.isArray(formData.jobTags) && formData.jobTags.length >= MAX_JOB_TAGS}
 />
 <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
 Add up to {MAX_JOB_TAGS} tags, separated by commas or Enter.
 </p>
 </div>
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
 <div role="status" aria-live="polite" aria-atomic="true">
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

 {/* Floating Action Button */}
 <button
 ref={addJobTriggerRef}
 onClick={handleOpenAddJobPopup}
  className="fixed bottom-10 right-10 w-16 h-16 rounded-full flex items-center justify-center frap-shadow hover:scale-110 active:scale-90 transition-all z-50 group"
  style={{ background: 'var(--accent)', color: '#ffffff' }}
  aria-label="Add a target job"
 >
 <span className="material-symbols-outlined text-3xl group-hover:rotate-90 transition-transform duration-300">add</span>
 </button>
 </div>
 );
};

export default DashboardPage;


