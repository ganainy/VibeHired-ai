import { useCallback, useEffect, useRef, useState } from 'react';
import { AtsScores, deleteAtsAnalysis, getAtsForJob, getAtsScores, scanAts } from '../../../services/atsApi';
import { JobApplication } from '../../../services/jobApi';
import { JsonResumeSchema } from '../../../../../server/src/types/jsonresume';

const ATS_POLLING_INTERVAL_MS = 3000;
const ATS_POLLING_TIMEOUT_MS = 120000;

type ToastType = 'success' | 'error' | 'info';

interface UseAtsWorkflowParams {
    jobId?: string;
    jobApplication: JobApplication | null;
    cvData: JsonResumeSchema;
    appliedAtsSuggestions: string[];
    showToast: (message: string, type?: ToastType) => void;
    onError: (error: unknown) => void;
}

export const useAtsWorkflow = ({
    jobId,
    jobApplication,
    cvData,
    appliedAtsSuggestions,
    showToast,
    onError,
}: UseAtsWorkflowParams) => {
    const [atsScores, setAtsScores] = useState<AtsScores | null>(null);
    const [isLoadingAts, setIsLoadingAts] = useState(false);
    const [isScanningAts, setIsScanningAts] = useState(false);
    const [atsAnalysisId, setAtsAnalysisId] = useState<string | null>(null);
    const [atsProgressMessage, setAtsProgressMessage] = useState('');

    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const clearAtsPolling = useCallback(() => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    }, []);

    const pollAtsScores = useCallback(async (analysisIdToPoll: string, startTime: number): Promise<boolean> => {
        try {
            const response = await getAtsScores(analysisIdToPoll);

            const hasScores = response.atsScores && (
                (response.atsScores.score !== null && response.atsScores.score !== undefined) ||
                (response.atsScores.skillMatchDetails && (
                    response.atsScores.skillMatchDetails.skillMatchPercentage !== undefined ||
                    (response.atsScores.skillMatchDetails.matchedSkills && response.atsScores.skillMatchDetails.matchedSkills.length > 0) ||
                    (response.atsScores.skillMatchDetails.missingSkills && response.atsScores.skillMatchDetails.missingSkills.length > 0)
                )) ||
                (response.atsScores.complianceDetails && (
                    (response.atsScores.complianceDetails.keywordsMatched && response.atsScores.complianceDetails.keywordsMatched.length > 0) ||
                    (response.atsScores.complianceDetails.keywordsMissing && response.atsScores.complianceDetails.keywordsMissing.length > 0) ||
                    (response.atsScores.complianceDetails.formattingIssues && response.atsScores.complianceDetails.formattingIssues.length > 0) ||
                    (response.atsScores.complianceDetails.suggestions && response.atsScores.complianceDetails.suggestions.length > 0)
                )) ||
                response.atsScores.error
            );

            if (hasScores) {
                setAtsScores(response.atsScores);
                setIsScanningAts(false);
                setAtsProgressMessage('');
                clearAtsPolling();
                showToast('ATS analysis completed successfully!', 'success');
                return true;
            }

            const elapsed = Date.now() - startTime;
            if (elapsed > ATS_POLLING_TIMEOUT_MS) {
                setIsScanningAts(false);
                setAtsProgressMessage('');
                clearAtsPolling();
                showToast('ATS analysis is taking longer than expected. Please try again later.', 'info');
                return true;
            }

            const elapsedSeconds = Math.floor(elapsed / 1000);
            setAtsProgressMessage(`Analyzing your CV... (${elapsedSeconds}s)`);
            return false;
        } catch (error) {
            console.error('Error polling ATS scores:', error);
            return false;
        }
    }, [clearAtsPolling, showToast]);

    const handleScanAts = useCallback(async () => {
        if (!jobApplication || !jobId) {
            showToast('Job application not loaded', 'error');
            return;
        }

        if (!cvData || Object.keys(cvData).length === 0) {
            showToast('Please generate a tailored CV first before running ATS scan', 'error');
            return;
        }

        if (!jobApplication.jobDescriptionText) {
            showToast('Please scrape the job description first', 'error');
            return;
        }

        clearAtsPolling();

        setIsScanningAts(true);
        setAtsProgressMessage('Starting ATS analysis...');
        setAtsScores(null);

        try {
            const response = await scanAts(jobId, undefined, appliedAtsSuggestions.length > 0 ? appliedAtsSuggestions : undefined);
            setAtsAnalysisId(response.analysisId);
            showToast('ATS scan started. Analyzing your tailored CV...', 'info');

            const startTime = Date.now();
            pollingIntervalRef.current = setInterval(async () => {
                const completed = await pollAtsScores(response.analysisId, startTime);
                if (completed) {
                    clearAtsPolling();
                }
            }, ATS_POLLING_INTERVAL_MS);

            const completedImmediately = await pollAtsScores(response.analysisId, startTime);
            if (completedImmediately) {
                clearAtsPolling();
            }
        } catch (error) {
            console.error('Error starting ATS scan:', error);
            onError(error);
            setIsScanningAts(false);
            setAtsProgressMessage('');
        }
    }, [appliedAtsSuggestions, clearAtsPolling, cvData, jobApplication, jobId, onError, pollAtsScores, showToast]);

    const handleDeleteAts = useCallback(async () => {
        if (!atsAnalysisId) {
            return;
        }

        if (!window.confirm('Are you sure you want to delete this ATS analysis? This cannot be undone.')) {
            return;
        }

        try {
            await deleteAtsAnalysis(atsAnalysisId);
            setAtsScores(null);
            setAtsAnalysisId(null);
            showToast('ATS analysis deleted successfully', 'success');
        } catch (error: any) {
            console.error('Error deleting ATS analysis:', error);
            showToast(error.message || 'Failed to delete ATS analysis', 'error');
        }
    }, [atsAnalysisId, showToast]);

    useEffect(() => {
        const fetchExistingAtsScores = async () => {
            if (jobId && jobApplication) {
                setIsLoadingAts(true);
                try {
                    const response = await getAtsForJob(jobId);
                    if (response.atsScores && response.analysisId) {
                        setAtsScores(response.atsScores);
                        setAtsAnalysisId(response.analysisId);
                    }
                } catch (error) {
                    console.error('Error fetching existing ATS scores:', error);
                } finally {
                    setIsLoadingAts(false);
                }
            }
        };

        if (jobApplication) {
            void fetchExistingAtsScores();
        }
    }, [jobApplication, jobId]);

    useEffect(() => {
        return () => {
            clearAtsPolling();
        };
    }, [clearAtsPolling]);

    return {
        atsScores,
        isLoadingAts,
        isScanningAts,
        atsAnalysisId,
        atsProgressMessage,
        handleScanAts,
        handleDeleteAts,
    };
};
