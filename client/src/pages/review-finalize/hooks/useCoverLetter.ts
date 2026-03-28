import { useState, useEffect } from 'react';
import { JobApplication } from '../../../services/jobApi';
import { generateCoverLetter } from '../../../services/coverLetterApi';
import { DEFAULT_COVER_LETTER_PROMPT } from '../../../constants/prompts';
import { CoverLetterBase } from '../../../services/coverLetterBaseApi';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { getPdfFilename } from '../utils/filenameHelpers';
import { getStoredValue, setStoredValue } from '../utils/localStorageHelpers';

export const useCoverLetter = (jobId: string | undefined, jobApplication: JobApplication | null) => {
    const [text, setText] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [baseLetters, setBaseLetters] = useState<CoverLetterBase[]>([]);
    const [showLibrary, setShowLibrary] = useState(false);
    const [selectedBaseId, setSelectedBaseId] = useState('');
    const [creationMode, setCreationMode] = useState<'ai' | 'import'>('ai');
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [isApplying, setIsApplying] = useState(false);
    const [applyError, setApplyError] = useState<string | null>(null);

    const [selectedClBaseCvId, setSelectedClBaseCvId] = useState<string>(() =>
        getStoredValue('job_selectedClBaseCvId', jobId)
    );
    const [clCustomInstructions, setClCustomInstructions] = useState<string>('');

    useEffect(() => {
        setText(jobApplication?.draftCoverLetterText || '');
    }, [jobApplication]);

    const handleGenerate = async () => {
        if (!jobId) return;

        setIsGenerating(true);
        setError(null);

        try {
            const fullPrompt = DEFAULT_COVER_LETTER_PROMPT + "\n\n**USER INSTRUCTIONS:**\n" + clCustomInstructions;
            const language = jobApplication?.language || 'en' as 'en' | 'de';

            const { availableCvs } = await import('../../../services/cvApi');
            const selectedOption = availableCvs.find(cv => cv._id === selectedClBaseCvId);
            const baseCvDataToUse = selectedOption?.cvJson || null;

            const response = await generateCoverLetter(jobId, language, baseCvDataToUse);
            const { text: generatedText, suggestedFilename } = response;

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
        baseLetters,
        showLibrary,
        selectedClBaseCvId,
        handleGenerate,
        handleCopyCoverLetter,
        handleDownloadWord,
    };
};
