
import React from 'react';
import { JobApplication } from '../../services/jobApi';
import { Link } from 'react-router-dom';

interface RecentActivityWidgetProps {
    jobs: JobApplication[];
}

const statusColors: Record<string, string> = {
    'Applied': 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
    'Interview': 'text-gold-600 bg-gold-100 dark:text-gold-400 dark:bg-gold-900/30',
    'Offer': 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30',
    'Rejected': 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
    'Assessment': 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30',
    'Closed': 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-900/30',
    'Not Applied': 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-900/30',
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

    return (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-100 dark:border-zinc-800 h-full">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
                <Link to="/" className="text-sm hover:underline" style={{color:'var(--accent)'}}>
                    View All
                </Link>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-zinc-800">
                            <th className="pb-3 pl-2">Company</th>
                            <th className="pb-3 hidden sm:table-cell">Role</th>
                            <th className="pb-3">Status</th>
                            <th className="pb-3 text-right pr-2">Updated</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {recentJobs.map(job => (
                            <tr key={job._id} className="group hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                <td className="py-3 pl-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 font-bold text-xs uppercase">
                                            {job.companyName.substring(0, 1)}
                                        </div>
                                        <span className="font-medium text-slate-900 dark:text-white">{job.companyName}</span>
                                    </div>
                                </td>
                                <td className="py-3 text-sm text-slate-600 dark:text-slate-400 hidden sm:table-cell">
                                    {job.jobTitle}
                                </td>
                                <td className="py-3">
                                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusColors[job.status] || statusColors['Not Applied']}`}>
                                        <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-60"></span>
                                        {job.status}
                                    </span>
                                </td>
                                <td className="py-3 text-right text-xs text-slate-500 dark:text-slate-400 pr-2">
                                    {formatTimeAgo(job.updatedAt)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
