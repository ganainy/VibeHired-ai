import { useState, useEffect, useCallback, useRef } from 'react';
import { JsonResumeSchema } from '../../../../../server/src/types/jsonresume';
import { createJobCv, CVDocument, getJobCv, createJobCvFromBase, deleteCv, getCvBranches } from '../../../services/cvApi';
import { CvSectionDescriptor, CvDynamicPayload } from '../../../types/cvDescriptor';
import { getStoredValue, setStoredValue } from '../utils/localStorageHelpers';
import { useAuth } from '../../../context/AuthContext';

const EMPTY_CV_DATA: JsonResumeSchema = { basics: {} };
const AUTO_SAVE_DELAY_MS = 2000;

export const useCvEditor = (jobId: string | undefined) => {
    const { refreshUsage } = useAuth();
    const [cvData, setCvData] = useState<JsonResumeSchema>(EMPTY_CV_DATA);
    const [currentCvId, setCurrentCvId] = useState<string | null>(null);
    const [liveCvDescriptor, setLiveCvDescriptor] = useState<CvSectionDescriptor[] | null>(null);
    const [liveCvData, setLiveCvData] = useState<Record<string, any> | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    const [isGenerating, setIsGenerating] = useState(false);
    const [generateError, setGenerateError] = useState<string | null>(null);

    const [tailoringChanges, setTailoringChanges] = useState<Array<{ section: string; description: string; reason: string; before?: string; after?: string }> | null>(null);
    const [showInlineCvDiff, setShowInlineCvDiff] = useState<boolean>(false);

    const [availableCvs, setAvailableCvs] = useState<{ id: string; name: string; data: any }[]>([]);
    const [selectedBaseCvId, setSelectedBaseCvId] = useState<string>(() =>
        getStoredValue('job_selectedBaseCvId', jobId)
    );

    const [creationMode, setCreationMode] = useState<'ai' | 'import'>('ai');
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isApplyingBaseCv, setIsApplyingBaseCv] = useState(false);
    const [applyCvError, setApplyCvError] = useState<string | null>(null);

    const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedCvDataRef = useRef<string | null>(null);

    const handleSelectedBaseCvIdChange = useCallback((newId: string) => {
        setSelectedBaseCvId(newId);
        setStoredValue('job_selectedBaseCvId', jobId, newId);
    }, [jobId]);

    // Fetch CV data on mount
    useEffect(() => {
        if (!jobId) return;

        const loadCvData = async () => {
            try {
                const cvResponse = await getJobCv(jobId);
                if (cvResponse.cv && cvResponse.cv.cvJson) {
                    setCvData(cvResponse.cv.cvJson);
                    setCurrentCvId(cvResponse.cv._id);
                    setTailoringChanges(cvResponse.cv.tailoringChanges ?? []);
                    setShowInlineCvDiff(false);
                    lastSavedCvDataRef.current = JSON.stringify(cvResponse.cv.cvJson);
                    setLiveCvDescriptor(cvResponse.cv.cvDescriptor ?? null);
                    setLiveCvData(cvResponse.cv.cvData ?? null);
                } else {
                    setCurrentCvId(null);
                    setLiveCvDescriptor(null);
                    setLiveCvData(null);
                    setTailoringChanges([]);
                    setShowInlineCvDiff(false);
                }
            } catch (err) {
                setCurrentCvId(null);
                setLiveCvDescriptor(null);
                setLiveCvData(null);
                setTailoringChanges([]);
                setShowInlineCvDiff(false);
            }
        };

        // Fetch available CVs
        const loadCvs = async () => {
            try {
                const response = await getCvBranches();
                const branches = response.branches;

                const options: { id: string; name: string; data: any }[] = [];

                const defaultCv = branches.find((cv: CVDocument) => cv.isDefault);
                if (defaultCv) {
                    const defaultName = defaultCv.displayName
                        ? `${defaultCv.displayName} (Default)`
                        : defaultCv.filename
                            ? `${defaultCv.filename} (Default)`
                            : 'Default CV';
                    options.push({ id: defaultCv._id, name: defaultName, data: defaultCv.cvJson });
                }

                branches.forEach((cv: CVDocument) => {
                    if (!cv.jobApplicationId && cv._id !== defaultCv?._id) {
                        const branchName = cv.displayName || cv.filename || 'Unnamed CV';
                        options.push({ id: cv._id, name: branchName, data: cv.cvJson });
                    }
                });

                setAvailableCvs(options);
            } catch (err) {
                console.error('Error loading CVs:', err);
            }
        };

        loadCvData();
        loadCvs();
    }, [jobId]);

    const handleSave = useCallback(async () => {
        if (!jobId || !cvData) return;

        setSaveStatus('saving');

        try {
            const updatePayload: any = {
                cvJson: cvData,
            };

            const newCvResponse = await createJobCv(jobId, updatePayload);

            setCurrentCvId(newCvResponse.cv._id);
            setCurrentCvId(newCvResponse.cv._id);
            setTailoringChanges(newCvResponse.cv.tailoringChanges ?? []);
            lastSavedCvDataRef.current = JSON.stringify(cvData);
            setSaveStatus('saved');
        } catch (error: any) {
            console.error('Error saving CV:', error);
            setSaveStatus('error');
        }
    }, [jobId, cvData]);

    const handleGenerate = async () => {
        if (!jobId) return;

        setIsGenerating(true);
        setGenerateError(null);

        try {
            const response = await createJobCv(jobId, { cvJson: cvData });
            setCvData(response.cv.cvJson ?? EMPTY_CV_DATA);
            setTailoringChanges(response.cv.tailoringChanges ?? []);
            lastSavedCvDataRef.current = JSON.stringify(response.cv.cvJson);
            try { await refreshUsage(); } catch (e) { console.error('Failed to refresh credits UI:', e); }
        } catch (error: any) {
            console.error('Error generating CV:', error);
            setGenerateError(error.response?.data instanceof Blob
                ? 'Failed to generate CV'
                : error.message || 'Failed to generate CV');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDynamicChange = useCallback((payload: CvDynamicPayload) => {
        if (!jobId) return;

        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
            autoSaveTimeoutRef.current = null;
        }

        setCvData((prev: JsonResumeSchema) => ({ ...prev, ...(payload.data || {}) }));
        setLiveCvDescriptor(payload.descriptor);
        setLiveCvData(payload.data);
        setTailoringChanges(null);
        setShowInlineCvDiff(false);

        autoSaveTimeoutRef.current = setTimeout(() => {
            handleSave();
        }, AUTO_SAVE_DELAY_MS);
    }, [jobId, handleSave]);

    const handleApplyBaseCv = async () => {
        if (!jobId) return;

        setIsApplyingBaseCv(true);
        setApplyCvError(null);

        try {
            const baseCvIdForJob = (selectedBaseCvId === 'master' || selectedBaseCvId === '') ? null : selectedBaseCvId;
            const response = await createJobCvFromBase(jobId, baseCvIdForJob || undefined);

            setCvData(response.cv.cvJson ?? EMPTY_CV_DATA);
            setCurrentCvId(response.cv._id);
            setTailoringChanges(response.cv.tailoringChanges ?? []);
            lastSavedCvDataRef.current = JSON.stringify(response.cv.cvJson);
        } catch (error: any) {
            console.error('Error applying base CV:', error);
            setApplyCvError(error.response?.data instanceof Blob
                ? 'Failed to apply base CV'
                : error.message || 'Failed to apply base CV');
        } finally {
            setIsApplyingBaseCv(false);
        }
    };

    const handleDeleteCv = async () => {
        if (!currentCvId) return;

        if (!confirm('Are you sure you want to delete the CV?')) return;

        try {
            await deleteCv(currentCvId);
            setCvData(EMPTY_CV_DATA);
            setCurrentCvId(null);
            setLiveCvDescriptor(null);
            setLiveCvData(null);
            setTailoringChanges([]);
            setShowInlineCvDiff(false);
            lastSavedCvDataRef.current = JSON.stringify(EMPTY_CV_DATA);
            try { await refreshUsage(); } catch (e) { console.error('Failed to refresh credits UI:', e); }
        } catch (error: any) {
            console.error('Error deleting CV:', error);
        }
    };

    return {
        cvData,
        setCvData,
        currentCvId,
        liveCvDescriptor,
        liveCvData,
        saveStatus,
        isGenerating,
        generateError,
        tailoringChanges,
        showInlineCvDiff,
        availableCvs,
        selectedBaseCvId,
        handleSelectedBaseCvIdChange,
        handleSave,
        handleGenerate,
        handleDynamicChange,
        handleApplyBaseCv,
        handleDeleteCv,
        applyCvError,
        creationMode,
        setCreationMode,
        importFile,
        setImportFile,
        isApplyingBaseCv,
    };
};
