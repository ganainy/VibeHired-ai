
import React from 'react';
import { JobApplication } from '../../services/jobApi';
import { Link } from 'react-router-dom';
import { TableOrCards, ColumnDef } from '../common/TableOrCards';

interface RecentActivityWidgetProps {
 jobs: JobApplication[];
}

const statusColors: Record<string, string> = {
'Applied': 'text-green-house bg-[var(--accent-bg)]',
  'Interview': 'text-gold bg-gold-lightest',
  'Offer': 'text-green bg-[var(--jade-bg)]',
  'Rejected': 'text-error bg-[var(--rose-bg)]',
  'Assessment': 'text-ember bg-[var(--ember-bg)]',
  'Closed': 'text-slate-600 bg-slate-100',
  'Not Applied': 'text-slate-600 bg-slate-100',
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

 const columns: ColumnDef<JobApplication>[] = [
 {
 key: 'companyName',
 label: 'Company',
 render: (job) => (
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded flex items-center justify-center font-bold text-xs uppercase" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
 {job.companyName.substring(0, 1)}
 </div>
 <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{job.companyName}</span>
 </div>
 ),
 },
 {
 key: 'jobTitle',
 label: 'Role',
 render: (job) => <span style={{ color: 'var(--text-secondary)' }}>{job.jobTitle}</span>,
 },
 {
 key: 'status',
 label: 'Status',
 render: (job) => (
 <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusColors[job.status] || statusColors['Not Applied']}`}>
 <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-60"></span>
 {job.status}
 </span>
 ),
 },
 {
 key: 'updatedAt',
 label: 'Updated',
 align: 'right',
 render: (job) => <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatTimeAgo(job.updatedAt)}</span>,
 },
 ];

 return (
 <div className="p-6 rounded-lg border h-full transition-all duration-300" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
 <div className="flex justify-between items-center mb-6">
 <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Activity</h3>
 <Link to="/" className="text-sm hover:underline transition-colors" style={{ color: 'var(--accent)' }}>
 View All
 </Link>
 </div>

 <TableOrCards
 data={recentJobs}
 columns={columns}
 emptyMessage="No recent activity found."
 />
 </div>
 );
};
