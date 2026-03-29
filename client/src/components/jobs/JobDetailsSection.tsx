import React from 'react';
import { JobApplication, JobStatusOptions } from '../../services/jobApi';
import JobStatusBadge from './JobStatusBadge';
import Spinner from '../common/Spinner';
import ErrorAlert from '../common/ErrorAlert';
import { normalizeMultipleUrls } from '../../lib/utils';

export type JobDetailsFormData = {
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

interface JobDetailsSectionProps {
    jobApplication: JobApplication;
    isEditing: boolean;
    setIsEditing: (isEditing: boolean) => void;
    formData: JobDetailsFormData | null;
    hasChanges: boolean;
    isSaving: boolean;
    saveError: string | null;
    setSaveError: (error: string | null) => void;
    onInputChange: (field: keyof JobDetailsFormData, value: string) => void;
    onUrlChange: (index: number, value: string) => void;
    onAddUrl: () => void;
    onRemoveUrl: (index: number) => void;
    onSave: () => Promise<void>;
    onCancel: () => void;
    availableCvs: { id: string; name: string; data: any }[];
    formatDateForInput: (dateString?: string) => string;
}

const JobDetailsSection: React.FC<JobDetailsSectionProps> = ({
    jobApplication,
    isEditing,
    setIsEditing,
    formData,
    hasChanges,
    isSaving,
    saveError,
    setSaveError,
    onInputChange,
    onUrlChange,
    onAddUrl,
    onRemoveUrl,
    onSave,
    onCancel,
    availableCvs,
    formatDateForInput
}) => {
    const jobStatusOptions: JobApplication['status'][] = ['Not Applied', 'Applied', 'Interview', 'Assessment', 'Rejected', 'Closed', 'Offer'];

    if (!formData) return null;

    return (
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
                                onClick={onCancel}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                                <span>Cancel</span>
                            </button>
                            <button
                                onClick={onSave}
                                disabled={!hasChanges || isSaving}
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
                            onClick={() => setIsEditing(true)}
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
                        onDismiss={() => setSaveError(null)}
                    />
                </div>
            )}

            {isEditing ? (
                /* ── Edit mode ── */
                <div className="space-y-5 md:space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Job Title <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={formData.jobTitle}
                                onChange={(e) => onInputChange('jobTitle', e.target.value)}
                                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Company Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={formData.companyName}
                                onChange={(e) => onInputChange('companyName', e.target.value)}
                                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                            <select
                                value={formData.status}
                                onChange={(e) => onInputChange('status', e.target.value as JobApplication['status'])}
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
                                value={formData.language}
                                onChange={(e) => onInputChange('language', e.target.value as 'en' | 'de')}
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
                                value={formatDateForInput(formData.createdAt)}
                                onChange={(e) => {
                                    const nextDate = e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : '';
                                    onInputChange('createdAt', nextDate);
                                }}
                                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Employment Type</label>
                            <select
                                value={formData.jobType || ''}
                                onChange={(e) => onInputChange('jobType', e.target.value)}
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
                                value={formData.baseCvId}
                                onChange={(e) => onInputChange('baseCvId', e.target.value)}
                                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                            >
                                <option value="">Use master/primary CV</option>
                                {formData.baseCvId && !availableCvs.some(cv => cv.id === formData.baseCvId) && (
                                    <option value={formData.baseCvId}>Current saved CV ({formData.baseCvId})</option>
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
                            {formData.jobUrls.map((urlValue, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <input
                                        type="url"
                                        value={urlValue}
                                        onChange={(e) => onUrlChange(idx, e.target.value)}
                                        onBlur={(e) => onUrlChange(idx, normalizeMultipleUrls(e.target.value))}
                                        placeholder={`Job URL ${idx + 1}`}
                                        className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                                    />
                                    {formData.jobUrls.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => onRemoveUrl(idx)}
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
                                onClick={onAddUrl}
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
                                value={formData.salary}
                                onChange={(e) => onInputChange('salary', e.target.value)}
                                placeholder="e.g., 50k-70k, $80,000"
                                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                            />
                            {!formData.salary && (jobApplication.extractedData?.salaryRaw || jobApplication.extractedData?.estimatedSalary) && (
                                <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                    {jobApplication.extractedData?.salaryIsEstimate === false
                                        ? `✅ From posting: ${jobApplication.extractedData.salaryRaw}`
                                        : `🤖 AI estimate: ${jobApplication.extractedData.estimatedSalary}`}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contact Email</label>
                            <input
                                type="email"
                                value={formData.contactEmail}
                                onChange={(e) => onInputChange('contactEmail', e.target.value)}
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
                                value={formData.contactPhone}
                                onChange={(e) => onInputChange('contactPhone', e.target.value)}
                                placeholder="+49 ..."
                                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Hiring Manager</label>
                            <input
                                type="text"
                                value={formData.hiringManagerName}
                                onChange={(e) => onInputChange('hiringManagerName', e.target.value)}
                                placeholder="Recruiter or manager name"
                                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Application URL</label>
                            <input
                                type="url"
                                value={formData.applicationUrl}
                                onChange={(e) => onInputChange('applicationUrl', e.target.value)}
                                placeholder="https://company.com/apply"
                                className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => onInputChange('notes', e.target.value)}
                            rows={3}
                            placeholder="Add notes for this application"
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-600 px-3 py-2.5 text-text-main-light dark:text-text-main-dark shadow-sm focus:border-primary focus:ring-primary sm:text-sm resize-y"
                        />
                    </div>
                </div>
            ) : (
                /* ── Read-only mode ── */
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                    {/* Job Title – always shown */}
                    <div className="flex flex-col gap-0.5">
                        <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Job Title</dt>
                        <dd className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">{formData.jobTitle || <span className="italic text-gray-400">—</span>}</dd>
                    </div>
                    {/* Company – always shown */}
                    <div className="flex flex-col gap-0.5">
                        <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Company</dt>
                        <dd className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">{formData.companyName || <span className="italic text-gray-400">—</span>}</dd>
                    </div>
                    {/* Status – always shown */}
                    <div className="flex flex-col gap-0.5">
                        <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Status</dt>
                        <dd><JobStatusBadge type="application" status={formData.status} /></dd>
                    </div>
                    {/* Language */}
                    {formData.language && (
                        <div className="flex flex-col gap-0.5">
                            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Language</dt>
                            <dd className="text-sm text-text-main-light dark:text-text-main-dark">{formData.language === 'de' ? 'German' : 'English'}</dd>
                        </div>
                    )}
                    {/* Employment Type */}
                    {formData.jobType && (
                        <div className="flex flex-col gap-0.5">
                            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Employment Type</dt>
                            <dd className="text-sm text-text-main-light dark:text-text-main-dark capitalize">{formData.jobType.replace(/-/g, ' ')}</dd>
                        </div>
                    )}
                    {/* Date Added */}
                    {formData.createdAt && (
                        <div className="flex flex-col gap-0.5">
                            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Date Added</dt>
                            <dd className="text-sm text-text-main-light dark:text-text-main-dark">{new Date(formData.createdAt).toLocaleDateString()}</dd>
                        </div>
                    )}
                    {/* Base CV */}
                    {formData.baseCvId && (
                        <div className="flex flex-col gap-0.5">
                            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Base CV</dt>
                            <dd className="text-sm text-text-main-light dark:text-text-main-dark">
                                {availableCvs.find(cv => cv.id === formData.baseCvId)?.name || formData.baseCvId}
                            </dd>
                        </div>
                    )}
                    {/* Job URL(s) */}
                    {formData.jobUrls.filter(u => u.trim()).length > 0 && (
                        <div className="flex flex-col gap-0.5 sm:col-span-2">
                            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Job URL{formData.jobUrls.filter(u => u.trim()).length > 1 ? 's' : ''}</dt>
                            <dd className="flex flex-col gap-1">
                                {formData.jobUrls.filter(u => u.trim()).map((url, idx) => (
                                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="text-sm truncate max-w-xs hover:underline" style={{ color: 'var(--accent)' }}>{url}</a>
                                ))}
                            </dd>
                        </div>
                    )}
                    {/* Salary */}
                    {formData.salary && (
                        <div className="flex flex-col gap-0.5">
                            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Salary</dt>
                            <dd className="text-sm text-text-main-light dark:text-text-main-dark">{formData.salary}</dd>
                        </div>
                    )}
                    {/* Contact Email */}
                    {formData.contactEmail && (
                        <div className="flex flex-col gap-0.5">
                            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Contact Email</dt>
                            <dd className="text-sm">
                                <a href={`mailto:${formData.contactEmail}`} className="hover:underline" style={{ color: 'var(--accent)' }}>{formData.contactEmail}</a>
                            </dd>
                        </div>
                    )}
                    {/* Contact Phone */}
                    {formData.contactPhone && (
                        <div className="flex flex-col gap-0.5">
                            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Contact Phone</dt>
                            <dd className="text-sm text-text-main-light dark:text-text-main-dark">{formData.contactPhone}</dd>
                        </div>
                    )}
                    {/* Hiring Manager */}
                    {formData.hiringManagerName && (
                        <div className="flex flex-col gap-0.5">
                            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Hiring Manager</dt>
                            <dd className="text-sm text-text-main-light dark:text-text-main-dark">{formData.hiringManagerName}</dd>
                        </div>
                    )}
                    {/* Application URL */}
                    {formData.applicationUrl && (
                        <div className="flex flex-col gap-0.5 sm:col-span-2">
                            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Application Portal</dt>
                            <dd className="text-sm">
                                <a href={formData.applicationUrl} target="_blank" rel="noopener noreferrer" className="hover:underline truncate" style={{ color: 'var(--accent)' }}>
                                    {formData.applicationUrl.length > 60 ? formData.applicationUrl.substring(0, 60) + '…' : formData.applicationUrl}
                                </a>
                            </dd>
                        </div>
                    )}
                    {/* Notes */}
                    {formData.notes && (
                        <div className="flex flex-col gap-0.5 sm:col-span-2">
                            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Notes</dt>
                            <dd className="text-sm text-text-main-light dark:text-text-main-dark whitespace-pre-wrap break-words">{formData.notes}</dd>
                        </div>
                    )}
                </dl>
            )}
        </div>
    );
};

export default JobDetailsSection;
