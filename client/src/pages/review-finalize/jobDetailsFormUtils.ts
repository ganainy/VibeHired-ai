import { JobApplication } from '../../services/jobApi';
import { parseMultipleUrls } from '../../lib/utils';
import { JobDetailsFormData } from '../../components/jobs/JobDetailsSection';

export const buildJobDetailsForm = (job: JobApplication): JobDetailsFormData => {
    const legacyContact = job.contact || '';
    let contactEmail = job.contactEmail || '';
    let contactPhone = job.contactPhone || '';
    let hiringManagerName = job.hiringManagerName || '';
    let applicationUrl = job.applicationUrl || '';

    if (legacyContact) {
        if (!contactEmail && legacyContact.includes('@')) {
            contactEmail = legacyContact;
        } else if (!applicationUrl && /^https?:\/\//i.test(legacyContact)) {
            applicationUrl = legacyContact;
        } else if (!hiringManagerName) {
            hiringManagerName = legacyContact;
        }
    }

    const parsedUrls = parseMultipleUrls(job.jobUrl || '');

    return {
        jobTitle: job.jobTitle || '',
        companyName: job.companyName || '',
        status: job.status || 'Not Applied',
        language: job.language || 'en',
        baseCvId: job.baseCvId || '',
        jobType: job.jobType || '',
        createdAt: job.createdAt || '',
        jobUrls: parsedUrls.length > 0 ? parsedUrls : [''],
        salary: job.salary || '',
        contactEmail,
        contactPhone,
        hiringManagerName,
        applicationUrl,
        notes: job.notes || '',
    };
};

export const formatDateForInput = (dateString?: string): string => {
    if (!dateString) {
        return '';
    }

    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return '';
        }

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch {
        return '';
    }
};
