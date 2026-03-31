import { useState, useEffect, useCallback } from 'react';
import { JobApplication } from '../../../services/jobApi';

type JobDetailsFormData = {
    jobTitle: string;
    companyName: string;
    status: JobApplication['status'];
    language: 'en' | 'de';
    baseCvId: string;
    jobType: JobApplication['jobType'] | '';
    createdAt: string;
    jobUrls: string[];
    salary: string;
    contactEmail: string;
    contactPhone: string;
    hiringManagerName: string;
    applicationUrl: string;
    notes: string;
};

const formatDateForInput = (dateString?: string): string => {
    if (!dateString) return '';

    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

const buildJobDetailsForm = (job: JobApplication): JobDetailsFormData => {
    const legacyContact = (job as any).contact || '';
    return {
        jobTitle: job.jobTitle || '',
        companyName: job.companyName || '',
        status: job.status || 'Not Applied',
        language: job.language || 'en',
        baseCvId: job.baseCvId || '',
        jobType: job.jobType || '',
        createdAt: job.createdAt ? formatDateForInput(job.createdAt) : '',
        jobUrls: job.jobUrl ? [job.jobUrl] : [],
        salary: (job as any).salary || '',
        contactEmail: legacyContact.match(/@/) ? legacyContact : '',
        contactPhone: '',
        hiringManagerName: '',
        applicationUrl: job.jobUrl || '',
        notes: (job as any).notes || '',
    };
};

export const useJobDetails = (jobApplication: JobApplication | null) => {
    const [form, setForm] = useState<JobDetailsFormData | null>(null);
    const [initialForm, setInitialForm] = useState<JobDetailsFormData | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [sourceJobId, setSourceJobId] = useState<string | null>(null);

    const hasChanges = useCallback(() => {
        if (!form || !initialForm) return false;
        return JSON.stringify(form) !== JSON.stringify(initialForm);
    }, [form, initialForm]);

    // Sync form with job application
    useEffect(() => {
        if (!jobApplication) return;

        const nextForm = buildJobDetailsForm(jobApplication);
        const isSwitchingJob = sourceJobId !== jobApplication._id;

        if (isSwitchingJob || !hasChanges) {
            setForm(nextForm);
            setInitialForm(nextForm);
            setSourceJobId(jobApplication._id);
            setSaveError(null);
        }
    }, [jobApplication, hasChanges, sourceJobId]);

    const handleChange = (field: keyof JobDetailsFormData, value: string) => {
        setForm(prev => prev ? { ...prev, [field]: value } : null);
    };

    const handleSave = async () => {
        if (!jobApplication || !form) return;

        setIsSaving(true);
        setSaveError(null);

        try {
            const title = form.jobTitle.trim();
            const company = form.companyName.trim();
            const normalizedJobUrl = form.jobUrls.join('\n').trim();

            const legacyContact =
                form.contactEmail.match(/@/) ? form.contactEmail : undefined;

            const updatePayload: Partial<JobApplication> = {
                jobTitle: title,
                companyName: company,
                language: form.language,
                status: form.status,
                baseCvId: form.baseCvId || null,
                jobType: form.jobType || null,
                salary: form.salary || undefined,
                contactEmail: form.contactEmail || undefined,
                contact: legacyContact,
                applicationUrl: normalizedJobUrl || undefined,
                notes: form.notes || undefined,
            };

            const { updateJob } = await import('../../../services/jobApi');
            const updatedJob = await updateJob(jobApplication._id, updatePayload);
            setForm(buildJobDetailsForm(updatedJob));
            setInitialForm(buildJobDetailsForm(updatedJob));
            setSourceJobId(updatedJob._id);
        } catch (error: any) {
            console.error('Error saving job details:', error);
            setSaveError(error.response?.data instanceof Blob
                ? 'Failed to save job details'
                : error.message || 'Failed to save job details');
        } finally {
            setIsSaving(false);
        }
    };

    return {
        form,
        isSaving,
        saveError,
        isEditing,
        handleChange,
        handleSave,
        setIsEditing,
    };
};
