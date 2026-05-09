import React from 'react';
import { JobApplication } from '../../services/jobApi';
import { JobRecommendation } from '../../services/jobRecommendationApi';
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

  const statusConfig: Record<string, { text: string; colorClass: string }> = {
    'Applied': { text: 'Applied', colorClass: 'text-[#006241]' },
    'Not Applied': { text: 'Not Applied', colorClass: 'text-[rgba(0,0,0,0.38)]' },
    'Interview': { text: 'Interview', colorClass: 'text-[#006241]' },
    'Assessment': { text: 'Assessment', colorClass: 'text-[#d4a017]' },
    'Rejected': { text: 'Rejected', colorClass: 'text-[#c82014]' },
    'Closed': { text: 'Closed', colorClass: 'text-[rgba(0,0,0,0.38)]' },
    'Offer': { text: 'Offer', colorClass: 'text-[#006241]' },
  };

  const status = statusConfig[jobApplication.status] || { text: jobApplication.status, colorClass: 'text-[rgba(0,0,0,0.38)]' };

  return (
    <div className="bg-white rounded-t-card overflow-hidden">
      {/* Top row */}
      <div className="px-6 py-5 md:px-8 md:py-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
        {/* Left: Title + Meta */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-extrabold text-[rgba(0,0,0,0.87)] leading-tight mb-1.5 tracking-tight">
            {jobApplication.jobTitle}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[rgba(0,0,0,0.58)] font-medium">
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-lg">corporate_fare</span>
              {jobApplication.companyName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-lg">schedule</span>
              Created: {formatDate(jobApplication.createdAt)}
            </span>
          </div>
        </div>

        {/* Right: Status + Match + Actions */}
        <div className="flex flex-wrap items-center gap-5 md:gap-6">
          {/* Status */}
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[rgba(0,0,0,0.38)] mb-0.5">
              Status
            </span>
            <span className={`text-lg font-bold ${status.colorClass}`}>
              {status.text}
            </span>
          </div>

          {/* Match */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[rgba(0,0,0,0.38)] mb-0.5">
              Match
            </span>
            {recommendation && recommendation.score !== null && recommendation.score !== undefined ? (
              <button
                onClick={onOpenRecommendationModal}
                className="flex items-center gap-2 px-4 py-1.5 border border-[#006241] text-[#006241] hover:bg-[rgba(0,98,65,0.05)] rounded-pill font-bold transition-all group"
                title="Click to view AI Application Advice"
              >
                <span className="text-sm">{recommendation.score}%</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 ${recommendation.shouldApply ? 'bg-[#E9F0EE] text-[#00623E]' : 'bg-[#fdf8ed] text-[#8a6d2b]'}`}>
                  {recommendation.shouldApply ? 'Good Fit' : 'Low Fit'}
                </span>
              </button>
            ) : (
              <button
                onClick={onCalculateMatch}
                disabled={isLoadingRecommendation || !jobApplication.jobDescriptionText}
                className="flex items-center gap-2 px-4 py-1.5 border border-[#006241] text-[#006241] hover:bg-[rgba(0,98,65,0.05)] rounded-pill font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title={!jobApplication.jobDescriptionText ? 'Add job description first' : 'Click to calculate match (2 credits)'}
              >
                {isLoadingRecommendation ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                    <span className="text-sm">Calculating...</span>
                  </span>
                ) : recommendation?.error ? (
                  <span className="text-sm">Retry</span>
                ) : (
                  <>
                    <span className="text-sm">Calculate</span>
                    <span className="bg-[#E9F0EE] px-2 py-0.5 rounded-full text-[11px] text-[#00623E] flex items-center gap-1">
                      2 <span className="material-symbols-outlined text-[12px]">monetization_on</span>
                    </span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 ml-0 md:ml-1">
            {jobUrls.length > 0 && (
              <a
                href={jobUrls[0]}
                target="_blank"
                rel="noopener noreferrer"
                className="w-11 h-11 flex items-center justify-center border border-[rgba(0,98,65,0.2)] rounded-xl text-[#006241] hover:bg-[#006241] hover:text-white transition-all duration-200"
                title={`View Job Posting${jobUrls.length > 1 ? ` (${jobUrls.length} URLs)` : ''}`}
              >
                <span className="material-symbols-outlined text-[20px]">open_in_new</span>
              </a>
            )}

            {jobApplication.status === 'Not Applied' && (
              <button
                onClick={onMarkAsApplied}
                className="w-11 h-11 flex items-center justify-center bg-[rgba(0,98,65,0.08)] text-[#006241] hover:bg-[#006241] hover:text-white transition-all duration-200 rounded-xl"
                title="Mark this job as Applied"
              >
                <span className="material-symbols-outlined text-[20px]">check_circle</span>
              </button>
            )}

            <button
              onClick={onDeleteJob}
              className="w-11 h-11 flex items-center justify-center bg-[rgba(200,32,20,0.08)] text-[#c82014] hover:bg-[#c82014] hover:text-white transition-all duration-200 rounded-xl"
              title="Delete this job application"
            >
              <span className="material-symbols-outlined text-[20px]">delete_outline</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewPageHeader;
