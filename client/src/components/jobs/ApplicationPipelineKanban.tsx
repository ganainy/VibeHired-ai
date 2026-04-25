// client/src/components/jobs/ApplicationPipelineKanban.tsx
import React, { useState, useMemo } from 'react';
import { JobApplication } from '../../services/jobApi';
import ApplicationCard from './ApplicationCard';
import Spinner from '../common/Spinner';

export type KanbanColumn = 'Saved' | 'Applied' | 'Interviewing' | 'Offer' | 'Rejected';

interface ApplicationPipelineKanbanProps {
 jobs: JobApplication[];
 isLoading?: boolean;
 onCardClick?: (job: JobApplication) => void;
 onStatusChange?: (jobId: string, newStatus: JobApplication['status']) => Promise<void>;
}

// Map Kanban columns to actual job statuses
const statusToColumn: Record<JobApplication['status'], KanbanColumn> = {
 'Not Applied': 'Saved',
 'Applied': 'Applied',
 'Interview': 'Interviewing',
 'Assessment': 'Interviewing',
 'Offer': 'Offer',
 'Rejected': 'Rejected',
 'Closed': 'Rejected',
};

// Map Kanban columns back to job statuses
const columnToStatus: Record<KanbanColumn, JobApplication['status']> = {
 'Saved': 'Not Applied',
 'Applied': 'Applied',
 'Interviewing': 'Interview',
 'Offer': 'Offer',
 'Rejected': 'Rejected',
};

