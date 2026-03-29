import React, { useState, useMemo } from 'react';

interface EmailFormatModalProps {
    isOpen: boolean;
    onClose: () => void;
    coverLetterText: string;
    jobTitle: string;
    companyName: string;
    language: 'en' | 'de';
    hiringManagerName?: string;
    contactEmail?: string;
    // New structured email fields from AI
    emailSubject?: string;
    emailBody?: string;
    emailRecipient?: string;
}

const EmailFormatModal: React.FC<EmailFormatModalProps> = ({
    isOpen,
    onClose,
    coverLetterText,
    jobTitle,
    companyName,
    language,
    contactEmail,
    emailSubject: providedEmailSubject,
    emailBody: providedEmailBody,
    emailRecipient: providedEmailRecipient
}) => {
    const [copiedSubject, setCopiedSubject] = useState(false);
    const [copiedBody, setCopiedBody] = useState(false);
    const [copiedRecipient, setCopiedRecipient] = useState(false);

    // Use AI-generated subject if available, otherwise generate one
    const emailSubject = useMemo(() => {
        if (providedEmailSubject) {
            return providedEmailSubject;
        }
        if (language === 'de') {
            return `Bewerbung als ${jobTitle} – ${companyName}`;
        }
        return `Application for ${jobTitle} position – ${companyName}`;
    }, [providedEmailSubject, jobTitle, companyName, language]);

    // Use AI-generated body if available, otherwise generate one
    const emailBody = useMemo(() => {
        if (providedEmailBody) {
            return providedEmailBody;
        }

        // Fallback: Generate email body from cover letter
        // Attachment note based on language
        const attachmentNote = language === 'de'
            ? '\n\nIm Anhang finden Sie meinen Lebenslauf sowie meine Zeugnisse und Zertifikate.\n\nMit freundlichen Grüßen'
            : '\n\nPlease find attached my CV along with my certificates.\n\nBest regards';
        
        // Find where the closing is
        const closingPatterns = language === 'de'
            ? ['Mit freundlichen Grüßen', 'Freundliche Grüße', 'Beste Grüße', 'Hochachtungsvoll']
            : ['Best regards', 'Sincerely', 'Yours sincerely', 'Kind regards', 'Yours faithfully'];
        
        let bodyText = coverLetterText;
        let hasClosing = false;
        
        // Check if cover letter already has a closing
        for (const pattern of closingPatterns) {
            if (coverLetterText.toLowerCase().includes(pattern.toLowerCase())) {
                hasClosing = true;
                break;
            }
        }
        
        // If no closing found, add the attachment note before the end
        if (!hasClosing) {
            bodyText = coverLetterText.trim() + attachmentNote;
        } else {
            // Try to insert attachment note before the closing
            let insertPosition = -1;
            for (const pattern of closingPatterns) {
                const idx = bodyText.toLowerCase().indexOf(pattern.toLowerCase());
                if (idx !== -1) {
                    insertPosition = idx;
                    break;
                }
            }
            
            if (insertPosition !== -1) {
                // Insert attachment note before the closing
                const beforeClosing = bodyText.substring(0, insertPosition).trim();
                const closingAndAfter = bodyText.substring(insertPosition);
                const attachmentText = language === 'de'
                    ? '\n\nIm Anhang finden Sie meinen Lebenslauf sowie meine Zeugnisse und Zertifikate.\n\n'
                    : '\n\nPlease find attached my CV along with my certificates.\n\n';
                bodyText = beforeClosing + attachmentText + closingAndAfter;
            } else {
                bodyText = coverLetterText.trim() + attachmentNote;
            }
        }
        
        return bodyText;
    }, [providedEmailBody, coverLetterText, language]);

    // Show AI recipient when available, otherwise fall back to extracted contact email.
    const displayRecipient = (providedEmailRecipient && providedEmailRecipient.trim())
        ? providedEmailRecipient.trim()
        : (contactEmail && contactEmail.trim())
            ? contactEmail.trim()
            : null;

    const handleCopySubject = async () => {
        try {
            await navigator.clipboard.writeText(emailSubject);
            setCopiedSubject(true);
            setTimeout(() => setCopiedSubject(false), 2000);
        } catch (err) {
            console.error('Failed to copy subject:', err);
        }
    };

    const handleCopyBody = async () => {
        try {
            await navigator.clipboard.writeText(emailBody);
            setCopiedBody(true);
            setTimeout(() => setCopiedBody(false), 2000);
        } catch (err) {
            console.error('Failed to copy body:', err);
        }
    };

    const handleCopyRecipient = async () => {
        if (!displayRecipient) return;
        try {
            await navigator.clipboard.writeText(displayRecipient);
            setCopiedRecipient(true);
            setTimeout(() => setCopiedRecipient(false), 2000);
        } catch (err) {
            console.error('Failed to copy recipient:', err);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden mx-4">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-2xl">mail</span>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                            {language === 'de' ? 'E-Mail Format' : 'Email Format'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        <span className="material-symbols-outlined text-gray-500 dark:text-gray-400">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    {/* Info Banner */}
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                        <div className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl">info</span>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                {language === 'de' 
                                    ? 'Diese E-Mail enthält einen Hinweis auf angehängte Dokumente (Lebenslauf und Zeugnisse). Kopieren Sie Betreff und Text für Ihre Bewerbung.'
                                    : 'This email includes a note about attached documents (CV and certificates). Copy the subject and body for your application.'}
                            </p>
                        </div>
                    </div>

                    {/* To Field (Read-only) - Only show if AI returned a specific recipient */}
                    {displayRecipient && (
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {language === 'de' ? 'An' : 'To'}
                                </label>
                                <button
                                    onClick={handleCopyRecipient}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                                        copiedRecipient
                                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                    }`}
                                >
                                    {copiedRecipient ? (
                                        <>
                                            <span className="material-symbols-outlined text-sm">check</span>
                                            {language === 'de' ? 'Kopiert!' : 'Copied!'}
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-sm">content_copy</span>
                                            {language === 'de' ? 'Kopieren' : 'Copy'}
                                        </>
                                    )}
                                </button>
                            </div>
                            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                                <span className="material-symbols-outlined text-gray-400 text-lg">alternate_email</span>
                                <span className="text-gray-900 dark:text-gray-100">
                                    {displayRecipient}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Subject Field */}
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                {language === 'de' ? 'Betreff' : 'Subject'}
                            </label>
                            <button
                                onClick={handleCopySubject}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                                    copiedSubject
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                            >
                                {copiedSubject ? (
                                    <>
                                        <span className="material-symbols-outlined text-sm">check</span>
                                        {language === 'de' ? 'Kopiert!' : 'Copied!'}
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-sm">content_copy</span>
                                        {language === 'de' ? 'Kopieren' : 'Copy'}
                                    </>
                                )}
                            </button>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                            <p className="text-gray-900 dark:text-gray-100 font-medium">{emailSubject}</p>
                        </div>
                    </div>

                    {/* Body Field */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                {language === 'de' ? 'Text' : 'Body'}
                            </label>
                            <button
                                onClick={handleCopyBody}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                                    copiedBody
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                            >
                                {copiedBody ? (
                                    <>
                                        <span className="material-symbols-outlined text-sm">check</span>
                                        {language === 'de' ? 'Kopiert!' : 'Copied!'}
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-sm">content_copy</span>
                                        {language === 'de' ? 'Kopieren' : 'Copy'}
                                    </>
                                )}
                            </button>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 max-h-80 overflow-y-auto">
                            <pre className="whitespace-pre-wrap text-gray-900 dark:text-gray-100 font-sans text-sm leading-relaxed">
                                {emailBody}
                            </pre>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmailFormatModal;
