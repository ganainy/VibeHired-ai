// client/src/pages/CVManagementPage.tsx
import React, { useState, ChangeEvent, FormEvent, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
 uploadCV,
 getMasterCv,
 getAllCvs,
 updateCv,
 deleteCv,
 toggleCvStar,
 CVDocument,
 getCvBranches,
 createCvBranch,
 renameCvBranch,
 uploadCvBranch,
 getCvUsage,
 CvUsageJob,
 getCvOriginalPdf,
 updateEditedPdf,
} from '../services/cvApi';
import { JsonResumeSchema } from '../../../server/src/types/jsonresume';
import { CvSectionDescriptor, CvDynamicPayload } from '../types/cvDescriptor';
import CvEditorPanel from '../components/cv-workspace/CvEditorPanel';
import Toast from '../components/common/Toast';
import { fetchAllSectionsAnalysis, fetchSectionAnalysis, SectionAnalysisResult } from '../services/analysisApi';
import { improveSection } from '../services/generatorApi';
import BaseCvLibraryView from '../components/cv-management/BaseCvLibraryView';
import CreateBranchModal from '../components/cv-management/CreateBranchModal';
import { validateCvFile, formatFileSize } from '../lib/utils';
import ConfirmModal from '../components/common/ConfirmModal';
import Spinner from '../components/common/Spinner';
import JobStatusBadge from '../components/jobs/JobStatusBadge';

