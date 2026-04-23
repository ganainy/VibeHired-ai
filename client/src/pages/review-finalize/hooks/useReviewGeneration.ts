import { useEffect, useState, useRef, type Dispatch, type SetStateAction } from 'react';
import { updateCustomPrompts } from '../../../services/settingsApi';
import { updateJob, JobApplication } from '../../../services/jobApi';
import { generateCvWithProgress, type GenerationProgressEvent } from '../../../services/generatorApi';
import { DEFAULT_CV_PROMPT, DEFAULT_COVER_LETTER_PROMPT } from '../../../constants/prompts';
import { generateCoverLetter } from '../../../services/coverLetterApi';
import { createJobCvFromBase } from '../../../services/cvApi';
import { JsonResumeSchema } from '../../../../../server/src/types/jsonresume';
import { parseApiErrorMessage } from '../../../utils/parseApiError';
import type { TailoringSettings } from '../../../components/review-finalize/TailoredCvPage';

export type ReviewGenerationStep = 'idle' | 'analyzing' | 'matching' | 'tailoring' | 'finalizing';

const STEP_WEIGHTS: Record<string, { label: string; startPct: number; estimatedMs: number }> = {
    analyzing:  { label: 'Analyzing Job Description', startPct: 0,  estimatedMs: 8000  },
    matching:   { label: 'Matching Skills & Experience', startPct: 25, estimatedMs: 12000 },
    tailoring:  { label: 'Tailoring Your CV', startPct: 40, estimatedMs: 25000 },
    finalizing: { label: 'Finalizing Document', startPct: 80, estimatedMs: 8000  },
};

interface UseReviewGenerationParams {
    jobId?: string;
    jobApplication: JobApplication | null;
    hasMasterCv: boolean;
    tailoredJobTitle: string;
    tailoredCompanyName: string;
    tailoredJobDescription: string;
    customInstructions: string;
    clCustomInstructions: string;
    selectedBaseCvId: string;
    selectedClBaseCvId: string;
    availableCvs: Array<{ id: string; name: string; data: any }>;
    cvData: JsonResumeSchema;
    coverLetterText: string;
    fetchJobData: () => Promise<void>;
    refreshUsage: () => Promise<void>;
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    setCoverLetterText: Dispatch<SetStateAction<string>>;
    setFinalPdfFiles: Dispatch<SetStateAction<{ cv: string | null; cl: string | null }>>;
    setJobApplication: Dispatch<SetStateAction<JobApplication | null>>;
    humanize: boolean;
}

