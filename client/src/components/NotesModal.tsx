import React, { useState, useEffect, useRef } from 'react';
import { Button } from './common';

interface NotesModalProps {
 isOpen: boolean;
 onClose: () => void;
 onSave: (notes: string) => Promise<void>;
 initialNotes: string;
 isSaving?: boolean;
}

const NotesModal: React.FC<NotesModalProps> = ({
 isOpen,
 onClose,
 onSave,
 initialNotes,
 isSaving = false
}) => {
 const [notes, setNotes] = useState<string>(initialNotes);
 const [error, setError] = useState<string | null>(null);
 const textareaRef = useRef<HTMLTextAreaElement>(null);

 // Update local state when initialNotes changes or modal opens
 useEffect(() => {
 if (isOpen) {
 setNotes(initialNotes);
 setError(null);
 // Focus textarea when modal opens
 setTimeout(() => {
 textareaRef.current?.focus();
 }, 100);
 }
 }, [initialNotes, isOpen]);

 const handleSave = async () => {
 setError(null);
 try {
 await onSave(notes);
 onClose();
 } catch (err: any) {
 console.error('Error saving notes:', err);
 setError(err.message || 'Failed to save notes');
 }
 };

 const handleCancel = () => {
 setNotes(initialNotes);
 setError(null);
 onClose();
 };

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'Escape') {
 handleCancel();
 } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
 handleSave();
 }
 };

 if (!isOpen) return null;

 return (
 <div 
 className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 transition-opacity duration-300 ease-in-out"
 onClick={handleCancel}
 >
 <div 
 className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 sm:mx-0 max-h-[90vh] flex flex-col"
 onClick={(e) => e.stopPropagation()}
 onKeyDown={handleKeyDown}
 >
 {/* Header */}
 <div className="flex justify-between items-center p-6 border-b border-theme">
 <h2 className="text-2xl font-semibold text-primary-color">
 Edit Notes
 </h2>
 <button
 onClick={handleCancel}
 disabled={isSaving}
 className="text-secondary-color hover:text-primary-color disabled:opacity-50 transition-colors"
 aria-label="Close"
 >
 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 {/* Error Message */}
 {error && (
 <div className="mx-6 mt-4 p-3 bg-[var(--rose-bg)] text-error text-sm rounded border border-red-300">
 {error}
 </div>
 )}

 {/* Content */}
 <div className="flex-1 overflow-y-auto p-6">
 <div className="mb-4">
 <label htmlFor="notes-textarea" className="block text-sm font-medium text-secondary-color mb-2">
 Notes
 </label>
 <textarea
 ref={textareaRef}
 id="notes-textarea"
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 rows={12}
 placeholder="Add your notes about this job application..."
 className="w-full px-3 py-2 border border-theme rounded-md bg-white text-primary-color focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-transparent resize-none transition-colors"
 disabled={isSaving}
 />
 <p className="mt-2 text-xs text-secondary-color">
 Press Ctrl+Enter (or Cmd+Enter on Mac) to save
 </p>
 </div>
 </div>

 {/* Footer */}
 <div className="flex justify-end gap-3 p-6 border-t border-theme">
 <Button
 variant="secondary"
 onClick={handleCancel}
 disabled={isSaving}
 className="px-4 py-2"
 >
 Cancel
 </Button>
 <Button
 onClick={handleSave}
 disabled={isSaving}
 className="flex items-center gap-2"
 >
 {isSaving ? (
 <>
 <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 Saving...
 </>
 ) : (
 <>
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
 </svg>
 Save Notes
 </>
 )}
 </Button>
 </div>
 </div>
 </div>
 );
};

export default NotesModal;

