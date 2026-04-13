// client/src/components/cv-workspace/AtsAnalysisCard.tsx
import React from 'react';
import AtsInlinePanel from '../ats/AtsInlinePanel';
import { AtsScores } from '../../services/atsApi';

export interface AtsAnalysisCardProps {
  atsScores: AtsScores | null;
  isScanningAts: boolean;
  isLoadingAts: boolean;
  atsProgressMessage: string;
  isApplyingAtsBatch: boolean;
  hasJobDescription: boolean;
  onScan: () => void;
  onApplyBatch: (items: { suggestion: string; index: number }[]) => Promise<void>;
  onDelete?: () => void;
}

/**
 * Collapsible ATS analysis card — score badge, re-scan button, and
 * the detailed `AtsInlinePanel`. Placed as a child of `CvEditorPanel`
 * in the workspace CV tab.
 */
const AtsAnalysisCard: React.FC<AtsAnalysisCardProps> = ({
  atsScores,
  isScanningAts,
  isLoadingAts,
  atsProgressMessage,
  isApplyingAtsBatch,
  hasJobDescription,
  onScan,
  onApplyBatch,
  onDelete,
}) => {
  const totalIssues = atsScores
    ? (atsScores.complianceDetails?.actionableFeedback?.length ?? 0) +
      (atsScores.complianceDetails?.keywordsMissing?.length ?? 0) +
      (atsScores.skillMatchDetails?.missingSkills?.length ?? 0)
    : 0;

  const subtitleText = isScanningAts
    ? 'Scanning…'
    : atsScores
    ? totalIssues > 0
      ? `${totalIssues} improvement${totalIssues !== 1 ? 's' : ''} available`
      : 'Looking good — no issues found'
    : 'Run a scan to check compatibility';

  const score = Math.round(atsScores?.score ?? 0);
  const scoreBadgeClass =
    score >= 80
      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
      : score >= 60
      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';

  return (
    <div className="mb-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
      <details className="group">
        <summary className="flex items-center justify-between cursor-pointer p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors border-b border-transparent group-open:border-zinc-100 dark:group-open:border-zinc-800">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg text-ink-950 shadow-sm"
              style={{ background: 'var(--accent)' }}
            >
              <span className="material-symbols-outlined text-[20px]">troubleshoot</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">ATS Analysis</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{subtitleText}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {atsScores && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreBadgeClass}`}>
                {score}%
              </span>
            )}
            {atsScores && (
              <button
                onClick={(e) => { e.preventDefault(); onScan(); }}
                className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 transition-all"
                title="Re-scan ATS"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-scan
                <span
                  className="text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded-full"
                  style={{ background: '#e8b844', color: '#0e0e17' }}
                >
                  2 Credit
                </span>
              </button>
            )}
            <span className="text-zinc-400 group-open:rotate-180 transition-transform duration-200">
              <span className="material-symbols-outlined text-[20px]">expand_more</span>
            </span>
          </div>
        </summary>

        <AtsInlinePanel
          atsScores={atsScores}
          isScanning={isScanningAts}
          isLoading={isLoadingAts}
          progressMessage={atsProgressMessage}
          hasJobDescription={hasJobDescription}
          isApplyingBatch={isApplyingAtsBatch}
          onScan={onScan}
          onRescan={onScan}
          onApplyBatch={onApplyBatch}
          onDelete={atsScores ? onDelete : undefined}
          hideHeader
        />
      </details>
    </div>
  );
};

export default AtsAnalysisCard;
