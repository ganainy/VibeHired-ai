import { useState, type Dispatch, type SetStateAction } from 'react';
import axios from 'axios';
import { renderCoverLetterPdf, getDownloadUrl } from '../../../services/generatorApi';
import { updateJob, JobApplication } from '../../../services/jobApi';

interface UseReviewCoverLetterPdfParams {
    jobId?: string;
    coverLetterText: string;
    jobApplication: JobApplication | null;
    setJobApplication: Dispatch<SetStateAction<JobApplication | null>>;
    setFinalPdfFiles: Dispatch<SetStateAction<{ cv: string | null; cl: string | null }>>;
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const useReviewCoverLetterPdf = ({
    jobId,
    coverLetterText,
    jobApplication,
    setJobApplication,
    setFinalPdfFiles,
    showToast,
}: UseReviewCoverLetterPdfParams) => {
    const [isRenderingCoverLetterPdf, setIsRenderingCoverLetterPdf] = useState<boolean>(false);
    const [renderError, setRenderError] = useState<string | null>(null);

    const handleDownload = async (filename: string | null) => {
        if (!filename) return;
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                throw new Error('No authentication token found.');
            }

            const url = getDownloadUrl(filename);
            const response = await axios.get(url, {
                responseType: 'blob',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            const blob = new Blob([response.data], { type: response.headers['content-type'] });
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
            showToast('Download started', 'success');
        } catch (error: any) {
            const errorMessage = error.response?.data instanceof Blob
                ? await error.response.data.text()
                : error.response?.data?.message || error.message || 'An unknown error occurred during download.';
            showToast(`Failed to download: ${errorMessage}`, 'error');
        }
    };

    const handleGenerateCoverLetterPdf = async () => {
        if (!jobId) return;

        setIsRenderingCoverLetterPdf(true);
        setRenderError(null);

        try {
            const updatePayload: any = {
                draftCoverLetterText: coverLetterText,
            };

            if (coverLetterText && coverLetterText.trim().length > 0) {
                const currentStatus = jobApplication?.generationStatus;
                if (currentStatus !== 'finalized') {
                    updatePayload.generationStatus = 'draft_ready';
                }
            }

            await updateJob(jobId, updatePayload);
            setJobApplication(prev => (prev ? { ...prev, ...updatePayload } : null));

            const result = await renderCoverLetterPdf(jobId);
            setFinalPdfFiles(prev => ({ ...prev, cl: result.coverLetterFilename }));
            setJobApplication(prev => (
                prev
                    ? {
                        ...prev,
                        generationStatus: 'finalized',
                        generatedCoverLetterFilename: result.coverLetterFilename,
                    }
                    : null
            ));
            showToast('Cover Letter PDF generated successfully', 'success');

            await handleDownload(result.coverLetterFilename);
        } catch (error: any) {
            console.error('Error generating Cover Letter PDF:', error);
            setRenderError(error.message || 'Failed to generate Cover Letter PDF.');
        } finally {
            setIsRenderingCoverLetterPdf(false);
        }
    };

    return {
        isRenderingCoverLetterPdf,
        renderError,
        handleDownload,
        handleGenerateCoverLetterPdf,
    };
};
