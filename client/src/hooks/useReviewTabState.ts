import { useEffect, useState } from 'react';
import { NavigateFunction } from 'react-router-dom';
import { ActiveReviewTab, isActiveReviewTab } from '../components/review-finalize/reviewTabs';

interface UseReviewTabStateParams {
    jobId?: string;
    tab?: string;
    navigate: NavigateFunction;
}

interface UseReviewTabStateResult {
    activeTab: ActiveReviewTab;
    handleTabChange: (newTab: ActiveReviewTab) => void;
}

export function useReviewTabState({
    jobId,
    tab,
    navigate,
}: UseReviewTabStateParams): UseReviewTabStateResult {
    const [activeTab, setActiveTab] = useState<ActiveReviewTab>(() => {
        if (tab && isActiveReviewTab(tab)) {
            return tab;
        }

        if (jobId) {
            try {
                const saved = localStorage.getItem(`job_tab_${jobId}`);
                if (saved && isActiveReviewTab(saved)) {
                    return saved;
                }
            } catch (error) {
                console.error('Error reading tab from localStorage', error);
            }
        }

        return 'job-description';
    });

    const handleTabChange = (newTab: ActiveReviewTab) => {
        setActiveTab(newTab);
        localStorage.setItem(`job_tab_${jobId}`, newTab);
        navigate(`/jobs/${jobId}/workspace/${newTab}`);
    };

    useEffect(() => {
        if (tab && isActiveReviewTab(tab)) {
            setActiveTab(tab);
        }
    }, [tab]);

    useEffect(() => {
        if (!jobId || tab) {
            return;
        }

        const saved = localStorage.getItem(`job_tab_${jobId}`);
        if (saved && isActiveReviewTab(saved)) {
            setActiveTab(saved);
            return;
        }

        setActiveTab('job-description');
    }, [jobId, tab]);

    return {
        activeTab,
        handleTabChange,
    };
}
