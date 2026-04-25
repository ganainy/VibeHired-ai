// client/src/components/jobs/MaterialPreviewModal.tsx
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { InterviewMaterial, MaterialType } from '../../types/interviewMaterial';
// @ts-ignore
import pdfMake from 'pdfmake/build/pdfmake';
// @ts-ignore
import pdfFonts from 'pdfmake/build/vfs_fonts';
// @ts-ignore
import Showdown from 'showdown';
// @ts-ignore
import htmlToPdfMake from 'html-to-pdfmake';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';

// @ts-ignore
if (pdfFonts && pdfFonts.pdfMake) {
    // @ts-ignore
    pdfMake.vfs = pdfFonts.pdfMake.vfs;
}

// ── URL utilities ─────────────────────────────────────────────────────────────

/**
 * Convert a Cloudinary raw/image URL to a version that forces inline (non-attachment) delivery.
 * Injects `fl_attachment:false` into the transformation path.
 *   Before: …/upload/{public_id}
 *   After:  …/upload/fl_attachment:false/{public_id}
 */
function toInlineCloudinaryUrl(url: string): string {
    return url.replace('/upload/', '/upload/fl_attachment:false/');
}

function toDownloadCloudinaryUrl(url: string): string {
    return url.replace('/upload/', '/upload/fl_attachment/');
}

/**
 * Build the actual URL to display in the iframe / img tag:
 * - images  → Cloudinary inline URL
 * - pdf     → Cloudinary inline URL (browser built-in PDF viewer)
 * - docx    → Google Docs Viewer embed
 * - link    → external URL as-is
 */
export function buildPreviewUrl(material: InterviewMaterial): string | null {
    if (material.type === 'text' || material.type === 'markdown') return null; // handled as content
    if (material.type === 'link') return material.url ?? null;

    if (!material.cloudinaryUrl) return null;

    const inlineUrl = toInlineCloudinaryUrl(material.cloudinaryUrl || '');

    // Both PDF and DOCX go through Google Docs Viewer — avoids Cloudinary CORS /
    // Content-Disposition issues and the unreliable <object>/iframe onLoad behavior.
    if (material.type === 'pdf' || material.type === 'docx') {
        return `https://docs.google.com/viewer?url=${encodeURIComponent(inlineUrl)}&embedded=true`;
    }

    // image → inline URL works natively
    return inlineUrl;
}

/** Returns true if this material type can be previewed inside the site */
export function canPreviewInline(type: MaterialType): boolean {
    return ['pdf', 'image', 'docx', 'text', 'markdown'].includes(type);
}

/** Download format options */
export type DownloadFormat = 'original' | 'pdf' | 'markdown' | 'docx';

/** Generate PDF from markdown content */
async function generatePdfFromMarkdown(markdownContent: string | undefined, title: string): Promise<void> {
    const content = markdownContent || '';

    const converter = new Showdown.Converter();
    const html = converter.makeHtml(content);
    
    const pdfContent = htmlToPdfMake(html);

    const docDefinition: any = {
        content: pdfContent,
        pageSize: 'A4',
        pageMargins: [15, 15, 15, 15],
    };

    // @ts-ignore
    pdfMake.createPdf(docDefinition).download(`${title}.pdf`);
}

