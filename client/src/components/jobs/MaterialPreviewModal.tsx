// client/src/components/jobs/MaterialPreviewModal.tsx
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { InterviewMaterial, MaterialType } from '../../types/interviewMaterial';

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

    const inlineUrl = toInlineCloudinaryUrl(material.cloudinaryUrl);

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

// ── Modal ─────────────────────────────────────────────────────────────────────

interface Props {
    material: InterviewMaterial;
    onClose: () => void;
}

const MaterialPreviewModal: React.FC<Props> = ({ material, onClose }) => {
    const [iframeLoaded, setIframeLoaded] = useState(false);
    const [iframeError, setIframeError] = useState(false);

    const previewUrl = buildPreviewUrl(material);
    const isTextContent = material.type === 'text' || material.type === 'markdown';

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

    return (
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
                                material.type === 'pdf' ? 'text-red-500'
                                : material.type === 'image' ? 'text-purple-500'
                                : material.type === 'docx' ? 'text-blue-500'
                                : material.type === 'markdown' ? 'text-cyan-500'
                                : 'text-green-500'
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
                                {material.title}
                            </p>
                            {material.originalFilename && (
                                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                    {material.originalFilename}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Open externally — link directly to the Cloudinary inline URL, not the GDocs viewer */}
                        {material.type !== 'text' && material.type !== 'markdown' && material.cloudinaryUrl && (
                            <a
                                href={toInlineCloudinaryUrl(material.cloudinaryUrl)}
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
                                alt={material.title}
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
                                            href={toInlineCloudinaryUrl(material.cloudinaryUrl)}
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
                                    title={material.title}
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
};

export default MaterialPreviewModal;
