import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { normalizeMultipleUrls } from '../../../lib/utils';
import { updateJob, type JobApplication } from '../../../services/jobApi';
import { buildJobDetailsForm } from '../jobDetailsFormUtils';
import type { JobDetailsFormData } from '../../../components/jobs/JobDetailsSection';

interface UseReviewJobDetailsParams {
    jobId?: string;
    jobApplication: JobApplication | null;
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    setJobApplication: Dispatch<SetStateAction<JobApplication | null>>;
    setTailoredJobTitle: Dispatch<SetStateAction<string>>;
    setTailoredCompanyName: Dispatch<SetStateAction<string>>;
    setTailoredJobDescription: Dispatch<SetStateAction<string>>;
    setSelectedBaseCvId: Dispatch<SetStateAction<string>>;
    setSelectedClBaseCvId: Dispatch<SetStateAction<string>>;
}

export const useReviewJobDetails = ({
    jobId,
    jobApplication,
    showToast,
    setJobApplication,
    setTailoredJobTitle,
    setTailoredCompanyName,
    setTailoredJobDescription,
    setSelectedBaseCvId,
    setSelectedClBaseCvId,
}: UseReviewJobDetailsParams) => {
    const [jobDetailsForm, setJobDetailsForm] = useState<JobDetailsFormData | null>(null);
    const [jobDetailsInitialForm, setJobDetailsInitialForm] = useState<JobDetailsFormData | null>(null);
    const [jobDetailsSourceJobId, setJobDetailsSourceJobId] = useState<string | null>(null);
    const [isSavingJobDetails, setIsSavingJobDetails] = useState<boolean>(false);
    const [jobDetailsSaveError, setJobDetailsSaveError] = useState<string | null>(null);
    const [isEditingJobDetails, setIsEditingJobDetails] = useState<boolean>(false);

    const jobDetailsHasChanges = useMemo(() => {
        if (!jobDetailsForm || !jobDetailsInitialForm) {
            return false;
        }

        return JSON.stringify(jobDetailsForm) !== JSON.stringify(jobDetailsInitialForm);
    }, [jobDetailsForm, jobDetailsInitialForm]);

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
    }, [jobApplication, jobDetailsSourceJobId, jobDetailsHasChanges]);

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
            try {
                localStorage.setItem(`job_selectedBaseCvId_${jobId}`, syncedBaseCvId);
                localStorage.setItem(`job_selectedClBaseCvId_${jobId}`, syncedBaseCvId);
            } catch (storageError) {
                console.error('Error saving base CV selection to localStorage', storageError);
            }

            showToast('Job details updated successfully', 'success');
            setIsEditingJobDetails(false);
        } catch (error: any) {
            console.error('Failed to update job details:', error);
            setJobDetailsSaveError(error.message || 'Failed to update job details.');
            showToast(error.message || 'Failed to update job details.', 'error');
        } finally {
            setIsSavingJobDetails(false);
        }
    };

    const handleCancelJobDetails = () => {
        setIsEditingJobDetails(false);
        if (jobDetailsInitialForm) {
            setJobDetailsForm(jobDetailsInitialForm);
        }
        setJobDetailsSaveError(null);
    };

    return {
        jobDetailsForm,
        jobDetailsHasChanges,
        isSavingJobDetails,
        jobDetailsSaveError,
        setJobDetailsSaveError,
        isEditingJobDetails,
        setIsEditingJobDetails,
        handleJobDetailsInputChange,
        handleJobUrlFieldChange,
        handleAddJobUrlField,
        handleRemoveJobUrlField,
        handleSaveJobDetails,
        handleCancelJobDetails,
    };
};
