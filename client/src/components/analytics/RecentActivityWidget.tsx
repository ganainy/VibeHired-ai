import React from 'react';
import { JobApplication } from '../../services/jobApi';
import { Link } from 'react-router-dom';
import { DataTable, DataTableColumn } from '../common/DataTable';

interface RecentActivityWidgetProps {
  jobs: JobApplication[];
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  'Applied': {
    bg: 'rgba(0, 98, 65, 0.08)',
    text: '#006241',
    dot: '#22c55e',
  },
  'Interview': {
    bg: 'rgba(59, 130, 246, 0.08)',
    text: '#2563eb',
    dot: '#3b82f6',
  },
  'Offer': {
    bg: 'rgba(0, 98, 65, 0.12)',
    text: '#006241',
    dot: '#10b981',
  },
  'Rejected': {
    bg: 'rgba(200, 32, 20, 0.08)',
    text: '#c82014',
    dot: '#ef4444',
  },
  'Assessment': {
    bg: 'rgba(168, 85, 247, 0.08)',
    text: '#9333ea',
    dot: '#a855f7',
  },
  'Closed': {
    bg: 'var(--bg-elevated)',
    text: 'var(--text-secondary)',
    dot: '#9ca3af',
  },
  'Not Applied': {
    bg: 'var(--bg-elevated)',
    text: 'var(--text-secondary)',
    dot: '#9ca3af',
  },
};

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "y ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "mo ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "d ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "h ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "m ago";
  return "Just now";
};

export const RecentActivityWidget: React.FC<RecentActivityWidgetProps> = ({ jobs }) => {
  // Get 5 most recently updated jobs
  const recentJobs = React.useMemo(() => {
    return [...jobs]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [jobs]);

  const configFor = (status: string) => statusConfig[status] || statusConfig['Not Applied'];

  const columns: DataTableColumn<JobApplication>[] = [
    {
      key: 'companyName',
      label: 'Company',
      render: (job) => (
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold uppercase"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
          >
            {job.companyName.substring(0, 1)}
          </div>
          <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
            {job.companyName}
          </span>
        </div>
      ),
    },
    {
      key: 'jobTitle',
      label: 'Role',
      render: (job) => (
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {job.jobTitle}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (job) => {
        const cfg = configFor(job.status);
        return (
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-[11px] font-bold"
            style={{ background: cfg.bg, color: cfg.text }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: cfg.dot }}
            />
            {job.status}
          </span>
        );
      },
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      align: 'right',
      render: (job) => (
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          {formatTimeAgo(job.updatedAt)}
        </span>
      ),
    },
  ];

  return (
    <div
      className="p-8 rounded-xl h-full transition-all duration-300"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
      }}
    >
      <div className="flex justify-between items-center mb-6">
        <h3
          className="font-bold text-lg"
          style={{ color: 'var(--text-primary)', fontFamily: "'Manrope', sans-serif" }}
        >
          Recent Activity
        </h3>
        <Link
          to="/"
          className="text-sm font-bold hover:underline transition-colors"
          style={{ color: 'var(--accent)' }}
        >
          View All
        </Link>
      </div>

      <DataTable
        data={recentJobs}
        columns={columns}
        emptyMessage="No recent activity found."
      />
    </div>
  );
};
