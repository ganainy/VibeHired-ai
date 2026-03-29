// client/src/components/jobs/ApplicationCard.tsx
import React, { useState } from 'react';
import { JobApplication } from '../../services/jobApi';
import JobStatusBadge from './JobStatusBadge';

interface ApplicationCardProps {
  job: JobApplication;
  onCardClick?: (job: JobApplication) => void;
  onDragStart?: (e: React.DragEvent, job: JobApplication) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  needsFollowUp?: boolean;
}

const ApplicationCard: React.FC<ApplicationCardProps> = ({
  job,
  onCardClick,
  onDragStart,
  onDragEnd,
  needsFollowUp = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartTime = React.useRef<number>(0);

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDateText = () => {
    if (job.dateApplied) {
      return `Applied on ${formatDate(job.dateApplied)}`;
    }
    if (job.createdAt) {
      return `Saved on ${formatDate(job.createdAt)}`;
    }
    return null;
  };

  const handleDragStart = (e: React.DragEvent) => {
    dragStartTime.current = Date.now();
    setIsDragging(true);
    onDragStart?.(e, job);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setTimeout(() => {
      setIsDragging(false);
    }, 100);
    onDragEnd?.(e);
  };

  const handleClick = () => {
    const timeSinceDragStart = Date.now() - dragStartTime.current;
    if (timeSinceDragStart > 200 || !isDragging) {
      onCardClick?.(job);
    }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      className={`
        bg-white dark:bg-zinc-800
        p-4 rounded-lg border border-gray-200 dark:border-zinc-700 shadow-sm
        cursor-pointer hover:shadow-md transition-shadow
        mb-3 overflow-hidden
        ${isDragging ? 'opacity-50' : ''}
      `}
    >
      <h5 className="font-semibold text-gray-900 dark:text-white mb-1 break-words">{job.jobTitle}</h5>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 break-words">{job.companyName}</p>
      <div className="flex flex-col text-xs">
        <span className="text-gray-500 dark:text-gray-400 mb-1">{getDateText()}</span>
        <JobStatusBadge type="application" status={job.status} />
      </div>
      {(job.notes && job.notes.trim()) || needsFollowUp ? (
        <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-200 dark:border-zinc-700">
          {job.notes && job.notes.trim() && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Note
            </span>
          )}
          {needsFollowUp && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 4.26a2.25 2.25 0 002.22 0L21 8M5.25 19.5h13.5A2.25 2.25 0 0021 17.25V6.75A2.25 2.25 0 0018.75 4.5H5.25A2.25 2.25 0 003 6.75v10.5A2.25 2.25 0 005.25 19.5z" />
              </svg>
              Follow-up
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default ApplicationCard;