const CVManagementPage: React.FC = () => {
 const isJsonResumeLike = useCallback((value: unknown): value is JsonResumeSchema => {
 if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
 const candidate = value as Record<string, unknown>;
 return 'basics' in candidate || 'work' in candidate || 'education' in candidate || 'skills' in candidate;
 }, []);

 const [selectedFile, setSelectedFile] = useState<File | null>(null);
 const [isUploading, setIsUploading] = useState<boolean>(false);
 const [currentCvData, setCurrentCvData] = useState<JsonResumeSchema | null>(null);
 const [defaultCvId, setDefaultCvId] = useState<string | null>(null);

 // Dynamic (AI-driven) editor state the live editing payload for the active CV
 const [liveCvDescriptor, setLiveCvDescriptor] = useState<CvSectionDescriptor[] | null>(null);
 const [liveCvData, setLiveCvData] = useState<Record<string, any> | null>(null);
 const [isLoadingCv, setIsLoadingCv] = useState<boolean>(true);
 const [isSaving, setIsSaving] = useState<boolean>(false);
 const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
 const [uploadError, setUploadError] = useState<string | null>(null);
 const [isDragging, setIsDragging] = useState<boolean>(false);
 const [isDeleting, setIsDeleting] = useState<boolean>(false);
 const [isReplacing, setIsReplacing] = useState<boolean>(false);
 const [uploadProgress, setUploadProgress] = useState<number>(0);
 const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(true);
 const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
 const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
 const [creationMode, setCreationMode] = useState<'choose' | 'upload' | 'scratch'>('upload');
 const [isNudgeDismissed, setIsNudgeDismissed] = useState<boolean>(false);
 const [hasCreatedFirstJob, setHasCreatedFirstJob] = useState<boolean>(false);

 // PDF editing state for raw PDF CVs
 const [editingPdfBase64, setEditingPdfBase64] = useState<string | null>(null);
 const [isSavingPdf, setIsSavingPdf] = useState(false);
 const [isLoadingPdf, setIsLoadingPdf] = useState(false);

 // Analysis state
 const [analyses, setAnalyses] = useState<Record<string, SectionAnalysisResult[]>>({});
 const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
 const [isAnalysisOutdated, setIsAnalysisOutdated] = useState<boolean>(false);
 const [improvingSections, setImprovingSections] = useState<Record<string, boolean>>({});

 const atsPollingIntervalIdRef = useRef<NodeJS.Timeout | null>(null);
 const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

 const [searchParams] = useSearchParams();
 const navigate = useNavigate();
 const location = useLocation();

 // CV usage data (jobs using a base CV)
 const [cvUsageJobs, setCvUsageJobs] = useState<CvUsageJob[]>([]);
 const [isLoadingUsage, setIsLoadingUsage] = useState(false);
 const [usageExpanded, setUsageExpanded] = useState(true);

  // UI state
  const [activeCvId, setActiveCvId] = useState<string | null>(() => {
  // Initialize from URL parameter
  const cvId = searchParams.get('cv');
  return cvId || null;
  }); // CV's MongoDB _id (null = loading)

  const [viewMode, setViewMode] = useState<'library' | 'editor'>(() => {
    const cvId = searchParams.get('cv');
    return cvId ? 'editor' : 'library';
  });

 // All CVs state (master + job CVs) from unified model
 const [allCvs, setAllCvs] = useState<CVDocument[]>([]);
 const [isLoadingJobCvs, setIsLoadingJobCvs] = useState<boolean>(false);

 // Create branch modal state
 const [isCreateBranchModalOpen, setIsCreateBranchModalOpen] = useState<boolean>(false);
 const [isCreatingBranch, setIsCreatingBranch] = useState<boolean>(false);

 // Inline CV name editing state
 const [isEditingName, setIsEditingName] = useState<boolean>(false);
 const [editingName, setEditingName] = useState<string>('');

 const handleStartEditName = () => {
   if (!activeCv) return;
   setEditingName(activeCv.displayName || '');
   setIsEditingName(true);
 };

 const handleSaveName = async () => {
   if (!activeCv) return;
   const trimmed = editingName.trim();
   setIsEditingName(false);
   if (!trimmed || trimmed === (activeCv.displayName || '')) return;
   await handleRenameBranch(activeCv._id, { displayName: trimmed, category: activeCv.category || null });
 };

 const handleNameKeyDown = (e: React.KeyboardEvent) => {
   if (e.key === 'Enter') { e.preventDefault(); handleSaveName(); }
   else if (e.key === 'Escape') setIsEditingName(false);
 };

 // Track original CV data for unsaved changes detection
 const originalCvDataRef = useRef<JsonResumeSchema | null>(null);
 const [confirmModal, setConfirmModal] = useState<{
 show: boolean;
 title: string;
 message: string;
 onConfirm: () => void;
 danger?: boolean;
 type?: 'confirm' | 'alert' | 'info';
 }>({
 show: false,
 title: '',
 message: '',
 onConfirm: () => { },
 });
 const [saveTrigger, setSaveTrigger] = useState<number>(0); // Force recalculation after save

 // Track last analyzed CV hash to avoid re-analyzing unchanged CVs
 // Can be backend hash (SHA256) or frontend hash (JSON string) - both work for comparison
 const lastAnalyzedCvHashRef = useRef<string | null>(null);

  useEffect(() => {
 if (typeof window === 'undefined') return;
 const created = window.localStorage.getItem('vh:has-created-first-job') === '1';
 setHasCreatedFirstJob(created);

 const handleStorage = (event: StorageEvent) => {
 if (event.key === 'vh:has-created-first-job') {
 setHasCreatedFirstJob(event.newValue === '1');
 }
 };
 window.addEventListener('storage', handleStorage);
 return () => window.removeEventListener('storage', handleStorage);
 }, []);

 const handleDismissFirstUploadNudge = () => {
 setIsNudgeDismissed(true);
 };

 // Update URL when activeCvId changes
 useEffect(() => {
 if (activeCvId) {
 const newSearchParams = new URLSearchParams(location.search);
 newSearchParams.set('cv', activeCvId);
 navigate(`${location.pathname}?${newSearchParams.toString()}`, { replace: true });
 } else {
 const newSearchParams = new URLSearchParams(location.search);
 newSearchParams.delete('cv');
 navigate(`${location.pathname}?${newSearchParams.toString()}`, { replace: true });
 }
 }, [activeCvId, navigate, location.pathname, location.search]);

 // Helper function to check if error is API key related
 const isApiKeyError = (errorMessage: string): boolean => {
 return errorMessage?.toLowerCase().includes('api key');
 };

 // Derived state from allCvs
 // Base CVs: no job association (jobApplicationId is null/undefined)
 const baseCvs = useMemo(() => allCvs.filter(cv => !cv.jobApplicationId), [allCvs]);
 const defaultCv = useMemo(() => allCvs.find(cv => cv.isDefault), [allCvs]);
 const jobCvs = useMemo(() => allCvs.filter(cv => !!cv.jobApplicationId), [allCvs]);
 const hasBaseCvs = baseCvs.length > 0;

 // Get active CV document
 const activeCv = useMemo(() => {
 if (!activeCvId) return defaultCv || null;
 return allCvs.find(cv => cv._id === activeCvId) || null;
 }, [activeCvId, allCvs, defaultCv]);

 // Get active job (for job CVs)
 const activeJob = useMemo(() => {
 return !!activeCv?.jobApplicationId ? activeCv.jobApplication : null;
 }, [activeCv]);

 // Get active CV data (cvJson)
 const activeCvData = useMemo(() => {
 if (!activeCv) return currentCvData; // Fallback to legacy state during transition
 return activeCv.cvJson || null;
 }, [activeCv, currentCvData]);

 // Fetch job usage for the active base CV
 const isBaseCv = activeCv && !activeCv.jobApplicationId;
 useEffect(() => {
 if (!isBaseCv || !activeCv?._id) {
 setCvUsageJobs([]);
 return;
 }
 let cancelled = false;
 setIsLoadingUsage(true);
 getCvUsage(activeCv._id)
 .then(res => { if (!cancelled) setCvUsageJobs(res.jobs); })
 .catch(() => { if (!cancelled) setCvUsageJobs([]); })
 .finally(() => { if (!cancelled) setIsLoadingUsage(false); });
 return () => { cancelled = true; };
 }, [activeCv?._id, isBaseCv]);

 // Sync live dynamic state when the active CV changes
 useEffect(() => {
 if (activeCv?.cvDescriptor && activeCv.cvData) {
 setLiveCvDescriptor(activeCv.cvDescriptor);
 setLiveCvData(activeCv.cvData);
 } else {
 setLiveCvDescriptor(null);
 setLiveCvData(null);
 }
 }, [activeCv?._id]); // Only when the active CV identity changes, not on every render

 // Load PDF for inline editing for any CV that has an original PDF file
 useEffect(() => {
 if (!activeCv?._id) {
 setEditingPdfBase64(null);
 return;
 }

 // Load the original PDF for inline editing
 let cancelled = false;
 const loadPdf = async () => {
 try {
 setIsLoadingPdf(true);
 const { pdfBase64 } = await getCvOriginalPdf(activeCv._id);
 if (!cancelled) {
 setEditingPdfBase64(pdfBase64);
 }
 } catch (err) {
 console.error('Failed to load PDF for editing:', err);
 if (!cancelled) {
 setEditingPdfBase64(null);
 }
 } finally {
 if (!cancelled) {
 setIsLoadingPdf(false);
 }
 }
 };

 loadPdf();
 return () => { cancelled = true; };
 }, [activeCv?._id]);

 // Calculate unsaved changes
 const hasUnsavedChanges = useMemo(() => {
 if (!activeCvData) return false;

 // For master CV
 if (activeCv?.isDefault) {
 if (!originalCvDataRef.current) return false;
 try {
 const currentStr = JSON.stringify(activeCvData);
 const originalStr = JSON.stringify(originalCvDataRef.current);
 return currentStr !== originalStr;
 } catch (error) {
 console.error('Error comparing CV data:', error);
 return true;
 }
 }

 // For Job CVs - we don't track unsaved changes as strictly yet since we don't have the original ref for each job easily accessible without more complex state
 // But we can check if it's currently saving
 return saveStatus === 'saving';
 }, [activeCvData, activeCv, saveStatus, saveTrigger]); // Include saveTrigger to force recalculation

 // Generate a simple hash for CV comparison (only relevant sections)
 // Note: This should match the backend hash generation logic
 const generateCvHash = (cvJson: JsonResumeSchema): string => {
 const relevantSections = {
 work: cvJson.work || [],
 education: cvJson.education || [],
 skills: cvJson.skills || []
 };
 // Normalize by stringifying (backend uses SHA256, but for frontend comparison we just need consistency)
 return JSON.stringify(relevantSections);
 };

 // Run full CV analysis - single request for all sections
 // Backend handles caching automatically - no need to check locally
 // Run full CV analysis - single request for all sections
 // Backend handles caching automatically - no need to check locally
 const runFullCvAnalysis = async (cvJson: JsonResumeSchema) => {
 if (isAnalyzing) return; // Prevent concurrent analyses

 setIsAnalyzing(true);

 try {
 // Single API call to analyze all sections at once
 // Backend will check its cache and return cached results if CV hash matches
 const allAnalyses = await fetchAllSectionsAnalysis(cvJson);
 setAnalyses(allAnalyses);
 // Store hash for reference (backend uses SHA256, we store the JSON string for local tracking)
 lastAnalyzedCvHashRef.current = generateCvHash(cvJson);
 } catch (error: any) {
 console.error('Error running CV analysis:', error);
 setToast({ message: error.message || 'Failed to analyze CV sections.', type: 'error' });
 } finally {
 setIsAnalyzing(false);
 }
 };

 // Manual trigger for analysis
 const handleRunAnalysis = async () => {
 if (!activeCvData) return;

 // Save first if there are changes (only for master for now)
 if (activeCvId === 'master' && hasUnsavedChanges) {
 await handleSaveCv();
 }

 // Run analysis
 runFullCvAnalysis(activeCvData);
 };

 // Fetch current CV on mount
 useEffect(() => {
 const fetchCv = async () => {
 setIsLoadingCv(true);
 try {
 const response = await getMasterCv();
 const cvDoc = response.cv;
 const cvData = cvDoc?.cvJson || null;
 setCurrentCvData(cvData);
 originalCvDataRef.current = cvData ? JSON.parse(JSON.stringify(cvData)) : null;
 // Reset save trigger to ensure proper comparison
 setSaveTrigger(0);

 // Load cached analysis if available
 // Backend has already verified the hash matches, so we can trust the cache
 if (cvData && isJsonResumeLike(cvData) && cvDoc?.analysisCache) {
 console.log('Loading cached analysis results');
 const cache = cvDoc.analysisCache as { analyses?: Record<string, any>; cvHash?: string };
 if (cache.analyses) {
 setAnalyses(cache.analyses);
 // Store the hash for future comparisons
 lastAnalyzedCvHashRef.current = cache.cvHash || null;
 }
 }

 setIsLoadingCv(false);

 // Run analysis after CV is loaded (only if no valid cache)
 const cache = cvDoc?.analysisCache as { analyses?: Record<string, any> } | null;
 if (cvData && isJsonResumeLike(cvData) && (!cache || !cache.analyses)) {
 setIsAnalysisOutdated(true);
 }
 } catch (error: any) {
 console.error("Error fetching current CV:", error);
 setToast({ message: error.message || 'Failed to load CV data.', type: 'error' });
 setIsLoadingCv(false);
 }
 };
 fetchCv();
 }, [isJsonResumeLike]);

 // Fetch all CV branches from unified API
 useEffect(() => {
 const fetchAllCvsData = async () => {
 setIsLoadingJobCvs(true);
 try {
 const response = await getCvBranches();
 setAllCvs(response.branches);

 // Set activeCvId to first base CV if not set yet
 const firstBase = response.branches.find(cv => !cv.jobApplicationId);
 if (firstBase && !activeCvId) {
 setActiveCvId(firstBase._id);
 }
 } catch (error: any) {
 console.error("Error fetching CV branches:", error);
 // Silently fail - CV branches are optional
 } finally {
 setIsLoadingJobCvs(false);
 }
 };

 // Fetch branches on mount, independent of master CV
 fetchAllCvsData();
 }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
 if (event.target.files && event.target.files[0]) {
 const file = event.target.files[0];

 const validation = validateCvFile(file);
 if (!validation.isValid) {
 setToast({
 message: validation.errorMessage!,
 type: 'error'
 });
 return;
 }

 setSelectedFile(file);
 setUploadError(null); // Clear any previous errors
 } else {
 setSelectedFile(null);
 }
 };

 const handleDragOver = (e: React.DragEvent) => {
 e.preventDefault();
 e.stopPropagation();
 setIsDragging(true);
 };

 const handleDragLeave = (e: React.DragEvent) => {
 e.preventDefault();
 e.stopPropagation();
 setIsDragging(false);
 };

 const handleDrop = (e: React.DragEvent) => {
 e.preventDefault();
 e.stopPropagation();
 setIsDragging(false);

 const files = e.dataTransfer.files;

 // Check if multiple files were dropped
 if (files && files.length > 1) {
 setToast({
 message: 'Please drop only one file at a time.',
 type: 'error'
 });
 return;
 }

 if (files && files[0]) {
 const file = files[0];

 const validation = validateCvFile(file);
 if (!validation.isValid) {
 setToast({
 message: validation.errorMessage!,
 type: 'error'
 });
 return;
 }

 setSelectedFile(file);
 setUploadError(null); // Clear any previous errors

 // Update the file input
 const fileInput = document.getElementById('cvFileInput') as HTMLInputElement;
 if (fileInput) {
 const dataTransfer = new DataTransfer();
 dataTransfer.items.add(file);
 fileInput.files = dataTransfer.files;
 }
 }
 };

 const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
 event.preventDefault();
 if (!selectedFile) {
 setToast({ message: 'Please select a PDF, DOCX, or RTF file to upload.', type: 'error' });
 return;
 }

 setIsUploading(true);
 setUploadProgress(0);

 try {
 // Simulate progress for better UX (actual upload happens quickly)
 setUploadProgress(30);

 const response = await uploadCV(selectedFile);

 setUploadProgress(60);
 const cvData = response.cv?.cvJson || null;
 setCurrentCvData(cvData);
 setAllCvs((prev: CVDocument[]) => {
 if (!response.cv?._id) return prev;
 const existingIndex = prev.findIndex((cv) => cv._id === response.cv._id);
 if (existingIndex >= 0) {
 return prev.map((cv) => (cv._id === response.cv._id ? { ...cv, ...response.cv } : cv));
 }
 return [...prev, response.cv];
 });
  if (response.cv?._id) {
    setActiveCvId(response.cv._id);
    setViewMode('editor');
  }
 originalCvDataRef.current = cvData ? JSON.parse(JSON.stringify(cvData)) : null;
 // Reset save trigger to ensure proper comparison
 setSaveTrigger(0);
 // Sync dynamic descriptor state from upload response
 setLiveCvDescriptor(response.cv?.cvDescriptor ?? null);
 setLiveCvData(response.cv?.cvData ?? null);

 setUploadProgress(90);

 if (cvData && isJsonResumeLike(cvData)) {
 runFullCvAnalysis(cvData);
 setIsAnalysisOutdated(false);
 }

 setUploadProgress(100);
 setSelectedFile(null);
 setIsReplacing(false);
 const fileInput = document.getElementById('cvFileInput') as HTMLInputElement;
 if (fileInput) fileInput.value = '';
 if (!hasCreatedFirstJob) {
 setIsNudgeDismissed(false);
 }
 setToast({ message: response.message || 'CV uploaded and processed successfully!', type: 'success' });
 } catch (error: any) {
 console.error('Upload failed:', error);
 setUploadProgress(0);
 setUploadError(error.message || 'Failed to upload CV. Please try again.');
 setToast({ message: error.message || 'Failed to upload CV. Please try again.', type: 'error' });
 } finally {
 setIsUploading(false);
 setTimeout(() => setUploadProgress(0), 1000); // Reset progress after a delay
 }
 };

 const handleCvChange = (updatedCv: JsonResumeSchema) => {
 // Optimistically update CV in allCvs (for both Master and Job CVs)
 if (activeCvId) {
 setAllCvs((prev: CVDocument[]) => prev.map((cv: CVDocument) =>
 cv._id === activeCvId ? { ...cv, cvJson: updatedCv } : cv
 ));
 }

 if (activeCv?.isDefault) {
 setCurrentCvData(updatedCv);
 }

 setSaveStatus('idle'); // Reset save status when changes are made

 // Trigger auto-save if enabled
 if (autoSaveEnabled) {
 // Clear existing timeout
 if (autoSaveTimeoutRef.current) {
 clearTimeout(autoSaveTimeoutRef.current);
 }

 // Set new timeout for auto-save (500ms debounce)
 autoSaveTimeoutRef.current = setTimeout(async () => {
 await handleSaveCv(true); // Pass true to indicate auto-save

 // Auto-trigger analysis after save if CV changed
 const currentHash = generateCvHash(updatedCv);
 if (isJsonResumeLike(updatedCv) && lastAnalyzedCvHashRef.current !== currentHash) {
 runFullCvAnalysis(updatedCv);
 }
 }, 500);
 }

 // Check if relevant sections changed
 const currentHash = generateCvHash(updatedCv);
 if (isJsonResumeLike(updatedCv) && lastAnalyzedCvHashRef.current !== currentHash) {
 setIsAnalysisOutdated(true);
 }
 };

 const handleSaveCv = useCallback(async (isAutoSave: boolean = false) => {
 if (!activeCvData) {
 setToast({ message: 'No CV data to save.', type: 'error' });
 return;
 }

 // Don't show saving state for auto-save to avoid UI flicker
 if (!isAutoSave) {
 setIsSaving(true);
 }
 setSaveStatus('saving');

 try {
 let message = 'CV updated successfully!';

 if (!activeCv?._id) {
 throw new Error('CV ID not found. Please refresh the page.');
 }

 // Use unified updateCv API for both master and job CVs
 const response = await updateCv(activeCv._id, {
 cvJson: activeCvData,
 cvDescriptor: liveCvDescriptor ?? undefined,
 cvData: liveCvData ?? undefined,
 });
 message = response.message || message;

 if (activeCv.isDefault) {
 // Deep copy to ensure proper comparison - update the ref with the exact data that was saved
 originalCvDataRef.current = JSON.parse(JSON.stringify(activeCvData));
 // Trigger recalculation of hasUnsaved changes
 setSaveTrigger(prev => prev + 1);
 }

 setSaveStatus('saved');
 setLastSavedTime(new Date());

 // Only show toast for manual saves
 if (!isAutoSave) {
 setToast({ message, type: 'success' });
 }

 // Reset save status after 3 seconds
 setTimeout(() => {
 setSaveStatus('idle');
 }, 3000);
 } catch (error: any) {
 console.error("Error saving CV:", error);
 setSaveStatus('error');
 // Handle both object errors and Error instances
 const errorMessage = error?.message || error?.error || 'Failed to save CV changes.';
 setToast({ message: errorMessage, type: 'error' });

 // Reset error status after 5 seconds
 setTimeout(() => {
 setSaveStatus('idle');
 }, 5000);
 } finally {
 if (!isAutoSave) {
 setIsSaving(false);
 }
 }
 }, [activeCvData, activeCv, liveCvDescriptor, liveCvData]);

 const handleDynamicChange = useCallback((payload: CvDynamicPayload) => {
 setLiveCvDescriptor(payload.descriptor);
 setLiveCvData(payload.data);
 setSaveStatus('idle');
 // Keep allCvs in sync for consistency
 if (activeCvId) {
 setAllCvs((prev: CVDocument[]) => prev.map((cv: CVDocument) =>
 cv._id === activeCvId
 ? { ...cv, cvDescriptor: payload.descriptor, cvData: payload.data }
 : cv
 ));
 }
 // Trigger auto-save if enabled
 if (autoSaveEnabled) {
 if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
 autoSaveTimeoutRef.current = setTimeout(() => handleSaveCv(true), 500);
 }
 }, [activeCvId, autoSaveEnabled, handleSaveCv]);

 // Save edited PDF back to the CV document
 const handlePdfSave = async (updatedPdfBase64: string) => {
 if (!activeCv?._id) return;

 setIsSavingPdf(true);
 try {
 await updateEditedPdf(activeCv._id, updatedPdfBase64);
 setEditingPdfBase64(updatedPdfBase64);
 setToast({ message: 'PDF saved successfully', type: 'success' });
 } catch (err: any) {
 console.error('Failed to save PDF:', err);
 setToast({ message: `Failed to save PDF: ${err.message}`, type: 'error' });
 } finally {
 setIsSavingPdf(false);
 }
 };

 const handleDownloadOriginalPdf = useCallback(() => {
 if (!editingPdfBase64) {
 setToast({ message: 'Original PDF is not available', type: 'error' });
 return;
 }
 const filename = activeCv?.filename?.endsWith('.pdf')
 ? activeCv.filename
 : `${activeCv?.filename || 'cv'}.pdf`;
 const link = document.createElement('a');
 link.href = `data:application/pdf;base64,${editingPdfBase64}`;
 link.download = filename;
 document.body.appendChild(link);
 link.click();
 document.body.removeChild(link);
 }, [editingPdfBase64, activeCv?.filename]);

 const handleDeleteCv = (cvId: string) => {
 setConfirmModal({
 show: true,
 title: 'Delete CV',
 message: 'Are you sure you want to delete this CV? This action cannot be undone.',
 danger: true,
 onConfirm: async () => {
 setIsDeleting(true);
 try {
 await deleteCv(cvId);
 const remaining = allCvs.filter((cv: CVDocument) => cv._id !== cvId);
 setAllCvs(remaining);
  if (activeCvId === cvId) {
  const nextCv = remaining.find(cv => !cv.jobApplicationId) || remaining[0] || null;
  setActiveCvId(nextCv?._id || null);
  if (!nextCv) setViewMode('library');
  }
 // If the deleted CV was the default or no CVs remain, clear the legacy
 // currentCvData fallback so the editor/preview don't ghost the deleted content.
 const deletedWasDefault = cvId === defaultCvId;
 if (deletedWasDefault || remaining.length === 0) {
 setCurrentCvData(null);
 if (deletedWasDefault) setDefaultCvId(null);
 }
 setToast({ message: 'CV deleted successfully.', type: 'success' });
 } catch (error: any) {
 console.error("Error deleting CV:", error);
 setToast({ message: error.message || 'Failed to delete CV.', type: 'error' });
 } finally {
 setIsDeleting(false);
 }
 }
 });
 };

 const handleRenameBranch = async (cvId: string, payload: { displayName: string; category: string | null }) => {
 try {
 await renameCvBranch(cvId, { displayName: payload.displayName, category: payload.category });

 // Update local state
 setAllCvs((prev: CVDocument[]) =>
 prev.map((cv: CVDocument) =>
 cv._id === cvId ? { ...cv, displayName: payload.displayName, category: payload.category ?? cv.category } : cv
 )
 );

 setToast({ message: 'CV branch renamed successfully.', type: 'success' });
 return true;
 } catch (error: any) {
 console.error("Error renaming CV branch:", error);
 setToast({ message: error.message || 'Failed to rename CV branch.', type: 'error' });
 return false;
 }
 };

 const handleToggleStar = async (cvId: string, nextValue: boolean) => {
 try {
 await toggleCvStar(cvId, nextValue);
 setAllCvs((prev: CVDocument[]) => prev.map((cv: CVDocument) =>
 cv._id === cvId ? { ...cv, isStarred: nextValue } : cv
 ));
 } catch (error: any) {
 console.error('Error toggling CV star:', error);
 setToast({ message: error.message || 'Failed to update CV star.', type: 'error' });
 }
 };

 const handleCreateBranch = async (sourceCvId: string, category: string, displayName: string) => {
 setIsCreatingBranch(true);
 try {
 const response = await createCvBranch({ sourceCvId, category, displayName });

 // Add the new branch to local state
 setAllCvs((prev: CVDocument[]) => [...prev, response.branch]);

 setToast({ message: 'CV branch created successfully.', type: 'success' });
 } catch (error: any) {
 console.error("Error creating CV branch:", error);
 setToast({ message: error.message || 'Failed to create CV branch.', type: 'error' });
 throw error; // Re-throw to let modal handle it
 } finally {
 setIsCreatingBranch(false);
 }
 };

 const handleUploadBranchFromFile = async (file: File, category: string, displayName: string) => {
 setIsCreatingBranch(true);
 try {
 const response = await uploadCvBranch(file, category, displayName);

 // Add the new branch to local state
 setAllCvs((prev: CVDocument[]) => [...prev, response.branch]);

 // Optionally set the new branch as active
 setActiveCvId(response.branch._id);

 setToast({ message: 'CV branch uploaded and created successfully.', type: 'success' });
 } catch (error: any) {
 console.error("Error uploading CV branch:", error);
 setToast({ message: error.message || 'Failed to upload CV branch.', type: 'error' });
 throw error; // Re-throw to let modal handle it
 } finally {
 setIsCreatingBranch(false);
 }
 };

 const formatRelativeTime = (date: Date): string => {
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffSecs = Math.floor(diffMs / 1000);
 const diffMins = Math.floor(diffSecs / 60);
 const diffHours = Math.floor(diffMins / 60);

 if (diffSecs < 10) return 'just now';
 if (diffSecs < 60) return `${diffSecs}s ago`;
 if (diffMins < 60) return `${diffMins}m ago`;
 if (diffHours < 24) return `${diffHours}h ago`;
 return date.toLocaleDateString();
 };

 // Handle section improvement
 const handleImproveSection = async (
 sectionName: string,
 sectionIndex: number,
 originalData: any,
 customInstructions?: string
 ) => {
 if (!activeCvData) return;

 const sectionKey = `${sectionName}-${sectionIndex}`;
 setImprovingSections((prev) => ({ ...prev, [sectionKey]: true }));

 try {
 const improvedData = await improveSection(sectionName, originalData, customInstructions);

 // Update the CV data with improved section - deep copy to ensure proper change detection
 const updatedCv = JSON.parse(JSON.stringify(activeCvData));

 if (sectionName === 'work' && updatedCv.work) {
 updatedCv.work[sectionIndex] = { ...updatedCv.work[sectionIndex], ...improvedData };
 } else if (sectionName === 'education' && updatedCv.education) {
 updatedCv.education[sectionIndex] = { ...updatedCv.education[sectionIndex], ...improvedData };
 } else if (sectionName === 'skills' && updatedCv.skills) {
 updatedCv.skills[sectionIndex] = { ...updatedCv.skills[sectionIndex], ...improvedData };
 }

 handleCvChange(updatedCv);

 // Re-analyze the improved section
 const newAnalysis = await fetchSectionAnalysis(sectionName, improvedData);
 setAnalyses((prev) => {
 const updated = { ...prev };
 if (!updated[sectionName]) {
 updated[sectionName] = [];
 }
 const sectionArray = [...(updated[sectionName] || [])];
 sectionArray[sectionIndex] = newAnalysis;
 updated[sectionName] = sectionArray;
 return updated;
 });

 // Update hash since CV changed
 const newHash = generateCvHash(updatedCv);
 lastAnalyzedCvHashRef.current = newHash;

 setToast({ message: 'Section improved successfully!', type: 'success' });
 } catch (error: any) {
 console.error('Error improving section:', error);
 setToast({ message: error.message || 'Failed to improve section.', type: 'error' });
 } finally {
 setImprovingSections((prev) => {
 const updated = { ...prev };
 delete updated[sectionKey];
 return updated;
 });
 }
 };

 // Keyboard shortcut for save
 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if ((e.ctrlKey || e.metaKey) && e.key === 's' && activeCvData && hasUnsavedChanges) {
 e.preventDefault();
 handleSaveCv();
 }
 };
 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, [activeCvData, hasUnsavedChanges, handleSaveCv]);

 // State for collapsible ATS panel
 const [isAtsPanelOpen, setIsAtsPanelOpen] = useState<boolean>(true);

 // Get smart status for display - shows only the most relevant status
 const getSmartStatus = () => {
 if (hasUnsavedChanges) {
 return { text: 'Unsaved changes', color: 'amber', icon: 'dot', tooltip: 'Press Ctrl+S to save' };
 }
 if (saveStatus === 'saving') {
 return { text: 'Saving...', color: 'blue', icon: 'spinner', tooltip: null };
 }
 if (saveStatus === 'error') {
 return { text: 'Save failed', color: 'red', icon: 'error', tooltip: 'Click to retry' };
 }

 if (saveStatus === 'saved' && lastSavedTime) {
 return { text: `Saved ${formatRelativeTime(lastSavedTime)}`, color: 'green', icon: 'check', tooltip: null };
 }
 if (atsScores && Object.keys(analyses).length > 0) {
 return { text: 'All up to date', color: 'green', icon: 'check', tooltip: 'CV and analysis are current' };
 }
 return null;
 };

 return (
 <div className="flex flex-col h-full px-4 sm:px-6 pt-6 sm:pt-8 pb-4 sm:pb-6 gap-4 sm:gap-6 overflow-hidden" style={{ backgroundColor: 'var(--bg-base)' }}>
  {(isLoadingCv || isLoadingJobCvs) ? (
  <div className="flex-1 flex items-center justify-center">
  <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
  <Spinner size="sm" />
  Loading CVs...
  </div>
  </div>
  ) : !hasBaseCvs ? (
  /* Zero-CV hero */
  <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto">
   <div className="w-full max-w-lg px-4 sm:px-6 py-8 sm:py-12">
  <div className="text-center mb-8">
  <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-5" style={{ background: 'linear-gradient(135deg, var(--accent-dim), var(--accent))' }}>
  <svg className="w-8 h-8 text-green-house" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
  </div>
  <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
  No Base CVs Yet
  </h2>
  <p className="text-base text-muted-color max-w-md mx-auto">
  Upload a CV or start from scratch to create your first base CV. We use base CVs to generate tailored CVs for jobs later.
  </p>
  </div>

  <form onSubmit={handleSubmit}>
  <div
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
  className={`border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center transition-all ${isDragging ? 'border-blue-500 bg-[var(--accent-bg)]' : 'border-theme'}`}
  >
  {isUploading ? (
   <p className="text-green-house">Uploading...</p>
  ) : (
  <>
   <p className="text-lg sm:text-lg font-medium text-primary-color">Drag & Drop or Click to Upload</p>
  <input type="file" id="cvFileInput" onChange={handleFileChange} className="hidden" accept=".pdf,.docx,.rtf" />
  <label htmlFor="cvFileInput" className="mt-4 inline-block px-6 py-2 bg-green text-white rounded-lg cursor-pointer hover:bg-green-accent">Select File</label>
  </>
  )}
  </div>

  {selectedFile && (
  <div className="mt-4 p-3 bg-[var(--accent-bg)] rounded-lg flex justify-between items-center text-sm">
  <span className="font-medium">{selectedFile.name}</span>
  <button onClick={() => setSelectedFile(null)} type="button" className="text-error hover:text-error">Remove</button>
  </div>
  )}

  <button
  type="submit"
  disabled={!selectedFile || isUploading}
  className="mt-6 w-full py-3 bg-green text-white rounded-xl font-semibold hover:bg-green-accent disabled:opacity-50"
  >
  {isUploading ? 'Processing...' : 'Extract & Fill Form'}
  </button>
  </form>
  {uploadError && <p className="mt-4 text-error text-center">{uploadError}</p>}
  </div>
  </div>
  ) : (
  <>
  {viewMode === 'library' && !isReplacing && hasBaseCvs && (
  <BaseCvLibraryView
  cvs={baseCvs}
  isLoading={isLoadingJobCvs}
  onSelectCv={(id) => { setActiveCvId(id); setViewMode('editor'); }}
  onUpload={() => { setIsReplacing(true); setSelectedFile(null); setCreationMode('upload'); }}
  onDeleteCv={handleDeleteCv}
  onCreateBranch={() => setIsCreateBranchModalOpen(true)}
  onToggleStar={handleToggleStar}
  />
  )}

  {(isReplacing || viewMode === 'editor') && (
  <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
  {isReplacing && !isLoadingCv ? (
  /* "" Upload / Create Overlay "" */
  <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-theme shadow-sm p-4 sm:p-6">
  {allCvs.length > 0 && (
  <button
  onClick={() => {
  setIsReplacing(false);
  setCreationMode('upload');
  }}
  className="mb-4 sm:mb-6 flex items-center gap-2 px-4 py-2.5 text-secondary-color hover:text-primary-color bg-white border border-theme rounded-lg shadow-sm hover:shadow-md transition-all font-medium"
  >
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
  <span>Back to Base CVs</span>
  </button>
  )}

  {/* Upload Mode */}
  {creationMode === 'upload' && (
  <div className="max-w-2xl mx-auto mt-6 sm:mt-10">
  <div className="text-center mb-6 sm:mb-8">
  <h2 className="text-xl sm:text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Import a Base CV</h2>
  <p className="text-secondary-color">Upload a PDF, DOCX, or RTF file as your base CV.</p>
  </div>

  <form onSubmit={handleSubmit}>
  <div
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}
  className={`border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center transition-all ${isDragging ? 'border-blue-500 bg-[var(--accent-bg)]' : 'border-theme'}`}
  >
  {isUploading ? (
  <p className="text-green-house">Uploading...</p>
  ) : (
  <>
  <p className="text-base sm:text-lg font-medium text-primary-color">Drag & Drop or Click to Upload</p>
  <input type="file" id="cvFileInput" onChange={handleFileChange} className="hidden" accept=".pdf,.docx,.rtf" />
  <label htmlFor="cvFileInput" className="mt-4 inline-block px-6 py-2 bg-green text-white rounded-lg cursor-pointer hover:bg-green-accent">Select File</label>
  </>
  )}
  </div>

  {selectedFile && (
  <div className="mt-4 p-3 bg-[var(--accent-bg)] rounded-lg flex justify-between items-center text-sm">
  <span className="font-medium">{selectedFile.name}</span>
  <button onClick={() => setSelectedFile(null)} type="button" className="text-error hover:text-error">Remove</button>
  </div>
  )}

  <button
  type="submit"
  disabled={!selectedFile || isUploading}
  className="mt-6 w-full py-3 bg-green text-white rounded-xl font-semibold hover:bg-green-accent disabled:opacity-50"
  >
  {isUploading ? 'Processing...' : 'Extract & Create Base CV'}
  </button>
  </form>
  {uploadError && <p className="mt-4 text-error text-center">{uploadError}</p>}
  </div>
  )}
  </div>
  ) : (
  <>
   {hasBaseCvs && !hasCreatedFirstJob && !isNudgeDismissed && (
  <div
  className="mb-4 sm:mb-5 rounded-2xl border px-5 py-4 sm:px-6 sm:py-5 relative overflow-hidden"
  style={{ borderColor: 'var(--accent-dim)', background: 'linear-gradient(135deg, var(--accent-bg), rgba(255,255,255,0.9))' }}
  >
  <div className="absolute -right-20 -top-20 w-48 h-48 rounded-full opacity-20" style={{ background: 'var(--accent)' }} />
  <div className="relative flex flex-col gap-4">
  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
  <div className="space-y-2">
  <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--text-muted)' }}>
  <span className="material-symbols-outlined text-base" style={{ color: 'var(--accent)' }}>bolt</span>
  Next Step
  </div>
  <h3 className="text-lg sm:text-xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
  Your base CV is ready. Now use it to apply.
  </h3>
  <p className="text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>
  Add a job in the dashboard, then generate a tailored CV and cover letter for that role.
  </p>
  </div>
  <div className="flex items-center gap-2">
  <Link
   to="/dashboard"
  className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm"
  >
  <span className="material-symbols-outlined text-base">dashboard</span>
  Go to Dashboard
  </Link>
  <button
  type="button"
  onClick={handleDismissFirstUploadNudge}
  className="px-3 py-2 text-sm font-medium rounded-lg border transition-colors"
  style={{ borderColor: 'var(--text-primary)', color: 'var(--text-secondary)' }}
  >
  Dismiss
  </button>
  </div>
  </div>
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
  {[
  {
  title: 'Pick a job to apply for',
  detail: 'Create or import a job in the dashboard.',
  icon: 'work'
  },
  {
  title: 'Generate a tailored CV',
  detail: 'Use this base CV to craft the job-specific version.',
  icon: 'auto_awesome'
  },
  {
  title: 'Finish with a cover letter',
  detail: 'Let the workspace draft a targeted cover letter.',
  icon: 'mail'
  }
  ].map((step, index) => (
  <div
  key={step.title}
  className="rounded-xl border px-4 py-3 flex items-start gap-3"
  style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
  >
  <div className="w-9 h-9 rounded-lg flex items-center justify-center font-semibold" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
  {index + 1}
  </div>
  <div className="space-y-1">
  <div className="flex items-center gap-2">
  <span className="material-symbols-outlined text-base" style={{ color: 'var(--accent)' }}>{step.icon}</span>
  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{step.title}</p>
  </div>
  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{step.detail}</p>
  </div>
  </div>
  ))}
  </div>
  </div>
  </div>
  )}

  {/* Back to Library Button */}
  <div className="flex-shrink-0 pb-2 flex items-center gap-3">
  <button
  onClick={() => { setActiveCvId(null); setViewMode('library'); }}
  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-black/60 hover:text-green bg-white border border-[#d4d0c8] rounded-lg shadow-sm hover:shadow-md transition-all"
  >
  <span className="material-symbols-outlined text-base">arrow_back</span>
  Back to Library
  </button>
  {activeCv && (
  isEditingName ? (
  <input
    autoFocus
    value={editingName}
    onChange={(e) => setEditingName(e.target.value)}
    onBlur={handleSaveName}
    onKeyDown={handleNameKeyDown}
    className="text-lg font-semibold text-black/87 bg-white border border-green/40 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-green/30 min-w-[200px]"
    placeholder="CV name..."
  />
  ) : (
  <h2
    onClick={handleStartEditName}
    className="text-lg font-semibold text-black/87 truncate cursor-pointer hover:text-green transition-colors group/title flex items-center gap-1.5"
    title="Click to rename"
  >
  {activeCv.displayName || activeCv.category || 'Unnamed CV'}
  <span className="material-symbols-outlined text-sm text-black/20 group-hover/title:text-green transition-colors">edit</span>
  </h2>
  )
  )}
  </div>

  <CvEditorPanel
  data={activeCvData || currentCvData}
  onChange={handleCvChange}
  onSave={() => handleSaveCv()}
  saveStatus={saveStatus}
  hasUnsavedChanges={hasUnsavedChanges}
  onImproveSection={handleImproveSection}
  improvingSections={improvingSections}
  className={isBaseCv ? 'flex-1 min-h-0' : 'h-full'}
  cvId={activeCv?._id}
  cvDescriptor={liveCvDescriptor}
  cvData={liveCvData}
  onDynamicChange={handleDynamicChange}
  pdfBase64={editingPdfBase64}
  pdfFilename={activeCv?.filename || null}
  onPdfSave={handlePdfSave}
  isPdfSaving={isSavingPdf}
  isLoadingPdf={isLoadingPdf}
  onDownload={handleDownloadOriginalPdf}
  onDelete={activeCv?._id ? () => handleDeleteCv(activeCv._id) : undefined}
  />
  {/* Used in Jobs section only for base CVs */}
  {isBaseCv && (
  <div className="flex-shrink-0 border-t mt-3" style={{ borderColor: 'var(--border)' }}>
  <button
  onClick={() => setUsageExpanded(!usageExpanded)}
  className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-[var(--bg-elevated)] transition-colors"
  style={{ color: 'var(--text-secondary)' }}
  >
  <span className="flex items-center gap-2">
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
  Used in Jobs
  {cvUsageJobs.length > 0 && (
  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
  {cvUsageJobs.length}
  </span>
  )}
  </span>
  <svg className={`w-4 h-4 transition-transform ${usageExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
  </button>
  {usageExpanded && (
  <div className="px-4 pb-3">
  {isLoadingUsage ? (
  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</p>
  ) : cvUsageJobs.length === 0 ? (
  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>This resume hasn't been used for any applications yet.</p>
  ) : (
  <ul className="space-y-1.5">
  {cvUsageJobs.map(job => (
  <li key={job._id}>
  <Link
  to={`/jobs/${job._id}/workspace/job-description`}
  className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg hover:bg-[var(--bg-elevated)] transition-colors group"
  >
  <span className="truncate" style={{ color: 'var(--text-primary)' }}>
  {job.jobTitle}
  </span>
  {job.companyName && (
  <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
  at {job.companyName}
  </span>
  )}
  <span className="ml-auto flex-shrink-0">
  <JobStatusBadge type="application" status={job.status as any} className="text-xs" />
  </span>
  </Link>
  </li>
  ))}
  </ul>
  )}
  </div>
  )}
  </div>
  )}
  </>
  )}
  </div>
  )}
  </>
  )}

 {/* Toast Notification */}
 {toast && (
 <Toast
 message={toast.message}
 type={toast.type}
 onClose={() => setToast(null)}
 />
 )}

 {/* Create Branch Modal */}
 <CreateBranchModal
 isOpen={isCreateBranchModalOpen}
 onClose={() => setIsCreateBranchModalOpen(false)}
 onUploadBranchFromFile={handleUploadBranchFromFile}
 isLoading={isCreatingBranch}
 />

 <ConfirmModal
 show={confirmModal.show}
 title={confirmModal.title}
 message={confirmModal.message}
 danger={confirmModal.danger}
 type={confirmModal.type}
 onConfirm={confirmModal.onConfirm}
 onClose={() => setConfirmModal(prev => ({ ...prev, show: false }))}
 />
 </div>
 );
};

export default CVManagementPage;
