import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { updateCustomPrompts } from '../../../services/settingsApi';
import { updateJob, JobApplication } from '../../../services/jobApi';
import { generateCvOnly } from '../../../services/generatorApi';
import { DEFAULT_CV_PROMPT, DEFAULT_COVER_LETTER_PROMPT } from '../../../constants/prompts';
import { generateCoverLetter } from '../../../services/coverLetterApi';
import { createJobCvFromBase } from '../../../services/cvApi';
import { JsonResumeSchema } from '../../../../../server/src/types/jsonresume';
import { parseApiErrorMessage } from '../../../utils/parseApiError';

export type ReviewGenerationStep = 'idle' | 'analyzing' | 'matching' | 'tailoring' | 'finalizing';

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

    useEffect(() => {
        let interval: NodeJS.Timeout | undefined;
        if (isGeneratingCv && generationProgress < 90) {
            interval = setInterval(() => {
                setGenerationProgress(prev => {
                    const increment = Math.random() * 8;
                    const newProgress = Math.min(prev + increment, 90);
                    if (newProgress >= 20 && generationStep === 'analyzing') {
                        setGenerationStep('matching');
                    } else if (newProgress >= 50 && generationStep === 'matching') {
                        setGenerationStep('tailoring');
                    } else if (newProgress >= 80 && generationStep === 'tailoring') {
                        setGenerationStep('finalizing');
                    }
                    return newProgress;
                });
            }, 500);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isGeneratingCv, generationProgress, generationStep]);

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

    const handleGenerateSpecificCv = async () => {
        if (!jobId || !jobApplication) return;

        if (!tailoredJobDescription) {
            showToast('Please ensure job description is present', 'error');
            return;
        }

        setIsGeneratingCv(true);
        setGenerateCvError(null);
        setGenerationStep('analyzing');
        setGenerationProgress(5);

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

            await new Promise(resolve => setTimeout(resolve, 800));
            setGenerationStep('matching');
            setGenerationProgress(25);

            await new Promise(resolve => setTimeout(resolve, 800));
            setGenerationStep('tailoring');
            setGenerationProgress(45);

            const response = await generateCvOnly(jobId, language as 'en' | 'de', {
                baseCvId: selectedBaseCvId === 'master' ? undefined : selectedBaseCvId,
                jobDescription: tailoredJobDescription,
                customInstructions,
                maxOutputTokens: 16384,
            });

            setGenerationStep('finalizing');
            setGenerationProgress(100);

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
            } else if (response.status === 'pending_input') {
                setGenerateCvError('Generation requires additional input. Please check the console for details.');
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
        handleGenerateSpecificCv,
        handleUseBaseCvAsIs,
    };
};
