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
      bgColor: 'bg-gray-100 dark:bg-zinc-900/50',
      textColor: 'text-gray-700 dark:text-gray-300',
      badgeBg: 'bg-gray-200 dark:bg-zinc-700',
      badgeText: 'text-gray-800 dark:text-gray-200',
      emptyText: 'text-gray-500 dark:text-gray-400'
    },
    {
      id: 'Applied',
      title: 'Applied',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      textColor: 'text-blue-800 dark:text-blue-300',
      badgeBg: 'bg-blue-100 dark:bg-blue-900',
      badgeText: 'text-blue-800 dark:text-blue-200',
      emptyText: 'text-blue-700 dark:text-blue-400'
    },
    {
      id: 'Interviewing',
      title: 'Interviewing',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      textColor: 'text-yellow-800 dark:text-yellow-300',
      badgeBg: 'bg-yellow-100 dark:bg-yellow-900',
      badgeText: 'text-yellow-800 dark:text-yellow-200',
      emptyText: 'text-yellow-700 dark:text-yellow-400'
    },
    {
      id: 'Offer',
      title: 'Offer',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      textColor: 'text-green-800 dark:text-green-300',
      badgeBg: 'bg-green-100 dark:bg-green-900',
      badgeText: 'text-green-800 dark:text-green-200',
      emptyText: 'text-green-700 dark:text-green-400'
    },
    {
      id: 'Rejected',
      title: 'Rejected',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      textColor: 'text-red-800 dark:text-red-300',
      badgeBg: 'bg-red-100 dark:bg-red-900',
      badgeText: 'text-red-800 dark:text-red-200',
      emptyText: 'text-red-700 dark:text-red-400'
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
              ${isDragOver ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''}
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
