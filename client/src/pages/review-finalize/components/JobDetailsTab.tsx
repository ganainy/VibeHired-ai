import React from 'react';
import { JobApplication } from '../../../services/jobApi';
import { normalizeMultipleUrls } from '../../../lib/utils';
import ErrorAlert from '../../../components/common/ErrorAlert';
import Spinner from '../../../components/common/Spinner';
import JobStatusBadge from '../../../components/jobs/JobStatusBadge';
import SendToPhoneButton from '../../../components/jobs/SendToPhoneButton';

interface JobDetailsFormData {
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
}

interface JobDetailsTabProps {
    jobApplication: JobApplication;
    form: JobDetailsFormData | null;
    initialForm: JobDetailsFormData | null;
    isEditing: boolean;
    isSaving: boolean;
    saveError: string | null;
    hasChanges: boolean;
    availableCvs: { id: string; name: string; data: any }[];
    isRefreshing: boolean;
    refreshError: string | null;
    isExtractingWithAi: boolean;
    pastedJobText: string;
    showExtractWithAi: boolean;
    isJobDescriptionExpanded: boolean;
    onChange: (field: keyof JobDetailsFormData, value: string) => void;
    onSave: () => void;
    onSetEditing: (editing: boolean) => void;
    onRefreshJobDetails: () => void;
    onExtractWithAi: () => void;
    onSetPastedJobText: (text: string) => void;
    onSetShowExtractWithAi: (show: boolean) => void;
    onSetJobDescriptionExpanded: (expanded: boolean) => void;
    onRevertForm: () => void;
    onDismissSaveError: () => void;
    onDismissRefreshError: () => void;
}

const jobStatusOptions = [
    'Not Applied',
    'Applying',
    'Applied',
    'Interview',
    'Offer',
    'Rejected',
    'Withdrawn',
];

const formatDateForInput = (dateString?: string): string => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch {
        return '';
    }
};