export const useReviewGeneration = ({
    jobId,
    jobApplication,
    hasMasterCv,
    tailoredJobTitle,
    tailoredCompanyName,
    tailoredJobDescription,
    customInstructions,
    clCustomInstructions,
    selectedBaseCvId,
    selectedClBaseCvId,
    availableCvs,
    cvData,
    coverLetterText,
    fetchJobData,
    refreshUsage,
    showToast,
    setCoverLetterText,
    setFinalPdfFiles,
    setJobApplication,
    humanize,
}: UseReviewGenerationParams) => {
    const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState<boolean>(false);
    const [coverLetterError, setCoverLetterError] = useState<string | null>(null);
    const [isClCopied, setIsClCopied] = useState<boolean>(false);

    const [isGeneratingCv, setIsGeneratingCv] = useState<boolean>(false);
    const [generateCvError, setGenerateCvError] = useState<string | null>(null);
    const [generationStep, setGenerationStep] = useState<ReviewGenerationStep>('idle');
    const [generationProgress, setGenerationProgress] = useState<number>(0);
    const [generationStepLabel, setGenerationStepLabel] = useState<string>('');
    const [generationDescription, setGenerationDescription] = useState<string>('');
    const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
    const generationStartRef = useRef<number | null>(null);

    const handleGenerateCoverLetter = async () => {
        if (!jobId || !jobApplication) return;

        setIsGeneratingCoverLetter(true);
        setCoverLetterError(null);

        try {
            if (
                tailoredJobTitle !== jobApplication.jobTitle ||
                tailoredCompanyName !== jobApplication.companyName ||
                tailoredJobDescription !== jobApplication.jobDescriptionText
            ) {
                await updateJob(jobId, {
                    jobTitle: tailoredJobTitle,
                    companyName: tailoredCompanyName,
                    jobDescriptionText: tailoredJobDescription,
                });
                setJobApplication(prev => (prev
                    ? {
                        ...prev,
                        jobTitle: tailoredJobTitle,
                        companyName: tailoredCompanyName,
                        jobDescriptionText: tailoredJobDescription,
                    }
                    : null));
            }

            if (!tailoredJobDescription) {
                setCoverLetterError('Please provide a job description.');
                return;
            }

            if (!hasMasterCv) {
                setCoverLetterError('Please upload a CV first at the CV Management page.');
                return;
            }

            if (clCustomInstructions) {
                const fullPrompt = `${DEFAULT_COVER_LETTER_PROMPT}\n\n**USER INSTRUCTIONS:**\n${clCustomInstructions}`;
                await updateCustomPrompts({ coverLetterPrompt: fullPrompt });
            } else {
                await updateCustomPrompts({ coverLetterPrompt: null });
            }

            const language = jobApplication.language || 'en';

            let baseCvDataToUse = undefined;
            if (selectedClBaseCvId === '__job_cv__') {
                baseCvDataToUse = cvData;
            } else if (selectedClBaseCvId !== 'master') {
                const selectedOption = availableCvs.find(cv => cv.id === selectedClBaseCvId);
                if (selectedOption) {
                    baseCvDataToUse = selectedOption.data;
                }
            }

            const response = await generateCoverLetter(jobId, language as 'en' | 'de', baseCvDataToUse, humanize);
            const { text: generatedText, suggestedFilename } = response;

            await updateJob(jobId, {
                draftCoverLetterText: generatedText,
                suggestedCoverLetterFilename: suggestedFilename,
                generatedCoverLetterFilename: null,
            });

            setCoverLetterText(generatedText);
            setFinalPdfFiles(prev => ({ ...prev, cl: null }));
            setJobApplication(prev => (prev
                ? {
                    ...prev,
                    draftCoverLetterText: generatedText,
                    suggestedCoverLetterFilename: suggestedFilename || prev.suggestedCoverLetterFilename,
                    generatedCoverLetterFilename: undefined,
                }
                : null));

            await fetchJobData();
            setFinalPdfFiles(prev => ({ ...prev, cl: null }));
            showToast('Cover letter generated successfully', 'success');
            try {
                await refreshUsage();
            } catch (e) {
                console.error('Failed to refresh credits UI:', e);
            }
        } catch (error: any) {
            console.error('Error generating cover letter:', error);
            setCoverLetterError(parseApiErrorMessage(error));
        } finally {
            setIsGeneratingCoverLetter(false);
        }
    };

    const handleCopyCoverLetter = () => {
        const textToCopy = coverLetterText ?? '';
        if (!textToCopy) {
            return;
        }
        navigator.clipboard.writeText(textToCopy);
        setIsClCopied(true);
        showToast('Cover letter copied to clipboard', 'success');
        setTimeout(() => setIsClCopied(false), 2000);
    };

    const handleGenerateSpecificCv = async (settings?: TailoringSettings) => {
        if (!jobId || !jobApplication) return;

        if (!tailoredJobDescription) {
            showToast('Please ensure job description is present', 'error');
            return;
        }

        setIsGeneratingCv(true);
        setGenerateCvError(null);
        setGenerationStep('analyzing');
        setGenerationProgress(5);
        setGenerationStepLabel('Preparing');
        setGenerationDescription('Validating your CV and job description...');
        setEstimatedTimeRemaining(null);
        generationStartRef.current = Date.now();

        try {
            if (
                tailoredJobTitle !== jobApplication.jobTitle ||
                tailoredCompanyName !== jobApplication.companyName ||
                tailoredJobDescription !== jobApplication.jobDescriptionText
            ) {
                await updateJob(jobId, {
                    jobTitle: tailoredJobTitle,
                    companyName: tailoredCompanyName,
                    jobDescriptionText: tailoredJobDescription,
                });
                setJobApplication(prev => (prev
                    ? {
                        ...prev,
                        jobTitle: tailoredJobTitle,
                        companyName: tailoredCompanyName,
                        jobDescriptionText: tailoredJobDescription,
                    }
                    : null));
            }

            if (!hasMasterCv) {
                setGenerateCvError('Please upload a CV first at the CV Management page.');
                return;
            }

            if (customInstructions) {
                const fullPrompt = `${DEFAULT_CV_PROMPT}\n\n**USER INSTRUCTIONS:**\n${customInstructions}`;
                await updateCustomPrompts({ cvPrompt: fullPrompt });
            } else {
                await updateCustomPrompts({ cvPrompt: null });
            }

            const language = jobApplication.language || 'en';

            const onProgress = (event: GenerationProgressEvent) => {
                const step = event.step as ReviewGenerationStep;
                if (step) setGenerationStep(step);
                if (event.stepLabel) setGenerationStepLabel(event.stepLabel);
                if (event.description) setGenerationDescription(event.description);
                setGenerationProgress(event.progress);

                if (generationStartRef.current && STEP_WEIGHTS[event.step]) {
                    const stepInfo = STEP_WEIGHTS[event.step];
                    const progressWithinStep = Math.max(0, Math.min(1, (event.progress - stepInfo.startPct) / (100 - stepInfo.startPct)));
                    const remainingInStep = stepInfo.estimatedMs * (1 - progressWithinStep);
                    const stepsAfter = Object.entries(STEP_WEIGHTS)
                        .filter(([key]) => {
                            const order = ['analyzing', 'matching', 'tailoring', 'finalizing'];
                            return order.indexOf(key) > order.indexOf(event.step);
                        })
                        .reduce((sum, [, val]) => sum + val.estimatedMs, 0);
                    setEstimatedTimeRemaining(Math.round((remainingInStep + stepsAfter) / 1000));
                }
            };

            const response = await generateCvWithProgress(jobId, language as 'en' | 'de', {
                baseCvId: selectedBaseCvId === 'master' ? undefined : selectedBaseCvId,
                jobDescription: tailoredJobDescription,
                customInstructions,
                maxOutputTokens: 16384,
                matchAddress: settings?.matchAddress ?? false,
                showChanges: settings?.showChanges ?? true,
            }, onProgress);

            setGenerationStep('finalizing');
            setGenerationProgress(100);
            setGenerationStepLabel('Complete');
            setGenerationDescription('Your tailored CV is ready!');
            setEstimatedTimeRemaining(0);

            await new Promise(resolve => setTimeout(resolve, 600));

            if (response.status === 'draft_ready') {
                await fetchJobData();
                const changesMsg = response.changesCount ? ` with ${response.changesCount} tailoring changes` : '';
                showToast(`CV generated successfully${changesMsg}`, 'success');
                try {
                    await refreshUsage();
                } catch (e) {
                    console.error('Failed to refresh credits UI:', e);
                }
            } else {
                setGenerateCvError('Unexpected response from generation service.');
            }
        } catch (error: any) {
            console.error('Error generating specific CV:', error);
            setGenerateCvError(parseApiErrorMessage(error));
        } finally {
            setIsGeneratingCv(false);
            setGenerationProgress(0);
            setGenerationStep('idle');
            setGenerationStepLabel('');
            setGenerationDescription('');
            setEstimatedTimeRemaining(null);
            generationStartRef.current = null;
        }
    };

    const handleUseBaseCvAsIs = async () => {
        if (!jobId || !jobApplication) return;

        if (!hasMasterCv) {
            showToast('Please upload a CV first at the CV Management page.', 'error');
            return;
        }

        setIsGeneratingCv(true);
        setGenerateCvError(null);
        setGenerationStep('finalizing');
        setGenerationProgress(50);

        try {
            await createJobCvFromBase(jobId, selectedBaseCvId === 'master' ? undefined : selectedBaseCvId);

            setGenerationProgress(100);
            await new Promise(resolve => setTimeout(resolve, 400));

            await fetchJobData();
            showToast('Base CV applied to this job successfully', 'success');
            try {
                await refreshUsage();
            } catch (e) {
                console.error('Failed to refresh credits UI:', e);
            }
        } catch (error: any) {
            console.error('Error applying base CV:', error);
            setGenerateCvError(parseApiErrorMessage(error));
        } finally {
            setIsGeneratingCv(false);
            setGenerationProgress(0);
            setGenerationStep('idle');
            setGenerationStepLabel('');
            setGenerationDescription('');
            setEstimatedTimeRemaining(null);
        }
    };

    return {
        isGeneratingCoverLetter,
        coverLetterError,
        setCoverLetterError,
        isClCopied,
        handleGenerateCoverLetter,
        handleCopyCoverLetter,
        isGeneratingCv,
        generateCvError,
        setGenerateCvError,
        generationStep,
        generationProgress,
        generationStepLabel,
        generationDescription,
        estimatedTimeRemaining,
        handleGenerateSpecificCv,
        handleUseBaseCvAsIs,
    };
};
