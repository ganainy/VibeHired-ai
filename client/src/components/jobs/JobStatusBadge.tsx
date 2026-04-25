// client/src/components/jobs/JobStatusBadge.tsx
import React from 'react';

type ApplicationStatus = 'Applied' | 'Not Applied' | 'Interview' | 'Assessment' | 'Rejected' | 'Closed' | 'Offer';
type GenerationStatus = 'none' | 'pending_input' | 'pending_generation' | 'draft_ready' | 'finalized' | 'error';

interface JobStatusBadgeProps {
 type: 'application' | 'generation';
 status: ApplicationStatus | GenerationStatus;
 className?: string;
}

const JobStatusBadge: React.FC<JobStatusBadgeProps> = ({ type, status, className = '' }) => {
 const getStatusConfig = () => {
 if (type === 'application') {
 const appStatus = status as ApplicationStatus;
 // Each status gets a distinctive color
 const configs: Record<ApplicationStatus, { color: string; label: string }> = {
'Applied': { color: 'text-green font-medium', label: 'Applied' },
  'Not Applied': { color: 'text-muted-color', label: 'Not Applied' },
  'Interview': { color: 'text-green-house font-medium', label: 'Interview' },
  'Assessment': { color: 'text-ember font-medium', label: 'Assessment' },
  'Rejected': { color: 'text-error', label: 'Rejected' },
  'Closed': { color: 'text-muted-color', label: 'Closed' },
  'Offer': { color: 'text-green font-semibold', label: 'Offer 🎉' },
 };
 return configs[appStatus];
 } else {
 const genStatus = status as GenerationStatus;
 const configs: Record<GenerationStatus, { color: string; label: string }> = {
 'none': { color: 'text-secondary-color', label: 'Not Started' },
'pending_input': { color: 'bg-yellow-100 text-yellow-800', label: 'Pending Input' },
  'pending_generation': { color: 'bg-[var(--accent-bg)] text-green-house', label: 'Generating' },
  'draft_ready': { color: 'bg-[var(--jade-bg)] text-green-800', label: 'Draft Ready' },
  'finalized': { color: 'bg-[var(--jade-bg)] text-green', label: 'Finalized' },
  'error': { color: 'bg-[var(--rose-bg)] text-red-800', label: 'Error' },
 };
 return configs[genStatus];
 }
 };

 const config = getStatusConfig();

 // For application status, render as plain text (no badge styling)
 if (type === 'application') {
 return (
 <span className={`text-sm ${config.color} ${className}`}>
 {config.label}
 </span>
 );
 }

 // For generation status, keep the badge styling
 return (
 <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color} ${className}`}>
 {config.label}
 </span>
 );
};

export default JobStatusBadge;
