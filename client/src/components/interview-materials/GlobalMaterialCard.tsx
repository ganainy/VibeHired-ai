// client/src/components/interview-materials/GlobalMaterialCard.tsx
import React, { useState } from 'react';
import { InterviewMaterial, MaterialJobRef, MaterialType } from '../../types/interviewMaterial';
import { canPreviewInline } from '../jobs/MaterialPreviewModal';

// CSS variable-based palette (reads from design system in index.css)
const V = {
  accent: 'var(--accent)',
  accentHover: 'var(--accent-hover)',
  accentBg: 'var(--accent-bg)',
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  bgBase: 'var(--bg-base)',
  bgSurface: 'var(--bg-surface)',
  bgElevated: 'var(--bg-elevated)',
  border: 'var(--border)',
  borderSubtle: 'var(--border-subtle)',
  jade: 'var(--jade)',
  jadeBg: 'var(--jade-bg)',
  rose: 'var(--rose)',
  roseBg: 'var(--rose-bg)',
  info: 'var(--info)',
} as const;

// Legacy S palette for colors not in design system tokens
const S = {
  light: '#d4e9e2', // Light green tint for backgrounds
} as const;

function getJobRef(material: InterviewMaterial): MaterialJobRef | null {
  if (!material.jobApplicationId) return null;
  if (typeof material.jobApplicationId === 'string') return null;
  return material.jobApplicationId as MaterialJobRef;
}

function getJobId(material: InterviewMaterial): string | null {
  if (!material.jobApplicationId) return null;
  if (typeof material.jobApplicationId === 'string') return material.jobApplicationId;
  return (material.jobApplicationId as MaterialJobRef)._id;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
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
    case 'pdf': return '#c62828';
    case 'image': return '#7c3aed';
    case 'docx': return '#2563eb';
    case 'text': return '#059669';
    case 'markdown': return '#0891b2';
    case 'link': return '#ea580c';
    default: return V.textMuted;
  }
}

