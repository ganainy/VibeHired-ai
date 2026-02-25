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
                'Applied': { color: 'text-green-600 dark:text-green-400 font-medium', label: 'Applied' },
                'Not Applied': { color: 'text-slate-500 dark:text-slate-400', label: 'Not Applied' },
                'Interview': { color: 'text-blue-600 dark:text-blue-400 font-medium', label: 'Interview' },
                'Assessment': { color: 'text-amber-600 dark:text-amber-400 font-medium', label: 'Assessment' },
                'Rejected': { color: 'text-red-500 dark:text-red-400', label: 'Rejected' },
                'Closed': { color: 'text-slate-400 dark:text-slate-500', label: 'Closed' },
                'Offer': { color: 'text-emerald-600 dark:text-emerald-400 font-semibold', label: 'Offer 🎉' },
            };
            return configs[appStatus];
        } else {
            const genStatus = status as GenerationStatus;
            const configs: Record<GenerationStatus, { color: string; label: string }> = {
                'none': { color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300', label: 'Not Started' },
                'pending_input': { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', label: 'Pending Input' },
                'pending_generation': { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', label: 'Generating' },
                'draft_ready': { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', label: 'Draft Ready' },
                'finalized': { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', label: 'Finalized' },
                'error': { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', label: 'Error' },
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
