// client/src/components/cv-workspace/RawPdfPlaceholder.tsx
import React from 'react';
import { Button } from '../common';

export interface RawPdfPlaceholderProps {
  filename: string | null;
  isLoadingRawPdf: boolean;
  onPreview: () => Promise<void>;
  onRemove: () => Promise<void>;
}

/**
 * Displayed in place of the CV editor when the attached CV is a raw PDF with
 * no parsed JSON content (e.g. uploaded as-is without AI parsing).
 */
const RawPdfPlaceholder: React.FC<RawPdfPlaceholderProps> = ({
  filename,
  isLoadingRawPdf,
  onPreview,
  onRemove,
}) => (
  <div className="p-10 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col items-center gap-4 text-center">
    <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--accent)' }}>
      description
    </span>

    <div>
      <p className="text-base font-semibold text-gray-800 dark:text-gray-200">CV attached as PDF</p>
      {filename && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-mono">{filename}</p>
      )}
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
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

export default RawPdfPlaceholder;
