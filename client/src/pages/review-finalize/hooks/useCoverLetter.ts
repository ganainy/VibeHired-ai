import { useState, useEffect } from 'react';
import { JobApplication } from '../../../services/jobApi';
import { generateCoverLetter } from '../../../services/coverLetterApi';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun } from 'docx';

export const useCoverLetter = (jobId: string | undefined, jobApplication: JobApplication | null, humanize: boolean = true) => {
    const [text, setText] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setText(jobApplication?.draftCoverLetterText || '');
    }, [jobApplication]);

    const handleGenerate = async () => {
        if (!jobId) return;

        setIsGenerating(true);
        setError(null);

        try {
            const language = jobApplication?.language || 'en' as 'en' | 'de';

            const response = await generateCoverLetter(jobId, language, undefined, humanize);
            const { text: generatedText } = response;

            setText(generatedText);
        } catch (error: any) {
            console.error('Error generating cover letter:', error);
            setError(error.response?.data instanceof Blob
                ? 'Failed to generate cover letter'
                : error.message || 'Failed to generate cover letter');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopyCoverLetter = () => {
        if (!text) return;
        navigator.clipboard.writeText(text);
    };

    const handleDownloadWord = async () => {
        const paragraphs = text.split('\n').map(line => {
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
        const sanitize = (str: string) => str?.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_') || 'Unknown';
        const aiName = (jobApplication?.suggestedCoverLetterFilename || '').replace(/\.pdf$/i, '');
        const filename = (aiName || sanitize(jobApplication?.companyName || '') + '_Anschreiben') + '.docx';
        saveAs(blob, filename);
    };

    return {
        text,
        setText,
        isGenerating,
        error,
        handleGenerate,
        handleCopyCoverLetter,
        handleDownloadWord,
    };
};
