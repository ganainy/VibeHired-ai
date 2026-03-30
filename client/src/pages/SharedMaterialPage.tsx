// client/src/pages/SharedMaterialPage.tsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getSharedMaterial } from '../services/interviewMaterialsApi';
import { InterviewMaterial, MaterialType } from '../types/interviewMaterial';

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconForType(type: MaterialType): string {
    switch (type) {
        case 'pdf': return 'picture_as_pdf';
        case 'image': return 'image';
        case 'docx': return 'description';
        case 'text': return 'article';
        case 'markdown': return 'code';
        case 'link': return 'link';
        default: return 'attach_file';
    }
}

function colorForType(type: MaterialType): string {
    switch (type) {
        case 'pdf': return 'var(--error)';
        case 'image': return 'var(--accent)';
        case 'docx': return 'var(--info)';
        case 'text': return 'var(--success)';
        case 'markdown': return 'var(--text-secondary)';
        case 'link': return 'var(--warning)';
        default: return 'var(--text-muted)';
    }
}

const SharedMaterialPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const [material, setMaterial] = useState<InterviewMaterial | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadMaterial = async () => {
            if (!token) return;
            try {
                setLoading(true);
                const data = await getSharedMaterial(token);
                setMaterial(data);
            } catch (e: any) {
                setError(e.message ?? 'Material not found or link has expired');
            } finally {
                setLoading(false);
            }
        };
        loadMaterial();
    }, [token]);

    if (loading) {
        return (
            <div 
                className="min-h-screen flex items-center justify-center"
                style={{ backgroundColor: 'var(--bg-base)' }}
            >
                <div className="text-center">
                    <div 
                        className="inline-block w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mb-4"
                        style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }}
                    />
                    <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
                </div>
            </div>
        );
    }

    if (error || !material) {
        return (
            <div 
                className="min-h-screen flex items-center justify-center"
                style={{ backgroundColor: 'var(--bg-base)' }}
            >
                <div className="text-center max-w-md p-6">
                    <span className="material-symbols-outlined text-5xl mb-4" style={{ color: 'var(--text-muted)' }}>
                        error
                    </span>
                    <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                        Material Not Found
                    </h1>
                    <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                        {error ?? 'This shared link may have been revoked or does not exist.'}
                    </p>
                    <Link 
                        to="/login"
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                        style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-base)' }}
                    >
                        Go to Login
                    </Link>
                </div>
            </div>
        );
    }

    const isLink = material.type === 'link';
    const hasContent = material.type === 'text' || material.type === 'markdown';

    return (
        <div 
            className="min-h-screen py-8 px-4"
            style={{ backgroundColor: 'var(--bg-base)' }}
        >
            <div className="max-w-2xl mx-auto">
                <div className="mb-6">
                    <Link 
                        to="/login"
                        className="inline-flex items-center gap-1 text-sm transition-colors hover:underline"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        <span className="material-symbols-outlined text-base">arrow_back</span>
                        Go to Login to access your account
                    </Link>
                </div>

                <div 
                    className="rounded-xl border p-6"
                    style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
                >
                    <div className="flex items-start gap-4 mb-4">
                        <div className="flex-shrink-0 mt-0.5">
                            <span className="material-symbols-outlined text-3xl" style={{ color: colorForType(material.type) }}>
                                {iconForType(material.type)}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                                {material.title}
                            </h1>
                            <div className="flex flex-wrap items-center gap-2">
                                <span 
                                    className="text-xs px-2 py-0.5 rounded-full capitalize font-medium"
                                    style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)' }}
                                >
                                    {material.type}
                                </span>
                                {material.fileSize !== undefined && (
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        {formatBytes(material.fileSize)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {material.description && (
                        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                            {material.description}
                        </p>
                    )}

                    {isLink && material.url && (
                        <a
                            href={material.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                            style={{ backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)' }}
                        >
                            <span className="material-symbols-outlined text-base">open_in_new</span>
                            Open Link
                        </a>
                    )}

                    {hasContent && material.type === 'markdown' && (
                        <div 
                            className="p-4 rounded-lg overflow-auto"
                            style={{ 
                                backgroundColor: 'var(--bg-surface)', 
                                maxHeight: 'calc(100vh - 300px)',
                                minHeight: '200px'
                            }}
                        >
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
                                        <code className="block text-xs font-mono p-3 rounded-lg overflow-x-auto mb-3" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>{children}</code>
                                    ) : (
                                        <code className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--accent)' }}>{children}</code>
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
                                {material.content || ''}
                            </ReactMarkdown>
                        </div>
                    )}

                    {hasContent && material.type === 'text' && (
                        <div 
                            className="p-4 rounded-lg text-sm whitespace-pre-wrap overflow-auto"
                            style={{ 
                                backgroundColor: 'var(--bg-surface)', 
                                color: 'var(--text-primary)',
                                maxHeight: 'calc(100vh - 300px)',
                                minHeight: '200px'
                            }}
                        >
                            {material.content}
                        </div>
                    )}

                    {(material.type === 'pdf' || material.type === 'image' || material.type === 'docx') && material.cloudinaryUrl && (
                        <div className="space-y-3">
                            <a
                                href={material.cloudinaryUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                                style={{ backgroundColor: 'var(--accent)', color: 'var(--text-on-accent)' }}
                            >
                                <span className="material-symbols-outlined text-base">open_in_new</span>
                                View File
                            </a>
                            <a
                                href={material.cloudinaryUrl.replace('/upload/', '/upload/fl_attachment/')}
                                download={material.originalFilename || material.title}
                                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ml-2"
                                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                            >
                                <span className="material-symbols-outlined text-base">download</span>
                                Download
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SharedMaterialPage;
