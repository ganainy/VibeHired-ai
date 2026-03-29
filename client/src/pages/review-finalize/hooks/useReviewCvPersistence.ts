import { useCallback, useEffect, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { createJobCv, updateCv } from '../../../services/cvApi';
import { updateJob, JobApplication } from '../../../services/jobApi';
import { JsonResumeSchema } from '../../../../../server/src/types/jsonresume';
import { CvSectionDescriptor, CvDynamicPayload } from '../../../types/cvDescriptor';

const AUTO_SAVE_DELAY_MS = 2000;

type CvSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseReviewCvPersistenceParams {
    jobId?: string;
    jobApplication: JobApplication | null;
    cvData: JsonResumeSchema;
    coverLetterText: string;
    currentCvId: string | null;
    hasPersistableCvContent: boolean;
    liveCvDescriptor: CvSectionDescriptor[] | null;
    liveCvData: Record<string, any> | null;
    isInitialLoadRef: MutableRefObject<boolean>;
    autoSaveTimeoutRef: MutableRefObject<NodeJS.Timeout | null>;
    lastSavedCvDataRef: MutableRefObject<string | null>;
    lastSavedCoverLetterRef: MutableRefObject<string | null>;
    setCurrentCvId: Dispatch<SetStateAction<string | null>>;
    setJobApplication: Dispatch<SetStateAction<JobApplication | null>>;
    setLiveCvDescriptor: Dispatch<SetStateAction<CvSectionDescriptor[] | null>>;
    setLiveCvData: Dispatch<SetStateAction<Record<string, any> | null>>;
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const useReviewCvPersistence = ({
    jobId,
    jobApplication,
    cvData,
    coverLetterText,
    currentCvId,
    hasPersistableCvContent,
    liveCvDescriptor,
    liveCvData,
    isInitialLoadRef,
    autoSaveTimeoutRef,
    lastSavedCvDataRef,
    lastSavedCoverLetterRef,
    setCurrentCvId,
    setJobApplication,
    setLiveCvDescriptor,
    setLiveCvData,
    showToast,
}: UseReviewCvPersistenceParams) => {
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [cvSaveStatus, setCvSaveStatus] = useState<CvSaveStatus>('idle');

    useEffect(() => {
        if (isInitialLoadRef.current || !jobId || !jobApplication) {
            return;
        }

        const currentCvDataStr = JSON.stringify(cvData);
        const currentCoverLetterStr = coverLetterText;

        if (
            currentCvDataStr === lastSavedCvDataRef.current &&
            currentCoverLetterStr === lastSavedCoverLetterRef.current
        ) {
            return;
        }

        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }

        autoSaveTimeoutRef.current = setTimeout(async () => {
            if (!jobId || !jobApplication) return;

            const cvDataStr = JSON.stringify(cvData);
            const coverLetterStr = coverLetterText;

            if (
                cvDataStr === lastSavedCvDataRef.current &&
                coverLetterStr === lastSavedCoverLetterRef.current
            ) {
                return;
            }

            setIsSaving(true);
            setSaveError(null);
            try {
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

                if (currentCvId && hasPersistableCvContent) {
                    await updateCv(currentCvId, { cvJson: cvData });
                } else if (hasPersistableCvContent) {
                    const newCvResponse = await createJobCv(jobId, { cvJson: cvData });
                    setCurrentCvId(newCvResponse.cv._id);
                }

                lastSavedCvDataRef.current = JSON.stringify(cvData);
                lastSavedCoverLetterRef.current = coverLetterText;

                setJobApplication(prev => (prev ? { ...prev, ...updatePayload } : null));
            } catch (error: any) {
                console.error('Error auto-saving changes:', error);
                setSaveError(error.message || 'Failed to save changes.');
            } finally {
                setIsSaving(false);
            }
        }, AUTO_SAVE_DELAY_MS);

        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [
        cvData,
        coverLetterText,
        jobId,
        jobApplication,
        currentCvId,
        hasPersistableCvContent,
        isInitialLoadRef,
        autoSaveTimeoutRef,
        lastSavedCvDataRef,
        lastSavedCoverLetterRef,
        setCurrentCvId,
        setJobApplication,
    ]);

    const handleManualSaveCv = useCallback(async () => {
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
    }, [currentCvId, cvData, liveCvDescriptor, liveCvData, lastSavedCvDataRef, showToast]);

    const handleDynamicChange = useCallback((payload: CvDynamicPayload) => {
        setLiveCvDescriptor(payload.descriptor);
        setLiveCvData(payload.data);
        setCvSaveStatus('idle');
        setTimeout(() => {
            void handleManualSaveCv();
        }, 800);
    }, [handleManualSaveCv, setLiveCvData, setLiveCvDescriptor]);

    return {
        isSaving,
        saveError,
        cvSaveStatus,
        setCvSaveStatus,
        handleManualSaveCv,
        handleDynamicChange,
    };
};