export const JobDetailsTab: React.FC<JobDetailsTabProps> = ({
    jobApplication,
    form,
    isEditing,
    isSaving,
    saveError,
    hasChanges,
    availableCvs,
    refreshError,
    isExtractingWithAi,
    pastedJobText,
    showExtractWithAi,
    isJobDescriptionExpanded,
    onChange,
    onSave,
    onSetEditing,
    onRefreshJobDetails,
    onExtractWithAi,
    onSetPastedJobText,
    onSetShowExtractWithAi,
    onSetJobDescriptionExpanded,
    onRevertForm,
    onDismissSaveError,
    onDismissRefreshError,
}) => {
    // Job URL field management is local to this component
    const handleJobUrlFieldChange = (idx: number, value: string) => {
        if (!form) return;
        const updated = [...form.jobUrls];
        updated[idx] = value;
        onChange('jobUrls', JSON.stringify(updated));
    };

    const handleAddJobUrlField = () => {
        if (!form) return;
        const updated = [...form.jobUrls, ''];
        onChange('jobUrls', JSON.stringify(updated));
    };

    const handleRemoveJobUrlField = (idx: number) => {
        if (!form) return;
        const updated = form.jobUrls.filter((_, i) => i !== idx);
        onChange('jobUrls', JSON.stringify(updated));
    };

    if (!form) return null;

    return (
        <div className="w-full space-y-6">
            {/* Job Details - Read-only / Edit */}
            <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">{isEditing ? 'edit_square' : 'work'}</span>
                        <h2 className="text-lg font-bold text-text-main-light dark:text-text-main-dark">Job Details</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {isEditing ? (
                            <>
                                {hasChanges && (
                                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Unsaved changes</span>
                                )}
                                <button
                                    onClick={() => {
                                        onSetEditing(false);
                                        onRevertForm();
                                        onDismissSaveError();
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-sm">close</span>
                                    <span>Cancel</span>
                                </button>
                                <button
                                    onClick={onSave}
                                    disabled={!hasChanges || isSaving || !form}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-ink-950 bg-primary hover:bg-primaryLight focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    {isSaving ? (
                                        <>
                                            <Spinner size="sm" />
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-sm">save</span>
                                            <span>Save</span>
                                        </>
                                    )}
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => onSetEditing(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">edit</span>
                                <span>Edit</span>
                            </button>
                        )}
                    </div>
                </div>

                {saveError && isEditing && (
                    <div className="mb-4">
                        <ErrorAlert
                            message={saveError}
                            onDismiss={onDismissSaveError}
                        />
                    </div>
                )}

                {isEditing && form ? (
                    /* Edit mode */
                    <div className="space-y-5 md:space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Job Title <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={form.jobTitle}
                                    onChange={(e) => onChange('jobTitle', e.target.value)}
                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={form.companyName}
                                    onChange={(e) => onChange('companyName', e.target.value)}
                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                                <select
                                    value={form.status}
                                    onChange={(e) => onChange('status', e.target.value)}
                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                >
                                    {jobStatusOptions.map(status => (
                                        <option key={status} value={status}>{status}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Language</label>
                                <select
                                    value={form.language}
                                    onChange={(e) => onChange('language', e.target.value)}
                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                >
                                    <option value="en">English</option>
                                    <option value="de">German</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date Added</label>
                                <input
                                    type="date"
                                    value={formatDateForInput(form.createdAt)}
                                    onChange={(e) => {
                                        const nextDate = e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : '';
                                        onChange('createdAt', nextDate);
                                    }}
                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Employment Type</label>
                                <select
                                    value={form.jobType || ''}
                                    onChange={(e) => onChange('jobType', e.target.value)}
                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
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
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Base CV</label>
                                <select
                                    value={form.baseCvId}
                                    onChange={(e) => onChange('baseCvId', e.target.value)}
                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                >
                                    <option value="">Use master/primary CV</option>
                                    {form.baseCvId && !availableCvs.some(cv => cv.id === form.baseCvId) && (
                                        <option value={form.baseCvId}>Current saved CV ({form.baseCvId})</option>
                                    )}
                                    {availableCvs.map((cv) => (
                                        <option key={cv.id} value={cv.id}>{cv.name || 'Unnamed CV'}</option>
                                    ))}
                                </select>
                                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">Choose which CV version to use as the default for this job.</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Job URL(s)</label>
                            <div className="space-y-2">
                                {form.jobUrls.map((urlValue, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <input
                                            type="url"
                                            value={urlValue}
                                            onChange={(e) => handleJobUrlFieldChange(idx, e.target.value)}
                                            onBlur={(e) => handleJobUrlFieldChange(idx, normalizeMultipleUrls(e.target.value))}
                                            placeholder={`Job URL ${idx + 1}`}
                                            className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                        />
                                        {form.jobUrls.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveJobUrlField(idx)}
                                                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 hover:text-red-500 hover:border-red-300 dark:hover:border-red-700 transition-colors"
                                                title="Remove URL"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleAddJobUrlField}
                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primaryLight transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[16px]">add</span>
                                    <span>Add another URL</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Salary</label>
                                <input
                                    type="text"
                                    value={form.salary}
                                    onChange={(e) => onChange('salary', e.target.value)}
                                    placeholder="e.g., 50k-70k, $80,000"
                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                                {!form.salary && (jobApplication.extractedData?.salaryRaw || jobApplication.extractedData?.estimatedSalary) && (
                                    <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                        {jobApplication.extractedData?.salaryIsEstimate === false
                                            ? `From posting: ${jobApplication.extractedData.salaryRaw}`
                                            : `AI estimate: ${jobApplication.extractedData.estimatedSalary}`}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contact Email</label>
                                <input
                                    type="email"
                                    value={form.contactEmail}
                                    onChange={(e) => onChange('contactEmail', e.target.value)}
                                    placeholder="name@company.com"
                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contact Phone</label>
                                <input
                                    type="text"
                                    value={form.contactPhone}
                                    onChange={(e) => onChange('contactPhone', e.target.value)}
                                    placeholder="+49 ..."
                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Hiring Manager</label>
                                <input
                                    type="text"
                                    value={form.hiringManagerName}
                                    onChange={(e) => onChange('hiringManagerName', e.target.value)}
                                    placeholder="Recruiter or manager name"
                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Application URL</label>
                                <input
                                    type="url"
                                    value={form.applicationUrl}
                                    onChange={(e) => onChange('applicationUrl', e.target.value)}
                                    placeholder="https://company.com/apply"
                                    className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes</label>
                            <textarea
                                value={form.notes}
                                onChange={(e) => onChange('notes', e.target.value)}
                                rows={3}
                                placeholder="Add notes for this application"
                                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm resize-y"
                            />
                        </div>
                    </div>
                ) : (
                    /* Read-only mode */
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                        <div className="flex flex-col gap-0.5">
                            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Job Title</dt>
                            <dd className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">{form.jobTitle || <span className="italic text-gray-400">---</span>}</dd>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Company</dt>
                            <dd className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">{form.companyName || <span className="italic text-gray-400">---</span>}</dd>
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Status</dt>
                            <dd><JobStatusBadge type="application" status={form.status} /></dd>
                        </div>
                        {form.language && (
                            <div className="flex flex-col gap-0.5">
                                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Language</dt>
                                <dd className="text-sm text-text-main-light dark:text-text-main-dark">{form.language === 'de' ? 'German' : 'English'}</dd>
                            </div>
                        )}
                        {form.jobType && (
                            <div className="flex flex-col gap-0.5">
                                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Employment Type</dt>
                                <dd className="text-sm text-text-main-light dark:text-text-main-dark capitalize">{form.jobType.replace(/-/g, ' ')}</dd>
                            </div>
                        )}
                        {form.createdAt && (
                            <div className="flex flex-col gap-0.5">
                                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Date Added</dt>
                                <dd className="text-sm text-text-main-light dark:text-text-main-dark">{new Date(form.createdAt).toLocaleDateString()}</dd>
                            </div>
                        )}
                        {form.baseCvId && (
                            <div className="flex flex-col gap-0.5">
                                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Base CV</dt>
                                <dd className="text-sm text-text-main-light dark:text-text-main-dark">
                                    {availableCvs.find(cv => cv.id === form.baseCvId)?.name || form.baseCvId}
                                </dd>
                            </div>
                        )}
                        {form.jobUrls.filter(u => u.trim()).length > 0 && (
                            <div className="flex flex-col gap-0.5 sm:col-span-2">
                                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Job URL{form.jobUrls.filter(u => u.trim()).length > 1 ? 's' : ''}</dt>
                                <dd className="flex flex-col gap-1">
                                    {form.jobUrls.filter(u => u.trim()).map((url, idx) => (
                                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="text-sm truncate max-w-xs hover:underline" style={{ color: 'var(--accent)' }}>{url}</a>
                                    ))}
                                </dd>
                            </div>
                        )}
                        {form.salary && (
                            <div className="flex flex-col gap-0.5">
                                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Salary</dt>
                                <dd className="text-sm text-text-main-light dark:text-text-main-dark">{form.salary}</dd>
                            </div>
                        )}
                        {form.contactEmail && (
                            <div className="flex flex-col gap-0.5">
                                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Contact Email</dt>
                                <dd className="text-sm">
                                    <a href={`mailto:${form.contactEmail}`} className="hover:underline" style={{ color: 'var(--accent)' }}>{form.contactEmail}</a>
                                </dd>
                            </div>
                        )}
                        {form.contactPhone && (
                            <div className="flex flex-col gap-0.5">
                                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Contact Phone</dt>
                                <dd className="text-sm text-text-main-light dark:text-text-main-dark">{form.contactPhone}</dd>
                            </div>
                        )}
                        {form.hiringManagerName && (
                            <div className="flex flex-col gap-0.5">
                                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Hiring Manager</dt>
                                <dd className="text-sm text-text-main-light dark:text-text-main-dark">{form.hiringManagerName}</dd>
                            </div>
                        )}
                        {form.applicationUrl && (
                            <div className="flex flex-col gap-0.5 sm:col-span-2">
                                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Application Portal</dt>
                                <dd className="text-sm">
                                    <a href={form.applicationUrl} target="_blank" rel="noopener noreferrer" className="hover:underline truncate" style={{ color: 'var(--accent)' }}>
                                        {form.applicationUrl.length > 60 ? form.applicationUrl.substring(0, 60) + '...' : form.applicationUrl}
                                    </a>
                                </dd>
                            </div>
                        )}
                        {form.notes && (
                            <div className="flex flex-col gap-0.5 sm:col-span-2">
                                <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Notes</dt>
                                <dd className="text-sm text-text-main-light dark:text-text-main-dark whitespace-pre-wrap break-words">{form.notes}</dd>
                            </div>
                        )}
                    </dl>
                )}
            </div>

            {/* Highlights Card */}
            <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-primary">lightbulb</span>
                    <h2 className="text-lg font-bold text-text-main-light dark:text-text-main-dark">Key Highlights</h2>
                </div>
                <ul className="space-y-3">
                    {jobApplication.extractedData?.location && (
                        <li className="flex items-start gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                            <span className="text-sm text-text-sub-light dark:text-text-sub-dark">
                                <strong className="text-text-main-light dark:text-text-main-dark">Location:</strong> {jobApplication.extractedData.location}
                            </span>
                        </li>
                    )}
                    {(jobApplication.extractedData?.salaryRaw || jobApplication.extractedData?.estimatedSalary) && (
                        <li className="flex items-start gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                            <span className="text-sm text-text-sub-light dark:text-text-sub-dark">
                                <strong className="text-text-main-light dark:text-text-main-dark">Salary:</strong>{' '}
                                {jobApplication.extractedData?.salaryRaw
                                    ? jobApplication.extractedData.salaryRaw
                                    : jobApplication.extractedData?.estimatedSalary}
                                {' '}
                                {jobApplication.extractedData?.salaryIsEstimate === false ? (
                                    <span className="inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                                        From posting
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" title="This salary is an AI estimate based on the job data">
                                        AI Estimate
                                    </span>
                                )}
                            </span>
                        </li>
                    )}
                    {jobApplication.contactEmail && (
                        <li className="flex items-start gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                            <span className="text-sm text-text-sub-light dark:text-text-sub-dark">
                                <strong className="text-text-main-light dark:text-text-main-dark">Contact Email:</strong>{' '}
                                <a href={`mailto:${jobApplication.contactEmail}`} className="hover:underline" style={{ color: 'var(--accent)' }}>
                                    {jobApplication.contactEmail}
                                </a>
                            </span>
                        </li>
                    )}
                    {jobApplication.contactPhone && (
                        <li className="flex items-start gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                            <span className="text-sm text-text-sub-light dark:text-text-sub-dark flex flex-wrap items-center gap-2">
                                <strong className="text-text-main-light dark:text-text-main-dark">Contact Phone:</strong>
                                {jobApplication.contactPhone}
                                <SendToPhoneButton
                                    phone={jobApplication.contactPhone}
                                    company={jobApplication.companyName}
                                    jobTitle={jobApplication.jobTitle}
                                    contactName={jobApplication.hiringManagerName}
                                />
                            </span>
                        </li>
                    )}
                    {jobApplication.hiringManagerName && (
                        <li className="flex items-start gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                            <span className="text-sm text-text-sub-light dark:text-text-sub-dark">
                                <strong className="text-text-main-light dark:text-text-main-dark">Hiring Manager:</strong> {jobApplication.hiringManagerName}
                            </span>
                        </li>
                    )}
                    {jobApplication.applicationUrl && (
                        <li className="flex items-start gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                            <span className="text-sm text-text-sub-light dark:text-text-sub-dark">
                                <strong className="text-text-main-light dark:text-text-main-dark">Application Portal:</strong>{' '}
                                <a href={jobApplication.applicationUrl} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--accent)' }}>
                                    {jobApplication.applicationUrl.length > 50 ? jobApplication.applicationUrl.substring(0, 50) + '...' : jobApplication.applicationUrl}
                                </a>
                            </span>
                        </li>
                    )}
                    {jobApplication.extractedData?.keyDetails && (
                        Array.isArray(jobApplication.extractedData.keyDetails) ? (
                            jobApplication.extractedData.keyDetails.map((item: { key: string; value: string }, idx: number) => (
                                <li key={idx} className="flex items-start gap-3">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                                    <span className="text-sm text-text-sub-light dark:text-text-sub-dark">
                                        <strong className="text-text-main-light dark:text-text-main-dark">{item.key}:</strong> {item.value}
                                    </span>
                                </li>
                            ))
                        ) : (
                            (jobApplication.extractedData.keyDetails as string).split('\n').filter((line: string) => line.trim()).map((line: string, idx: number) => (
                                <li key={idx} className="flex items-start gap-3">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
                                    <span className="text-sm text-text-sub-light dark:text-text-sub-dark leading-relaxed">
                                        {line.replace(/^[\*\-]\s*/, '')}
                                    </span>
                                </li>
                            ))
                        )
                    )}
                </ul>
            </div>

            {/* Job Prerequisites Card */}
            {jobApplication.jobPrerequisites && (
                <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-text-main-light dark:text-text-main-dark flex items-center gap-2">
                            <span className="material-symbols-outlined">checklist</span>
                            Requirements
                        </h2>
                    </div>
                    <div className="text-sm text-text-main-light dark:text-text-main-dark leading-relaxed">
                        <div className="whitespace-pre-wrap">
                            {jobApplication.jobPrerequisites}
                        </div>
                    </div>
                </div>
            )}

            {/* Description Card */}
            <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-text-main-light dark:text-text-main-dark">Description</h2>
                    {(!jobApplication.jobDescriptionText || jobApplication.jobDescriptionText.trim().length < 50) && (
                        <button
                            onClick={() => onSetShowExtractWithAi(!showExtractWithAi)}
                            disabled={isExtractingWithAi}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isExtractingWithAi
                                ? 'badge badge-gold opacity-60'
                                : showExtractWithAi
                                    ? 'badge badge-gold'
                                    : 'btn-ghost text-sm'
                                }`}
                            title="Extract job details using AI"
                        >
                            {isExtractingWithAi ? (
                                <>
                                    <Spinner size="sm" />
                                    <span>Extracting...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5A2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5Z" />
                                    </svg>
                                    <span>{showExtractWithAi ? 'Cancel' : 'Extract with AI'}</span>
                                    {!showExtractWithAi && <span className="text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-dim)', color: 'var(--text-on-accent)' }}>1 Credit</span>}
                                </>
                            )}
                        </button>
                    )}
                </div>

                {refreshError && (
                    <div className="mb-4">
                        <ErrorAlert
                            message={refreshError}
                            onDismiss={onDismissRefreshError}
                            onRetry={onRefreshJobDetails}
                        />
                    </div>
                )}

                {showExtractWithAi && (!jobApplication.jobDescriptionText || jobApplication.jobDescriptionText.trim().length < 50) && (
                    <div className="mb-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <p className="text-sm text-secondary-color mb-3">
                            Paste the job description text below and click "Extract" to update the job details using AI.
                        </p>
                        <div className="relative">
                            <textarea
                                value={pastedJobText}
                                onChange={(e) => onSetPastedJobText(e.target.value)}
                                placeholder="Paste job description here..."
                                className="input-base w-full resize-y min-h-[120px]"
                                rows={5}
                                disabled={isExtractingWithAi}
                            />
                            {isExtractingWithAi && (
                                <div className="absolute inset-0 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center gap-2">
                                    <Spinner size="md" />
                                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Extracting job details...</p>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-between mt-3">
                            <div>
                                {pastedJobText && pastedJobText.trim().length > 0 && pastedJobText.trim().length < 50 && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400">
                                        Please paste more text (at least 50 characters)
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={onExtractWithAi}
                                disabled={isExtractingWithAi || !pastedJobText || pastedJobText.trim().length < 50}
                                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {isExtractingWithAi ? (
                                    <>
                                        <Spinner size="sm" />
                                        <span>Extracting...</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5A2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5Z" />
                                        </svg>
                                        <span>Extract with AI</span>
                                        <span className="text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-dim)', color: 'var(--text-on-accent)' }}>1 Credit</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                <div className={`custom-scrollbar overflow-y-auto pr-2 text-sm text-text-main-light dark:text-text-main-dark leading-relaxed space-y-4 ${isJobDescriptionExpanded ? 'max-h-none' : 'max-h-[500px]'}`}>
                    {jobApplication.jobDescriptionText ? (
                        <div className="whitespace-pre-wrap">
                            {jobApplication.jobDescriptionText}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <span className="material-symbols-outlined text-4xl text-gray-300 dark:text-gray-600 mb-2">description</span>
                            <p className="text-text-sub-light dark:text-text-sub-dark mb-6">No job description available.</p>
                            <div className="w-full max-w-2xl">
                                <div className="relative">
                                    <textarea
                                        value={pastedJobText}
                                        onChange={(e) => onSetPastedJobText(e.target.value)}
                                        placeholder="Paste job description here..."
                                        className="input-base w-full resize-y min-h-[120px]"
                                        rows={5}
                                        disabled={isExtractingWithAi}
                                    />
                                    {isExtractingWithAi && (
                                        <div className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center gap-2">
                                            <Spinner size="md" />
                                            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Extracting job details...</p>
                                        </div>
                                    )}
                                </div>
                                <div className="flex justify-center gap-3 mt-4">
                                    <button
                                        onClick={onExtractWithAi}
                                        disabled={isExtractingWithAi || !pastedJobText || pastedJobText.trim().length < 50}
                                        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isExtractingWithAi ? (
                                            <>
                                                <Spinner size="sm" />
                                                <span>Extracting...</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5A2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5Z" />
                                                </svg>
                                                <span>Extract with AI</span>
                                                <span className="text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-dim)', color: 'var(--text-on-accent)' }}>1 Credit</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                                {pastedJobText && pastedJobText.trim().length > 0 && pastedJobText.trim().length < 50 && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                                        Please paste more text (at least 50 characters)
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {jobApplication.jobDescriptionText && (
                    <div className="mt-4 flex justify-center pt-2 border-t border-gray-100 dark:border-gray-700">
                        <button
                            onClick={() => onSetJobDescriptionExpanded(!isJobDescriptionExpanded)}
                            className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
                        >
                            {isJobDescriptionExpanded ? 'Show less' : 'Read full description'}
                            <span className="material-symbols-outlined text-base">
                                {isJobDescriptionExpanded ? 'expand_less' : 'expand_more'}
                            </span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default JobDetailsTab;

