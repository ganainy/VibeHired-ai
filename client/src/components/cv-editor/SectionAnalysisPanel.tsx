import React, { useState } from 'react';

interface SectionAnalysisPanelProps {
 analysis: {
 needsImprovement: boolean;
 feedback: string;
 } | null;
 onImprove: (customInstructions?: string) => void;
 isLoading?: boolean;
}

const SectionAnalysisPanel: React.FC<SectionAnalysisPanelProps> = ({
 analysis,
 onImprove,
 isLoading = false
}) => {
 const [showModal, setShowModal] = useState(false);
 const [customInstructions, setCustomInstructions] = useState('');

 const handleAIFixClick = () => {
 setShowModal(true);
 };

 const handleConfirm = () => {
 onImprove(customInstructions.trim() || undefined);
 setShowModal(false);
 setCustomInstructions('');
 };

 const handleCancel = () => {
 setShowModal(false);
 setCustomInstructions('');
 };

 // If no analysis or no improvement needed, render nothing
 if (!analysis || !analysis.needsImprovement) {
 return null;
 }

 return (
 <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
 {/* Warning/Idea Icon */}
 <div className="flex-shrink-0 mt-0.5">
 <svg
 className="w-5 h-5 text-yellow-600"
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
 />
 </svg>
 </div>

 {/* Feedback Text */}
 <div className="flex-1">
 <p className="text-sm text-yellow-800">
 {analysis.feedback}
 </p>
 </div>

 {/* AI Fix Button */}
 <div className="flex-shrink-0">
 <button
 onClick={handleAIFixClick}
 disabled={isLoading}
 className="px-3 py-1.5 bg-green text-white text-sm rounded-md hover:bg-green-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
 >
 {isLoading ? (
 <>
 <svg
 className="animate-spin h-4 w-4"
 xmlns="http://www.w3.org/2000/svg"
 fill="none"
 viewBox="0 0 24 24"
 >
 <circle
 className="opacity-25"
 cx="12"
 cy="12"
 r="10"
 stroke="currentColor"
 strokeWidth="4"
 ></circle>
 <path
 className="opacity-75"
 fill="currentColor"
 d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
 ></path>
 </svg>
 Improving...
 </>
 ) : (
 <>
 <svg
 className="w-4 h-4"
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 strokeWidth={2}
 d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
 />
 </svg>
 AI Fix
 </>
 )}
 </button>
 </div>

 {/* Custom Instructions Modal */}
 {showModal && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleCancel}>
 <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-2">
 <svg className="w-6 h-6 text-green-house" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
 </svg>
 <h3 className="text-lg font-semibold text-primary-color">AI Improvement</h3>
 </div>
 <button
 onClick={handleCancel}
 className="text-muted-color hover:text-secondary-color transition-colors"
 >
 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 <div className="mb-4">
 <label className="block text-sm font-medium text-secondary-color mb-2">
 Custom Instructions (Optional)
 </label>
 <textarea
 value={customInstructions}
 onChange={(e) => setCustomInstructions(e.target.value)}
 placeholder="e.g., Focus on quantifiable achievements, use action verbs, emphasize leadership skills..."
 className="w-full px-3 py-2 border border-theme rounded-lg focus:ring-2 focus:ring-gold focus:border-transparent bg-white text-primary-color placeholder-muted-color resize-none"
 rows={4}
 maxLength={500}
 autoFocus
 />
 <div className="flex items-center justify-between mt-2">
 <p className="text-xs text-secondary-color">
 Leave empty to use default AI improvements
 </p>
 <span className="text-xs text-muted-color">
 {customInstructions.length}/500
 </span>
 </div>
 </div>

 <div className="flex items-center gap-3">
 <button
 onClick={handleCancel}
 className="flex-1 px-4 py-2 bg-[var(--bg-raised)] text-secondary-color rounded-lg hover:bg-[var(--bg-raised)] transition-colors font-medium"
 >
 Cancel
 </button>
 <button
 onClick={handleConfirm}
 className="flex-1 px-4 py-2 bg-green text-white rounded-lg hover:bg-green-accent transition-colors font-medium flex items-center justify-center gap-2"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
 </svg>
 Improve with AI
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};

export default SectionAnalysisPanel;