import React, { useState } from 'react';
import { JobRecommendation } from '../../services/jobRecommendationApi';
import CreditsBadge from '../common/CreditsBadge';

interface JobRecommendationBadgeProps {
 recommendation: JobRecommendation | null;
 isLoading?: boolean;
 className?: string;
 onRetry?: () => void;
 jobId?: string;
}

const JobRecommendationBadge: React.FC<JobRecommendationBadgeProps> = ({
 recommendation,
 isLoading = false,
 className = '',
 onRetry,
 jobId
}) => {
 void jobId;
 const [showTooltip, setShowTooltip] = useState(false);
 const [isRetrying, setIsRetrying] = useState(false);

 if (isLoading) {
 return (
 <div className={`inline-flex items-center gap-2 ${className}`}>
 <div className="animate-pulse bg-slate-200 rounded-full h-6 w-16"></div>
 </div>
 );
 }

 if (!recommendation) {
 const handleRetry = async () => {
 if (onRetry && !isRetrying) {
 setIsRetrying(true);
 try {
 await onRetry();
 } finally {
 setIsRetrying(false);
 }
 }
 };

 return (
 <div className={`inline-flex items-center gap-2 ${className}`}>
 <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-secondary-color`} style={{ background: 'var(--bg-elevated)' }}>
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <span>Not analyzed</span>
 </div>
 {onRetry && (
 <button
 onClick={handleRetry}
 disabled={isRetrying}
 className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1 transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
 style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}
 title="Calculate skill match"
 >
 {isRetrying ? (
 <>
 <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 <span>Calculating...</span>
 </>
 ) : (
 <>
 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
 </svg>
 <span>Calculate</span>
  <CreditsBadge amount="2 Credit" variant="gold" />
 </>
 )}
 </button>
 )}
 </div>
 );
 }

 // Check if there's an error (either in error field or reason contains error indicators)
 const hasError = recommendation.error ||
 (recommendation.reason && (
 recommendation.reason.includes('failed:') ||
 recommendation.reason.includes('Analysis completed but relevance check failed') ||
 recommendation.reason.includes('Error') ||
 recommendation.reason.includes('ECONNRESET') ||
 recommendation.reason.includes('quota') ||
 recommendation.reason.includes('timeout')
 ));

 if (hasError) {
 const errorMessage = recommendation.error || recommendation.reason || 'Analysis failed';
 const handleRetry = async () => {
 if (onRetry && !isRetrying) {
 setIsRetrying(true);
 try {
 await onRetry();
 } finally {
 setIsRetrying(false);
 }
 }
 };

 return (
 <div className={`inline-flex items-center gap-2 ${className}`}>
 <div
 className={`relative inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--rose-bg)] text-red-800 ${onRetry ? 'cursor-help' : ''}`}
 onMouseEnter={() => setShowTooltip(true)}
 onMouseLeave={() => setShowTooltip(false)}
 >
 <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
 </svg>
 <span>Failed</span>
 {showTooltip && (
 <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-lg whitespace-pre-line max-w-xs pointer-events-none">
 <div className="font-semibold mb-1">Analysis Error</div>
 {errorMessage}
 <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
 <div className="border-4 border-transparent border-t-slate-900"></div>
 </div>
 </div>
 )}
 </div>
 {onRetry && (
 <button
 onClick={handleRetry}
 disabled={isRetrying}
 className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1 transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
 style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}
 title="Retry skill match calculation"
 >
 {isRetrying ? (
 <>
 <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 <span>Retrying...</span>
 </>
 ) : (
 <>
 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
 </svg>
 <span>Retry</span>
 </>
 )}
 </button>
 )}
 </div>
 );
 }

 // Handle cases where score is null or undefined (still calculating)
 if (recommendation.score === null || recommendation.score === undefined) {
 return (
 <div className={`inline-flex items-center gap-2 ${className}`}>
 <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
 <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 <span>Calculating...</span>
 </div>
 </div>
 );
 }

 // Determine badge configuration based on score
 let badgeConfig: {
 bgColor: string;
 textColor: string;
 borderColor: string;
 icon: React.ReactNode;
 label: string;
 progressColor: string;
 };

 if (recommendation.score >= 70) {
 badgeConfig = {
 bgColor: 'bg-[var(--jade-bg)]',
 textColor: 'text-green-800',
 borderColor: 'border-transparent',
 progressColor: 'bg-green',
 label: 'Strong Match',
 icon: (
 <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
 </svg>
 )
 };
 } else if (recommendation.score >= 50) {
 badgeConfig = {
 bgColor: '',
 textColor: '',
 borderColor: 'border-transparent',
 progressColor: 'bg-gold',
 label: 'Moderate Match',
 icon: (
 <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" style={{color:'var(--accent)'}}>
 <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
 </svg>
 )
 };
 } else {
 badgeConfig = {
 bgColor: 'bg-[var(--rose-bg)]',
 textColor: 'text-red-800',
 borderColor: 'border-transparent',
 progressColor: 'bg-red-500',
 label: 'Weak Match',
 icon: (
 <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
 </svg>
 )
 };
 }

 return (
 <div
 className={`relative inline-flex items-center ${className}`}
 onMouseEnter={() => setShowTooltip(true)}
 onMouseLeave={() => setShowTooltip(false)}
 >
 <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeConfig.bgColor} ${badgeConfig.textColor} ${badgeConfig.borderColor} cursor-help transition-all hover:opacity-80`}
 style={recommendation.score >= 50 && recommendation.score < 70 ? {background:'var(--accent-bg)', color:'var(--accent)', borderColor:'var(--accent-dim)'} : {}}>
 {badgeConfig.icon}
 <span>{recommendation.score}%</span>
 <span className="opacity-75">•</span>
 <span className="truncate max-w-[100px]">{badgeConfig.label}</span>
 </div>

 {showTooltip && (
 <div className="absolute z-[100] right-full top-1/2 transform -translate-y-1/2 mr-2 w-72 pointer-events-none">
 <div className="bg-slate-900 text-white rounded-lg shadow-xl overflow-hidden" style={{background:'var(--bg-raised)', color:'var(--text-primary)'}}>
 {/* Header */}
 <div className={`px-4 py-2 ${badgeConfig.progressColor} bg-opacity-90`}>
 <div className="flex items-center justify-between">
 <span className="text-sm font-semibold">Match Analysis</span>
 <span className="text-lg font-bold">{recommendation.score}%</span>
 </div>
 </div>

 {/* Content */}
 <div className="px-4 py-3 space-y-2">
 <div>
 <div className="text-xs font-semibold mb-1" style={{color:'var(--text-muted)'}}>Recommendation</div>
 <div className="text-sm leading-relaxed" style={{color:'var(--text-secondary)'}}>{recommendation.reason}</div>
 </div>

 {recommendation.cached && recommendation.cachedAt && (
 <div className="pt-2 border-t" style={{borderColor:'var(--border)'}}>
 <div className="flex items-center gap-1.5 text-xs" style={{color:'var(--text-muted)'}}>
 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <span>Analyzed: {new Date(recommendation.cachedAt).toLocaleDateString('en-US', {
 month: 'short',
 day: 'numeric',
 year: 'numeric',
 hour: '2-digit',
 minute: '2-digit'
 })}</span>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Arrow pointing right */}
 <div className="absolute top-1/2 left-full transform -translate-y-1/2 -ml-1">
 <div className="border-8 border-transparent" style={{borderLeftColor:'var(--bg-raised)'}}></div>
 </div>
 </div>
 )}
 </div>
 );
};

export default JobRecommendationBadge;
