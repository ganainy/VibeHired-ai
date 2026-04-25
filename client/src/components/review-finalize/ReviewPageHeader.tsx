import React from 'react';
import { JobApplication } from '../../services/jobApi';
import { JobRecommendation } from '../../services/jobRecommendationApi';
import JobStatusBadge from '../jobs/JobStatusBadge';
import { parseMultipleUrls } from '../../lib/utils';

interface ReviewPageHeaderProps {
 jobApplication: JobApplication;
 recommendation: JobRecommendation | null;
 isLoadingRecommendation: boolean;
 onOpenRecommendationModal: () => void;
 onCalculateMatch: () => void;
 onMarkAsApplied: () => void;
 onDeleteJob: () => void;
}

const formatDate = (dateString?: string) => {
 if (!dateString) return 'N/A';
 try {
 const date = new Date(dateString);
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

 if (diffDays === 0) return 'Today';
 if (diffDays === 1) return 'Yesterday';
 if (diffDays < 7) return `${diffDays} days ago`;

 return date.toLocaleDateString('en-US', {
 year: 'numeric',
 month: 'short',
 day: 'numeric',
 });
 } catch {
 return 'N/A';
 }
};

const ReviewPageHeader: React.FC<ReviewPageHeaderProps> = ({
 jobApplication,
 recommendation,
 isLoadingRecommendation,
 onOpenRecommendationModal,
 onCalculateMatch,
 onMarkAsApplied,
 onDeleteJob,
}) => {
 const jobUrls = parseMultipleUrls(jobApplication.jobUrl || '');

 return (
 <div className="flex flex-col md:flex-row items-start justify-between gap-4 mb-6">
 <div className="flex-1 min-w-0">
 <h1 className="text-2xl font-bold text-primary-color">
 {jobApplication.jobTitle}
 </h1>
 <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-secondary-color mt-1.5">
 <span className="inline-flex items-center gap-1.5">
 <span className="material-symbols-outlined text-[18px]">apartment</span>
 {jobApplication.companyName}
 </span>
 <span className="inline-flex items-center gap-1.5">
 <span className="material-symbols-outlined text-[18px]">schedule</span>
 Created: {formatDate(jobApplication.createdAt)}
 </span>
 </div>
 </div>

 <div className="flex flex-wrap items-start gap-4 md:gap-6 w-full md:w-auto md:flex-shrink-0 mt-4 md:mt-0">
 <div className="text-center">
 <p className="text-xs font-medium text-muted-color uppercase tracking-wider mb-1">Status</p>
 <JobStatusBadge type="application" status={jobApplication.status} />
 </div>

 {recommendation && recommendation.score !== null && recommendation.score !== undefined ? (
 <button
 onClick={onOpenRecommendationModal}
 className="text-center cursor-pointer hover:opacity-80 transition-opacity"
 title="Click to view AI Application Advice"
 >
 <p className="text-xs font-medium text-muted-color uppercase tracking-wider mb-1">Match</p>
 <p className={`text-sm font-semibold ${recommendation.shouldApply
 ? 'text-green'
 : 'text-gold'
 }`}
 >
 {`${recommendation.score}%`}
 </p>
 </button>
 ) : (
 <button
 onClick={onCalculateMatch}
 disabled={isLoadingRecommendation || !jobApplication.jobDescriptionText}
 className="text-center cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
 title={!jobApplication.jobDescriptionText ? 'Add job description first' : 'Click to calculate match (2 credits)'}
 >
 <p className="text-xs font-medium text-muted-color uppercase tracking-wider mb-1">Match</p>
 {isLoadingRecommendation ? (
 <span className="inline-flex items-center gap-1">
 <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
 </span>
 ) : recommendation?.error ? (
 <span className="text-xs px-2 py-0.5 bg-[var(--rose-bg)] text-error rounded-md hover:bg-red-200 transition-colors">
 Retry
 </span>
 ) : (
 <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg cursor-pointer" style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}>
 Calculate
 <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#e8b844', color: '#0e0e17' }}>2 Credit</span>
 </span>
 )}
 </button>
 )}

 {jobUrls.length > 0 && (
 <div className="flex flex-wrap items-center gap-1 gap-y-2">
 {jobUrls.slice(0, 3).map((url, idx) => (
 <a
 key={idx}
 href={url}
 target="_blank"
 rel="noopener noreferrer"
 className="p-3 rounded-lg shadow-sm transition-all flex items-center justify-center hover:scale-105 active:scale-95 self-stretch"
 style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}
 onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-bg-hover)')}
 onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent-bg)')}
 title={`View Job Posting ${jobUrls.length > 1 ? `(${idx + 1})` : ''}: ${url}`}
 >
 <span className="material-symbols-outlined text-[20px]">open_in_new</span>
 {jobUrls.length > 1 && (
 <span className="text-xs ml-0.5">{idx + 1}</span>
 )}
 </a>
 ))}
 {jobUrls.length > 3 && (
 <span className="text-xs text-secondary-color ml-1" title={jobUrls.slice(3).join('\n')}>
 +{jobUrls.length - 3} more
 </span>
 )}
 </div>
 )}

 {jobApplication.status === 'Not Applied' && (
 <button
 onClick={onMarkAsApplied}
 className="px-4 py-3 text-sm font-medium text-white bg-green hover:bg-green-accent rounded-lg shadow-sm transition-all flex items-center gap-1.5 hover:scale-105 active:scale-95 self-stretch"
 title="Mark this job as Applied"
 >
 <span className="material-symbols-outlined text-[18px]">check_circle</span>
 <span>Mark as Applied</span>
 </button>
 )}

 <button
 onClick={onDeleteJob}
 className="p-3 text-error hover:text-error bg-red-50 hover:bg-red-100 rounded-lg shadow-sm transition-all flex items-center justify-center hover:scale-105 active:scale-95 self-stretch"
 title="Delete this job application"
 >
 <span className="material-symbols-outlined text-[20px]">delete</span>
 </button>
 </div>
 </div>
 );
};

export default ReviewPageHeader;