/** Parse inline markdown and create TextRun array */
function parseInlineMarkdown(text: string): TextRun[] {
    const runs: TextRun[] = [];
    let remaining = text;
    
    while (remaining.length > 0) {
        // Bold **text** or __text__
        const boldMatch = remaining.match(/^(\*\*|__)(.+?)(\1)/);
        if (boldMatch) {
            runs.push(new TextRun({ text: boldMatch[2], bold: true }));
            remaining = remaining.slice(boldMatch[0].length);
            continue;
        }
        
        // Italic *text* or _text_
        const italicMatch = remaining.match(/^(\*|_)([^*_]+)\1/);
        if (italicMatch) {
            runs.push(new TextRun({ text: italicMatch[2], italics: true }));
            remaining = remaining.slice(italicMatch[0].length);
            continue;
        }
        
        // Inline code `code`
        const codeMatch = remaining.match(/^`([^`]+)`/);
        if (codeMatch) {
            runs.push(new TextRun({ 
                text: codeMatch[1], 
                font: 'Courier New',
                shading: { fill: 'f0f0f0' }
            }));
            remaining = remaining.slice(codeMatch[0].length);
            continue;
        }
        
        // Regular text - take until next special char
        const nextSpecial = remaining.search(/[\*_`]/);
        if (nextSpecial === -1) {
            runs.push(new TextRun({ text: remaining }));
            break;
        } else if (nextSpecial === 0) {
            runs.push(new TextRun({ text: remaining[0] }));
            remaining = remaining.slice(1);
        } else {
            runs.push(new TextRun({ text: remaining.slice(0, nextSpecial) }));
            remaining = remaining.slice(nextSpecial);
        }
    }
    
    return runs;
}

