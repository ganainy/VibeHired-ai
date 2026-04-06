import { useState } from 'react';
import { JsonResumeSchema } from '../../../../../server/src/types/jsonresume';
import { renderFinalPdfs, renderCvPdf, renderCoverLetterPdf, getDownloadUrl } from '../../../services/generatorApi';
import axios from 'axios';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { getPdfFilename } from '../utils/filenameHelpers';

interface PdfFiles {
    cv: string | null;
    cl: string | null;
}

export const usePdfGeneration = (jobId: string | undefined, cvData: JsonResumeSchema, coverLetterText: string) => {
    const [isRenderingPdf, setIsRenderingPdf] = useState(false);
    const [isRenderingCvPdf, setIsRenderingCvPdf] = useState(false);
    const [isRenderingClPdf, setIsRenderingClPdf] = useState(false);
    const [renderError, setRenderError] = useState<string | null>(null);
    const [isLoadingRawPdf, setIsLoadingRawPdf] = useState(false);
    const [finalPdfFiles, setFinalPdfFiles] = useState<PdfFiles>({ cv: null, cl: null });

    const handleGenerateFinalPdfs = async () => {
        if (!jobId) return;

        setIsRenderingPdf(true);
        setRenderError(null);

        try {
            const result = await renderFinalPdfs(jobId);
            setFinalPdfFiles({
                cv: result.cvFilename || null,
                cl: result.coverLetterFilename || null,
            });
        } catch (error: any) {
            console.error('Error generating PDFs:', error);
            setRenderError(error.response?.data instanceof Blob
                ? 'Failed to generate PDF'
                : error.message || 'Failed to generate PDF');
        } finally {
            setIsRenderingPdf(false);
        }
    };

    const handleGenerateCvPdf = async () => {
        if (!jobId) return;

        setIsRenderingCvPdf(true);
        setRenderError(null);

        try {
            const result = await renderCvPdf(jobId);
            setFinalPdfFiles((prev) => ({ ...prev, cv: result.cvFilename || prev.cv }));
        } catch (error: any) {
            console.error('Error generating CV PDF:', error);
            setRenderError(error.response?.data instanceof Blob
                ? 'Failed to generate CV PDF'
                : error.message || 'Failed to generate CV PDF');
        } finally {
            setIsRenderingCvPdf(false);
        }
    };

    const handleGenerateCoverLetterPdf = async () => {
        if (!jobId) return;

        setIsRenderingClPdf(true);
        setRenderError(null);

        try {
            const result = await renderCoverLetterPdf(jobId);
            setFinalPdfFiles((prev) => ({ ...prev, cl: result.coverLetterFilename || prev.cl }));
        } catch (error: any) {
            console.error('Error generating CL PDF:', error);
            setRenderError(error.response?.data instanceof Blob
                ? 'Failed to generate CL PDF'
                : error.message || 'Failed to generate CL PDF');
        } finally {
            setIsRenderingClPdf(false);
        }
    };

    const handleDownload = async (filename: string | null) => {
        if (!filename) return;

        setIsLoadingRawPdf(true);
        setRenderError(null);

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
        } catch (error: any) {
            console.error('Error downloading PDF:', error);
            setRenderError(error.response?.data instanceof Blob
                ? 'Failed to download PDF'
                : error.message || 'Failed to download PDF');
        } finally {
            setIsLoadingRawPdf(false);
        }
    };

    const handleDownloadWord = async () => {
        const paragraphs = coverLetterText.split('\n').map(line => {
            const trimmed = line.trim();
            return trimmed.length === 0
                ? new Paragraph({
                    children: [new TextRun({
                        text: ' ',
                        break: 1
                    })]
                })
                : new Paragraph({
                    children: [new TextRun({
                        text: trimmed
                    })]
                });
        });

        const doc = new Document({
            sections: [{
                properties: {},
                children: paragraphs
            }]
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, getPdfFilename({ companyName: '', jobTitle: '', language: 'en' }) + '.docx');
    };

    return {
        isRenderingPdf,
        isRenderingCvPdf,
        isRenderingClPdf,
        renderError,
        isLoadingRawPdf,
        finalPdfFiles,
        handleGenerateFinalPdfs,
        handleGenerateCvPdf,
        handleGenerateCoverLetterPdf,
        handleDownload,
        handleDownloadWord,
    };
};
