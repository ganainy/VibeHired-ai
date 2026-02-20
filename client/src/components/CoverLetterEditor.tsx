import React, { useRef, useEffect, useState, useCallback } from 'react';

interface CoverLetterEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

const CoverLetterEditor: React.FC<CoverLetterEditorProps> = ({
    value,
    onChange,
    placeholder = 'Your cover letter will appear here...',
    disabled = false,
    className = ''
}) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [formatStates, setFormatStates] = useState({
        bold: false,
        italic: false,
        underline: false
    });

    // Convert plain text to HTML (preserve newlines)
    const textToHtml = (text: string): string => {
        if (!text) return '';
        // Escape HTML and convert newlines to <br> tags
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
    };

    // Convert HTML to plain text (preserve newlines)
    const htmlToText = (html: string): string => {
        if (!html) return '';
        const temp = document.createElement('div');
        temp.innerHTML = html;
        // Convert <br> tags back to newlines
        return temp.innerText || temp.textContent || '';
    };

    // Initialize editor content when value changes externally
    useEffect(() => {
        if (editorRef.current && !isFocused) {
            const htmlContent = textToHtml(value);
            if (editorRef.current.innerHTML !== htmlContent) {
                editorRef.current.innerHTML = htmlContent;
            }
        }
    }, [value, isFocused]);

    const updateFormatStates = useCallback(() => {
        if (editorRef.current && document.activeElement === editorRef.current) {
            setFormatStates({
                bold: document.queryCommandState('bold'),
                italic: document.queryCommandState('italic'),
                underline: document.queryCommandState('underline')
            });
        }
    }, []);

    const handleInput = () => {
        if (editorRef.current) {
            const textContent = htmlToText(editorRef.current.innerHTML);
            onChange(textContent);
            updateFormatStates();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    };

    const handleFocus = () => {
        setIsFocused(true);
        updateFormatStates();
    };

    const handleBlur = () => {
        setIsFocused(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        // Handle keyboard shortcuts
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'b') {
                e.preventDefault();
                applyFormat('bold');
            } else if (e.key === 'i') {
                e.preventDefault();
                applyFormat('italic');
            } else if (e.key === 'u') {
                e.preventDefault();
                applyFormat('underline');
            }
        }
    };

    // Listen for selection changes
    useEffect(() => {
        if (isFocused) {
            const handleSelectionChange = () => {
                updateFormatStates();
            };
            document.addEventListener('selectionchange', handleSelectionChange);
            return () => {
                document.removeEventListener('selectionchange', handleSelectionChange);
            };
        }
    }, [isFocused, updateFormatStates]);

    const applyFormat = (command: string, value: string | boolean = false) => {
        document.execCommand(command, false, value as string);
        editorRef.current?.focus();
        // Update format states after a short delay to ensure command is applied
        setTimeout(updateFormatStates, 10);
    };

    return (
        <div className={`flex flex-col h-full min-h-0 ${className}`}>
            {/* Formatting Toolbar */}
            <div className="flex gap-1 mb-2 p-2 bg-gray-100 dark:bg-gray-600 rounded-t border-b border-gray-300 dark:border-gray-600 flex-shrink-0">
                <button
                    type="button"
                    onClick={() => applyFormat('bold')}
                    disabled={disabled}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        formatStates.bold
                            ? 'bg-blue-500 text-white'
                            : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-500'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="Bold (Ctrl+B)"
                    aria-label="Bold"
                >
                    <strong>B</strong>
                </button>
                <button
                    type="button"
                    onClick={() => applyFormat('italic')}
                    disabled={disabled}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        formatStates.italic
                            ? 'bg-blue-500 text-white'
                            : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-500'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="Italic (Ctrl+I)"
                    aria-label="Italic"
                >
                    <em>I</em>
                </button>
                <button
                    type="button"
                    onClick={() => applyFormat('underline')}
                    disabled={disabled}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                        formatStates.underline
                            ? 'bg-blue-500 text-white'
                            : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-500'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="Underline (Ctrl+U)"
                    aria-label="Underline"
                >
                    <u>U</u>
                </button>
            </div>

            {/* PDF-like Page Container */}
            <div className="flex-1 overflow-auto bg-gray-200 dark:bg-gray-900 p-4 min-h-0">
                <div className="mx-auto bg-white shadow-lg" style={{ maxWidth: '800px', minHeight: '1123px' }}>
                    {/* Editor Area */}
                    <div
                        ref={editorRef}
                        contentEditable={!disabled}
                        onInput={handleInput}
                        onPaste={handlePaste}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        onMouseUp={updateFormatStates}
                        className="outline-none"
                        style={{
                            fontFamily: 'Arial, Helvetica, sans-serif',
                            fontSize: '11pt',
                            lineHeight: '1.6',
                            color: '#333',
                            minHeight: '1123px',
                            padding: '40px',
                            margin: '0'
                        }}
                        data-placeholder={placeholder}
                        suppressContentEditableWarning={true}
                    />
                </div>
            </div>

            {/* Placeholder styling */}
            <style>{`
                [contenteditable][data-placeholder]:empty:before {
                    content: attr(data-placeholder);
                    color: #9ca3af;
                    pointer-events: none;
                }
            `}</style>
        </div>
    );
};

export default CoverLetterEditor;

