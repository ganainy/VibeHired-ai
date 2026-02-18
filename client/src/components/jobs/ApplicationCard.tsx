// client/src/components/jobs/ApplicationCard.tsx
import React, { useState } from 'react';
import { JobApplication } from '../../services/jobApi';
import JobStatusBadge from './JobStatusBadge';

interface ApplicationCardProps {
  job: JobApplication;
  onCardClick?: (job: JobApplication) => void;
  onDragStart?: (e: React.DragEvent, job: JobApplication) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const ApplicationCard: React.FC<ApplicationCardProps> = ({
  job,
  onCardClick,
  onDragStart,
  onDragEnd
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

  const handleClick = (e: React.MouseEvent) => {
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
    </div>
  );
};

export default ApplicationCard;
