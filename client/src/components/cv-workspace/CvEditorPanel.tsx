import React, { useRef, useState, useEffect } from 'react';
import { Button } from '../common';
import CvDocumentRenderer from '../cv-editor/CvDocumentRenderer';

import { hasMeaningfulContent } from '../../utils/hasMeaningfulContent';
import { JsonResumeSchema } from '../../../../server/src/types/jsonresume';
import { SectionAnalysisResult } from '../../services/analysisApi';
import RawPdfPlaceholder from './RawPdfPlaceholder';

const showToast = (message: string, _type: 'success' | 'error' | 'info' = 'info') => {
 console.log(`[${_type.toUpperCase()}] ${message}`);
 alert(message);
};

export type CvSaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface CvEditorPanelProps {
 /** Unified CV data in JsonResume format */
 data: JsonResumeSchema | null;
 /** Called on every edit */
 onChange: (data: JsonResumeSchema) => void;
 /** Called when the user clicks Save */
 onSave: () => Promise<void> | void;
 /** Save lifecycle status */
 saveStatus?: CvSaveStatus;
 /** Whether there are unsaved edits */
 hasUnsavedChanges?: boolean;
 /** Optional content rendered above the editor panel */
 children?: React.ReactNode;
 /** Called when the user clicks Delete */
 onDelete?: () => void;
 /** Called when the user wants to download the original PDF (e.g. for non-JsonResume CVs) */
 onDownload?: () => void;
 className?: string;
 /** Optional ATS analysis panel */
 atsPanel?: React.ReactNode;
 /** Which view to show by default */
 defaultRightView?: 'preview' | 'ats';

 // ── PDF editing props ───────────────────────────────────────────────────
 pdfBase64?: string | null;
 pdfFilename?: string | null;
 onPdfSave?: (updatedPdfBase64: string) => Promise<void> | void;
 isPdfSaving?: boolean;
 isLoadingPdf?: boolean;

 // ── Structured editor props (forwarded to CvDocumentRenderer) ───────────
 analyses?: Record<string, SectionAnalysisResult[]>;
 onImproveSection?: (sectionName: string, sectionIndex: number, originalData: any, instructions?: string) => void;
 improvingSections?: Record<string, boolean>;

 // ── Dynamic editor props (kept for backward compat) ──────────────────────
 cvDescriptor?: any;
 cvData?: any;
 onDynamicChange?: (payload: any) => void;
 diffChanges?: any[];
 showDiffOverlay?: boolean;
 cvId?: string;
}

