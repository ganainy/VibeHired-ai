import { useEffect, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { applyBaseCoverLetterToJob, getBaseCoverLetters, saveCurrentCoverLetterForJob, uploadCoverLetterForJob, type CoverLetterBase } from '../../../services/coverLetterBaseApi';
import { createJobCvFromBase, getCvBranches, type CVDocument, uploadCvForJob } from '../../../services/cvApi';
import { updateJob, type JobApplication } from '../../../services/jobApi';
import { JsonResumeSchema } from '../../../../../server/src/types/jsonresume';

interface UseReviewBaseAssetsParams {
    jobId?: string;
    jobApplication: JobApplication | null;
    fetchJobData: () => Promise<void>;
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    setJobApplication: Dispatch<SetStateAction<JobApplication | null>>;
    setCvData: Dispatch<SetStateAction<JsonResumeSchema>>;
    setCurrentCvId: Dispatch<SetStateAction<string | null>>;
    setCurrentCvFilename: Dispatch<SetStateAction<string | null>>;
    cvImportFileRef: MutableRefObject<HTMLInputElement | null>;
}

export const useReviewBaseAssets = ({
    jobId,
    jobApplication,
    fetchJobData,
    showToast,
    setJobApplication,
    setCvData,
    setCurrentCvId,
    setCurrentCvFilename,
    cvImportFileRef,
}: UseReviewBaseAssetsParams) => {
    const [availableCvs, setAvailableCvs] = useState<{ id: string; name: string; data: any }[]>([]);

    const [selectedBaseCvId, setSelectedBaseCvId] = useState<string>(() => {
        if (jobId) {
            try {
                const saved = localStorage.getItem(`job_selectedBaseCvId_${jobId}`);
                if (saved) return saved;
            } catch (e) {
                console.error('Error reading selectedBaseCvId from localStorage', e);
            }
        }
        return '';
    });

    const [selectedClBaseCvId, setSelectedClBaseCvId] = useState<string>(() => {
        if (jobId) {
            try {
                const saved = localStorage.getItem(`job_selectedClBaseCvId_${jobId}`);
                if (saved) return saved;
            } catch (e) {
                console.error('Error reading selectedClBaseCvId from localStorage', e);
            }
        }
        return 'master';
    });

    const [baseCoverLetters, setBaseCoverLetters] = useState<CoverLetterBase[]>([]);
    const [showClLibraryPanel, setShowClLibraryPanel] = useState<boolean>(false);
    const [clCreationMode, setClCreationMode] = useState<'ai' | 'import'>('ai');
    const [selectedBaseClId, setSelectedBaseClId] = useState<string>('');
    const [clUploadFile, setClUploadFile] = useState<File | null>(null);
    const [isApplyingBaseCl, setIsApplyingBaseCl] = useState<boolean>(false);
    const [applyClError, setApplyClError] = useState<string | null>(null);

    const [cvCreationMode, setCvCreationMode] = useState<'ai' | 'import'>('ai');
    const [cvImportFile, setCvImportFile] = useState<File | null>(null);
    const [selectedBaseCvIdForImport, setSelectedBaseCvIdForImport] = useState<string>('');
    const [isApplyingBaseCv, setIsApplyingBaseCv] = useState<boolean>(false);
    const [applyCvError, setApplyCvError] = useState<string | null>(null);

    const handleSelectedBaseCvIdChange = (newId: string) => {
        setSelectedBaseCvId(newId);
        if (jobId) {
            const currentJobId = jobId;
            try {
                localStorage.setItem(`job_selectedBaseCvId_${currentJobId}`, newId);
            } catch (e) {
                console.error('Error saving selectedBaseCvId to localStorage', e);
            }

            const baseCvIdForJob = newId === 'master' || newId === '' ? null : newId;
            void updateJob(currentJobId, { baseCvId: baseCvIdForJob })
                .then((updatedJob) => {
                    setJobApplication(prev => (prev ? { ...prev, baseCvId: updatedJob.baseCvId ?? null } : prev));
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
                console.error('Error saving selectedClBaseCvId to localStorage', e);
            }
        }
    };

    useEffect(() => {
        if (!showClLibraryPanel && clCreationMode !== 'import') return;
        getBaseCoverLetters()
            .then(setBaseCoverLetters)
            .catch((err: any) => console.error('Failed to load base cover letters', err));
    }, [showClLibraryPanel, clCreationMode]);

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

    const handleSaveClSnapshot = async () => {
        if (!jobId) return;
        try {
            await saveCurrentCoverLetterForJob(jobId);
            showToast('Cover letter snapshot saved', 'success');
        } catch {
            showToast('Failed to save snapshot', 'error');
        }
    };

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
                console.error('Error reading CV selection from localStorage', e);
                setSelectedBaseCvId('');
                setSelectedClBaseCvId('master');
            }
        }
    }, [jobId]);

    useEffect(() => {
        if (!jobApplication || !jobId) return;

        try {
            const savedBaseCvId = localStorage.getItem(`job_selectedBaseCvId_${jobId}`);
            const savedClBaseCvId = localStorage.getItem(`job_selectedClBaseCvId_${jobId}`);

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
            console.error('Error syncing CV selection from job:', e);
        }
    }, [jobApplication, jobId]);

    useEffect(() => {
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
                        const branchName = cv.displayName
                            ? cv.displayName
                            : cv.category
                                ? `${cv.category} CV`
                                : 'CV Branch';
                        options.push({ id: cv._id, name: branchName, data: cv.cvJson });
                    }
                });
                setAvailableCvs(options);
            } catch (err) {
                console.error('Failed to load CVs', err);
            }
        };
        void loadCvs();
    }, [jobId]);

    useEffect(() => {
        if (availableCvs.length === 0 || !jobId) return;
        if (selectedBaseCvId === '' || selectedBaseCvId === 'master') return;

        const hasValidSelection = availableCvs.some(cv => cv.id === selectedBaseCvId);
        if (hasValidSelection) return;

        handleSelectedBaseCvIdChange('');
    }, [availableCvs, selectedBaseCvId, jobId]);

    return {
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
        cvCreationMode,
        setCvCreationMode,
        cvImportFile,
        setCvImportFile,
        selectedBaseCvIdForImport,
        setSelectedBaseCvIdForImport,
        isApplyingBaseCv,
        applyCvError,
        setApplyCvError,
        handleApplyBaseCv,
    };
};