function toDownloadCloudinaryUrl(url: string): string {
  return url.replace('/upload/', '/upload/fl_attachment/');
}

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
  onAssignJob?: (id: string) => void;
  onUnassignJob?: (id: string) => void;
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
  onAssignJob,
  onUnassignJob,
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
  const [menuOpen, setMenuOpen] = useState(false);

  const EDITABLE_TYPES: MaterialType[] = ['text', 'markdown', 'link', 'docx'];
  const isEditable = EDITABLE_TYPES.includes(material.type);
  const hasContent = material.type === 'text' || material.type === 'markdown';
  const isLink = material.type === 'link';
  const clickable = !editMode && (canPreviewInline(material.type) || isLink);
  const jobRef = getJobRef(material);
  const jobId = getJobId(material);
  void isAssignedToJob;

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
    setMenuOpen(false);
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
    setMenuOpen(false);
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
    if (material.cloudinaryUrl) {
      window.open(toDownloadCloudinaryUrl(material.cloudinaryUrl), '_blank', 'noopener,noreferrer');
    }
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (material.shareToken) {
      onShowShare(material);
    } else {
      onShare(material._id);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    setConfirmDelete(true);
  };

  return (
    <div
      onClick={clickable ? handleCardClick : undefined}
      className={`card group relative flex flex-col p-4 rounded-xl transition-all duration-300 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
      style={{
        border: editMode ? `2px solid ${V.accent}` : undefined,
      }}
    >
      {editMode ? (
        /* Edit Mode */
        <div className="space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: S.light }}>
                <span className="material-symbols-outlined text-base" style={{ color: V.accent }}>
                  {iconForType(material.type)}
                </span>
              </div>
              <span className="text-sm font-semibold" style={{ color: V.accent }}>
                Editing {material.type}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: V.textSecondary }}>
                Title
              </label>
              <input
                type="text"
                value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none"
                style={{
                  backgroundColor: V.bgBase,
                  borderColor: V.bgElevated,
                  color: V.textPrimary,
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: V.textSecondary }}>
                Description <span className="font-normal opacity-60">(optional)</span>
              </label>
              <textarea
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                rows={4}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none resize-y font-mono"
                style={{
                  backgroundColor: V.bgBase,
                  borderColor: V.bgElevated,
                  color: V.textPrimary,
                }}
              />
            </div>

            {hasContent && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: V.textSecondary }}>
                  {material.type === 'markdown' ? 'Content (Markdown)' : 'Content'}
                </label>
                <textarea
                  value={editForm.content}
                  onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                  rows={6}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none resize-y font-mono"
                  style={{
                    backgroundColor: V.bgBase,
                    borderColor: V.bgElevated,
                    color: V.textPrimary,
                  }}
                />
              </div>
            )}

            {isLink && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: V.textSecondary }}>
                  URL
                </label>
                <input
                  type="url"
                  value={editForm.url}
                  onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border focus:outline-none"
                  style={{
                    backgroundColor: V.bgBase,
                    borderColor: V.bgElevated,
                    color: V.textPrimary,
                  }}
                />
              </div>
            )}

            {material.type === 'docx' && (
              <p className="text-xs" style={{ color: V.textMuted }}>
                To replace the file itself, delete this item and re-upload.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving || !editForm.title.trim()}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-full transition-colors disabled:opacity-50"
              style={{
                backgroundColor: V.accent,
                color: V.bgSurface,
              }}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: V.bgSurface, borderTopColor: 'transparent' }} />
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
              className="px-4 py-2.5 text-sm font-medium rounded-full border transition-colors disabled:opacity-50"
              style={{
                backgroundColor: V.bgSurface,
                borderColor: V.bgElevated,
                color: V.textSecondary,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        /* Normal View */
        <>
          {/* Top row: icon + menu */}
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: V.bgBase }}>
              <span className="material-symbols-outlined text-xl" style={{ color: colorForType(material.type) }}>
                {iconForType(material.type)}
              </span>
            </div>
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
                className="p-1.5 rounded-full transition-colors"
                style={{ color: V.textSecondary }}
                title="More actions"
              >
                <span className="material-symbols-outlined text-xl">more_vert</span>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
                  <div
                    className="card absolute right-0 top-9 z-20 w-44 rounded-xl py-1.5"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => { onToggleFavorite(material._id); setMenuOpen(false); }}
                      disabled={isUpdating}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-[#f9f8f6] disabled:opacity-50"
                      style={{ color: material.isFavorite ? V.accent : V.textSecondary }}
                    >
                      <span className="material-symbols-outlined text-sm" style={material.isFavorite ? { fontVariationSettings: "'FILL' 1" } : undefined}>star</span>
                      {material.isFavorite ? 'Unfavorite' : 'Favorite'}
                    </button>
                    {isEditable && (
                      <button
                        onClick={openEdit}
                        disabled={isUpdating}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-[#f9f8f6] disabled:opacity-50"
                        style={{ color: V.textSecondary }}
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                        Edit
                      </button>
                    )}
                    {material.type !== 'link' && (
                      <button
                        onClick={handleDownload}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-[#f9f8f6]"
                        style={{ color: V.textSecondary }}
                      >
                        <span className="material-symbols-outlined text-sm">download</span>
                        Download
                      </button>
                    )}
                    <button
                      onClick={handleShareClick}
                      disabled={isUpdating}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-[#f9f8f6] disabled:opacity-50"
                      style={{ color: V.textSecondary }}
                    >
                      <span className="material-symbols-outlined text-sm">{material.shareToken ? 'link' : 'share'}</span>
                      {material.shareToken ? 'Manage Share' : 'Share'}
                    </button>
                    {onAssignJob && !jobId && (
                      <button
                        onClick={() => { onAssignJob(material._id); setMenuOpen(false); }}
                        disabled={isUpdating}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-[#f9f8f6] disabled:opacity-50"
                        style={{ color: V.textSecondary }}
                      >
                        <span className="material-symbols-outlined text-sm">work</span>
                        Assign to Job
                      </button>
                    )}
                    {onUnassignJob && jobId && (
                      <button
                        onClick={() => { onUnassignJob(material._id); setMenuOpen(false); }}
                        disabled={isUpdating}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-[#f9f8f6] disabled:opacity-50"
                        style={{ color: V.textSecondary }}
                      >
                        <span className="material-symbols-outlined text-sm">work_off</span>
                        Unassign from Job
                      </button>
                    )}
                    <div className="my-1 mx-3" style={{ height: '1px', backgroundColor: V.bgElevated }} />
                    <button
                      onClick={() => { onRemoveGlobal(material._id); setMenuOpen(false); }}
                      disabled={isUpdating}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-[#f9f8f6] disabled:opacity-50"
                      style={{ color: V.textSecondary }}
                    >
                      <span className="material-symbols-outlined text-sm">bookmark_remove</span>
                      Remove from library
                    </button>
                    <button
                      onClick={handleDeleteClick}
                      disabled={isUpdating}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-red-50 disabled:opacity-50"
                      style={{ color: '#c62828' }}
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Title */}
          <h4
            className="font-semibold text-sm truncate mb-1 tracking-tight"
            style={{ color: V.textPrimary }}
            title={material.title}
          >
            {material.title}
          </h4>

          {/* Meta */}
          <p className="text-xs mb-4" style={{ color: V.textSecondary }}>
            Added: {material.createdAt ? formatDate(material.createdAt) : 'Unknown'}
          </p>

          {/* Job chip (shown in flat view) */}
          {showJobChip && jobRef && jobId && (
            <span
              className="inline-block mb-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
              style={{ backgroundColor: S.light, color: V.accent }}
            >
              {jobRef.companyName} — {jobRef.jobTitle}
            </span>
          )}

          {/* Description */}
          {material.description && (
            <p className="text-xs mb-4 line-clamp-2" style={{ color: V.textSecondary }}>
              {material.description}
            </p>
          )}

          {/* Bottom row: badge + actions */}
          <div className="mt-auto pt-4 flex items-center justify-between" style={{ borderTop: `1px solid ${V.bgElevated}` }}>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
              style={{ backgroundColor: S.light, color: V.accent }}
            >
              {material.type}
            </span>
            <div className="flex gap-1.5">
              {material.type !== 'link' ? (
                <button
                  onClick={handleDownload}
                  className="p-1.5 rounded-full transition-colors"
                  style={{ color: V.accent }}
                  title="Download"
                >
                  <span className="material-symbols-outlined text-lg">download</span>
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); if (material.url) window.open(material.url, '_blank', 'noopener,noreferrer'); }}
                  className="p-1.5 rounded-full transition-colors"
                  style={{ color: V.accent }}
                  title="Open Link"
                >
                  <span className="material-symbols-outlined text-lg">open_in_new</span>
                </button>
              )}
              <button
                onClick={handleShareClick}
                className="p-1.5 rounded-full transition-colors"
                style={{ color: V.accent }}
                title={material.shareToken ? 'Sharing on' : 'Share'}
              >
                <span className="material-symbols-outlined text-lg">{material.shareToken ? 'link' : 'share'}</span>
              </button>
            </div>
          </div>

          {/* Confirm delete inline */}
          {confirmDelete && (
            <div
              className="card absolute inset-x-2 bottom-2 z-10 rounded-xl p-3"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-xs font-medium mb-2" style={{ color: V.textPrimary }}>Delete this material?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => onDelete(material._id)}
                  disabled={isUpdating}
                  className="flex-1 text-xs px-3 py-2 rounded-full font-semibold text-white transition-colors disabled:opacity-50"
                  style={{ backgroundColor: V.rose }}
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 text-xs px-3 py-2 rounded-full font-medium transition-colors"
                  style={{ backgroundColor: V.bgBase, color: V.textSecondary }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GlobalMaterialCard;
