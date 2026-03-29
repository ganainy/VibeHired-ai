import React from 'react';
import SimpleLoader from '../common/SimpleLoader';

export type GenerationStep = 'idle' | 'analyzing' | 'matching' | 'tailoring' | 'finalizing';

interface GenerationProgressModalProps {
    isOpen: boolean;
    generationStep: GenerationStep;
    generationProgress: number;
}

const GenerationProgressModal: React.FC<GenerationProgressModalProps> = ({
    isOpen,
    generationStep,
    generationProgress,
}) => {
    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-700">
                <div className="p-8">
                    <div className="flex justify-center mb-6">
                        <SimpleLoader
                            message={
                                generationStep === 'analyzing' ? 'Analyzing Job Requirements...' :
                                    generationStep === 'matching' ? 'Matching Skills & Experience...' :
                                        generationStep === 'tailoring' ? 'Tailoring Your Resume...' :
                                            'Finalizing Document...'
                            }
                            description={
                                generationStep === 'analyzing' ? 'Identifying key keywords and requirements from the job description.' :
                                    generationStep === 'matching' ? 'Finding the best projects and experiences from your history.' :
                                        generationStep === 'tailoring' ? 'Rewriting descriptions to highlight relevance and impact.' :
                                            'Formatting your new CV for maximum impact.'
                            }
                            height="auto"
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="relative pt-1">
                            <div className="flex mb-2 items-center justify-between">
                                <div className="text-right">
                                    <span className="text-xs font-semibold inline-block" style={{ color: 'var(--accent)' }}>
                                        {Math.round(generationProgress)}%
                                    </span>
                                </div>
                            </div>
                            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200 dark:bg-gray-600">
                                <div style={{ width: `${generationProgress}%`, background: 'var(--accent)' }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ease-out"></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-medium text-gray-400">
                            <div style={generationStep === 'analyzing' || generationStep === 'matching' || generationStep === 'tailoring' || generationStep === 'finalizing' ? { color: 'var(--accent)' } : {}}>Analyze</div>
                            <div style={generationStep === 'matching' || generationStep === 'tailoring' || generationStep === 'finalizing' ? { color: 'var(--accent)' } : {}}>Match</div>
                            <div style={generationStep === 'tailoring' || generationStep === 'finalizing' ? { color: 'var(--accent)' } : {}}>Tailor</div>
                            <div style={generationStep === 'finalizing' ? { color: 'var(--accent)' } : {}}>Finalize</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GenerationProgressModal;
