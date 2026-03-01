// client/src/pages/CVManagementPage.tsx
import React, { useState, ChangeEvent, FormEvent, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  uploadCV,
  getMasterCv,
  getAllCvs,
  updateCv,
  deleteCv,
  CVDocument,
  getCvBranches,
  createCvBranch,
  renameCvBranch,
  uploadCvBranch
} from '../services/cvApi';
import { JsonResumeSchema } from '../../../server/src/types/jsonresume';
import { CvSectionDescriptor, CvDynamicPayload } from '../types/cvDescriptor';
import CvEditorPanel from '../components/cv-workspace/CvEditorPanel';
import Toast from '../components/common/Toast';
import { fetchAllSectionsAnalysis, fetchSectionAnalysis, SectionAnalysisResult } from '../services/analysisApi';
import { improveSection } from '../services/generatorApi';
import { scanAts, getAtsScores, getLatestAts, AtsScores, getAtsForJob } from '../services/atsApi';
import { getAllTemplates } from '../templates/config';
import Sidebar from '../components/cv-management/Sidebar';
import CreateBranchModal from '../components/cv-management/CreateBranchModal';
import { validateCvFile, formatFileSize } from '../lib/utils';
import ConfirmModal from '../components/common/ConfirmModal';

const CVManagementPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [currentCvData, setCurrentCvData] = useState<JsonResumeSchema | null>(null);
  const [masterCvId, setMasterCvId] = useState<string | null>(null); // Store master CV's MongoDB ID

  // Dynamic (AI-driven) editor state — the live editing payload for the active CV
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
  const [selectedTemplate, setSelectedTemplate] = useState<string>('german-latex');
  const [creationMode, setCreationMode] = useState<'choose' | 'upload' | 'scratch'>('choose');

  // Analysis state
  const [analyses, setAnalyses] = useState<Record<string, SectionAnalysisResult[]>>({});
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [improvingSections, setImprovingSections] = useState<Record<string, boolean>>({});

  // ATS Analysis state
  const [atsScores, setAtsScores] = useState<AtsScores | null>(null);
  const [isScanningAts, setIsScanningAts] = useState<boolean>(false);
  const [atsAnalysisId, setAtsAnalysisId] = useState<string | null>(null);
  const [isAnalysisOutdated, setIsAnalysisOutdated] = useState<boolean>(false);
  const atsPollingIntervalIdRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  // UI state
  const [activeCvId, setActiveCvId] = useState<string | null>(() => {
    // Initialize from URL parameter
    const cvId = searchParams.get('cv');
    return cvId || null;
  }); // CV's MongoDB _id (null = loading)

  // All CVs state (master + job CVs) from unified model
  const [allCvs, setAllCvs] = useState<CVDocument[]>([]);
  const [isLoadingJobCvs, setIsLoadingJobCvs] = useState<boolean>(false);

  // Create branch modal state
  const [isCreateBranchModalOpen, setIsCreateBranchModalOpen] = useState<boolean>(false);
  const [isCreatingBranch, setIsCreatingBranch] = useState<boolean>(false);

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
  const masterCv = useMemo(() => allCvs.find(cv => cv.isMasterCv), [allCvs]); // Keep for backward compatibility
  const jobCvs = useMemo(() => allCvs.filter(cv => !cv.isMasterCv), [allCvs]); // Keep for backward compatibility

  // Get active CV document
  const activeCv = useMemo(() => {
    if (!activeCvId) return masterCv || null;
    return allCvs.find(cv => cv._id === activeCvId) || null;
  }, [activeCvId, allCvs, masterCv]);

  // Get active job (for job CVs)
  const activeJob = useMemo(() => {
    return activeCv?.isMasterCv === false ? activeCv.jobApplication : null;
  }, [activeCv]);

  // Get active CV data (cvJson)
  const activeCvData = useMemo(() => {
    if (!activeCv) return currentCvData; // Fallback to legacy state during transition
    return activeCv.cvJson || null;
  }, [activeCv, currentCvData]);

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

  // Calculate unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!activeCvData) return false;

    // For master CV
    if (activeCv?.isMasterCv) {
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

    // Run both analyses
    runFullCvAnalysis(activeCvData);
    runAtsAnalysis(activeCvData);
    setIsAnalysisOutdated(false);
  };

  // Poll ATS scores until analysis is complete
  const pollAtsScores = async (analysisIdToPoll: string, startTime: number, maxWaitTime: number = 60000): Promise<boolean> => {
    const elapsed = Date.now() - startTime;
    if (elapsed > maxWaitTime) {
      setIsScanningAts(false);
      setToast({ message: 'ATS analysis is taking longer than expected. Please check back later.', type: 'info' });
      return true; // Stop polling
    }

    try {
      const response = await getAtsScores(analysisIdToPoll);
      if (response.atsScores) {
        if (response.atsScores.error) {
          setIsScanningAts(false);
          setToast({ message: `ATS analysis error: ${response.atsScores.error}`, type: 'error' });
          return true; // Stop polling
        }
        if (response.atsScores.score !== null && response.atsScores.score !== undefined) {
          setAtsScores(response.atsScores);
          setIsScanningAts(false);
          setToast({ message: 'ATS analysis completed!', type: 'success' });
          return true; // Stop polling
        }
      }
      return false; // Continue polling
    } catch (error: any) {
      console.error('Error polling ATS scores:', error);
      // Don't stop polling on transient errors, but log them
      return false;
    }
  };

  // Trigger ATS analysis for general CV review (no job description)
  const runAtsAnalysis = async (cvDataOverride?: JsonResumeSchema | null) => {
    const cvDataToUse = cvDataOverride !== undefined ? cvDataOverride : activeCvData;
    if (!cvDataToUse) {
      // Silently return if no CV data - don't show error toast
      return;
    }

    if (isScanningAts) {
      return; // Already scanning
    }

    // Clear any existing polling
    if (atsPollingIntervalIdRef.current) {
      clearInterval(atsPollingIntervalIdRef.current);
      atsPollingIntervalIdRef.current = null;
    }

    setIsScanningAts(true);
    setAtsScores(null); // Clear previous scores

    try {
      // Trigger ATS scan
      // If activeCv is master, pass undefined for jobId
      const jobId = activeCv?.isMasterCv ? undefined : activeCv?.jobApplicationId || undefined;

      const response = await scanAts(jobId, atsAnalysisId || undefined);
      setAtsAnalysisId(response.analysisId);
      setToast({ message: 'ATS analysis started. Analyzing your CV...', type: 'info' });

      const startTime = Date.now();
      const POLLING_INTERVAL = 2000; // Poll every 2 seconds

      // Set up interval polling
      const intervalId = setInterval(async () => {
        const result = await pollAtsScores(response.analysisId, startTime);
        if (result) {
          clearInterval(intervalId);
          atsPollingIntervalIdRef.current = null;
        }
      }, POLLING_INTERVAL);

      atsPollingIntervalIdRef.current = intervalId;

      // Start polling immediately
      const checkResult = await pollAtsScores(response.analysisId, startTime);
      if (checkResult) {
        clearInterval(intervalId);
        atsPollingIntervalIdRef.current = null;
      }
    } catch (error: any) {
      console.error('Error starting ATS scan:', error);
      setIsScanningAts(false);
      setToast({ message: error.message || 'Failed to start ATS analysis.', type: 'error' });
    }
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
        setMasterCvId(cvDoc?._id || null); // Store the CV's MongoDB ID
        originalCvDataRef.current = cvData ? JSON.parse(JSON.stringify(cvData)) : null;
        // Reset save trigger to ensure proper comparison
        setSaveTrigger(0);

        // Load saved template preference from CV document
        if (cvDoc?.templateId) {
          setSelectedTemplate(cvDoc.templateId);
        }

        // Load cached analysis if available
        // Backend has already verified the hash matches, so we can trust the cache
        if (cvData && cvDoc?.analysisCache) {
          console.log('Loading cached analysis results');
          const cache = cvDoc.analysisCache as { analyses?: Record<string, any>; cvHash?: string };
          if (cache.analyses) {
            setAnalyses(cache.analyses);
            // Store the hash for future comparisons
            lastAnalyzedCvHashRef.current = cache.cvHash || null;
          }
        }

        // Load existing ATS scores if available
        let hasExistingAtsScores = false;
        if (cvData) {
          try {
            const atsResponse = await getLatestAts();
            if (atsResponse.atsScores && atsResponse.analysisId) {
              console.log('Loading existing ATS scores');
              setAtsScores(atsResponse.atsScores);
              setAtsAnalysisId(atsResponse.analysisId);
              hasExistingAtsScores = true;
            }
          } catch (atsError: any) {
            // If no ATS scores exist, that's fine - we'll trigger analysis below
            console.log('No existing ATS scores found, will trigger new analysis');
          }
        }

        setIsLoadingCv(false);

        // Run analysis after CV is loaded (only if no valid cache)
        const cache = cvDoc?.analysisCache as { analyses?: Record<string, any> } | null;
        if (cvData && (!cache || !cache.analyses)) {
          // We can optionally auto-run here or just let the user decide.
          // For better UX on first load, maybe we just show "Analysis needed"
          setIsAnalysisOutdated(true);
        }

        // Trigger ATS analysis only if no existing scores were found
        if (cvData && !hasExistingAtsScores) {
          // Same here, let user trigger it
          // setIsAnalysisOutdated(true); // Already set above
        }
      } catch (error: any) {
        console.error("Error fetching current CV:", error);
        setToast({ message: error.message || 'Failed to load CV data.', type: 'error' });
        setIsLoadingCv(false);
      }
    };
    fetchCv();

    // Cleanup polling on unmount
    return () => {
      if (atsPollingIntervalIdRef.current) {
        clearInterval(atsPollingIntervalIdRef.current);
        atsPollingIntervalIdRef.current = null;
      }
    };
  }, []);

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

  // Fetch ATS scores when switching context
  useEffect(() => {
    const fetchContextAts = async () => {
      setAtsScores(null); // Clear while loading

      try {
        if (activeCv?.isMasterCv) {
          const atsResponse = await getLatestAts();
          if (atsResponse.atsScores) {
            setAtsScores(atsResponse.atsScores);
            setAtsAnalysisId(atsResponse.analysisId);
          }
        } else if (activeCv?.jobApplicationId) {
          // Fetch for specific job
          const atsResponse = await getAtsForJob(activeCv.jobApplicationId);
          if (atsResponse.atsScores) {
            setAtsScores(atsResponse.atsScores);
            setAtsAnalysisId(atsResponse.analysisId);
          }
        }
      } catch (error) {
        console.error('Error fetching ATS scores for context:', error);
      }
    };

    if (activeCvData) {
      fetchContextAts();
    }
  }, [activeCv, activeCvData]);


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
      setMasterCvId(response.cv?._id || null); // Store the new CV's MongoDB ID
      originalCvDataRef.current = cvData ? JSON.parse(JSON.stringify(cvData)) : null;
      // Reset save trigger to ensure proper comparison
      setSaveTrigger(0);
      // Sync dynamic descriptor state from upload response
      setLiveCvDescriptor(response.cv?.cvDescriptor ?? null);
      setLiveCvData(response.cv?.cvData ?? null);

      setUploadProgress(90);

      if (cvData) {
        runFullCvAnalysis(cvData);
        runAtsAnalysis(cvData);
        setIsAnalysisOutdated(false);
      }

      setUploadProgress(100);
      setSelectedFile(null);
      setIsReplacing(false);
      const fileInput = document.getElementById('cvFileInput') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
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

    if (activeCv?.isMasterCv) {
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
        if (lastAnalyzedCvHashRef.current !== currentHash) {
          runFullCvAnalysis(updatedCv);
          runAtsAnalysis(updatedCv);
          setIsAnalysisOutdated(false);
        }
      }, 500);
    }

    // Check if relevant sections changed
    const currentHash = generateCvHash(updatedCv);
    if (lastAnalyzedCvHashRef.current !== currentHash) {
      setIsAnalysisOutdated(true);
    }
  };

  const handleTemplateChange = (newTemplate: string) => {
    setSelectedTemplate(newTemplate);
    // Save template preference immediately when changed
    if (currentCvData && masterCvId) {
      // Use a separate timeout to avoid conflicts with CV auto-save
      setTimeout(() => {
        updateCv(masterCvId, { cvJson: currentCvData, templateId: newTemplate }).catch((error: any) => {
          console.error("Error saving template preference:", error);
        });
      }, 100);
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
        templateId: activeCv.isMasterCv ? selectedTemplate : undefined
      });
      message = response.message || message;

      if (activeCv.isMasterCv) {
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
  }, [activeCvData, activeCv, selectedTemplate, liveCvDescriptor, liveCvData]);

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

  const handleRenameBranch = async (cvId: string, newName: string) => {
    try {
      await renameCvBranch(cvId, { displayName: newName });

      // Update local state
      setAllCvs((prev: CVDocument[]) =>
        prev.map((cv: CVDocument) =>
          cv._id === cvId ? { ...cv, displayName: newName } : cv
        )
      );

      setToast({ message: 'CV branch renamed successfully.', type: 'success' });
    } catch (error: any) {
      console.error("Error renaming CV branch:", error);
      setToast({ message: error.message || 'Failed to rename CV branch.', type: 'error' });
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
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900 p-6 pt-10 gap-6 overflow-hidden">
      {/* Left Sidebar */}
      {!isReplacing && (
        <Sidebar
          cvs={baseCvs}
          activeCvId={activeCvId}
          onSelectCv={setActiveCvId}
          onAddNewCv={() => {
            setIsReplacing(true);
            setSelectedFile(null);
            setCreationMode('choose');
          }}
          onReplaceCv={() => {
            setIsReplacing(true);
            setSelectedFile(null);
            setCreationMode('upload');
          }}
          onDeleteCv={handleDeleteCv}
          onRenameBranch={handleRenameBranch}
          onCreateBranch={() => setIsCreateBranchModalOpen(true)}
          className="w-full flex-shrink-0 z-20"
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Upload/Create Overlay */}
        {(!currentCvData || isReplacing) && !isLoadingCv ? (
          <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8">
            {/* Back Button */}
            {allCvs.length > 0 && (
              <button
                onClick={() => {
                  // Select the primary CV if available, otherwise select the first CV
                  const cvToSelect = allCvs.find(cv => !cv.jobApplicationId) || allCvs[0];
                  if (cvToSelect) {
                    setActiveCvId(cvToSelect._id);
                    setIsReplacing(false);
                    setCreationMode('choose');
                  }
                }}
                className="mb-6 flex items-center gap-2 px-4 py-2.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-all font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to My CVs
              </button>
            )}

            {/* Choice Mode */}
            {creationMode === 'choose' && (
              <div className="max-w-3xl mx-auto mt-10">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4 shadow-lg" style={{ background: 'linear-gradient(135deg, var(--accent-dim), var(--accent))' }}>
                    <svg className="w-8 h-8 text-ink-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
                    {masterCv ? 'Update Your CV' : 'Create Your CV'}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto text-lg">
                    Choose how you'd like to {masterCv ? 'update' : 'create'} your professional CV
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button
                    onClick={() => {
                      const emptyCvData: JsonResumeSchema = {
                        basics: {
                          name: '',
                          label: '',
                          email: '',
                          phone: '',
                          summary: '',
                          location: { city: '', region: '', countryCode: '' },
                          profiles: [],
                        },
                        work: [], education: [], skills: [], projects: [], languages: [], certificates: [],
                      };
                      setCurrentCvData(emptyCvData);
                      setCreationMode('choose');
                    }}
                    className="group relative p-8 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-500 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 text-left"
                  >
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Create from Scratch</h3>
                    <p className="text-gray-600 dark:text-gray-400">Start with a blank canvas.</p>
                  </button>

                  <button
                    onClick={() => setCreationMode('upload')}
                    className="group relative p-8 bg-gray-50 dark:bg-gray-900 rounded-2xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 text-left"
                  >
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Upload Existing CV</h3>
                    <p className="text-gray-600 dark:text-gray-400">Import your existing PDF/RTF.</p>
                  </button>
                </div>
              </div>
            )}

            {/* Upload Mode */}
            {creationMode === 'upload' && (
              <div className="max-w-2xl mx-auto mt-10">
                <div className="text-center mb-8">
                  <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>Import Your CV</h2>
                  <p className="text-gray-600 dark:text-gray-400">Upload a PDF, DOCX, or RTF file.</p>
                </div>

                <form onSubmit={handleSubmit}>
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                  >
                    {isUploading ? (
                      <p className="text-blue-600">Uploading...</p>
                    ) : (
                      <>
                        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">Drag & Drop or Click to Upload</p>
                        <input type="file" id="cvFileInput" onChange={handleFileChange} className="hidden" accept=".pdf,.docx,.rtf" />
                        <label htmlFor="cvFileInput" className="mt-4 inline-block px-6 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700">Select File</label>
                      </>
                    )}
                  </div>

                  {selectedFile && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg flex justify-between items-center text-sm">
                      <span className="font-medium">{selectedFile.name}</span>
                      <button onClick={() => setSelectedFile(null)} type="button" className="text-red-500 hover:text-red-700">Remove</button>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!selectedFile || isUploading}
                    className="mt-6 w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isUploading ? 'Processing...' : 'Extract & Fill Form'}
                  </button>
                </form>
                {uploadError && <p className="mt-4 text-red-600 text-center">{uploadError}</p>}
              </div>
            )}
          </div>
        ) : (
          <CvEditorPanel
            data={activeCvData || currentCvData}
            onChange={handleCvChange}
            onSave={() => handleSaveCv()}
            saveStatus={saveStatus}
            hasUnsavedChanges={hasUnsavedChanges}
            templateId={selectedTemplate}
            onTemplateChange={handleTemplateChange}
            onImproveSection={handleImproveSection}
            improvingSections={improvingSections}
            className="h-full"
            cvId={activeCv?._id}
            cvDescriptor={liveCvDescriptor}
            cvData={liveCvData}
            onDynamicChange={handleDynamicChange}
          />
        )}
      </div>

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
        onCreateBranch={handleCreateBranch}
        onUploadBranchFromFile={handleUploadBranchFromFile}
        allCvs={allCvs}
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