const ApplicationPipelineKanban: React.FC<ApplicationPipelineKanbanProps> = ({
 jobs,
 isLoading = false,
 onCardClick,
 onStatusChange
}) => {
 const [draggedJob, setDraggedJob] = useState<JobApplication | null>(null);
 const [dragOverColumn, setDragOverColumn] = useState<KanbanColumn | null>(null);

 // Helper to check if job has email contact
 const getRecipientEmail = (job: JobApplication): string | null => {
 const direct = job.contactEmail?.trim();
 if (direct) return direct;
 const legacy = job.contact?.trim();
 if (!legacy) return null;
 const match = legacy.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
 return match?.[0] ?? null;
 };

 // Helper to check if job is older than two weeks
 const isOlderThanTwoWeeks = (job: JobApplication): boolean => {
 const anchor = job.dateApplied || job.createdAt;
 if (!anchor) return false;
 const appliedAt = new Date(anchor).getTime();
 if (Number.isNaN(appliedAt)) return false;
 const daysElapsed = Math.floor((Date.now() - appliedAt) / (1000 * 60 * 60 * 24));
 return daysElapsed > 14;
 };

 // Calculate which jobs need follow-up
 const needsFollowUpJobIdSet = useMemo(
 () => new Set(
 jobs
 .filter((job) => job.status === 'Applied' && Boolean(getRecipientEmail(job)) && isOlderThanTwoWeeks(job))
 .map((job) => job._id)
 ),
 [jobs]
 );

 // Group jobs by Kanban column
 const jobsByColumn = useMemo(() => {
 const grouped: Record<KanbanColumn, JobApplication[]> = {
 'Saved': [],
 'Applied': [],
 'Interviewing': [],
 'Offer': [],
 'Rejected': [],
 };

 jobs.forEach(job => {
 const column = statusToColumn[job.status] || 'Saved';
 grouped[column].push(job);
 });

 return grouped;
 }, [jobs]);

 const handleDragStart = (e: React.DragEvent, job: JobApplication) => {
 setDraggedJob(job);
 e.dataTransfer.effectAllowed = 'move';
 };

 const handleDragEnd = () => {
 setDraggedJob(null);
 setDragOverColumn(null);
 };

 const handleDragOver = (e: React.DragEvent, column: KanbanColumn) => {
 e.preventDefault();
 e.dataTransfer.dropEffect = 'move';
 setDragOverColumn(column);
 };

 const handleDragLeave = () => {
 setDragOverColumn(null);
 };

 const handleDrop = async (e: React.DragEvent, targetColumn: KanbanColumn) => {
 e.preventDefault();
 setDragOverColumn(null);

 if (!draggedJob) return;

 const newStatus = columnToStatus[targetColumn];
 const currentColumn = statusToColumn[draggedJob.status];

 if (currentColumn !== targetColumn && onStatusChange) {
 try {
 await onStatusChange(draggedJob._id, newStatus);
 } catch (error) {
 console.error('Failed to update job status:', error);
 }
 }

 setDraggedJob(null);
 };

 const columns: { id: KanbanColumn; title: string; bgColor: string; textColor: string; badgeBg: string; badgeText: string; emptyText: string }[] = [
{
  id: 'Saved',
  title: 'Saved',
  bgColor: 'bg-[var(--bg-raised)]',
  textColor: 'text-secondary-color',
  badgeBg: 'bg-[var(--bg-raised)]',
  badgeText: 'text-primary-color',
  emptyText: 'text-secondary-color'
  },
  {
  id: 'Applied',
  title: 'Applied',
  bgColor: 'bg-[var(--accent-bg)]',
  textColor: 'text-green-house',
  badgeBg: 'bg-[var(--accent-bg)]',
  badgeText: 'text-green-house',
  emptyText: 'text-green-house'
  },
  {
  id: 'Interviewing',
  title: 'Interviewing',
  bgColor: 'bg-yellow-50',
  textColor: 'text-yellow-800',
  badgeBg: 'bg-yellow-100',
  badgeText: 'text-yellow-800',
  emptyText: 'text-yellow-700'
  },
  {
  id: 'Offer',
  title: 'Offer',
  bgColor: 'bg-[var(--jade-bg)]',
  textColor: 'text-green-800',
  badgeBg: 'bg-[var(--jade-bg)]',
  badgeText: 'text-green-800',
  emptyText: 'text-green'
  },
  {
  id: 'Rejected',
  title: 'Rejected',
  bgColor: 'bg-red-50',
  textColor: 'text-red-800',
  badgeBg: 'bg-[var(--rose-bg)]',
  badgeText: 'text-red-800',
  emptyText: 'text-error'
  },
 ];

 if (isLoading) {
 return (
 <div className="flex items-center justify-center h-64">
 <Spinner size="lg" />
 </div>
 );
 }

 return (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
 {columns.map((column) => {
 const columnJobs = jobsByColumn[column.id];
 const isDragOver = dragOverColumn === column.id;

 return (
 <div
 key={column.id}
 className={`
 ${column.bgColor}
 p-4 rounded-lg
 ${isDragOver ? 'ring-2 ring-blue-500' : ''}
 transition-all
 `}
 onDragOver={(e) => handleDragOver(e, column.id)}
 onDragLeave={handleDragLeave}
 onDrop={(e) => handleDrop(e, column.id)}
 >
 <div className="flex justify-between items-center mb-4">
 <h4 className={`font-semibold ${column.textColor}`}>
 {column.title}
 </h4>
 <span className={`text-sm font-bold ${column.badgeBg} ${column.badgeText} rounded-full px-2 py-0.5`}>
 {columnJobs.length}
 </span>
 </div>

 <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
 {columnJobs.length === 0 ? (
 <div className={`text-center py-10`}>
 <p className={`text-sm ${column.emptyText}`}>No applications</p>
 </div>
 ) : (
 columnJobs.map((job) => (
 <ApplicationCard
 key={job._id}
 job={job}
 onCardClick={onCardClick}
 onDragStart={handleDragStart}
 onDragEnd={handleDragEnd}
 needsFollowUp={needsFollowUpJobIdSet.has(job._id)}
 />
 ))
 )}
 </div>
 </div>
 );
 })}
 </div>
 );
};

export default ApplicationPipelineKanban;
