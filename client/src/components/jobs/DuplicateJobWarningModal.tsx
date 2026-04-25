// client/src/components/jobs/DuplicateJobWarningModal.tsx
import React, { useEffect, useRef } from 'react';
import JobStatusBadge from './JobStatusBadge';
import { JobApplication } from '../../services/jobApi';

type DuplicateEntry = Pick<JobApplication, '_id' | 'jobTitle' | 'companyName' | 'status' | 'createdAt' | 'jobUrl'>;

interface DuplicateJobWarningModalProps {
 isOpen: boolean;
 duplicates: DuplicateEntry[];
 onCancel: () => void;
 onAddAnyway: () => void;
 isSubmitting?: boolean;
}

const DuplicateJobWarningModal: React.FC<DuplicateJobWarningModalProps> = ({
 isOpen,
 duplicates,
 onCancel,
 onAddAnyway,
 isSubmitting = false,
}) => {
 const cancelBtnRef = useRef<HTMLButtonElement>(null);

 useEffect(() => {
 if (isOpen) {
 // Focus the cancel button by default for safety
 setTimeout(() => cancelBtnRef.current?.focus(), 50);
 }
 }, [isOpen]);

 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if (e.key === 'Escape' && isOpen) onCancel();
 };
 document.addEventListener('keydown', handleKeyDown);
 return () => document.removeEventListener('keydown', handleKeyDown);
 }, [isOpen, onCancel]);

 if (!isOpen) return null;

 const formatDate = (dateStr: string) => {
 try {
 return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
 } catch {
 return dateStr;
 }
 };

 return (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
 role="dialog"
 aria-modal="true"
 aria-labelledby="duplicate-warning-title"
 onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
 >
 <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
 {/* Header */}
<div className="flex items-center gap-3 px-6 py-4 border-b border-theme bg-[var(--ember-bg)]">
  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-[var(--ember-bg)] flex items-center justify-center">
  <svg className="w-5 h-5 text-ember" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
 </svg>
 </div>
 <div>
<h2 id="duplicate-warning-title" className="text-base font-semibold text-ember">
  Possible Duplicate Application
  </h2>
  <p className="text-sm text-ember mt-0.5">
 You may have already added this job.
 </p>
 </div>
 </div>

 {/* Body */}
 <div className="px-6 py-4">
 <p className="text-sm text-secondary-color mb-3">
 {duplicates.length === 1
 ? 'The following existing application matches the job you are trying to add:'
 : `The following ${duplicates.length} existing applications match the job you are trying to add:`}
 </p>

 <ul className="space-y-2 max-h-56 overflow-y-auto">
 {duplicates.map((dup) => (
 <li
 key={dup._id}
 className="flex items-start gap-3 rounded-lg border border-theme bg-elevated px-3 py-2.5"
 >
 <div className="flex-1 min-w-0">
<p className="font-medium text-sm text-primary-color truncate">{dup.jobTitle}</p>
  <p className="text-xs text-secondary-color truncate">{dup.companyName}</p>
 {dup.jobUrl && (
 <a
 href={dup.jobUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="text-xs text-blue-500 hover:underline truncate block max-w-full"
 onClick={(e) => e.stopPropagation()}
 >
 {dup.jobUrl}
 </a>
 )}
 <p className="text-xs text-muted-color mt-0.5">Added {formatDate(dup.createdAt)}</p>
 </div>
 <div className="flex-shrink-0 mt-0.5">
 <JobStatusBadge type="application" status={dup.status} />
 </div>
 </li>
 ))}
 </ul>
 </div>

 {/* Footer */}
 <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-theme bg-elevated">
 <button
 ref={cancelBtnRef}
 onClick={onCancel}
 disabled={isSubmitting}
 className="px-4 py-2 text-sm font-medium rounded-lg border border-theme text-secondary-color bg-white hover:bg-[var(--bg-raised)] transition-colors disabled:opacity-50"
 >
 Cancel
 </button>
 <button
 onClick={onAddAnyway}
 disabled={isSubmitting}
 className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
 >
 {isSubmitting && (
 <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
 </svg>
 )}
 Add Anyway
 </button>
 </div>
 </div>
 </div>
 );
};

export default DuplicateJobWarningModal;