const CvEditorPanel: React.FC<CvEditorPanelProps> = ({
 data,
 onChange,
 onSave,
 saveStatus = 'idle',
 hasUnsavedChanges = false,
 children,
 onDelete,
 onDownload,
 className = '',
 atsPanel,
 defaultRightView = 'preview',
 pdfBase64,
 pdfFilename,
 onPdfSave,
 isPdfSaving = false,
 isLoadingPdf = false,
 analyses,
 onImproveSection,
 improvingSections,
}) => {
 const [rightView] = useState<'preview' | 'ats'>(atsPanel ? defaultRightView : 'preview');
 const scrollContainerRef = useRef<HTMLDivElement>(null);
 const [currentPage, setCurrentPage] = useState(0);
 const [totalPages, setTotalPages] = useState(1);

 // A4 at 96 dpi = 794px wide. Gap between pages when horizontally paginated.
 const PAGE_WIDTH = 794;
 const PAGE_GAP = 32;
 const STEP = PAGE_WIDTH + PAGE_GAP; // 826px

 const saveStatusConfig: Record<CvSaveStatus, { label: string; color: string } | null> = {
 idle: hasUnsavedChanges ? { label: 'Unsaved changes', color: 'amber' } : null,
 saving: { label: 'Saving…', color: 'blue' },
 saved: { label: 'Saved ✓', color: 'green' },
 error: { label: 'Save failed', color: 'red' },
 };
 const statusDisplay = saveStatusConfig[saveStatus];

 const isPdfEditing = Boolean(pdfBase64 && onPdfSave && !hasMeaningfulContent(data));

 // Recalculate total pages whenever data changes or the container resizes.
 useEffect(() => {
 if (!data || !scrollContainerRef.current) return;

 const container = scrollContainerRef.current;

 const recalc = () => {
 // scrollWidth reflects the true rendered width of all pages laid out
 // horizontally inside the preview div.
 const pages = Math.max(1, Math.round(container.scrollWidth / STEP));
 setTotalPages(pages);
 };

 // Slight delay so the CV renderer finishes its layout pass first.
 const timer = setTimeout(recalc, 150);

 // Also watch for future size changes (e.g. fonts loading, content edits).
 const ro = new ResizeObserver(recalc);
 ro.observe(container);

 return () => {
 clearTimeout(timer);
 ro.disconnect();
 };
 }, [data, STEP]);

 const goToPage = (pageIdx: number) => {
 if (!scrollContainerRef.current) return;
 scrollContainerRef.current.scrollTo({
 left: pageIdx * STEP,
 behavior: 'smooth',
 });
 setCurrentPage(pageIdx);
 };

 const handleScroll = () => {
 if (!scrollContainerRef.current) return;
 const pageIdx = Math.round(scrollContainerRef.current.scrollLeft / STEP);
 if (pageIdx !== currentPage) setCurrentPage(pageIdx);
 };

 return (
 <div
 className={`flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}
 // NOTE: No overflow-hidden here — that was clipping the A4 sheet.
 >
 {children && (
 <div className="flex-shrink-0 p-4 pb-0 bg-gray-50/30">
 {children}
 </div>
 )}

 {/* ── Main body ── */}
 <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-xl">

 {/* ── Toolbar ── */}
 <div className="flex-shrink-0 px-3 sm:px-4 py-3 border-b border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
 <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
 {statusDisplay && (
 <span
 className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-${statusDisplay.color}-100${statusDisplay.color}-900/30 text-${statusDisplay.color}-700${statusDisplay.color}-300`}
 >
 {statusDisplay.label}
 </span>
 )}
 </div>

 <div className="flex items-center gap-2 flex-wrap">
 {/* Page navigation – only shown when there is more than one page */}
 {data && totalPages > 1 && (
 <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 mr-2">
 {Array.from({ length: totalPages }, (_, i) => (
 <button
 key={i}
 onClick={() => goToPage(i)}
 className={`min-w-[32px] h-8 flex items-center justify-center rounded-md text-xs font-bold transition-all ${currentPage === i
 ? 'bg-primary text-white shadow-sm'
 : 'text-gray-500 hover:bg-white'
 }`}
 >
 {i + 1}
 </button>
 ))}
 </div>
 )}


 </div>
 </div>

 {/* ── Preview / ATS area ── */}
 {/*
 Key fixes applied here:
 1. Outer wrapper uses overflow-hidden + flex-1 to fill available height
 without clipping content inside the scroll container.
 2. The scroll container allows BOTH axes to scroll so the A4 sheet is
 never clipped regardless of panel width.
 3. pb-32 kept so the last line of text is not hidden behind the toolbar
 when scrolled to the bottom.
 */}
 <div className="flex-1 min-h-0 overflow-hidden bg-gray-100">
 <style>{`
 @media print {
 #cv-preview-wrapper {
 padding: 0 !important;
 background: white !important;
 }
 }
 `}</style>
 <div
 ref={scrollContainerRef}
 onScroll={handleScroll}
 className="h-full w-full overflow-x-auto overflow-y-auto scroll-smooth"
 style={{ scrollbarGutter: 'stable' }}
 >
 {isPdfEditing && !hasMeaningfulContent(data) ? (
 <RawPdfPlaceholder
 filename={pdfFilename || null}
 isLoadingRawPdf={isLoadingPdf}
 onPreview={async () => { }}
 onRemove={onDelete ? async () => { onDelete(); } : async () => { }}
 pdfBase64={pdfBase64}
 onPdfSave={onPdfSave}
 isPdfSaving={isPdfSaving}
 />
 ) : rightView === 'ats' && atsPanel ? (
 <div className="h-full">{atsPanel}</div>
 ) : data ? (
 <div
 id="cv-preview-wrapper"
 className="flex flex-col items-center min-w-full pb-10"
 >
 <CvDocumentRenderer
 data={data as JsonResumeSchema}
 onChange={(updated) => onChange(updated)}
 analyses={analyses}
 onImproveSection={onImproveSection}
 improvingSections={improvingSections}
 />
 </div>
 ) : (
 <div className="flex items-center justify-center h-full w-full text-gray-400">
 <p className="text-sm">Loading CV…</p>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
};

export default CvEditorPanel;