/** Generate DOCX from markdown content */
async function generateDocxFromMarkdown(markdownContent: string | undefined, title: string): Promise<void> {
    const content = markdownContent || '';
    const lines = content.split('\n');
    const docChildren: Paragraph[] = [];

    docChildren.push(
        new Paragraph({
            text: title,
            heading: HeadingLevel.TITLE,
            spacing: { after: 400 },
            alignment: AlignmentType.CENTER,
        })
    );

    for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('# ')) {
            docChildren.push(
                new Paragraph({
                    text: trimmedLine.substring(2),
                    heading: HeadingLevel.HEADING_1,
                    spacing: { before: 400, after: 200 },
                })
            );
        } else if (trimmedLine.startsWith('## ')) {
            docChildren.push(
                new Paragraph({
                    text: trimmedLine.substring(3),
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 300, after: 150 },
                })
            );
        } else if (trimmedLine.startsWith('### ')) {
            docChildren.push(
                new Paragraph({
                    text: trimmedLine.substring(4),
                    heading: HeadingLevel.HEADING_3,
                    spacing: { before: 200, after: 100 },
                })
            );
        } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
            const itemText = trimmedLine.substring(2);
            docChildren.push(
                new Paragraph({
                    children: [
                        new TextRun({ text: '• ', bold: true }),
                        ...parseInlineMarkdown(itemText),
                    ],
                    spacing: { after: 100 },
                    indent: { left: 720 },
                })
            );
        } else if (trimmedLine === '') {
            docChildren.push(new Paragraph({ text: '' }));
        } else {
            docChildren.push(
                new Paragraph({
                    children: parseInlineMarkdown(trimmedLine),
                    spacing: { after: 100 },
                })
            );
        }
    }

    const doc = new Document({
        sections: [{
            properties: {},
            children: docChildren,
        }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${title}.docx`);
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface Props {
    material: InterviewMaterial;
    onClose: () => void;
}

const MaterialPreviewModal: React.FC<Props> = ({ material, onClose }) => {
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [iframeError, setIframeError] = useState(false);
    const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>('original');

    const previewUrl = buildPreviewUrl(material);
    const isTextContent = material.type === 'text' || material.type === 'markdown';

    const handleDownload = async () => {
        const title = material.title || 'Material';
        switch (downloadFormat) {
            case 'original':
                if (material.type === 'text' || material.type === 'markdown') {
                    const blob = new Blob([material.content || ''], { type: 'text/plain' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${title}.${material.type === 'markdown' ? 'md' : 'txt'}`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                } else if (material.cloudinaryUrl) {
                    const downloadUrl = toDownloadCloudinaryUrl(material.cloudinaryUrl);
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = material.originalFilename || title;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
                break;
            case 'pdf':
                if (isTextContent) {
                    await generatePdfFromMarkdown(material.content, title);
                } else {
                    const downloadUrl = toDownloadCloudinaryUrl(material.cloudinaryUrl || '');
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = `${title}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
                break;
            case 'markdown':
                if (material.content) {
                    const blob = new Blob([material.content], { type: 'text/markdown' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${title}.md`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                }
                break;
            case 'docx':
                if (isTextContent && material.content) {
                    await generateDocxFromMarkdown(material.content, title);
                } else {
                    const downloadUrl = toDownloadCloudinaryUrl(material.cloudinaryUrl || '');
                    const a = document.createElement('a');
                    a.href = downloadUrl;
                    a.download = `${title}.docx`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                }
                break;
        }
    };

    // Close on backdrop click
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
    };

    // Close on Escape
    React.useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const modal = (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={handleBackdropClick}
        >
            <div
                className="relative w-full flex flex-col rounded-2xl shadow-2xl overflow-hidden"
                style={{
                    maxWidth: '900px',
                    height: isTextContent ? 'auto' : '85vh',
                    maxHeight: '90vh',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b"
                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span
                            className={`material-symbols-outlined text-lg flex-shrink-0 ${
                                material.type === 'pdf' ? 'text-error'
                                : material.type === 'image' ? 'text-purple-500'
                                : material.type === 'docx' ? 'text-green-house'
                                : material.type === 'markdown' ? 'text-cyan-500'
                                : 'text-green'
                            }`}
                        >
                            {material.type === 'pdf' ? 'picture_as_pdf'
                                : material.type === 'image' ? 'image'
                                : material.type === 'docx' ? 'description'
                                : material.type === 'markdown' ? 'code'
                                : 'article'}
                        </span>
                        <div className="min-w-0">
                             <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                {material.title || 'Untitled'}
                            </p>
                            {material.originalFilename && (
                                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                    {material.originalFilename}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Download Format */}
                        {material.type !== 'link' && (
                            <>
                                <select
                                    value={downloadFormat}
                                    onChange={(e) => setDownloadFormat(e.target.value as DownloadFormat)}
                                    className="text-xs px-2 py-1.5 rounded-lg border transition-colors"
                                    style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                                >
                                    <option value="original">Original</option>
                                    <option value="pdf">PDF</option>
                                    <option value="markdown">Markdown</option>
                                    <option value="docx">Word (DOCX)</option>
                                </select>
                                <button
                                    onClick={handleDownload}
                                    title="Download"
                                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors hover:text-green"
                                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface)' }}
                                >
                                    <span className="material-symbols-outlined text-sm">download</span>
                                </button>
                            </>
                        )}

                        {/* Open externally — link directly to the Cloudinary inline URL, not the GDocs viewer */}
                        {material.type !== 'text' && material.type !== 'markdown' && material.cloudinaryUrl && (
                            <a
                                href={toInlineCloudinaryUrl(material.cloudinaryUrl || '')}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open in new tab"
                                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
                                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface)' }}
                            >
                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                Open
                            </a>
                        )}
                        {/* For links, show the external URL */}
                        {material.type === 'link' && material.url && (
                            <a
                                href={material.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open link"
                                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors"
                                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface)' }}
                            >
                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                Open
                            </a>
                        )}
                        {/* Close */}
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg transition-colors hover:bg-opacity-10 hover:bg-gray-500"
                            style={{ color: 'var(--text-muted)' }}
                            aria-label="Close preview"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden relative">

                    {/* ── Text / Markdown ── */}
                    {isTextContent && (
                        <div className="overflow-y-auto p-5 max-h-[70vh]">
                            {material.type === 'markdown' ? (
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        h1: ({ children }) => <h1 className="text-xl font-bold mt-5 mb-3 pb-1 border-b" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}>{children}</h1>,
                                        h2: ({ children }) => <h2 className="text-lg font-bold mt-4 mb-2" style={{ color: 'var(--text-primary)' }}>{children}</h2>,
                                        h3: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1.5" style={{ color: 'var(--text-primary)' }}>{children}</h3>,
                                        p: ({ children }) => <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-primary)' }}>{children}</p>,
                                        ul: ({ children }) => <ul className="text-sm list-disc pl-5 mb-3 space-y-1" style={{ color: 'var(--text-primary)' }}>{children}</ul>,
                                        ol: ({ children }) => <ol className="text-sm list-decimal pl-5 mb-3 space-y-1" style={{ color: 'var(--text-primary)' }}>{children}</ol>,
                                        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                                        blockquote: ({ children }) => <blockquote className="border-l-4 pl-4 my-3 italic text-sm" style={{ borderColor: 'var(--accent)', color: 'var(--text-secondary)' }}>{children}</blockquote>,
                                        code: ({ children, className }) => className ? (
                                            <code className="block text-xs font-mono p-3 rounded-lg overflow-x-auto mb-3" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}>{children}</code>
                                        ) : (
                                            <code className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--accent)' }}>{children}</code>
                                        ),
                                        pre: ({ children }) => <pre className="mb-3 overflow-x-auto">{children}</pre>,
                                        strong: ({ children }) => <strong className="font-semibold" style={{ color: 'var(--text-primary)' }}>{children}</strong>,
                                        em: ({ children }) => <em className="italic">{children}</em>,
                                        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="underline hover:opacity-80" style={{ color: 'var(--accent)' }}>{children}</a>,
                                        hr: () => <hr className="my-4" style={{ borderColor: 'var(--border)' }} />,
                                        table: ({ children }) => (
                                            <div className="overflow-x-auto mb-4">
                                                <table className="w-full text-sm border-collapse" style={{ borderColor: 'var(--border)' }}>{children}</table>
                                            </div>
                                        ),
                                        thead: ({ children }) => <thead style={{ backgroundColor: 'var(--bg-elevated)' }}>{children}</thead>,
                                        tbody: ({ children }) => <tbody>{children}</tbody>,
                                        tr: ({ children }) => <tr className="border-b" style={{ borderColor: 'var(--border)' }}>{children}</tr>,
                                        th: ({ children }) => <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide border-r last:border-r-0" style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>{children}</th>,
                                        td: ({ children }) => <td className="px-3 py-2 border-r last:border-r-0" style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}>{children}</td>,
                                    }}
                                >
                                    {material.content ?? '*(empty)*'}
                                </ReactMarkdown>
                            ) : (
                                <p
                                    className="text-sm whitespace-pre-wrap leading-relaxed"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    {material.content ?? '(empty)'}
                                </p>
                            )}
                        </div>
                    )}

                    {/* ── Image ── */}
                    {material.type === 'image' && previewUrl && (
                        <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                             <img
                                src={previewUrl}
                                alt={material.title || 'Material Image'}
                                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                                style={{ maxHeight: 'calc(85vh - 60px)' }}
                            />
                        </div>
                    )}

                    {/* ── PDF + DOCX — Google Docs Viewer iframe ── */}
                    {(material.type === 'pdf' || material.type === 'docx') && previewUrl && (
                        <>
                            {!iframeLoaded && !iframeError && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                                    <div
                                        className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                                        style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
                                    />
                                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                        {material.type === 'pdf' ? 'Loading PDF...' : 'Loading document...'}
                                    </p>
                                </div>
                            )}
                            {iframeError ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                                    <span className="material-symbols-outlined text-4xl text-red-400">error_outline</span>
                                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Could not load preview</p>
                                    {material.cloudinaryUrl && (
                                        <a
                                            href={toInlineCloudinaryUrl(material.cloudinaryUrl || '')}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium transition-all"
                                            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text, #1a1200)' }}
                                        >
                                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                                            Open file
                                        </a>
                                    )}
                                </div>
                            ) : (
                                 <iframe
                                    src={previewUrl}
                                    title={material.title || 'Material Preview'}
                                    className="w-full h-full border-0"
                                    style={{ opacity: iframeLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
                                    onLoad={() => setIframeLoaded(true)}
                                    onError={() => { setIframeError(true); setIframeLoaded(true); }}
                                />
                            )}
                        </>
                    )}
                </div>

                {/* Description footer */}
                {material.description && (
                    <div
                        className="px-4 py-2.5 flex-shrink-0 border-t text-xs"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', backgroundColor: 'var(--bg-elevated)' }}
                    >
                        {material.description}
                    </div>
                )}
            </div>
        </div>
    );

    return ReactDOM.createPortal(modal, document.body);
};

export default MaterialPreviewModal;
