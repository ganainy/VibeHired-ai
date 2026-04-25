// client/src/components/cv-workspace/RawPdfPlaceholder.tsx
import React from 'react';
import { Button } from '../common';
import PdfmeEditor from './PdfmeEditor';

export interface RawPdfPlaceholderProps {
 filename: string | null;
 isLoadingRawPdf: boolean;
 onPreview: () => Promise<void>;
 onRemove: () => Promise<void>;
 /** Base64 PDF content to enable inline editing */
 pdfBase64?: string | null;
 /** Called when user saves the edited PDF */
 onPdfSave?: (updatedPdfBase64: string) => Promise<void> | void;
 /** Whether PDF save is in progress */
 isPdfSaving?: boolean;
}

/**
 * Displayed in place of the CV editor when the attached CV is a raw PDF with
 * no parsed JSON content (e.g. uploaded as-is without AI parsing).
 * Shows inline PDF editor when pdfBase64 is provided, otherwise shows preview-only.
 */
const RawPdfPlaceholder: React.FC<RawPdfPlaceholderProps> = ({
 filename,
 isLoadingRawPdf,
 onPreview,
 onRemove,
 pdfBase64,
 onPdfSave,
 isPdfSaving = false,
}) => {
 // Show inline editor if we have PDF data and a save handler
 const canEdit = pdfBase64 && onPdfSave;

 if (canEdit) {
 return (
 <div className="h-full min-h-[600px]">
 <PdfmeEditor
 pdfBase64={pdfBase64}
 filename={filename || undefined}
 onSave={onPdfSave}
 isSaving={isPdfSaving}
 onRemove={onRemove}
 className="h-full"
 />
 </div>
 );
 }

 // Fallback: preview-only mode
 return (
 <div className="p-10 rounded-2xl border border-theme bg-white flex flex-col items-center gap-4 text-center">
 <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--accent)' }}>
 description
 </span>

 <div>
<p className="text-base font-semibold text-primary-color">CV attached as PDF</p>
{filename && (
<p className="text-sm text-secondary-color mt-1 font-mono">{filename}</p>
)}
<p className="text-sm text-secondary-color mt-2">
 This CV was stored as-is. No in-app editing is available for raw PDF attachments.
 </p>
 </div>

 <div className="flex items-center gap-3">
 <Button
 type="button"
 variant="secondary"
 disabled={isLoadingRawPdf}
 onClick={onPreview}
 className="text-sm"
 >
 {isLoadingRawPdf ? (
 <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
 ) : (
 <span className="material-symbols-outlined text-base">visibility</span>
 )}
 Preview PDF
 </Button>

 <Button
 type="button"
 variant="danger"
 onClick={onRemove}
 className="text-sm"
 >
 <span className="material-symbols-outlined text-base">delete</span>
 Remove &amp; re-attach
 </Button>
 </div>
 </div>
 );
};

export default RawPdfPlaceholder;
