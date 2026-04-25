import React from 'react';
import { JobApplication } from '../../services/jobApi';
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
 const normalizeTagValue = (value: string): string => value.trim().replace(/\s+/g, ' ');
 const getJobTags = (): string[] => {
 const tags: string[] = [];
 const seen = new Set<string>();
 const pushTag = (tag?: string | null) => {
 if (!tag) return;
 const normalized = normalizeTagValue(tag);
 if (!normalized) return;
 const key = normalized.toLowerCase();
 if (seen.has(key)) return;
 seen.add(key);
 tags.push(normalized);
 };

 if (Array.isArray(jobApplication.jobTags)) {
 jobApplication.jobTags.forEach(pushTag);
 }
 if (jobApplication.jobCategory) {
 pushTag(jobApplication.jobCategory);
 }

 return tags;
 };

 const renderTagCards = (tags: string[]) => {
 const visibleTags = tags.slice(0, 4);
 const remaining = tags.length - visibleTags.length;
 return (
 <div className="flex flex-wrap gap-2">
 {visibleTags.map((tag) => (
 <span
 key={tag}
 className="inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-semibold"
 style={{
 background: 'var(--bg-raised)',
 color: 'var(--text-secondary)',
 borderColor: 'var(--border)',
 boxShadow: '0 1px 2px rgba(0, 0, 0, 0.12)'
 }}
 >
 {tag}
 </span>
 ))}
 {remaining > 0 && (
 <span
 className="inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-semibold"
 style={{
 background: 'var(--bg-elevated)',
 color: 'var(--text-muted)',
 borderColor: 'var(--border)',
 boxShadow: '0 1px 2px rgba(0, 0, 0, 0.12)'
 }}
 >
 +{remaining}
 </span>
 )}
 </div>
 );
 };
 const jobTags = getJobTags();

 if (!formData) return null;

 return (
 <div className="bg-white rounded-xl shadow-sm border border-theme p-5 md:p-6">
 <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
 <div className="flex items-center gap-2">
 <span className="material-symbols-outlined text-primary">{isEditing ? 'edit_square' : 'work'}</span>
 <h2 className="text-lg font-bold text-text-main-light">Job Details</h2>
 </div>
 <div className="flex items-center gap-2">
 {isEditing ? (
 <>
 {hasChanges && (
 <span className="text-xs font-medium text-ember">Unsaved changes</span>
 )}
 <button
 onClick={onCancel}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-theme text-xs font-medium rounded-md text-secondary-color bg-white hover:bg-elevated transition-colors"
 >
 <span className="material-symbols-outlined text-sm">close</span>
 <span>Cancel</span>
 </button>
 <button
 onClick={onSave}
 disabled={!hasChanges || isSaving}
 className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-transparent text-xs font-medium rounded-md shadow-sm text-green-house bg-primary hover:bg-primaryLight focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
 className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-theme text-xs font-medium rounded-md text-secondary-color bg-white hover:bg-elevated transition-colors"
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
 <label className="block text-sm font-medium text-secondary-color mb-2">Job Title <span className="text-error">*</span></label>
 <input
 type="text"
 value={formData.jobTitle}
 onChange={(e) => onInputChange('jobTitle', e.target.value)}
 className="w-full rounded-md border-theme bg-elevated px-3 py-2.5 text-text-main-light shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-secondary-color mb-2">Company Name <span className="text-error">*</span></label>
 <input
 type="text"
 value={formData.companyName}
 onChange={(e) => onInputChange('companyName', e.target.value)}
 className="w-full rounded-md border-theme bg-elevated px-3 py-2.5 text-text-main-light shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
 />
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
 <div>
 <label className="block text-sm font-medium text-secondary-color mb-2">Status</label>
 <select
 value={formData.status}
 onChange={(e) => onInputChange('status', e.target.value as JobApplication['status'])}
 className="w-full rounded-md border-theme bg-elevated px-3 py-2.5 text-text-main-light shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
 >
 {jobStatusOptions.map(status => (
 <option key={status} value={status}>{status}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-secondary-color mb-2">Language</label>
 <select
 value={formData.language}
 onChange={(e) => onInputChange('language', e.target.value as 'en' | 'de')}
 className="w-full rounded-md border-theme bg-elevated px-3 py-2.5 text-text-main-light shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
 >
 <option value="en">English</option>
 <option value="de">German</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-secondary-color mb-2">Date Added</label>
 <input
 type="date"
 value={formatDateForInput(formData.createdAt)}
 onChange={(e) => {
 const nextDate = e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : '';
 onInputChange('createdAt', nextDate);
 }}
 className="w-full rounded-md border-theme bg-elevated px-3 py-2.5 text-text-main-light shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
 />
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
 <div>
 <label className="block text-sm font-medium text-secondary-color mb-2">Employment Type</label>
 <select
 value={formData.jobType || ''}
 onChange={(e) => onInputChange('jobType', e.target.value)}
 className="w-full rounded-md border-theme bg-elevated px-3 py-2.5 text-text-main-light shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
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
 <label className="block text-sm font-medium text-secondary-color mb-2">Base CV</label>
 <select
 value={formData.baseCvId}
 onChange={(e) => onInputChange('baseCvId', e.target.value)}
 className="w-full rounded-md border-theme bg-elevated px-3 py-2.5 text-text-main-light shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
 >
 <option value="" disabled>Select a CV</option>
 {formData.baseCvId && !availableCvs.some(cv => cv.id === formData.baseCvId) && (
 <option value={formData.baseCvId}>Current saved CV ({formData.baseCvId})</option>
 )}
 {availableCvs.map((cv) => (
 <option key={cv.id} value={cv.id}>{cv.name || 'Unnamed CV'}</option>
 ))}
 </select>
 <p className="mt-1.5 text-xs text-secondary-color">Choose which CV version to use as the default for this job.</p>
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-secondary-color mb-2">Job URL(s)</label>
 <div className="space-y-2">
 {formData.jobUrls.map((urlValue, idx) => (
 <div key={idx} className="flex items-center gap-2">
 <input
 type="url"
 value={urlValue}
 onChange={(e) => onUrlChange(idx, e.target.value)}
 onBlur={(e) => onUrlChange(idx, normalizeMultipleUrls(e.target.value))}
 placeholder={`Job URL ${idx + 1}`}
 className="w-full rounded-md border-theme bg-elevated px-3 py-2.5 text-text-main-light shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
 />
 {formData.jobUrls.length > 1 && (
 <button
 type="button"
 onClick={() => onRemoveUrl(idx)}
 className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-theme bg-white text-secondary-color hover:text-error hover:border-red-300 transition-colors"
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
 <label className="block text-sm font-medium text-secondary-color mb-2">Salary</label>
 <input
 type="text"
 value={formData.salary}
 onChange={(e) => onInputChange('salary', e.target.value)}
 placeholder="e.g., 50k-70k, $80,000"
 className="w-full rounded-md border-theme bg-elevated px-3 py-2.5 text-text-main-light shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
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
 <label className="block text-sm font-medium text-secondary-color mb-2">Contact Email</label>
 <input
 type="email"
 value={formData.contactEmail}
 onChange={(e) => onInputChange('contactEmail', e.target.value)}
 placeholder="name@company.com"
 className="w-full rounded-md border-theme bg-elevated px-3 py-2.5 text-text-main-light shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
 />
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
 <div>
 <label className="block text-sm font-medium text-secondary-color mb-2">Contact Phone</label>
 <input
 type="text"
 value={formData.contactPhone}
 onChange={(e) => onInputChange('contactPhone', e.target.value)}
 placeholder="+49 ..."
 className="w-full rounded-md border-theme bg-elevated px-3 py-2.5 text-text-main-light shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-secondary-color mb-2">Hiring Manager</label>
 <input
 type="text"
 value={formData.hiringManagerName}
 onChange={(e) => onInputChange('hiringManagerName', e.target.value)}
 placeholder="Recruiter or manager name"
 className="w-full rounded-md border-theme bg-elevated px-3 py-2.5 text-text-main-light shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-secondary-color mb-2">Application URL</label>
 <input
 type="url"
 value={formData.applicationUrl}
 onChange={(e) => onInputChange('applicationUrl', e.target.value)}
 placeholder="https://company.com/apply"
 className="w-full rounded-md border-theme bg-elevated px-3 py-2.5 text-text-main-light shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-secondary-color mb-2">Notes</label>
 <textarea
 value={formData.notes}
 onChange={(e) => onInputChange('notes', e.target.value)}
 rows={3}
 placeholder="Add notes for this application"
 className="w-full rounded-md border-theme bg-elevated px-3 py-2.5 text-text-main-light shadow-sm focus:border-primary focus:ring-primary sm:text-sm resize-y"
 />
 </div>
 </div>
 ) : (
 /* ── Read-only mode ── */
 <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
 {/* Job Title – always shown */}
 <div className="flex flex-col gap-0.5">
 <dt className="text-xs font-medium text-secondary-color">Job Title</dt>
 <dd className="text-sm font-semibold text-text-main-light">{formData.jobTitle || <span className="italic text-muted-color">—</span>}</dd>
 </div>
 {/* Company – always shown */}
 <div className="flex flex-col gap-0.5">
 <dt className="text-xs font-medium text-secondary-color">Company</dt>
 <dd className="text-sm font-semibold text-text-main-light">{formData.companyName || <span className="italic text-muted-color">—</span>}</dd>
 </div>
 {/* Status – always shown */}
 <div className="flex flex-col gap-0.5">
 <dt className="text-xs font-medium text-secondary-color">Status</dt>
 <dd><JobStatusBadge type="application" status={formData.status} /></dd>
 </div>
 {/* Language */}
 {formData.language && (
 <div className="flex flex-col gap-0.5">
 <dt className="text-xs font-medium text-secondary-color">Language</dt>
 <dd className="text-sm text-text-main-light">{formData.language === 'de' ? 'German' : 'English'}</dd>
 </div>
 )}
 {/* Employment Type */}
 {formData.jobType && (
 <div className="flex flex-col gap-0.5">
 <dt className="text-xs font-medium text-secondary-color">Employment Type</dt>
 <dd className="text-sm text-text-main-light capitalize">{formData.jobType.replace(/-/g, ' ')}</dd>
 </div>
 )}
 {/* Date Added */}
 {formData.createdAt && (
 <div className="flex flex-col gap-0.5">
 <dt className="text-xs font-medium text-secondary-color">Date Added</dt>
 <dd className="text-sm text-text-main-light">{new Date(formData.createdAt).toLocaleDateString()}</dd>
 </div>
 )}
 {/* Base CV */}
 {formData.baseCvId && (
 <div className="flex flex-col gap-0.5">
 <dt className="text-xs font-medium text-secondary-color">Base CV</dt>
 <dd className="text-sm text-text-main-light">
 {availableCvs.find(cv => cv.id === formData.baseCvId)?.name || formData.baseCvId}
 </dd>
 </div>
 )}
 {/* Job URL(s) */}
 {formData.jobUrls.filter(u => u.trim()).length > 0 && (
 <div className="flex flex-col gap-0.5 sm:col-span-2">
 <dt className="text-xs font-medium text-secondary-color">Job URL{formData.jobUrls.filter(u => u.trim()).length > 1 ? 's' : ''}</dt>
 <dd className="flex flex-col gap-1">
 {formData.jobUrls.filter(u => u.trim()).map((url, idx) => (
 <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="text-sm truncate max-w-xs hover:underline" style={{ color: 'var(--accent)' }}>{url}</a>
 ))}
 </dd>
 </div>
 )}
 {/* Tags */}
 <div className="flex flex-col gap-0.5 sm:col-span-2">
 <dt className="text-xs font-medium text-secondary-color">Tags</dt>
 <dd>
 {jobTags.length > 0 ? renderTagCards(jobTags) : <span className="italic text-muted-color">—</span>}
 </dd>
 </div>
 {/* Salary */}
 {formData.salary && (
 <div className="flex flex-col gap-0.5">
 <dt className="text-xs font-medium text-secondary-color">Salary</dt>
 <dd className="text-sm text-text-main-light">{formData.salary}</dd>
 </div>
 )}
 {/* Contact Email */}
 {formData.contactEmail && (
 <div className="flex flex-col gap-0.5">
 <dt className="text-xs font-medium text-secondary-color">Contact Email</dt>
 <dd className="text-sm">
 <a href={`mailto:${formData.contactEmail}`} className="hover:underline" style={{ color: 'var(--accent)' }}>{formData.contactEmail}</a>
 </dd>
 </div>
 )}
 {/* Contact Phone */}
 {formData.contactPhone && (
 <div className="flex flex-col gap-0.5">
 <dt className="text-xs font-medium text-secondary-color">Contact Phone</dt>
 <dd className="text-sm text-text-main-light">{formData.contactPhone}</dd>
 </div>
 )}
 {/* Hiring Manager */}
 {formData.hiringManagerName && (
 <div className="flex flex-col gap-0.5">
 <dt className="text-xs font-medium text-secondary-color">Hiring Manager</dt>
 <dd className="text-sm text-text-main-light">{formData.hiringManagerName}</dd>
 </div>
 )}
 {/* Application URL */}
 {formData.applicationUrl && (
 <div className="flex flex-col gap-0.5 sm:col-span-2">
 <dt className="text-xs font-medium text-secondary-color">Application Portal</dt>
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
 <dt className="text-xs font-medium text-secondary-color">Notes</dt>
 <dd className="text-sm text-text-main-light whitespace-pre-wrap break-words">{formData.notes}</dd>
 </div>
 )}
 </dl>
 )}
 </div>
 );
};

export default JobDetailsSection;
