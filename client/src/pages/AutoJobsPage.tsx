// client/src/pages/AutoJobsPage.tsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Country, State, City } from 'country-state-city';
import {
 getAutoJobs,
 getStats,
 getSettings,
 updateSettings,
 triggerWorkflow,
 getWorkflowStatus,
 cancelWorkflow,
 promoteAutoJob,
 deleteAutoJob,
 deleteAllAutoJobs,
 AutoJob,
 WorkflowStats,
 AutoJobSettings,
 WorkflowRun
} from '../services/autoJobApi';
import Toast from '../components/common/Toast';
import Spinner from '../components/common/Spinner';
import SimpleLoader from '../components/common/SimpleLoader';
import CreditsBadge from '../components/common/CreditsBadge';
import ConfirmModal from '../components/common/ConfirmModal';
import JobRecommendationBadge from '../components/jobs/JobRecommendationBadge';
import { formatDate } from '../utils/dateUtils';
import { parseApiErrorMessage } from '../utils/parseApiError';
import { getJobRecommendation } from '../services/jobRecommendationApi';
import { parseMultipleUrls } from '../lib/utils';

const AutoJobsPage: React.FC = () => {
 // State
 const [jobs, setJobs] = useState<AutoJob[]>([]);
 const [stats, setStats] = useState<WorkflowStats | null>(null);
 const [settings, setSettings] = useState<AutoJobSettings>({
 keywords: '',
 location: '',
 jobType: [],
 experienceLevel: [],
 datePosted: 'any time',
 maxJobs: 100,
 avoidDuplicates: false
 });
 const [isLoading, setIsLoading] = useState(true);
 const [isTriggering, setIsTriggering] = useState(false);
 const [isSavingSettings, setIsSavingSettings] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
 const [showApiWarning, setShowApiWarning] = useState(!localStorage.getItem('autoJobsApiWarningDismissed'));

 // Confirmation Modal State
 const [confirmModal, setConfirmModal] = useState<{
 isOpen: boolean;
 message: string;
 title?: string;
 onConfirm: () => void;
 confirmText?: string;
 cancelText?: string;
 confirmButtonStyle?: 'primary' | 'danger';
 } | null>(null);

 // Workflow Progress State
 const [currentRunId, setCurrentRunId] = useState<string | null>(localStorage.getItem('autoJobRunId'));
 const [workflowProgress, setWorkflowProgress] = useState<WorkflowRun | null>(null);
 const [lastJobCount, setLastJobCount] = useState<number>(0); // Track number of jobs to detect new ones

 // Pagination
 const [currentPage, setCurrentPage] = useState(1);
 const [totalPages, setTotalPages] = useState(1);
 const [total, setTotal] = useState(0);
 const pageSize = 10;

 // Filters
 const [filterRelevance, setFilterRelevance] = useState<string>('');
 const [filterStatus, setFilterStatus] = useState<string>('');

 // Sorting
 const [sortColumn, setSortColumn] = useState<'postDate' | 'skillMatch' | null>(null);
 const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

 // Location autocomplete
 const [locationInput, setLocationInput] = useState<string>('');
 const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
 const [showLocationSuggestions, setShowLocationSuggestions] = useState<boolean>(false);

 // Sync locationInput with settings.location
 useEffect(() => {
 if (settings.location !== undefined) {
 setLocationInput(settings.location || '');
 }
 }, [settings.location]);

 // Fetch data
 const fetchData = async () => {
 try {
 setIsLoading(true);
 // Handle "processing" filter - fetch all jobs and filter on frontend
 const relevanceFilter = filterRelevance === 'processing' ? '' : filterRelevance;
 // When "processing" is selected, don't use status filter (we'll filter on frontend)
 const statusFilter = filterRelevance === 'processing' ? '' : filterStatus;

 const [jobsData, statsData, settingsData] = await Promise.all([
 getAutoJobs({
 page: currentPage,
 limit: filterRelevance === 'processing' ? 1000 : pageSize, // Get more for processing filter
 relevance: relevanceFilter,
 status: statusFilter
 }),
 getStats(),
 getSettings()
 ]);

 // If filtering by "processing", filter jobs with pending or analyzed status
 let filteredJobs = jobsData.jobs;
 let totalCount = jobsData.pagination.total;
 if (filterRelevance === 'processing') {
 filteredJobs = jobsData.jobs.filter(job =>
 job.processingStatus === 'pending' || job.processingStatus === 'analyzed'
 );
 // Recalculate pagination for filtered results
 const startIndex = (currentPage - 1) * pageSize;
 const endIndex = startIndex + pageSize;
 filteredJobs = filteredJobs.slice(startIndex, endIndex);
 totalCount = jobsData.jobs.filter(job =>
 job.processingStatus === 'pending' || job.processingStatus === 'analyzed'
 ).length;
 }

 setJobs(filteredJobs);
 setTotalPages(filterRelevance === 'processing' ? Math.ceil(totalCount / pageSize) : jobsData.pagination.pages);
 setTotal(totalCount);
 setStats(statsData);
 // Update lastJobCount when fetching data (only if not in a running workflow)
 if (!currentRunId || !workflowProgress || workflowProgress.status !== 'running') {
 setLastJobCount(jobsData.jobs.length);
 }
 // Filter settings to only include valid fields
 const filteredSettings = filterValidSettings(settingsData);
 setSettings(filteredSettings);
 setLocationInput(filteredSettings.location || '');
 setError(null);
 } catch (err: any) {
 setError(err.response?.data?.message || 'Failed to load data');
 showToast('Failed to load auto jobs', 'error');
 } finally {
 setIsLoading(false);
 }
 };

 // Generate location suggestions from country-state-city package (optimized)
 const generateLocationSuggestions = (input: string): string[] => {
 if (!input || input.length < 2) {
 return [];
 }

 const inputLower = input.toLowerCase().trim();
 const suggestions: Set<string> = new Set();
 const maxSuggestions = 15;
 let foundCount = 0;

 // Add "Remote" options first (fast)
 if ('remote'.startsWith(inputLower)) {
 suggestions.add('Remote, United States');
 suggestions.add('Remote, Worldwide');
 foundCount += 2;
 }

 // Limit countries to search (only first 50 most common countries)
 const commonCountryCodes = ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'IE', 'PL', 'CZ', 'PT', 'GR', 'IN', 'CN', 'JP', 'KR', 'SG', 'MY', 'TH', 'VN', 'PH', 'ID', 'NZ', 'ZA', 'BR', 'MX', 'AR', 'CL', 'CO', 'PE', 'AE', 'SA', 'IL', 'TR', 'RU', 'UA', 'RO', 'HU', 'BG', 'HR', 'SI'];

 // Search countries (limited set)
 for (const countryCode of commonCountryCodes) {
 if (foundCount >= maxSuggestions) break;
 const country = Country.getCountryByCode(countryCode);
 if (country) {
 const countryName = country.name.toLowerCase();
 if (countryName.includes(inputLower)) {
 suggestions.add(country.name);
 foundCount++;
 }
 }
 }

 // Search states/provinces (only for common countries, limit to first 20 states per country)
 for (const countryCode of commonCountryCodes.slice(0, 10)) {
 if (foundCount >= maxSuggestions) break;
 const states = State.getStatesOfCountry(countryCode);
 for (let i = 0; i < Math.min(states.length, 20); i++) {
 if (foundCount >= maxSuggestions) break;
 const state = states[i];
 const stateName = state.name.toLowerCase();
 if (stateName.includes(inputLower)) {
 const country = Country.getCountryByCode(countryCode);
 if (country) {
 suggestions.add(`${state.name}, ${country.name}`);
 foundCount++;
 }
 }
 }
 }

 // Search cities (only for US, UK, CA, AU, DE - limit to first 10 cities per state)
 const citySearchCountries = ['US', 'GB', 'CA', 'AU', 'DE'];
 for (const countryCode of citySearchCountries) {
 if (foundCount >= maxSuggestions) break;
 const states = State.getStatesOfCountry(countryCode);
 for (let i = 0; i < Math.min(states.length, 10); i++) {
 if (foundCount >= maxSuggestions) break;
 const state = states[i];
 const cities = City.getCitiesOfState(countryCode, state.isoCode);
 for (let j = 0; j < Math.min(cities.length, 10); j++) {
 if (foundCount >= maxSuggestions) break;
 const city = cities[j];
 const cityName = city.name.toLowerCase();
 if (cityName.includes(inputLower)) {
 const country = Country.getCountryByCode(countryCode);
 if (country) {
 suggestions.add(`${city.name}, ${state.name}`);
 foundCount++;
 if (foundCount < maxSuggestions) {
 suggestions.add(`${city.name}, ${country.name}`);
 foundCount++;
 }
 }
 }
 }
 }
 }

 return Array.from(suggestions).slice(0, maxSuggestions);
 };

 // Debounce timer for location suggestions
 const locationSearchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

 // Handle location input change (with debouncing for suggestions)
 const handleLocationInputChange = (value: string) => {
 const trimmedValue = value.substring(0, 100);
 setLocationInput(trimmedValue);

 // Update settings immediately (no debounce for input display)
 const newSettings = { ...settings, location: trimmedValue };
 setSettings(newSettings);
 debouncedAutoSave(newSettings);

 // Clear previous timeout
 if (locationSearchTimeoutRef.current) {
 clearTimeout(locationSearchTimeoutRef.current);
 }

 // Hide suggestions if input is too short
 if (trimmedValue.length < 2) {
 setLocationSuggestions([]);
 setShowLocationSuggestions(false);
 return;
 }

 // Debounce suggestion generation to avoid blocking UI
 locationSearchTimeoutRef.current = setTimeout(() => {
 // Use setTimeout to defer to next event loop tick
 setTimeout(() => {
 const suggestions = generateLocationSuggestions(trimmedValue);
 setLocationSuggestions(suggestions);
 setShowLocationSuggestions(suggestions.length > 0);
 }, 0);
 }, 300); // 300ms debounce
 };

 // Cleanup timeout on unmount
 useEffect(() => {
 return () => {
 if (locationSearchTimeoutRef.current) {
 clearTimeout(locationSearchTimeoutRef.current);
 }
 };
 }, []);

 // Handle location suggestion selection
 const handleLocationSelect = (suggestion: string) => {
 setLocationInput(suggestion);
 setShowLocationSuggestions(false);
 const newSettings = { ...settings, location: suggestion };
 setSettings(newSettings);
 debouncedAutoSave(newSettings);
 };

 useEffect(() => {
 fetchData();
 }, [currentPage, filterRelevance, filterStatus]);

 // Polling for workflow progress and new jobs
 useEffect(() => {
 if (!currentRunId) return;

 const interval = setInterval(async () => {
 try {
 const status = await getWorkflowStatus(currentRunId);
 setWorkflowProgress(status);
 // Clear isTriggering once we have workflow status
 setIsTriggering(false);

 // Poll for new jobs if workflow is running
 if (status.status === 'running') {
 try {
 // Handle "processing" filter - fetch all jobs and filter on frontend
 const relevanceFilter = filterRelevance === 'processing' ? '' : filterRelevance;
 const statusFilter = filterRelevance === 'processing' ? '' : filterStatus;

 const jobsData = await getAutoJobs({
 page: 1,
 limit: 1000, // Get more jobs to see all from current run
 relevance: relevanceFilter,
 status: statusFilter
 });

 // If filtering by "processing", filter jobs with pending or analyzed status
 let filteredJobs = jobsData.jobs;
 if (filterRelevance === 'processing') {
 filteredJobs = jobsData.jobs.filter(job =>
 job.processingStatus === 'pending' || job.processingStatus === 'analyzed'
 );
 }

 // Check if we have new jobs
 const currentJobCount = filteredJobs.length;
 if (currentJobCount > lastJobCount) {
 // New jobs detected, update the list
 setJobs(filteredJobs);
 setTotalPages(filterRelevance === 'processing' ? Math.ceil(filteredJobs.length / pageSize) : jobsData.pagination.pages);
 setTotal(filterRelevance === 'processing' ? filteredJobs.length : jobsData.pagination.total);
 setLastJobCount(currentJobCount);
 }
 } catch (err) {
 // Silently fail job polling, don't break workflow status polling
 console.error('Error polling for new jobs:', err);
 }
 }

 if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
 clearInterval(interval);
 localStorage.removeItem('autoJobRunId');
 setCurrentRunId(null);
 setLastJobCount(0);

 if (status.status === 'completed') {
 // Check if no jobs were found
 if (status.stats.jobsFound === 0) {
 showToast('No jobs found matching your search criteria. Try adjusting your keywords, location, or filters.', 'info');
 } else if (status.stats.generated > 0) {
 showToast(`Workflow complete! ${status.stats.generated} jobs generated`, 'success');
 } else if (status.stats.newJobs === 0 && status.stats.jobsFound > 0) {
 showToast(`Found ${status.stats.jobsFound} jobs, but all were duplicates. No new jobs to process.`, 'info');
 } else {
 showToast(`Workflow complete! Found ${status.stats.jobsFound} jobs`, 'success');
 }
 fetchData(); // Refresh data
 } else if (status.status === 'failed') {
 showToast(`Workflow failed: ${status.errorMessage}`, 'error');
 fetchData(); // Refresh data
 } else if (status.status === 'cancelled') {
 showToast('Workflow cancelled successfully', 'success');
 fetchData(); // Refresh data
 }
 }
 } catch (err) {
 console.error('Error polling workflow status:', err);
 // Don't clear interval immediately on error, might be temporary network issue
 }
 }, 2000); // Poll every 2 seconds

 return () => clearInterval(interval);
 }, [currentRunId, filterRelevance, filterStatus, lastJobCount]);

 // Toast helper
 const showToast = (message: string, type: 'success' | 'error' | 'info') => {
 setToast({ message, type });
 setTimeout(() => setToast(null), 5000);
 };

 // Handle workflow trigger
 const handleTrigger = async () => {
 try {
 setIsTriggering(true);
 setLastJobCount(0); // Reset job count for new workflow
 const result = await triggerWorkflow();
 setCurrentRunId(result.runId);
 localStorage.setItem('autoJobRunId', result.runId);
 // Keep isTriggering true until workflow status is fetched
 // The button will remain disabled based on workflowProgress status
 } catch (err: any) {
 setIsTriggering(false);
 showToast(parseApiErrorMessage(err), 'error');
 }
 };

 // Check if workflow is currently running
 const isWorkflowRunning = workflowProgress?.status === 'running' || (currentRunId && !workflowProgress);

 // Filter settings to only include valid fields
 const filterValidSettings = (settingsToFilter: any): AutoJobSettings => {
 return {
 enabled: settingsToFilter.enabled ?? false,
 keywords: settingsToFilter.keywords ?? '',
 location: settingsToFilter.location ?? '',
 jobType: Array.isArray(settingsToFilter.jobType) ? settingsToFilter.jobType : [],
 experienceLevel: Array.isArray(settingsToFilter.experienceLevel) ? settingsToFilter.experienceLevel : [],
 // Map invalid "past hour" to valid "past 24 hours"
 datePosted: settingsToFilter.datePosted === 'past hour' ? 'past 24 hours' : (settingsToFilter.datePosted ?? 'any time'),
 maxJobs: settingsToFilter.maxJobs ?? 100,
 avoidDuplicates: settingsToFilter.avoidDuplicates ?? false,
 };
 };

 // Auto-save settings (debounced)
 // Debounce timer for auto-save
 const autoSaveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

 const autoSaveSettings = async (newSettings: AutoJobSettings, showMessage = true) => {
 try {
 setIsSavingSettings(true);
 // Only send valid fields to backend
 const validSettings = filterValidSettings(newSettings);
 await updateSettings(validSettings);
 if (showMessage) {
 showToast('Settings saved successfully', 'success');
 }
 } catch (err: any) {
 showToast(err.response?.data?.message || 'Failed to save settings', 'error');
 } finally {
 setIsSavingSettings(false);
 }
 };

 // Debounced auto-save function
 const debouncedAutoSave = (newSettings: AutoJobSettings) => {
 // Clear previous timeout
 if (autoSaveTimeoutRef.current) {
 clearTimeout(autoSaveTimeoutRef.current);
 }

 // Set new timeout for auto-save
 autoSaveTimeoutRef.current = setTimeout(() => {
 autoSaveSettings(newSettings, true);
 }, 1000); // 1 second debounce
 };

 // Cleanup timeout on unmount
 useEffect(() => {
 return () => {
 if (autoSaveTimeoutRef.current) {
 clearTimeout(autoSaveTimeoutRef.current);
 }
 };
 }, []);



 // Handle max jobs change with auto-save
 const handleMaxJobsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const newSettings = { ...settings, maxJobs: parseInt(e.target.value) };
 setSettings(newSettings);
 debouncedAutoSave(newSettings);
 };

 // Handle promote job
 const handlePromote = (id: string) => {
 setConfirmModal({
 isOpen: true,
 message: 'Save this job to your main dashboard?',
 title: 'Save Job',
 confirmText: 'Save',
 cancelText: 'Cancel',
 confirmButtonStyle: 'primary',
 onConfirm: async () => {
 setConfirmModal(null);
 try {
 await promoteAutoJob(id);
 showToast('Job saved to main dashboard successfully!', 'success');
 fetchData();
 } catch (err: any) {
 showToast(err.response?.data?.message || 'Failed to save job to main dashboard', 'error');
 }
 }
 });
 };

 // Handle delete job
 const handleDelete = (id: string) => {
 setConfirmModal({
 isOpen: true,
 message: 'Delete this auto job?',
 title: 'Delete Job',
 confirmText: 'Delete',
 cancelText: 'Cancel',
 confirmButtonStyle: 'danger',
 onConfirm: async () => {
 setConfirmModal(null);
 try {
 await deleteAutoJob(id);
 showToast('Job deleted successfully', 'success');
 fetchData();
 } catch (err: any) {
 showToast(err.response?.data?.message || 'Failed to delete job', 'error');
 }
 }
 });
 };

 // Handle delete all jobs
 const handleDeleteAll = () => {
 setConfirmModal({
 isOpen: true,
 message: 'Are you sure you want to delete ALL auto jobs? This action cannot be undone.',
 title: 'Delete All Jobs',
 confirmText: 'Delete All',
 cancelText: 'Cancel',
 confirmButtonStyle: 'danger',
 onConfirm: async () => {
 setConfirmModal(null);
 try {
 const result = await deleteAllAutoJobs();
 showToast(`Deleted ${result.count} jobs successfully`, 'success');
 fetchData();
 } catch (err: any) {
 showToast(err.response?.data?.message || 'Failed to delete all jobs', 'error');
 }
 }
 });
 };

 // Handle retry skill match calculation
 const handleRetrySkillMatch = async (jobId: string) => {
 try {
 const recommendation = await getJobRecommendation(jobId, true);

 // Update the job in the local state
 setJobs(prevJobs =>
 prevJobs.map(job =>
 job._id === jobId
 ? {
 ...job,
 recommendation: {
 score: recommendation.score,
 shouldApply: recommendation.shouldApply,
 reason: recommendation.reason,
 cachedAt: recommendation.cachedAt ? new Date(recommendation.cachedAt) : new Date(),
 error: recommendation.error
 }
 }
 : job
 )
 );

 // Refresh the job data to get the latest state
 await fetchData();

 if (recommendation.error) {
 showToast(`Failed to calculate skill match: ${recommendation.error}`, 'error');
 } else {
 showToast('Skill match calculated successfully', 'success');
 }
 } catch (err: any) {
 showToast(err.response?.data?.message || err.message || 'Failed to retry skill match calculation', 'error');
 }
 };

 // Render relevance badge (for processing status)
 const renderRelevanceBadge = (status?: string, recommendation?: AutoJob['recommendation']) => {
 if (status === 'pending' || status === 'analyzed') {
 return (
 <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-[var(--accent-bg)] text-green-house">
 <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
 </svg>
 Processing...
 </span>
 );
 }
 if (status === 'error') {
 return <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-[var(--rose-bg)] text-error">Error</span>;
 }
 if (recommendation?.shouldApply) {
 return (
 <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full bg-[var(--jade-bg)] text-green">
 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
 </svg>
 Relevant
 </span>
 );
 }
 return <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>Not Relevant</span>;
 };

 if (isLoading && jobs.length === 0) {
 return (
 <div className="flex items-center justify-center py-20">
 <SimpleLoader message="Loading automatic job suggestions..." height="auto" />
 </div>
 );
 }

 // Handle column sort click
 const handleSort = (column: 'postDate' | 'skillMatch') => {
 if (sortColumn === column) {
 // Toggle direction if same column
 setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
 } else {
 // New column, default to desc (highest first)
 setSortColumn(column);
 setSortDirection('desc');
 }
 };

 // Sort jobs based on current sort settings
 const sortedJobs = [...jobs].sort((a, b) => {
 if (!sortColumn) return 0;

 let comparison = 0;
 if (sortColumn === 'postDate') {
 const dateA = a.jobPostDate ? new Date(a.jobPostDate).getTime() : 0;
 const dateB = b.jobPostDate ? new Date(b.jobPostDate).getTime() : 0;
 comparison = dateA - dateB;
 } else if (sortColumn === 'skillMatch') {
 const scoreA = a.recommendation?.score ?? -1;
 const scoreB = b.recommendation?.score ?? -1;
 comparison = scoreA - scoreB;
 }

 return sortDirection === 'asc' ? comparison : -comparison;
 });

 // Render sort indicator
 const SortIndicator = ({ column }: { column: 'postDate' | 'skillMatch' }) => {
 if (sortColumn !== column) {
 return (
 <svg className="w-4 h-4 ml-1 text-muted-color opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
 </svg>
 );
 }
 return sortDirection === 'desc' ? (
 <svg className="w-4 h-4 ml-1 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 ) : (
 <svg className="w-4 h-4 ml-1 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
 </svg>
 );
 };

 return (
 <div className="h-full overflow-y-auto p-6 lg:p-8" style={{ backgroundColor: 'var(--bg-base)' }}>
 <div className="max-w-7xl mx-auto space-y-8">
 {/* Header */}
 <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
 <div>
 <h1 className="page-title">Auto Jobs</h1>
 <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
 Automated job discovery and application preparation
 </p>
 </div>
 <div className="flex items-center gap-3">
 {jobs.length > 0 && (
 <button
 onClick={handleDeleteAll}
 disabled={isWorkflowRunning || isTriggering}
 className="px-4 py-2 text-error border border-theme rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                style={{ backgroundColor: 'var(--bg-surface)' }}
 title="Delete all auto jobs"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 <span>Delete All</span>
 </button>
 )}
 <button
 onClick={handleTrigger}
 disabled={isWorkflowRunning || isTriggering}
 className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[120px] justify-center"
  title={`Run auto-jobs workflow (3 base + ${(settings.maxJobs || 100) * 0.25} credits = ${3 + (settings.maxJobs || 100) * 0.25} total)`}
  >
 {(isWorkflowRunning || isTriggering) ? (
 <>
 <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 <span>{isTriggering ? 'Starting...' : 'Running...'}</span>
 </>
 ) : (
 <> Run Now <CreditsBadge amount="3 base + 0.25 Credits/job" variant="dim" className="ml-1" /></>
 )}
 </button>
 </div>
 </div>

 {/* API Cost Warning Banner */}
 {showApiWarning && (
 <div className="relative border rounded-xl p-4"
                    style={{ backgroundColor: 'var(--ember-bg)', borderColor: 'rgba(212,160,23,0.2)' }}>
 <div className="flex items-start gap-3">
 <div className="flex-shrink-0">
 <svg className="w-5 h-5 text-ember" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
 </svg>
 </div>
 <div className="flex-1">
 <h3 className="text-sm font-medium text-warm">
 Credits & API Access
 </h3>
 <p className="mt-1 text-sm text-warm">
 Auto Jobs uses AI and automated discovery to find relevant roles.
 </p>
 <ul className="mt-2 text-sm text-warm list-disc list-inside space-y-1">
 <li><strong>App Credits</strong> are consumed per job retrieved (0.1 credits/job)</li>
 <li><strong>Paid Gemini/OpenAI API key</strong> is required in Settings for career analysis</li>
 </ul>
 </div>
 <button
 onClick={() => {
 localStorage.setItem('autoJobsApiWarningDismissed', 'true');
 setShowApiWarning(false);
 }}
 className="flex-shrink-0 text-ember text-ember"
 title="Dismiss"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 </div>
 )}

 {/* Configuration Card */}
 <div className="card p-3 sm:p-6">
 <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Configuration</h2>

 <div className="space-y-4">
 {/* Keywords */}
 <div>
 <label className="label-overline mb-1 block">
 Job Keywords <span className="text-error">*</span>
 </label>
 <input
 type="text"
 value={settings.keywords || ''}
 onChange={(e) => {
 const newSettings = { ...settings, keywords: e.target.value.substring(0, 200) };
 setSettings(newSettings);
 debouncedAutoSave(newSettings);
 }}
 placeholder="e.g., mobile developer"
 maxLength={200}
 className="input-base w-full"
 />
 <p className="mt-1 text-xs text-secondary-color">
 Enter job search keywords (required if location not provided). Max 200 characters.
 </p>
 </div>

 {/* Location */}
 <div className="relative">
 <label className="label-overline mb-1 block">
 Location
 </label>
 <input
 type="text"
 value={locationInput}
 onChange={(e) => handleLocationInputChange(e.target.value)}
 onFocus={() => {
 if (locationInput.length >= 2) {
 // Use setTimeout to avoid blocking
 setTimeout(() => {
 const suggestions = generateLocationSuggestions(locationInput);
 setLocationSuggestions(suggestions);
 setShowLocationSuggestions(suggestions.length > 0);
 }, 0);
 }
 }}
 onBlur={() => {
 // Delay hiding suggestions to allow click events
 setTimeout(() => setShowLocationSuggestions(false), 200);
 }}
 placeholder="e.g., New York, NY or Berlin, Germany"
 maxLength={100}
 className="input-base w-full"
 />
 {showLocationSuggestions && locationSuggestions.length > 0 && (
 <div className="absolute z-10 w-full mt-1 border border-theme rounded-lg shadow-lg max-h-60 overflow-y-auto" style={{ backgroundColor: 'var(--bg-surface)' }}>
 {locationSuggestions.map((suggestion, index) => (
 <button
 key={index}
 type="button"
 onClick={() => handleLocationSelect(suggestion)}
 className="w-full text-left px-4 py-2 text-sm transition-colors" style={{ color: 'var(--text-primary)' }}
 >
 {suggestion}
 </button>
 ))}
 </div>
 )}
 <p className="mt-1 text-xs text-secondary-color">
 Enter location to filter jobs (optional). Start typing to see suggestions. Max 100 characters.
 </p>
 </div>

 {/* Job Type */}
 <div>
 <label className="label-overline mb-1 block">
 Job Type
 </label>
 <div className="flex flex-wrap gap-2">
 {['full-time', 'part-time', 'contract', 'internship'].map((type) => (
 <label key={type} className="flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={settings.jobType?.includes(type) || false}
 onChange={(e) => {
 const currentTypes = settings.jobType || [];
 const newTypes = e.target.checked
 ? [...currentTypes, type]
 : currentTypes.filter(t => t !== type);
 const newSettings = { ...settings, jobType: newTypes };
 setSettings(newSettings);
 debouncedAutoSave(newSettings);
 }}
 className="mr-2 rounded accent-gold"
 />
 <span className="text-sm text-secondary-color capitalize">{type.replace('-', ' ')}</span>
 </label>
 ))}
 </div>
 <p className="mt-1 text-xs text-secondary-color">
 Select 1-5 job types (optional). Leave empty to include all types.
 </p>
 </div>

 {/* Experience Level */}
 <div>
 <label className="label-overline mb-1 block">
 Experience Level
 </label>
 <div className="flex flex-wrap gap-2">
 {['entry level', 'associate', 'mid-senior level', 'director', 'internship'].map((level) => (
 <label key={level} className="flex items-center cursor-pointer">
 <input
 type="checkbox"
 checked={settings.experienceLevel?.includes(level) || false}
 onChange={(e) => {
 const currentLevels = settings.experienceLevel || [];
 const newLevels = e.target.checked
 ? [...currentLevels, level]
 : currentLevels.filter(l => l !== level);
 const newSettings = { ...settings, experienceLevel: newLevels };
 setSettings(newSettings);
 debouncedAutoSave(newSettings);
 }}
 className="mr-2 rounded accent-gold"
 />
 <span className="text-sm text-secondary-color capitalize">{level}</span>
 </label>
 ))}
 </div>
 <p className="mt-1 text-xs text-secondary-color">
 Select 1-5 experience levels (optional). Leave empty to include all levels.
 </p>
 </div>

 {/* Date Posted */}
 <div>
 <label className="label-overline mb-1 block">
 Date Posted
 </label>
 <select
 value={settings.datePosted === 'past hour' ? 'past 24 hours' : (settings.datePosted || 'any time')}
 onChange={(e) => {
 // Prevent selecting "past hour" (not supported by API)
 const datePosted = e.target.value === 'past hour' ? 'past 24 hours' : e.target.value;
 const newSettings = { ...settings, datePosted };
 setSettings(newSettings);
 debouncedAutoSave(newSettings);
 }}
 className="input-base w-full"
 >
 <option value="any time">Any Time</option>
 <option value="past 24 hours">Past 24 Hours</option>
 <option value="past week">Past Week</option>
 <option value="past month">Past Month</option>
 </select>
 <p className="mt-1 text-xs text-secondary-color">
 Filter jobs by posting date (optional).
 </p>
 </div>

 {/* Max Jobs Slider */}
 <div>
 <div className="flex justify-between items-center mb-1">
 <label className="block text-sm font-medium text-secondary-color">
 Jobs to Retrieve
 </label>
 <span className="text-sm font-semibold">
 {settings.maxJobs || 100} jobs
 </span>
 </div>
 <input
 type="range"
 min="20"
 max="1000"
 value={settings.maxJobs || 100}
 onChange={handleMaxJobsChange}
 className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-gold"
                  style={{ backgroundColor: 'var(--bg-raised)' }}
 />
 <p className="mt-1 text-xs text-secondary-color">
 Maximum number of jobs to process per run (20-1000, default: 100)
 </p>
 </div>

 {/* Avoid Duplicates */}
 <div className="flex items-center justify-between">
 <div>
 <label className="text-sm font-medium text-secondary-color">Avoid Duplicates</label>
 <p className="text-xs text-secondary-color">Skip already scraped jobs across runs</p>
 </div>
 <button
 onClick={() => {
 const newSettings = { ...settings, avoidDuplicates: !settings.avoidDuplicates };
 setSettings(newSettings);
 debouncedAutoSave(newSettings);
 }}
className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.avoidDuplicates ? 'bg-gold' : ''}`}
                    style={!settings.avoidDuplicates ? { backgroundColor: 'var(--bg-raised)' } : undefined}
 >
 <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.avoidDuplicates ? 'translate-x-6' : 'translate-x-1'
 }`} />
 </button>
 </div>
 </div>
 </div>

 {/* Workflow Progress Section - Inline on page */}
 {workflowProgress && (
 <div className="card p-4 sm:p-8 relative overflow-hidden">
 {/* Top Progress Bar */}
 <div className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: 'var(--bg-raised)' }}>
 <div
 className="h-full bg-gradient-to-r from-gold to-gold transition-all duration-500 ease-out"
 style={{ width: `${workflowProgress.progress.percentage}%` }}
 />
 </div>

 {/* Header */}
 <div className="flex items-center justify-between mb-8">
 <div className="flex-1">
 <h2 className="text-2xl font-bold text-primary-color mb-1">
 {workflowProgress.status === 'completed' ? 'Workflow Complete!' :
 workflowProgress.status === 'failed' ? 'Workflow Failed' :
 workflowProgress.status === 'cancelled' ? 'Workflow Cancelled' :
 'Running Auto Jobs'}
 </h2>
 {workflowProgress.status === 'running' && workflowProgress.progress.currentStep && (
 <p className="text-sm text-secondary-color">
 {workflowProgress.progress.currentStep}
 </p>
 )}
 </div>
 {workflowProgress.status === 'running' && (
 <button
 onClick={async () => {
 if (!currentRunId) return;
 setConfirmModal({
 isOpen: true,
 message: 'Are you sure you want to cancel this workflow? Processing will stop at the current job.',
 title: 'Cancel Workflow',
 confirmText: 'Cancel Workflow',
 cancelText: 'Keep Running',
 confirmButtonStyle: 'danger',
 onConfirm: async () => {
 setConfirmModal(null);
 try {
 await cancelWorkflow(currentRunId);
 showToast('Workflow cancelled successfully', 'success');
 const status = await getWorkflowStatus(currentRunId);
 setWorkflowProgress(status);
 setCurrentRunId(null);
 localStorage.removeItem('autoJobRunId');
 } catch (err: any) {
 showToast(err.response?.data?.message || 'Failed to cancel workflow', 'error');
 }
 }
 });
 }}
 className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 text-sm font-medium"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 Cancel
 </button>
 )}
 {(workflowProgress.status === 'completed' || workflowProgress.status === 'failed' || workflowProgress.status === 'cancelled') && (
 <button
 onClick={() => {
 setWorkflowProgress(null);
 setCurrentRunId(null);
 localStorage.removeItem('autoJobRunId');
 fetchData();
 }}
 className="p-2 text-muted-color hover:text-secondary-color transition-colors"
 aria-label="Close"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 )}
 </div>

 {/* Horizontal Steps Layout */}
 <div className="relative mb-8">
 <div className="flex items-center justify-between">
 {workflowProgress.steps.map((step, index) => {
 const isCompleted = step.status === 'completed';
 const isRunning = step.status === 'running';
 const isFailed = step.status === 'failed';
 const isPending = step.status === 'pending';

 // Find the index of the running step
 const runningIndex = workflowProgress.steps.findIndex(s => s.status === 'running');
 const isBeforeRunning = index < runningIndex;

 return (
 <div key={index} className="flex-1 flex flex-col items-center relative">
 {/* Connector Line */}
 {index < workflowProgress.steps.length - 1 && (
 <div className="absolute top-5 left-[60%] right-0 h-0.5 -z-10">
<div className={`h-full transition-all duration-500 ${isCompleted || isBeforeRunning
? 'bg-green'
: ''
}`} style={{ width: '100%', ...(isCompleted || isBeforeRunning ? {} : { backgroundColor: 'var(--bg-raised)' }) }} />
 </div>
 )}

 {/* Step Circle */}
 <div className={`
 w-10 h-10 rounded-full flex items-center justify-center mb-3 relative z-10
 transition-all duration-300
 ${isCompleted
 ? 'bg-green text-white shadow-lg shadow-green-500/50'
 : isRunning
 ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50 animate-pulse'
 : isFailed
 ? 'bg-red-500 text-white shadow-lg shadow-red-500/50'
 : 'bg-[var(--bg-raised)] text-muted-color'}
 `}>
 {isCompleted ? (
 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
 </svg>
 ) : isFailed ? (
 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
 </svg>
 ) : isRunning ? (
 <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
 </svg>
 ) : (
 <span className="text-sm font-semibold">{index + 1}</span>
 )}
 </div>

 {/* Step Label */}
 <div className="text-center">
 <div className={`text-sm font-medium mb-1 ${isCompleted
 ? 'text-green'
 : isRunning
 ? 'text-green-house'
 : isFailed
 ? 'text-error'
 : 'text-secondary-color'}
 `}>
 {step.name}
 </div>
 {isRunning && step.message && (
 <div className="text-xs text-green-house animate-pulse mt-1">
 {step.message}
 </div>
 )}
 {isCompleted && step.message && (
 <div className="text-xs text-secondary-color mt-1">
 {step.message}
 </div>
 )}
 </div>

 {/* Progress Bar for Running Step */}
 {isRunning && (
 <div className="absolute top-10 left-1/2 transform -translate-x-1/2 w-20 h-1 rounded-full overflow-hidden mt-2" style={{ backgroundColor: 'var(--bg-raised)' }}>
 <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }} />
 </div>
 )}
 </div>
 );
 })}
 </div>
 </div>

 {/* Current Action Message */}
 {workflowProgress.status === 'running' && workflowProgress.progress.currentStep && (
 <div className="bg-[var(--accent-bg)] border border-[var(--border)] rounded-lg p-4 mb-6">
 <p className="text-sm text-green-house text-center">
 {workflowProgress.progress.currentStep}
 </p>
 </div>
 )}

 {/* Footer Message */}
 {workflowProgress.status === 'running' && (
 <div className="text-center text-xs text-muted-color">
 You can safely navigate away. The workflow will continue in the background.
 </div>
 )}
 </div>
 )}

 {/* Jobs Table */}
 <div className="card overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-elevated border-b border-theme">
 <tr>
 <th className="px-6 py-4 text-left text-xs font-semibold text-secondary-color uppercase tracking-wider">JOB</th>
 <th className="px-6 py-4 text-left text-xs font-semibold text-secondary-color uppercase tracking-wider">LOCATION</th>
 <th
 className="px-6 py-4 text-left text-xs font-semibold text-secondary-color uppercase tracking-wider cursor-pointer hover:text-gold transition-colors group"
 onClick={() => handleSort('postDate')}
 >
 <span className="flex items-center">
 POST DATE
 <SortIndicator column="postDate" />
 </span>
 </th>
 <th
 className="px-6 py-4 text-left text-xs font-semibold text-secondary-color uppercase tracking-wider cursor-pointer hover:text-gold transition-colors group"
 onClick={() => handleSort('skillMatch')}
 >
 <span className="flex items-center">
 SKILL MATCH
 <SortIndicator column="skillMatch" />
 </span>
 </th>
 <th className="px-6 py-4 text-right text-xs font-semibold text-secondary-color uppercase tracking-wider">ACTIONS</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-200" style={{ backgroundColor: 'var(--bg-surface)' }}>
 {sortedJobs.length === 0 ? (
 <tr>
 <td colSpan={5} className="px-6 py-12 text-center">
 <div className="flex flex-col items-center gap-3">
 <p className="text-secondary-color text-base">
 {workflowProgress?.status === 'completed' && workflowProgress.stats.jobsFound === 0 ? (
 <>
 No jobs found matching your search criteria.
 <br />
 <span className="text-sm mt-2 block">
 Try adjusting your keywords, location, date filters, or job type settings.
 </span>
 </>
 ) : (
 'No jobs found yet. Click "Run Now" to start discovering jobs!'
 )}
 </p>
 </div>
 </td>
 </tr>
 ) : (
 sortedJobs.map((job) => (
 <tr key={job._id} className="hover:bg-[var(--bg-elevated)] transition-colors">
 <td className="px-6 py-4">
 <div className="flex flex-col">
 <a
 href={parseMultipleUrls(job.jobUrl || '')[0] || '#'}
 target="_blank"
 rel="noopener noreferrer"
 className="font-semibold text-primary-color hover:text-gold transition-colors"
 >
 {job.jobTitle}
 </a>
 <span className="text-sm text-secondary-color mt-0.5">{job.companyName}</span>
 </div>
 </td>
 <td className="px-6 py-4">
 <div className="flex flex-col">
 {job.extractedData?.location ? (
 <>
 <span className="text-sm text-secondary-color">
 {job.extractedData.location}
 </span>
 {job.extractedData?.remoteOption && (
 <span className="text-xs font-medium mt-0.5">
 {job.extractedData.remoteOption}
 </span>
 )}
 </>
 ) : (
<span className="text-sm text-muted-color italic">
Not specified
</span>
 )}
 </div>
 </td>
 <td className="px-6 py-4">
 {job.jobPostDate ? (() => {
 try {
 const postDate = typeof job.jobPostDate === 'string'
 ? new Date(job.jobPostDate)
 : job.jobPostDate;
if (isNaN(postDate.getTime())) {
return (
<span className="text-sm text-muted-color italic">
Not available
</span>
 );
 }
 return (
 <span className="text-sm text-secondary-color">
 {postDate.toLocaleDateString('en-US', {
 year: 'numeric',
 month: 'short',
 day: 'numeric'
 })}
 </span>
 );
} catch (error) {
return (
<span className="text-sm text-muted-color italic">
Not available
</span>
 );
 }
})() : (
<span className="text-sm text-muted-color italic">
Not available
</span>
 )}
 </td>
 <td className="px-6 py-4">
 <JobRecommendationBadge
 recommendation={job.recommendation ? {
 score: job.recommendation.score,
 shouldApply: job.recommendation.shouldApply,
 reason: job.recommendation.reason,
 cached: true,
 cachedAt: job.recommendation.cachedAt instanceof Date
 ? job.recommendation.cachedAt.toISOString()
 : typeof job.recommendation.cachedAt === 'string'
 ? job.recommendation.cachedAt
 : new Date().toISOString(),
 error: (job.recommendation as any).error
 } : job.processingStatus === 'error' && job.errorMessage ? {
 score: null,
 shouldApply: false,
 reason: job.errorMessage,
 cached: false,
 error: job.errorMessage
 } : null}
 isLoading={
 // Only show loading if workflow is running AND job is still being processed
 !!(isWorkflowRunning &&
 (job.processingStatus === 'pending' || job.processingStatus === 'analyzed') &&
 !job.recommendation)
 }
 onRetry={() => handleRetrySkillMatch(job._id)}
 jobId={job._id}
 />
 </td>
 <td className="px-6 py-4">
 <div className="flex items-center justify-end gap-2">
 {(job.processingStatus === 'generated' || job.processingStatus === 'not_relevant' || job.processingStatus === 'relevant') && (
 <button
 onClick={() => handlePromote(job._id)}
 className="inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
style={{ background: 'var(--jade-bg)', color: 'var(--jade)', border: '1px solid rgba(0,98,65,0.3)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,98,65,0.18)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--jade-bg)')}
 title="Save to main dashboard"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
 </svg>
 </button>
 )}
 <button
 onClick={() => handleDelete(job._id)}
 className="inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"
style={{ background: 'var(--rose-bg)', color: 'var(--rose)', border: '1px solid rgba(200,32,20,0.3)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,32,20,0.18)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--rose-bg)')}
 title="Delete"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 </button>
 </div>
 </td>
 </tr>
 ))
 )}
 </tbody>
 </table>
 </div>

 {/* Pagination */}
 <div className="px-6 py-4 bg-elevated border-t border-theme flex items-center justify-between">
 <div className="text-sm text-secondary-color">
 Showing {total === 0 ? 0 : Math.min((currentPage - 1) * pageSize + 1, total)} to {Math.min(currentPage * pageSize, total)} of {total} entries
 </div>
 {totalPages > 1 && (
 <div className="flex gap-2">
 <button
 onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
 disabled={currentPage === 1}
className="px-4 py-2 text-sm border border-theme rounded-lg hover:bg-[var(--bg-elevated)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
>
Previous
 </button>
 <button
 onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
 disabled={currentPage === totalPages}
className="px-4 py-2 text-sm border border-theme rounded-lg hover:bg-[var(--bg-elevated)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
>
Next
 </button>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Toast Notifications */}
 {toast && (
 <Toast
 message={toast.message}
 type={toast.type}
 onClose={() => setToast(null)}
 />
 )}

 {/* Confirmation Modal */}
 {confirmModal && (
 <ConfirmModal
 show={confirmModal.isOpen}
 onClose={() => setConfirmModal(null)}
 onConfirm={confirmModal.onConfirm}
 title={confirmModal.title || 'Confirm'}
 message={confirmModal.message}
 confirmLabel={confirmModal.confirmText}
 cancelLabel={confirmModal.cancelText}
 danger={confirmModal.confirmButtonStyle === 'danger'}
 />
 )}
 </div>
 );
};

export default AutoJobsPage;


