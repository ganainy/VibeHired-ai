import { useState, useCallback, useRef } from 'react';
import { scanAts, getAtsScores, AtsScores, deleteAtsAnalysis } from '../../../services/atsApi';
import { applyAtsSuggestion } from '../../../services/generatorApi';

const ATS_POLLING_INTERVAL_MS = 3000;
const ATS_POLLING_TIMEOUT_MS = 120000;

export const useAtsAnalysis = (jobId: string | undefined, initialAppliedSuggestions: string[]) => {
    const [scores, setScores] = useState<AtsScores | null>(null);
    const [isLoading] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [analysisId, setAnalysisId] = useState<string | null>(null);
    const [progressMessage, setProgressMessage] = useState('');
    const [isApplyingBatch] = useState(false);
    const [appliedSuggestions, setAppliedSuggestions] = useState<string[]>(initialAppliedSuggestions);

    const pollingIntervalId = useRef<NodeJS.Timeout | null>(null);

    const pollAtsScores = useCallback(async (analysisIdToPoll: string, startTime: number) => {
        try {
            const response = await getAtsScores(analysisIdToPoll);
            const hasScores = response.atsScores && Object.keys(response.atsScores).length > 0;

            if (hasScores) {
                setScores(response.atsScores);
                if (pollingIntervalId.current) {
                    clearInterval(pollingIntervalId.current);
                    pollingIntervalId.current = null;
                }
            } else {
                const elapsed = Date.now() - startTime;
                const elapsedSeconds = Math.floor(elapsed / 1000);

                if (elapsedSeconds > 60) {
                    const progress = Math.min(50 + Math.floor((elapsed - 60000) / 1800), 90);
                    setProgressMessage(`Analyzing... ${progress}%`);
                } else {
                    const minutes = Math.floor(elapsed / 60000);
                    const seconds = Math.floor((elapsed % 60000) / 1000);
                    setProgressMessage(`Analyzing... ${minutes}m ${seconds}s`);
                }
            }
        } catch (error: any) {
            console.error('Error polling ATS scores:', error);
        }
    }, []);

    const handleScan = async () => {
        if (!jobId) return;

        setIsScanning(true);
        setProgressMessage('');
        setScores(null);

        try {
            const response = await scanAts(jobId, undefined, appliedSuggestions.length > 0 ? appliedSuggestions : undefined);
            const startTime = Date.now();
            setAnalysisId(response.analysisId);

            const intervalId = setInterval(async () => {
                await pollAtsScores(response.analysisId, startTime);
            }, ATS_POLLING_INTERVAL_MS);

            pollingIntervalId.current = intervalId;

            // Set timeout to stop polling after 2 minutes
            setTimeout(() => {
                if (pollingIntervalId.current) {
                    clearInterval(pollingIntervalId.current);
                    pollingIntervalId.current = null;
                }
            }, ATS_POLLING_TIMEOUT_MS);

        } catch (error: any) {
            console.error('Error scanning ATS:', error);
            setIsScanning(false);
        }
    };

    const handleApplySuggestion = async (suggestion: string) => {
        if (!jobId || !scores) return;

        try {
            await applyAtsSuggestion({}, [suggestion]);
            const newApplied = [...appliedSuggestions, suggestion];
            setAppliedSuggestions(newApplied);
        } catch (error: any) {
            console.error('Error applying ATS suggestion:', error);
        }
    };

    const handleDelete = async () => {
        if (!jobId) return;
        if (!confirm('Are you sure you want to delete the ATS analysis?')) return;

        try {
            await deleteAtsAnalysis(jobId);
            setScores(null);
            setAnalysisId(null);
            if (pollingIntervalId.current) {
                clearInterval(pollingIntervalId.current);
                pollingIntervalId.current = null;
            }
        } catch (error: any) {
            console.error('Error deleting ATS analysis:', error);
        }
    };

    return {
        scores,
        isLoading,
        isScanning,
        progressMessage,
        isApplyingBatch,
        appliedSuggestions,
        analysisId,
        handleScan,
        handleApplySuggestion,
        handleDelete,
    };
};
