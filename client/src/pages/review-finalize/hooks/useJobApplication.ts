import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getJobById, updateJob, JobApplication, scrapeJobDescriptionApi, extractJobFromTextApi, deleteJob } from '../../../services/jobApi';
import { getJobRecommendation, JobRecommendation } from '../../../services/jobRecommendationApi';
import { useAuth } from '../../../context/AuthContext';

export const useJobApplication = (jobId: string | undefined) => {
    const [job, setJob] = useState<JobApplication | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshError, setRefreshError] = useState<string | null>(null);

    const [recommendation, setRecommendation] = useState<JobRecommendation | null>(null);
    const [isRefreshingRecommendation, setIsRefreshingRecommendation] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [isExtractingWithAi, setIsExtractingWithAi] = useState(false);
    const [pastedJobText, setPastedJobText] = useState('');

    const navigate = useNavigate();
    const { refreshUsage } = useAuth();

    const fetchJobData = useCallback(async () => {
        if (!jobId) return;

        setIsLoading(true);
        setError(null);

        try {
            const data = await getJobById(jobId);
            setJob(data);


        } catch (error: any) {
            console.error('Error fetching job application:', error);
            setError(error.response?.data instanceof Blob
                ? 'Failed to fetch job details'
                : error.message || 'Failed to fetch job details');
        } finally {
            setIsLoading(false);
        }
    }, [jobId]);

    useEffect(() => {
        fetchJobData();
    }, [fetchJobData]);

    const handleRefresh = async () => {
        if (!jobId || !job) return;

        setIsRefreshing(true);
        setRefreshError(null);

        try {
            const response = await scrapeJobDescriptionApi(jobId);
            setJob(response.job);
            try { await refreshUsage(); } catch (e) { console.error('Failed to refresh credits UI:', e); }
        } catch (error: any) {
            console.error('Error refreshing job details:', error);
            setRefreshError(error.response?.data instanceof Blob
                ? 'Failed to refresh job details'
                : error.message || 'Failed to refresh job details');
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleExtractWithAi = async () => {
        if (!jobId || !job) return;

        setIsExtractingWithAi(true);
        setError(null);

        try {
            const updatedJob = await extractJobFromTextApi(jobId, pastedJobText.trim());
            setJob(updatedJob);
            setPastedJobText('');
            try { await refreshUsage(); } catch (e) { console.error('Failed to refresh credits UI:', e); }
        } catch (error: any) {
            console.error('Error extracting job details:', error);
            setError(error.response?.data instanceof Blob
                ? 'Failed to extract job details'
                : error.message || 'Failed to extract job details');
        } finally {
            setIsExtractingWithAi(false);
        }
    };

    const handleMarkAsApplied = async () => {
        if (!job || !job) return;

        try {
            const updatePayload: any = {
                status: 'Applied',
                appliedAt: new Date().toISOString(),
            };
            const updatedJob = await updateJob(job._id, updatePayload);
            setJob(updatedJob);
            try { await refreshUsage(); } catch (e) { console.error('Failed to refresh credits UI:', e); }
        } catch (error: any) {
            console.error('Error marking job as applied:', error);
        }
    };

    const handleDeleteJob = async () => {
        if (!job || !job) return;

        if (!confirm('Are you sure you want to delete this job application?')) return;

        try {
            await deleteJob(job._id);
            navigate('/jobs');
        } catch (error: any) {
            console.error('Error deleting job:', error);
        }
    };

    const handleRefreshRecommendation = async () => {
        if (!jobId) return;

        setIsRefreshingRecommendation(true);
        try {
            const result = await getJobRecommendation(jobId, true);
            setRecommendation(result);
        } catch (error: any) {
            console.error('Error refreshing recommendation:', error);
        } finally {
            setIsRefreshingRecommendation(false);
        }
    };

    return {
        job,
        isLoading,
        error,
        isRefreshing,
        refreshError,
        recommendation,
        isRefreshingRecommendation,
        isModalOpen,
        isExtractingWithAi,
        pastedJobText,
        handleRefresh,
        handleExtractWithAi,
        handleMarkAsApplied,
        handleDeleteJob,
        handleRefreshRecommendation,
        setIsModalOpen,
    };
};
