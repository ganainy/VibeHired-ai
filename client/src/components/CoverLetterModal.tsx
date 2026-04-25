// client/src/components/CoverLetterModal.tsx
import React, { useState } from 'react';
import CoverLetterEditor from './CoverLetterEditor';

interface CoverLetterModalProps {
 isOpen: boolean;
 onClose: () => void;
 onSave: (coverLetterText: string) => Promise<void>;
 initialText?: string;
 isLoading?: boolean;
}

const CoverLetterModal: React.FC<CoverLetterModalProps> = ({
 isOpen,
 onClose,
 onSave,
 initialText = '',
 isLoading = false
}) => {
 const [coverLetterText, setCoverLetterText] = useState<string>(initialText);
 const [isSaving, setIsSaving] = useState<boolean>(false);
 const [error, setError] = useState<string | null>(null);

 // Update local state when initialText changes (e.g., when new cover letter is generated)
 React.useEffect(() => {
 if (isOpen) {
 setCoverLetterText(initialText);
 setError(null);
 }
 }, [initialText, isOpen]);

 const handleSave = async () => {
 if (!coverLetterText.trim()) {
 setError('Cover letter cannot be empty');
 return;
 }

 setIsSaving(true);
 setError(null);

 try {
 await onSave(coverLetterText);
 onClose();
 } catch (err: any) {
 console.error('Error saving cover letter:', err);
 setError(err.message || 'Failed to save cover letter');
 } finally {
 setIsSaving(false);
 }
 };

 const handleCancel = () => {
 setCoverLetterText(initialText);
 setError(null);
 onClose();
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
 <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl mx-4 sm:mx-0 max-h-[90vh] flex flex-col">
 <div className="flex justify-between items-center mb-4">
 <h2 className="text-2xl font-semibold text-primary-color">
 Cover Letter
 </h2>
 <button
 onClick={handleCancel}
 disabled={isSaving || isLoading}
 className="text-secondary-color hover:text-secondary-color disabled:opacity-50"
 aria-label="Close"
 >
 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 {error && (
 <div className="mb-4 p-3 bg-[var(--rose-bg)] text-error text-sm rounded border border-error">
 {error}
 </div>
 )}

 {isLoading ? (
 <div className="flex-1 flex items-center justify-center">
 <div className="text-center">
 <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
 <p className="text-secondary-color">Generating cover letter...</p>
 </div>
 </div>
 ) : (
 <>
 <div className="flex-1 mb-4 overflow-hidden flex flex-col min-h-0 max-h-full">
 <CoverLetterEditor
 value={coverLetterText}
 onChange={setCoverLetterText}
 placeholder="Your cover letter will appear here..."
 disabled={isSaving}
 className="flex-1 min-h-0 h-full"
 />
 </div>

 <div className="flex justify-end gap-3 pt-4 border-t">
 <button
 onClick={handleCancel}
 disabled={isSaving || isLoading}
 className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 Cancel
 </button>
 <button
 onClick={handleSave}
 disabled={isSaving || isLoading || !coverLetterText.trim()}
 className="px-4 py-2 bg-green text-white rounded hover:bg-green-accent disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {isSaving ? 'Saving...' : 'Save'}
 </button>
 </div>
 </>
 )}
 </div>
 </div>
 );
};

export default CoverLetterModal;

