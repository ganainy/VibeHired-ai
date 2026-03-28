// client/src/components/ats/AtsInlinePanel.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AtsScores } from '../../services/atsApi';
import Spinner from '../common/Spinner';
import SimpleLoader from '../common/SimpleLoader';

export interface AtsInlinePanelProps {
    atsScores: AtsScores | null;
    isScanning: boolean;
    isLoading: boolean;
    progressMessage?: string;
    hasJobDescription: boolean;
    /** True while a batch apply AI call is in-flight */
    isApplyingBatch: boolean;
    onScan: () => void;
    /** Called with all selected items; parent handles the AI call and CV update */
    onApplyBatch: (items: { suggestion: string; index: number }[]) => Promise<void>;
    onDelete?: () => void;
    onRescan?: () => void;
    /** Hide the internal score/rescan header bar (use when the parent card provides its own header) */
    hideHeader?: boolean;
}

type Priority = 'high' | 'medium' | 'low';

const PRIORITY_COLORS: Record<Priority, { badge: string; border: string }> = {
    high: {
        badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
        border: 'border-l-red-500',
    },
    medium: {
        badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
        border: 'border-l-amber-500',
    },
    low: {
        badge: 'badge badge-ink',
        border: 'border-l-gold-400',
    },
};

const ScoreMini: React.FC<{ score: number }> = ({ score }) => {
    const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
    const r = 30;
    const circ = 2 * Math.PI * r;
    const offset = circ - (circ * score) / 100;
    return (
        <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 flex-shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r={r} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-200 dark:text-gray-700" />
                    <circle cx="40" cy="40" r={r} stroke={color} strokeWidth="8" fill="transparent"
                        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                        className="transition-all duration-700" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{Math.round(score)}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">%</span>
                </div>
            </div>
            <div>
                <p className={`font-semibold text-sm ${score >= 80 ? 'text-green-600 dark:text-green-400' : score >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                    {score >= 80 ? 'Good Fit' : score >= 60 ? 'Moderate Fit' : 'Needs Work'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">ATS Compatibility Score</p>
            </div>
        </div>
    );
};

const AtsInlinePanel: React.FC<AtsInlinePanelProps> = ({
    atsScores,
    isScanning,
    isLoading,
    progressMessage,
    hasJobDescription,
    isApplyingBatch,
    onScan,
    onApplyBatch,
    onDelete,
    onRescan,
    hideHeader = false,
}) => {
    // ── Track which suggestion indices have been successfully applied ─────────
    const [appliedIndices, setAppliedIndices] = useState<Set<number>>(new Set());
    // ── Track which items are currently checked for batch apply ───────────────
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

    // Reset both sets whenever atsScores changes (new scan results)
    useEffect(() => {
        setAppliedIndices(new Set());
        setSelectedIndices(new Set());
    }, [atsScores]);

    // Build a flat indexed list of all applyable items
    const allSuggestions = useMemo(() => {
        if (!atsScores) return [];
        const items: { text: string; type: 'feedback' | 'keyword' | 'skill'; priority?: Priority }[] = [];
        // Actionable feedback
        (atsScores.complianceDetails?.actionableFeedback ?? []).forEach(fb => {
            items.push({ text: fb.action, type: 'feedback', priority: fb.priority as Priority });
        });
        // Missing keywords (prioritized list takes precedence)
        const prioritizedKeywords = atsScores.complianceDetails?.prioritizedMissingKeywords ?? [];
        if (prioritizedKeywords.length > 0) {
            prioritizedKeywords.forEach(pk => items.push({ text: `Add the keyword "${pk.keyword}" to the CV — ${pk.context}`, type: 'keyword', priority: pk.priority as Priority }));
        } else {
            (atsScores.complianceDetails?.keywordsMissing ?? []).forEach(kw => items.push({ text: `Add the missing keyword "${kw}" to the CV`, type: 'keyword' }));
        }
        // Missing skills
        const prioritizedSkills = atsScores.complianceDetails?.prioritizedMissingSkills ?? [];
        if (prioritizedSkills.length > 0) {
            prioritizedSkills.forEach(ps => items.push({ text: `Add the skill "${ps.skill}" to the CV — ${ps.context}`, type: 'skill', priority: ps.priority as Priority }));
        } else {
            (atsScores.skillMatchDetails?.missingSkills ?? []).forEach(sk => items.push({ text: `Add the missing skill "${sk}" to the skills section`, type: 'skill' }));
        }
        return items;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [atsScores]);

    const feedbackWithIdx = allSuggestions
        .map((s, i) => ({ ...s, origIdx: i }))
        .filter(s => s.type === 'feedback' && !appliedIndices.has(s.origIdx));
    const keywordsWithIdx = allSuggestions
        .map((s, i) => ({ ...s, origIdx: i }))
        .filter(s => s.type === 'keyword' && !appliedIndices.has(s.origIdx));
    const skillsWithIdx = allSuggestions
        .map((s, i) => ({ ...s, origIdx: i }))
        .filter(s => s.type === 'skill' && !appliedIndices.has(s.origIdx));

    const remainingItems = [...feedbackWithIdx, ...keywordsWithIdx, ...skillsWithIdx];
    const remainingCount = remainingItems.length;
    const appliedCount = appliedIndices.size;

    const selectedCount = [...selectedIndices].filter(idx => !appliedIndices.has(idx)).length;
    const allSelected = remainingCount > 0 && selectedCount === remainingCount;
    const someSelected = selectedCount > 0;

    const toggleItem = useCallback((origIdx: number) => {
        setSelectedIndices(prev => {
            const next = new Set(prev);
            if (next.has(origIdx)) next.delete(origIdx); else next.add(origIdx);
            return next;
        });
    }, []);

    const toggleAll = useCallback(() => {
        if (allSelected) {
            setSelectedIndices(new Set());
        } else {
            setSelectedIndices(new Set(remainingItems.map(i => i.origIdx)));
        }
    }, [allSelected, remainingItems]);

    const handleApplySelected = useCallback(async () => {
        const items = remainingItems
            .filter(i => selectedIndices.has(i.origIdx))
            .map(i => ({ suggestion: i.text, index: i.origIdx }));
        if (items.length === 0) return;
        await onApplyBatch(items);
        setAppliedIndices(prev => {
            const next = new Set(prev);
            items.forEach(i => next.add(i.index));
            return next;
        });
        setSelectedIndices(new Set());
    }, [remainingItems, selectedIndices, onApplyBatch]);

    const score = atsScores?.score ?? 0;

    // ── Loading / Scanning states ─────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="py-8">
                <SimpleLoader message="Loading ATS scores…" height="auto" />
            </div>
        );
    }

    if (isScanning) {
        return (
            <div className="py-12 flex flex-col items-center justify-center text-center">
                <SimpleLoader
                    message="Analyzing your CV..."
                    description={progressMessage || "This usually takes 15–30 seconds"}
                    height="auto"
                />
            </div>
        );
    }

    if (!atsScores) {
        return (
            <div className="flex flex-col items-center justify-center py-8 px-6 text-center gap-5">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-dim)' }}>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--accent)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                </div>
                <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">ATS Analysis</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                        Scan your tailored CV against the job requirements and get a list of actionable improvements you can apply in one click.
                    </p>
                </div>
                {!hasJobDescription && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 max-w-xs">
                        ⚠️ Please scrape the job description first before running the scan.
                    </p>
                )}
                <button
                    onClick={onScan}
                    disabled={!hasJobDescription}
                    className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 px-5 py-2.5 text-sm"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    Run ATS Scan
                    <span className="text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded-full" style={{ background: '#e8b844', color: '#0e0e17' }}>2 Credit</span>
                </button>
            </div>
        );
    }

    // Row checkbox component
    const RowCheckbox: React.FC<{ origIdx: number }> = ({ origIdx }) => (
        <label className="flex-shrink-0 flex items-center pt-0.5 cursor-pointer" title="Select this improvement">
            <input
                type="checkbox"
                checked={selectedIndices.has(origIdx)}
                onChange={() => toggleItem(origIdx)}
                disabled={isApplyingBatch}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 accent-gold-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            />
        </label>
    );

    return (
        <div className="flex flex-col">
            {/* Optional header — hidden when embedded in parent card */}
            {!hideHeader && (
                <div className="flex-shrink-0 px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                    <div className="flex items-start justify-between gap-3">
                        <ScoreMini score={score} />
                        <div className="flex flex-col gap-1.5 items-end">
                            <button
                                onClick={onRescan ?? onScan}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 transition-all"
                                title="Re-scan ATS (2 credits)"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Re-scan
                                <span className="text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded-full" style={{ background: '#e8b844', color: '#0e0e17' }}>2 Credit</span>
                            </button>
                            {onDelete && (
                                <button onClick={onDelete} className="text-[11px] text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors">
                                    Delete analysis
                                </button>
                            )}
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                        {remainingCount > 0
                            ? <>
                                <span>{remainingCount} improvement{remainingCount !== 1 ? 's' : ''} remaining</span>
                                {appliedCount > 0 && <span className="ml-2 text-green-600 dark:text-green-400">· {appliedCount} applied ✓</span>}
                                <span className="block mt-0.5">Select items and click Apply Selected</span>
                            </>
                            : appliedCount > 0
                                ? <span className="text-green-600 dark:text-green-400">All {appliedCount} improvement{appliedCount !== 1 ? 's' : ''} applied ✓</span>
                                : 'Your CV is well-optimized for this job!'}
                    </p>
                </div>
            )}

            {/* Scrollable suggestions */}
            <div className="overflow-y-auto max-h-[480px] px-4 py-4 space-y-3">

                {/* Compact hint when header is hidden */}
                {hideHeader && remainingCount > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 pb-1">
                        <span className="font-medium text-gray-700 dark:text-gray-300">{remainingCount} improvement{remainingCount !== 1 ? 's' : ''} found.</span>
                        {appliedCount > 0 && <span className="text-green-600 dark:text-green-400 ml-1">{appliedCount} applied ✓ ·</span>}
                        {' '}Select items below and click <span className="font-medium">Apply Selected</span>.
                    </p>
                )}

                {/* Select All + Apply Selected action bar */}
                {remainingCount > 0 && (
                    <div className="flex items-center justify-between gap-2 py-2 px-3 bg-zinc-50 dark:bg-slate-800/60 rounded-lg border border-zinc-100 dark:border-slate-700 sticky top-0 z-10">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={allSelected}
                                ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                onChange={toggleAll}
                                disabled={isApplyingBatch}
                                className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 accent-gold-500 cursor-pointer disabled:opacity-50"
                            />
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {allSelected ? 'Deselect all' : 'Select all'} ({remainingCount})
                            </span>
                        </label>
                        <button
                            onClick={handleApplySelected}
                            disabled={!someSelected || isApplyingBatch}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border
                                ${isApplyingBatch
                                    ? 'cursor-wait'
                                    : !someSelected
                                        ? 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-gray-700 text-gray-500 border-gray-200 dark:border-gray-600'
                                        : 'bg-gold-500 hover:bg-gold-600 text-ink-950 border-transparent shadow-sm'
                                }`}
                        >
                            {isApplyingBatch
                                ? <><Spinner size="sm" /><span className="ml-1">Applying…</span></>
                                : <>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    Apply Selected{someSelected ? ` (${selectedCount})` : ''}
                                    <span className="text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded-full" style={{ background: '#e8b844', color: '#0e0e17' }}>3 Credit</span>
                                </>
                            }
                        </button>
                    </div>
                )}

                {/* All-applied / no-issues empty state */}
                {remainingCount === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center gap-3">
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {appliedCount > 0 ? `All ${appliedCount} improvement${appliedCount !== 1 ? 's' : ''} applied!` : 'No improvements needed'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {appliedCount > 0 ? 'Your CV has been updated. Re-scan to verify the new score.' : 'Your CV looks great for this job!'}
                        </p>
                    </div>
                )}

                {/* Actionable Feedback */}
                {feedbackWithIdx.length > 0 && (
                    <section>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                            Actionable Feedback
                        </h4>
                        <div className="space-y-2">
                            {feedbackWithIdx.map((item) => {
                                const pColors = PRIORITY_COLORS[item.priority ?? 'low'];
                                return (
                                    <div
                                        key={item.origIdx}
                                        className={`flex items-start gap-3 p-3 rounded-lg border border-l-4 border-gray-100 dark:border-gray-700 ${pColors.border} transition-colors
                                            ${selectedIndices.has(item.origIdx) ? 'border-gold-400' : 'bg-white dark:bg-gray-800'}`}
                                    >
                                        <RowCheckbox origIdx={item.origIdx} />
                                        <div className="flex-1 min-w-0">
                                            {item.priority && (
                                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase mb-1 ${pColors.badge}`}>
                                                    {item.priority}
                                                </span>
                                            )}
                                            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{item.text}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Missing Keywords */}
                {keywordsWithIdx.length > 0 && (
                    <section>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                            Missing Keywords
                        </h4>
                        <div className="space-y-2">
                            {keywordsWithIdx.map((item) => (
                                <div
                                    key={item.origIdx}
                                    className={`flex items-start gap-3 p-3 rounded-lg border border-l-4 border-gray-100 dark:border-gray-700 border-l-orange-400 transition-colors
                                        ${selectedIndices.has(item.origIdx) ? 'border-gold-400' : 'bg-white dark:bg-gray-800'}`}
                                >
                                    <RowCheckbox origIdx={item.origIdx} />
                                    <div className="flex-1 min-w-0">
                                        {item.priority && (
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase mb-1 ${PRIORITY_COLORS[item.priority].badge}`}>
                                                {item.priority}
                                            </span>
                                        )}
                                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{item.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Missing Skills */}
                {skillsWithIdx.length > 0 && (
                    <section>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                            Missing Skills
                        </h4>
                        <div className="space-y-2">
                            {skillsWithIdx.map((item) => (
                                <div
                                    key={item.origIdx}
                                    className={`flex items-start gap-3 p-3 rounded-lg border border-l-4 border-gray-100 dark:border-gray-700 border-l-gold-500 transition-colors
                                        ${selectedIndices.has(item.origIdx) ? 'border-gold-400' : 'bg-white dark:bg-gray-800'}`}
                                >
                                    <RowCheckbox origIdx={item.origIdx} />
                                    <div className="flex-1 min-w-0">
                                        {item.priority && (
                                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase mb-1 ${PRIORITY_COLORS[item.priority].badge}`}>
                                                {item.priority}
                                            </span>
                                        )}
                                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{item.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Matched keywords (read-only) */}
                {(atsScores.complianceDetails?.keywordsMatched ?? []).length > 0 && (
                    <section>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                            Matched Keywords
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                            {(atsScores.complianceDetails?.keywordsMatched ?? []).map((kw, i) => (
                                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-[11px] font-medium">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    {kw}
                                </span>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};

export default AtsInlinePanel;
