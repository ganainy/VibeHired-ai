// client/src/components/interview-materials/GlobalMaterialCard.tsx
import React, { useState } from 'react';
import { InterviewMaterial, MaterialJobRef, MaterialType } from '../../types/interviewMaterial';
import MaterialPreviewModal, { canPreviewInline } from '../jobs/MaterialPreviewModal';

interface GlobalMaterialCardProps {
    material: InterviewMaterial;
    showJobChip?: boolean;
    isAssignedToJob?: boolean;
    onRemoveGlobal: (id: string) => void;
    onDelete: (id: string) => void;
    onPreview: (m: InterviewMaterial) => void;
    onToggleFavorite: (id: string) => void;
    onEdit: (id: string, payload: import('../../types/interviewMaterial').UpdateMaterialPayload) => Promise<void>;
    onShare: (id: string) => void;
    onShowShare: (m: InterviewMaterial) => void;
    isUpdating: boolean;
}

const GlobalMaterialCard: React.FC<GlobalMaterialCardProps> = ({
    material,
    showJobChip = false,
    isAssignedToJob = false,
    onRemoveGlobal,
    onDelete,
    onPreview,
    onToggleFavorite,
    onEdit,
    onShare,
    onShowShare,
    isUpdating,
}) => {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState({
        title: material.title,
        description: material.description ?? '',
        content: material.content ?? '',
        url: material.url ?? '',
    });
    const [isSaving, setIsSaving] = useState(false);

    const EDITABLE_TYPES: MaterialType[] = ['text', 'markdown', 'link', 'docx'];
    const isEditable = EDITABLE_TYPES.includes(material.type);
    const hasContent = material.type === 'text' || material.type === 'markdown';
    const isLink = material.type === 'link';
    const clickable = !editMode && (canPreviewInline(material.type) || isLink);
    const jobRef = getJobRef(material);
    const jobId = getJobId(material);

    const handleCardClick = () => {
        if (editMode) return;
        if (isLink && material.url) {
            window.open(material.url, '_blank', 'noopener,noreferrer');
        } else if (canPreviewInline(material.type)) {
            onPreview(material);
        }
    };

    const openEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditForm({
            title: material.title,
            description: material.description ?? '',
            content: material.content ?? '',
            url: material.url ?? '',
        });
        setEditMode(true);
    };

    const handleSave = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!editForm.title.trim()) return;
        setIsSaving(true);
        try {
            const payload: import('../../types/interviewMaterial').UpdateMaterialPayload = {
                title: editForm.title.trim(),
                description: editForm.description.trim() || undefined,
                ...(hasContent ? { content: editForm.content } : {}),
                ...(isLink ? { url: editForm.url.trim() } : {}),
            };
            await onEdit(material._id, payload);
            setEditMode(false);
        } catch {
            // onEdit throws on failure — keep edit mode open
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (material.type === 'link') {
            if (material.url) window.open(material.url, '_blank', 'noopener,noreferrer');
            return;
        }
        if (material.type === 'text' || material.type === 'markdown') {
            const blob = new Blob([material.content || ''], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${material.title}.${material.type === 'markdown' ? 'md' : 'txt'}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            return;
        }
    };

    return (
        <div
            onClick={clickable ? handleCardClick : undefined}
            className="group relative flex flex-col p-4 rounded-2xl border border transition-all duration-300 overflow-hidden"
            style={{
                backgroundColor: editMode ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                borderColor: editMode ? 'var(--accent)' : 'var(--border)',
                borderWidth: editMode ? '2px' : '1px',
            }}
        >
            {editMode ? (
                /* Edit Mode */
                <div className="space-y-4" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' }}>
                                <span className="material-symbols-outlined text-base" style={{ color: 'var(--bg-base)' }}>
                                    {iconForType(material.type)}
                                </span>
                            </div>
                            <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                                Editing {material.type}
                            </span>
                        </div>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-4">
                        {/* Title */}
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                Title
                            </label>
                            <input
                                type="text"
                                value={editForm.title}
                                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                                className="w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                                style={{
                                    backgroundColor: 'var(--bg-surface)',
                                    borderColor: 'var(--border)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                Description
                                <span className="font-normal opacity-60">(optional)</span>
                            </label>
                            <textarea
                                value={editForm.description}
                                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                                rows={4}
                                className="w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-1 focus:ring-amber-400/50 resize-y font-mono"
                                style={{
                                    backgroundColor: 'var(--bg-surface)',
                                    borderColor: 'var(--border)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                        </div>

                        {/* Content (text / markdown) */}
                        {hasContent && (
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                    {material.type === 'markdown' ? 'Content (Markdown)' : 'Content'}
                                </label>
                                <textarea
                                    value={editForm.content}
                                    onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                                    rows={6}
                                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-1 focus:ring-amber-400/50 resize-y font-mono"
                                    style={{
                                        backgroundColor: 'var(--bg-surface)',
                                        borderColor: 'var(--border)',
                                        color: 'var(--text-primary)',
                                    }}
                                />
                            </div>
                        )}

                        {/* URL (link) */}
                        {isLink && (
                            <div>
                                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                                    URL
                                </label>
                                <input
                                    type="url"
                                    value={editForm.url}
                                    onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))}
                                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                                    style={{
                                        backgroundColor: 'var(--bg-surface)',
                                        borderColor: 'var(--border)',
                                        color: 'var(--text-primary)',
                                    }}
                                />
                            </div>
                        )}

                        {/* docx note */}
                        {material.type === 'docx' && (
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                To replace the file itself, delete this item and re-upload.
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2">
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !editForm.title.trim()}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                            style={{
                                backgroundColor: isSaving ? 'var(--bg-elevated)' : 'var(--accent)',
                                color: 'var(--bg-base)',
                            }}
                        >
                            {isSaving ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}>
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 018 8V0C5.373 0 0.5.373 0 12h4z"></path>
                                    </span>
                                    Saving…
                                </span>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-sm">check</span>
                                    Save Changes
                                </>
                            )}
                        </button>
                        <button
                            onClick={e => { e.stopPropagation(); setEditMode(false); }}
                            disabled={isSaving}
                            className="px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors disabled:opacity-50"
                            style={{
                                backgroundColor: 'var(--bg-surface)',
                                borderColor: 'var(--border)',
                                color: 'var(--text-secondary)',
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                /* Normal View */
                <>
                    {/* Icon + Title Row */}
                    <div className="flex items-start gap-4 mb-3">
                        {/* Type Icon */}
                        <div className="relative flex-shrink-0">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' }}>
                                <span className="material-symbols-outlined text-base" style={{ color: 'var(--bg-base)' }}>
                                    {iconForType(material.type)}
                                </span>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-0.5">
                            {/* Title */}
                            <p className="text-base font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                                {material.title}
                            </p>

                            {/* Metadata Row */}
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                <span
                                    className="px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider"
                                    style={{
                                        backgroundColor: 'var(--bg-surface)',
                                        color: 'var(--text-muted)',
                                    }}
                                >
                                    {material.type}
                                </span>

                                {material.fileSize !== undefined && (
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        {formatBytes(material.fileSize)}
                                    </span>
                                )}

                                {material.url && (
                                    <span className="truncate max-w-[180px] underline" style={{ color: 'var(--accent)' }}>
                                        {material.url}
                                    </span>
                                )}

                                {material.createdAt && (
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        {formatDate(material.createdAt)}
                                    </span>
                                )}

                                {/* Job chip (shown in flat view) */}
                                {showJobChip && jobRef && jobId && (
                                    <span
                                        className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:opacity-80"
                                        style={{
                                            backgroundColor: 'var(--accent-bg)',
                                            color: 'var(--accent)',
                                        }}
                                    >
                                        {jobRef.companyName} — {jobRef.jobTitle}
                                    </span>
                                )}
                            </div>

                            {/* Description */}
                            {material.description && (
                                <p className="text-sm mt-1 line-clamp-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                    {material.description}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center gap-2 mt-2 pl-9" onClick={(e) => e.stopPropagation()}>
                        {/* Favorite Star */}
                        <button
                            onClick={() => onToggleFavorite(material._id)}
                            disabled={isUpdating}
                            title={material.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            className="p-2 rounded-lg transition-all disabled:opacity-50"
                            style={{
                                color: material.isFavorite ? 'var(--accent)' : 'var(--text-muted)',
                                opacity: material.isFavorite ? 1 : 0.6,
                            }}
                        >
                            <span
                                className="material-symbols-outlined text-base"
                                style={material.isFavorite ? { fontVariationSettings: "'FILL' 1" } : undefined}
                            >
                                star
                            </span>
                        </button>

                        {/* Edit Button */}
                        {isEditable && (
                            <button
                                onClick={openEdit}
                                title="Edit"
                                disabled={isUpdating}
                                className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                <span className="material-symbols-outlined text-base">edit</span>
                            </button>
                        )}

                        {/* Download Button */}
                        {material.type !== 'link' && (
                            <button
                                onClick={handleDownload}
                                title="Download"
                                className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                <span className="material-symbols-outlined text-base">download</span>
                            </button>
                        )}

                        {/* Share / Open Button */}
                        {material.cloudinaryUrl ? (
                            <button
                                onClick={() => window.open(toDownloadCloudinaryUrl(material.cloudinaryUrl), '_blank', 'noopener,noreferrer')}
                                title="Open file"
                                className="p-2 rounded-lg transition-colors"
                                style={{ color: 'var(--accent)' }}
                            >
                                <span className="material-symbols-outlined text-base">open_in_new</span>
                            </button>
                        ) : material.shareToken ? (
                            <button
                                onClick={(e) => { e.stopPropagation(); onShowShare(material); }}
                                title="Sharing is on - click to manage"
                                className="p-2 rounded-lg transition-colors"
                                style={{ color: 'var(--accent)' }}
                            >
                                <span className="material-symbols-outlined text-base">link</span>
                            </button>
                        ) : (
                            <button
                                onClick={(e) => e.stopPropagation(); onShare(material._id); }}
                                title="Share"
                                disabled={isUpdating}
                                className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                <span className="material-symbols-outlined text-base">share</span>
                            </button>
                        )}

                        {/* Delete Button */}
                        {confirmDelete ? (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => onDelete(material._id)}
                                    disabled={isUpdating}
                                    className="text-xs px-3 py-1.5 rounded-md bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                                >
                                    Delete
                                </button>
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    className="text-xs px-3 py-1.5 rounded-md transition-colors"
                                    style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)' }}
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirmDelete(true)}
                                title="Delete"
                                disabled={isUpdating}
                                className="p-2 rounded-lg transition-colors hover:text-red-500 disabled:opacity-50"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                        )}

                        {/* Remove from Library Button */}
                        <button
                            onClick={() => onRemoveGlobal(material._id)}
                            disabled={isUpdating}
                            className="flex items-center gap-2 mt-2 text-xs transition-colors disabled:opacity-50 hover:text-red-500"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <span className="material-symbols-outlined text-sm">remove_circle_outline</span>
                            Remove from library
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default GlobalMaterialCard;
