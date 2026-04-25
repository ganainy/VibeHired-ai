// client/src/components/cv-workspace/TailoringChangesPanel.tsx
import React from 'react';

export interface TailoringChange {
 section: string;
 description: string;
 reason: string;
 before?: string;
 after?: string;
}

export interface TailoringChangesPanelProps {
 tailoringChanges: TailoringChange[] | null;
 showInlineCvDiff: boolean;
 onToggleDiff: (show: boolean) => void;
}

/**
 * Collapsible panel listing the AI-driven tailoring changes made to a CV.
 * Placed as a child of `CvEditorPanel` in the workspace CV tab.
 */
const TailoringChangesPanel: React.FC<TailoringChangesPanelProps> = ({
 tailoringChanges,
 showInlineCvDiff,
 onToggleDiff,
}) => {
 if (tailoringChanges === null) return null;

 return (
<div className="mb-6 bg-white rounded-xl border border-theme shadow-sm overflow-hidden">
<details className="group">
<summary className="flex items-center justify-between cursor-pointer p-4 hover:bg-elevated transition-colors border-b border-transparent group-open:border-[var(--border-subtle)]">
 <div className="flex items-center gap-3">
 <div
 className="flex items-center justify-center w-8 h-8 rounded-lg text-green-house shadow-sm"
 style={{ background: 'var(--accent)' }}
 >
 <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
 </div>
 <div>
<h3 className="text-sm font-bold text-primary-color">Tailoring Changes</h3>
<p className="text-xs text-secondary-color">
 {tailoringChanges.length > 0
 ? `${tailoringChanges.length} modification${tailoringChanges.length !== 1 ? 's' : ''} recorded`
 : 'No section-level change details were provided for this version'}
 </p>
 </div>
 </div>

 <div className="flex items-center gap-3">
 <button
 type="button"
 onClick={(e) => {
 e.preventDefault();
 e.stopPropagation();
 onToggleDiff(!showInlineCvDiff);
 }}
 disabled={tailoringChanges.length === 0}
 className="text-xs font-semibold px-2.5 py-1 rounded-md border border-theme hover:bg-[var(--bg-raised)] disabled:opacity-50 disabled:cursor-not-allowed"
 title="Show changed sections directly in CV preview"
 >
 {showInlineCvDiff ? 'Hide Inline Diff' : 'Show Inline Diff'}
 </button>
 <span className="text-muted-color group-open:rotate-180 transition-transform duration-200">
 <span className="material-symbols-outlined text-[20px]">expand_more</span>
 </span>
 </div>
 </summary>

 <div className="p-4 pt-0 divide-y divide-slate-100">
 {tailoringChanges.length === 0 && (
 <div className="py-4 text-sm text-secondary-color">
 This tailored CV was generated, but the model did not return section-level diff details.
 Regenerate to capture richer change details.
 </div>
 )}

 {tailoringChanges.map((change, index) => (
 <div key={index} className="py-4 first:pt-2 last:pb-2">
 <div className="flex flex-col items-start gap-2">
 <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-[var(--bg-raised)] text-secondary-color">
 {change.section}
 </span>
 <div className="w-full space-y-2">
 <p className="text-base text-primary-color leading-snug flex items-start gap-2">
 <span className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: 'var(--accent)' }} />
 {change.reason}
 </p>

 {(change.before || change.after) && (
<details className="mt-3 rounded-xl border border-theme bg-elevated p-3">
<summary className="cursor-pointer text-xs font-semibold text-secondary-color hover:text-primary-color transition-colors">
 View content diff
 </summary>
 <div className="mt-3 space-y-3">
 {change.before && (
 <div className="rounded-lg bg-red-50 p-3 border border-red-100">
 <p className="text-[11px] font-bold uppercase tracking-wide text-error/80 mb-1.5">
 Before
 </p>
<p className="text-sm text-primary-color whitespace-pre-wrap break-words leading-relaxed">
{change.before}
</p>
</div>
)}
{change.after && (
<div className="rounded-lg bg-[var(--jade-bg)] p-3 border border-emerald-100">
<p className="text-[11px] font-bold uppercase tracking-wide text-green/80 mb-1.5">
 After
 </p>
 <p className="text-sm text-primary-color whitespace-pre-wrap break-words leading-relaxed">
 {change.after}
 </p>
 </div>
 )}
 </div>
 </details>
 )}
 </div>
 </div>
 </div>
 ))}
 </div>
 </details>
 </div>
 );
};

export default TailoringChangesPanel;
