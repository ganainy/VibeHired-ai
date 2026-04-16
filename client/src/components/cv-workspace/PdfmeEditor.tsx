// client/src/components/cv-workspace/PdfmeEditor.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Form } from '@pdfme/ui';
import { generate } from '@pdfme/generator';
import { text, image } from '@pdfme/schemas';

interface PdfmeEditorProps {
  /** Base64-encoded PDF content (without data: URI prefix) */
  pdfBase64: string;
  /** Filename of the PDF */
  filename?: string;
  /** Called when user saves the edited PDF. Returns modified PDF as base64 */
  onSave: (updatedPdfBase64: string) => Promise<void> | void;
  /** Whether save operation is in progress */
  isSaving?: boolean;
  /** Optional callback for remove action */
  onRemove?: () => void;
  /** Additional CSS class */
  className?: string;
}

/**
 * Inline PDF editor using @pdfme/ui Form mode.
 * Allows direct text editing on the PDF itself.
 */
const PdfmeEditor: React.FC<PdfmeEditorProps> = ({
  pdfBase64,
  filename,
  onSave,
  isSaving = false,
  onRemove,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<Form | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convert base64 PDF to blob URL for pdfme
  const getPdfBlobUrl = useCallback(async (base64: string): Promise<string> => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  }, []);

  // Initialize pdfme Form editor
  useEffect(() => {
    if (!containerRef.current || !pdfBase64) return;

    let blobUrl: string | null = null;
    let form: Form | null = null;
    let cancelled = false;

    const initEditor = async () => {
      try {
        setIsLoading(true);
        setError(null);

        blobUrl = await getPdfBlobUrl(pdfBase64);
        if (cancelled) return;

        // Create a simple template with text fields for editing
        // schemas is an array of arrays (each inner array represents a PDF page)
        const template = {
          basePdf: blobUrl,
          schemas: [[
            {
              name: 'textField1',
              type: 'text',
              position: { x: 10, y: 10 },
              width: 100,
              height: 10,
            },
          ]],
        };

        if (!containerRef.current) return;

        // Initial inputs for the form
        const initialInputs = [{ textField1: '' }];

        form = new Form({
          domContainer: containerRef.current,
          template,
          inputs: initialInputs,
          plugins: {
            text: text,
            image: image,
          },
        });

        if (cancelled) return;
        formRef.current = form;

        setIsLoading(false);
      } catch (err: any) {
        console.error('Failed to initialize PDFme editor:', err);
        if (!cancelled) {
          setError(err?.message || 'Failed to load PDF editor');
          setIsLoading(false);
        }
      }
    };

    initEditor();

    // Cleanup
    return () => {
      cancelled = true;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
      if (form) {
        form.destroy();
        formRef.current = null;
      }
    };
  }, [pdfBase64, getPdfBlobUrl]);

  // Save handler
  const handleSave = async () => {
    if (!formRef.current) return;

    try {
      // Get the current inputs (edited content)
      const inputs = formRef.current.getInputs();
      const template = formRef.current.getTemplate();

      // Generate new PDF with the edited content
      const pdfUint8Array = await generate({
        template,
        inputs,
        plugins: {
          text: text,
          image: image,
        },
      });

      // Convert Uint8Array to Blob
      const blob = new Blob([pdfUint8Array], { type: 'application/pdf' });

      // Convert PDF blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64String = reader.result as string;
        // Remove data: URI prefix
        const base64Content = base64String.split(',')[1];
        onSave(base64Content);
      };
    } catch (err: any) {
      console.error('Failed to save PDF:', err);
      setError(err?.message || 'Failed to save PDF');
    }
  };

  if (error) {
    return (
      <div className={`p-6 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 ${className}`}>
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-red-600 dark:text-red-400 flex-shrink-0">error</span>
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300">Failed to load PDF editor</p>
            <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 text-sm font-medium text-red-600 dark:text-red-400 underline hover:text-red-800 dark:hover:text-red-300"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-gray-500 dark:text-gray-400">picture_as_pdf</span>
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">PDF Editor</p>
            {filename && (
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate max-w-[200px]">{filename}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Unsaved changes
            </span>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <span className="material-symbols-outlined text-[18px]">save</span>
            )}
            <span className="hidden sm:inline">{isSaving ? 'Saving…' : 'Save'}</span>
          </button>

          {onRemove && (
            <>
              <div className="w-px h-6 bg-gray-200 dark:bg-gray-600 mx-1" />
              <button
                type="button"
                onClick={onRemove}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
                <span className="hidden sm:inline">Remove</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* PDF Editor Container */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 bg-opacity-90 dark:bg-opacity-90 z-10">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 dark:border-blue-400 mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading PDF editor…</p>
            </div>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
};

export default PdfmeEditor;
