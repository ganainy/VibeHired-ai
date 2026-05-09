import React from 'react';
import { Link } from 'react-router-dom';
import Spinner from '../common/Spinner';
import CreditsBadge from '../common/CreditsBadge';
import { JobRecommendation } from '../../services/jobRecommendationApi';

interface RecommendationModalProps {
 isOpen: boolean;
 recommendation: JobRecommendation | null;
 isLoadingRecommendation: boolean;
 isRefreshingRecommendation: boolean;
 hasJobDescription: boolean;
 onRefreshRecommendation: () => void;
 onClose: () => void;
}

const RecommendationModal: React.FC<RecommendationModalProps> = ({
 isOpen,
 recommendation,
 isLoadingRecommendation,
 isRefreshingRecommendation,
 hasJobDescription,
 onRefreshRecommendation,
 onClose,
}) => {
 if (!isOpen) {
 return null;
 }

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
 <div className="relative w-full max-w-xl max-h-[80vh] overflow-y-auto rounded-2xl shadow-2xl p-6 bg-white border border-theme">
 <div className="flex items-center gap-3 mb-6">
 <span className={`material-symbols-outlined text-2xl ${recommendation?.shouldApply
? 'text-green'
: recommendation?.error
? 'text-error'
: recommendation && !recommendation.shouldApply
? 'text-ember'
 : 'text-primary'
 }`}>smart_toy</span>
 <h2 className="text-xl font-bold text-text-main-light">AI Application Advice</h2>
 <div className="ml-auto flex items-center gap-2">
 <button
 onClick={onRefreshRecommendation}
 disabled={isLoadingRecommendation || isRefreshingRecommendation || !hasJobDescription}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--bg-raised)] text-secondary-color hover:bg-[var(--bg-raised)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 title={!hasJobDescription ? 'Job description required' : 'Refresh analysis (2 credits)'}
 >
 {isRefreshingRecommendation ? (
 <Spinner size="sm" />
 ) : (
 <span className="material-symbols-outlined text-sm">refresh</span>
 )}
 <span>Refresh</span>
  <CreditsBadge amount="2 Credit" variant="gold" className="ml-1" />
  </button>
  <button
  onClick={onClose}
  className="p-1.5 rounded-full text-secondary-color hover:text-primary-color hover:bg-[var(--bg-raised)] transition-colors"
  title="Close"
  >
  <span className="material-symbols-outlined">close</span>
  </button>
  </div>
  </div>
 
  {isLoadingRecommendation && (
 <div className="flex items-center gap-3 py-8 justify-center">
 <Spinner size="md" />
 <span className="text-secondary-color">Analyzing job match...</span>
 </div>
 )}

 {!isLoadingRecommendation && !hasJobDescription && (
 <div className="flex items-start gap-3 py-4">
 <span className="material-symbols-outlined text-muted-color mt-0.5">info</span>
 <div>
 <p className="text-secondary-color">
 Job description is required to provide AI application advice.
 </p>
 <p className="mt-2 text-sm text-secondary-color">
 Go to the Job Description tab and paste the job description.
 </p>
 </div>
 </div>
 )}

 {!isLoadingRecommendation && recommendation?.error && recommendation.error.toLowerCase().includes('cv') && (
 <div className="flex items-start gap-3 py-4">
 <span className="material-symbols-outlined text-ember mt-0.5">upload_file</span>
 <div>
 <p className="text-sm font-medium text-ember mb-1">CV Required</p>
 <p className="text-sm text-ember mb-3">
 Please upload a CV first to get AI-powered application advice.
 </p>
 <Link
 to="/manage-cv"
 onClick={onClose}
 className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors"
 >
 <span className="material-symbols-outlined text-sm">description</span>
 <span>Upload CV</span>
 </Link>
 </div>
 </div>
 )}

 {!isLoadingRecommendation && recommendation?.error && !recommendation.error.toLowerCase().includes('cv') && (
 <div className="flex items-start gap-3 py-4">
 <span className="material-symbols-outlined text-error mt-0.5">error</span>
 <div>
 <p className="text-sm font-medium text-error mb-1">Analysis Error</p>
 <p className="text-sm text-error">{recommendation.error}</p>
 </div>
 </div>
 )}

 {!isLoadingRecommendation && recommendation && !recommendation.error && (
 <div className="space-y-5">
 <div className={`flex items-center gap-4 p-5 rounded-xl ${recommendation.shouldApply
? 'bg-[var(--jade-bg)]'
: 'bg-[var(--ember-bg)]'
 }`}>
 <div className={`flex items-center justify-center w-14 h-14 rounded-full ${recommendation.shouldApply ? 'bg-green' : 'bg-amber-500'
 }`}>
 <span className="material-symbols-outlined text-white text-3xl">
 {recommendation.shouldApply ? 'thumb_up' : 'warning'}
 </span>
 </div>
 <div className="flex-1">
 <p className={`text-xl font-bold ${recommendation.shouldApply
? 'text-green'
: 'text-ember'
 }`}>
 {recommendation.shouldApply ? 'Apply!' : 'Consider Carefully'}
 </p>
 {recommendation.score !== null && (
 <p className={`text-sm ${recommendation.shouldApply
 ? 'text-green'
 : 'text-ember'
 }`}>
 Match Score: <span className="font-bold text-lg">{recommendation.score}%</span>
 </p>
 )}
 </div>
 </div>

 <div>
 <p className="text-sm font-medium text-text-main-light mb-2">Why?</p>
 <p className="text-sm text-text-sub-light leading-relaxed">
 {recommendation.reason}
 </p>
 </div>

 {recommendation.keywordAnalysis && (
 recommendation.keywordAnalysis.matchedKeywords.length > 0 ||
 recommendation.keywordAnalysis.missingKeywords.length > 0
 ) && (
 <div className="pt-4 border-t border-theme">
 <p className="text-sm font-medium text-text-main-light mb-3">
 Keyword Analysis
 </p>
 <p className="text-xs text-text-sub-light mb-3">
 <span className="text-green font-medium">Matched</span> keywords in your CV |
 <span className="text-ember font-medium"> Missing</span> from your CV
 </p>
 <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto custom-scrollbar">
 {recommendation.keywordAnalysis.matchedKeywords.map((keyword, idx) => (
 <span
 key={`matched-${idx}`}
 className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--jade-bg)] text-green border border-green-200"
 >
 {keyword}
 </span>
 ))}
 {recommendation.keywordAnalysis.missingKeywords.map((keyword, idx) => (
 <span
 key={`missing-${idx}`}
 className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--ember-bg)] text-ember border border-[var(--ember)]"
 >
 {keyword}
 </span>
 ))}
 </div>
 </div>
 )}

 {recommendation.cached && recommendation.cachedAt && (
 <p className="text-xs text-muted-color pt-2">
 Last analyzed: {new Date(recommendation.cachedAt).toLocaleDateString('en-US', {
 month: 'short',
 day: 'numeric',
 hour: '2-digit',
 minute: '2-digit'
 })}
 </p>
 )}
 </div>
 )}

 {!isLoadingRecommendation && !recommendation && hasJobDescription && (
 <div className="flex flex-col items-center justify-center py-8 gap-4">
 <span className="material-symbols-outlined text-muted-color text-4xl">auto_awesome</span>
 <p className="text-secondary-color text-center">
 AI recommendation not yet generated.
 </p>
 <button
 onClick={onRefreshRecommendation}
 disabled={isRefreshingRecommendation}
 className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-green-house hover:bg-primaryLight disabled:opacity-50 transition-colors"
 >
 {isRefreshingRecommendation ? (
 <Spinner size="sm" />
 ) : (
 <span className="material-symbols-outlined text-sm">auto_awesome</span>
 )}
 <span>Generate Recommendation</span>
  <CreditsBadge amount="2 Credit" variant="gold" className="ml-1" />
  </button>
  </div>
  )}
  </div>
  </div>
  );
};

export default RecommendationModal;
