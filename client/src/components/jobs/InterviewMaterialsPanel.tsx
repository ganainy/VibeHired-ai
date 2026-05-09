// client/src/components/jobs/InterviewMaterialsPanel.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { InterviewMaterial, MaterialType, CreateMaterialPayload, UpdateMaterialPayload } from '../../types/interviewMaterial';
import {
 getMaterialsByJob,
 createMaterial,
 updateMaterial,
 deleteMaterial,
} from '../../services/interviewMaterialsApi';
import MaterialPreviewModal, { canPreviewInline } from './MaterialPreviewModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

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
case 'pdf': return 'text-error';
  case 'image': return 'text-purple-500';
  case 'docx': return 'text-blue-500';
  case 'text': return 'text-green-500';
  case 'markdown': return 'text-cyan-500';
  case 'link': return 'text-ember';
 default: return 'text-secondary-color';
 }
}

// ── Add Form Types ─────────────────────────────────────────────────────────────

type AddMode = 'idle' | 'file' | 'bulk' | 'text' | 'markdown' | 'link';

interface AddFormState {
 title: string;
 description: string;
 content: string;
 url: string;
 isGlobal: boolean;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const MaterialCard: React.FC<{
 material: InterviewMaterial;
 onToggleGlobal: (id: string, isGlobal: boolean) => void;
 onDelete: (id: string) => void;
 onSave: (id: string, payload: UpdateMaterialPayload) => Promise<void>;
 onPreview: (material: InterviewMaterial) => void;
 isUpdating: boolean;
}> = ({ material, onToggleGlobal, onDelete, onSave, onPreview, isUpdating }) => {
 const [confirmDelete, setConfirmDelete] = useState(false);
 const [isEditing, setIsEditing] = useState(false);
 const [isSaving, setIsSaving] = useState(false);
 const [editForm, setEditForm] = useState({
 title: material.title,
 description: material.description ?? '',
 content: material.content ?? '',
 url: material.url ?? '',
 });

 const startEdit = (e: React.MouseEvent) => {
 e.stopPropagation();
 setEditForm({
 title: material.title,
 description: material.description ?? '',
 content: material.content ?? '',
 url: material.url ?? '',
 });
 setIsEditing(true);
 };

 const handleSave = async (e: React.MouseEvent) => {
 e.stopPropagation();
 if (!editForm.title.trim()) return;
 setIsSaving(true);
 try {
 await onSave(material._id, {
 title: editForm.title.trim(),
 description: editForm.description.trim() || undefined,
 content: (material.type === 'text' || material.type === 'markdown') ? editForm.content : undefined,
 url: material.type === 'link' ? editForm.url.trim() : undefined,
 });
 setIsEditing(false);
 } finally {
 setIsSaving(false);
 }
 };

 const isLink = material.type === 'link';
 const clickable = (canPreviewInline(material.type) || isLink) && !isEditing;

 const handleCardClick = () => {
 if (isLink && material.url) {
 window.open(material.url, '_blank', 'noopener,noreferrer');
 } else if (canPreviewInline(material.type)) {
 onPreview(material);
 }
 };

 return (
 <div
 onClick={clickable ? handleCardClick : undefined}
  className={`group relative flex flex-col gap-3 p-3.5 rounded-xl border transition-all duration-200 ${
 clickable ? 'cursor-pointer hover:border-opacity-60' : ''
 }`}
 style={{
 backgroundColor: 'var(--bg-elevated)',
 borderColor: 'var(--border)',
 }}
 >
 {/* Row 1: icon + info */}
 <div className="flex items-start gap-3">
 {/* Type icon */}
 <div className="flex-shrink-0 mt-0.5">
 <span className={`material-symbols-outlined text-xl ${colorForType(material.type)}`}>
 {iconForType(material.type)}
 </span>
 </div>

 {/* Info */}
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold leading-snug break-words" style={{ color: 'var(--text-primary)' }}>
 {material.title}
 </p>

 {/* Metadata row */}
 <div className="flex flex-wrap items-center gap-2 mt-1">
 <span
 className="text-xs px-1.5 py-0.5 rounded-md capitalize font-medium"
 style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)' }}
 >
 {material.type}
 </span>
 {material.fileSize !== undefined && (
 <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
 {formatBytes(material.fileSize)}
 </span>
 )}
 {material.originalFilename && (
 <span className="text-xs truncate max-w-[160px]" style={{ color: 'var(--text-muted)' }}>
 {material.originalFilename}
 </span>
 )}
 {material.url && (
 <span
 className="text-xs truncate max-w-[220px] underline"
 style={{ color: 'var(--accent)' }}
 >
 {material.url}
 </span>
 )}
 </div>

 {/* Description */}
 {material.description && (
 <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
 {material.description}
 </p>
 )}

 {/* Content preview for text/markdown */}
 {(material.type === 'text' || material.type === 'markdown') && material.content && (
 <div className="mt-2 p-2 rounded bg-elevated border border-[var(--border)]">
 <p className="text-xs line-clamp-4 font-mono whitespace-pre-wrap overflow-hidden" style={{ color: 'var(--text-secondary)' }}>
 {material.content}
 </p>
 </div>
 )}
 </div>
 </div>{/* end row 1 */}

 {/* Row 2: actions */}
 <div className="flex items-center gap-1 flex-wrap pl-9" onClick={(e) => e.stopPropagation()}>
 {/* Edit */}
 {!isEditing && (
 <button
 onClick={startEdit}
 title="Edit"
 className="p-1.5 rounded-lg transition-all hover:text-blue-500"
 style={{ color: 'var(--text-muted)' }}
 >
 <span className="material-symbols-outlined text-base">edit</span>
 </button>
 )}
 {/* Delete */}
 {confirmDelete ? (
 <div className="flex items-center gap-1">
 <button
 onClick={(e) => { e.stopPropagation(); onDelete(material._id); }}
 className="text-xs px-2 py-1 rounded-md bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
 >
 Delete
 </button>
 <button
 onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
 className="text-xs px-2 py-1 rounded-md transition-colors"
 style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface)' }}
 >
 Cancel
 </button>
 </div>
 ) : (
 !isEditing && (
 <button
 onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
 title="Delete"
 className="p-1.5 rounded-lg transition-all hover:text-red-500"
 style={{ color: 'var(--text-muted)' }}
 >
 <span className="material-symbols-outlined text-base">delete</span>
 </button>
 )
 )}
 </div>

 {/* Inline edit form */}
 {isEditing && (
 <div className="space-y-2 pt-1" onClick={(e) => e.stopPropagation()}>
 <input
 autoFocus
 value={editForm.title}
 onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))}
 placeholder="Title"
 className="w-full text-sm px-3 py-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-400"
 style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
 />
 <input
 value={editForm.description}
 onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))}
 placeholder="Description (optional)"
 className="w-full text-sm px-3 py-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-400"
 style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
 />
 {(material.type === 'text' || material.type === 'markdown') && (
 <textarea
 rows={5}
 value={editForm.content}
 onChange={(e) => setEditForm(f => ({ ...f, content: e.target.value }))}
 placeholder="Content"
 className="w-full text-sm px-3 py-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono resize-y"
 style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
 />
 )}
 {material.type === 'link' && (
 <input
 value={editForm.url}
 onChange={(e) => setEditForm(f => ({ ...f, url: e.target.value }))}
 placeholder="URL"
 className="w-full text-sm px-3 py-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-400"
 style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
 />
 )}
 <div className="flex justify-end gap-2">
 <button
 onClick={(e) => { e.stopPropagation(); setIsEditing(false); }}
 className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
 style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
 >
 Cancel
 </button>
 <button
 onClick={handleSave}
 disabled={isSaving || !editForm.title.trim()}
 className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-semibold transition-all disabled:opacity-50"
 style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text, #1a1200)' }}
 >
 {isSaving ? <span className="inline-block w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" /> : null}
 Save
 </button>
 </div>
 </div>
 )}

 {/* Global toggle */}
 <div className="flex items-center gap-2 mt-2.5" onClick={(e) => e.stopPropagation()}>
 <button
 onClick={() => onToggleGlobal(material._id, !material.isGlobal)}
 disabled={isUpdating}
 className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
 material.isGlobal ? 'bg-amber-400' : 'bg-gray-300'
 }`}
 aria-label="Add to global library"
 >
 <span
 className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform ${
 material.isGlobal ? 'translate-x-5' : 'translate-x-0.5'
 }`}
 />
 </button>
 <span className="text-xs" style={{ color: material.isGlobal ? 'var(--accent)' : 'var(--text-muted)' }}>
 {material.isGlobal ? 'In Prep Library' : 'Add to Prep Library'}
 </span>
 </div>

 </div>
 );
};

// ── Main Panel ─────────────────────────────────────────────────────────────────

interface Props {
 jobId: string;
}

const InterviewMaterialsPanel: React.FC<Props> = ({ jobId }) => {
 const [materials, setMaterials] = useState<InterviewMaterial[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [addMode, setAddMode] = useState<AddMode>('idle');
 const [isDragOver, setIsDragOver] = useState(false);
 const [pendingFile, setPendingFile] = useState<File | null>(null);
 const [pendingFiles, setPendingFiles] = useState<File[]>([]);
 const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; errors: string[] } | null>(null);
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
 const [previewMaterial, setPreviewMaterial] = useState<InterviewMaterial | null>(null);

 const fileInputRef = useRef<HTMLInputElement>(null);
 const [form, setForm] = useState<AddFormState>({
 title: '',
 description: '',
 content: '',
 url: '',
 isGlobal: false,
 });

 // ── Load ─────────────────────────────────────────────────────────────────

 const loadMaterials = useCallback(async () => {
 setIsLoading(true);
 setError(null);
 try {
 const data = await getMaterialsByJob(jobId);
 setMaterials(data);
 } catch (e: any) {
 setError(e.message ?? 'Failed to load materials');
 } finally {
 setIsLoading(false);
 }
 }, [jobId]);

 useEffect(() => {
 loadMaterials();
 }, [loadMaterials]);

 // ── Form helpers ─────────────────────────────────────────────────────────

 const resetForm = () => {
 setForm({ title: '', description: '', content: '', url: '', isGlobal: false });
 setPendingFile(null);
 setPendingFiles([]);
 setBulkProgress(null);
 setAddMode('idle');
 };

 const handleFilesSelected = (files: File[]) => {
 if (files.length === 0) return;
 if (files.length === 1) {
 // Single file: show form so user can edit title/description
 setPendingFile(files[0]);
 const baseName = files[0].name.replace(/\.[^.]+$/, '');
 setForm(f => ({ ...f, title: baseName }));
 setAddMode('file');
 } else {
 // Multiple files: show bulk queue
 setPendingFiles(files);
 setAddMode('bulk');
 }
 };

 const handleDrop = (e: React.DragEvent) => {
 e.preventDefault();
 setIsDragOver(false);
 const files = Array.from(e.dataTransfer.files);
 if (files.length > 0) handleFilesSelected(files);
 };

 const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = Array.from(e.target.files ?? []);
 if (files.length > 0) handleFilesSelected(files);
 e.target.value = '';
 };

 const handleBulkUpload = async () => {
 if (pendingFiles.length === 0) return;
 setIsSubmitting(true);
 setBulkProgress({ done: 0, total: pendingFiles.length, errors: [] });
 const created: InterviewMaterial[] = [];
 const errors: string[] = [];
 for (const file of pendingFiles) {
 try {
 const title = file.name.replace(/\.[^.]+$/, '');
 const material = await createMaterial({ jobApplicationId: jobId, title, isGlobal: false }, file);
 created.push(material);
 } catch (e: any) {
 errors.push(`${file.name}: ${e.message ?? 'Upload failed'}`);
 }
 setBulkProgress(prev => prev ? { ...prev, done: prev.done + 1, errors } : null);
 }
 setMaterials(prev => [...created.reverse(), ...prev]);
 setIsSubmitting(false);
 if (errors.length > 0) {
 setError(`${errors.length} file(s) failed to upload:\n${errors.join('\n')}`);
 }
 resetForm();
 };

 // ── Submit ───────────────────────────────────────────────────────────────

 const handleSubmit = async () => {
 if (!form.title.trim()) return;
 setIsSubmitting(true);
 setError(null);
 try {
 let payload: CreateMaterialPayload;

 if (addMode === 'file' && pendingFile) {
 payload = {
 jobApplicationId: jobId,
 title: form.title.trim(),
 description: form.description.trim() || undefined,
 isGlobal: form.isGlobal,
 };
 const created = await createMaterial(payload, pendingFile);
 setMaterials(prev => [created, ...prev]);
 } else {
 const type = addMode as MaterialType;
 payload = {
 jobApplicationId: jobId,
 type,
 title: form.title.trim(),
 description: form.description.trim() || undefined,
 content: (type === 'text' || type === 'markdown') ? form.content : undefined,
 url: type === 'link' ? form.url.trim() : undefined,
 isGlobal: form.isGlobal,
 };
 const created = await createMaterial(payload);
 setMaterials(prev => [created, ...prev]);
 }
 resetForm();
 } catch (e: any) {
 setError(e.message ?? 'Failed to save material');
 } finally {
 setIsSubmitting(false);
 }
 };

 // ── Toggle global ─────────────────────────────────────────────────────────

 const handleToggleGlobal = async (materialId: string, isGlobal: boolean) => {
 setUpdatingIds(prev => new Set(prev).add(materialId));
 try {
 const updated = await updateMaterial(materialId, { isGlobal });
 setMaterials(prev => prev.map(m => (m._id === materialId ? updated : m)));
 } catch (e: any) {
 setError(e.message ?? 'Failed to update material');
 } finally {
 setUpdatingIds(prev => {
 const next = new Set(prev);
 next.delete(materialId);
 return next;
 });
 }
 };

 // ── Delete ────────────────────────────────────────────────────────────────

 const handleDelete = async (materialId: string) => {
 setUpdatingIds(prev => new Set(prev).add(materialId));
 try {
 await deleteMaterial(materialId);
 setMaterials(prev => prev.filter(m => m._id !== materialId));
 } catch (e: any) {
 setError(e.message ?? 'Failed to delete material');
 } finally {
 setUpdatingIds(prev => {
 const next = new Set(prev);
 next.delete(materialId);
 return next;
 });
 }
 };

 // ── Save (inline edit) ───────────────────────────────────────────────────

 const handleSaveMaterial = async (materialId: string, payload: UpdateMaterialPayload) => {
 const updated = await updateMaterial(materialId, payload);
 setMaterials(prev => prev.map(m => (m._id === materialId ? updated : m)));
 };

 // ── Render ─────────────────────────────────────────────────────────────────

 return (
 <div className="space-y-4">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
 <div className="flex items-center gap-2">
 <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>
 library_books
 </span>
 <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
 Prep Materials
 </h2>
 {materials.length > 0 && (
 <span
 className="text-xs px-2 py-0.5 rounded-full font-medium"
 style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' }}
 >
 {materials.length}
 </span>
 )}
 </div>
 <p className="text-xs sm:text-right max-w-md" style={{ color: 'var(--text-muted)' }}>
 Upload files, notes, or links for interview prep
 </p>
 </div>

 {/* Error */}
 {error && (
 <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-[var(--rose-bg)] text-error border border-red-200">
 <span className="material-symbols-outlined text-base">error</span>
 {error}
 <button onClick={() => setError(null)} className="ml-auto">
 <span className="material-symbols-outlined text-sm">close</span>
 </button>
 </div>
 )}

 {/* ── Drop zone / Add buttons ── */}
 {addMode === 'idle' && (
 <div className="space-y-2.5">
 {/* Drag-drop upload zone */}
 <div
 onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
 onDragLeave={() => setIsDragOver(false)}
 onDrop={handleDrop}
 onClick={() => fileInputRef.current?.click()}
 className="relative flex flex-col items-center justify-center gap-2 p-5 md:p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 bg-white"
 style={{
 borderColor: isDragOver ? 'var(--accent)' : 'var(--border)',
 backgroundColor: isDragOver ? 'var(--accent-bg)' : undefined,
 }}
 >
 <span
 className="material-symbols-outlined text-3xl"
 style={{ color: isDragOver ? 'var(--accent)' : 'var(--text-muted)' }}
 >
 cloud_upload
 </span>
 <p className="text-sm font-medium text-center" style={{ color: isDragOver ? 'var(--accent)' : 'var(--text-secondary)' }}>
 Drag & drop files, or click to browse
 </p>
 <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
 PDF, DOCX, PNG, JPG, TXT, MD — up to 30 MB each
 </p>
 <input
 ref={fileInputRef}
 type="file"
 multiple
 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
 accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.gif,.webp,.txt,.md"
 onChange={handleFileInputChange}
 onClick={(e) => e.stopPropagation()}
 />
 </div>

 {/* Quick add buttons */}
 <div className="flex flex-wrap gap-2">
 <button
 onClick={() => setAddMode('text')}
 className="flex items-center justify-center sm:justify-start gap-1.5 text-xs px-3 py-2 rounded-lg border transition-all hover:border-opacity-60"
 style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }}
 >
 <span className="material-symbols-outlined text-sm text-green-500">article</span>
 Add Note
 </button>
 <button
 onClick={() => setAddMode('markdown')}
 className="flex items-center justify-center sm:justify-start gap-1.5 text-xs px-3 py-2 rounded-lg border transition-all hover:border-opacity-60"
 style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }}
 >
 <span className="material-symbols-outlined text-sm text-cyan-500">code</span>
 Add Markdown
 </button>
 <button
 onClick={() => setAddMode('link')}
 className="flex items-center justify-center sm:justify-start gap-1.5 text-xs px-3 py-2 rounded-lg border transition-all hover:border-opacity-60"
 style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }}
 >
 <span className="material-symbols-outlined text-sm text-ember">link</span>
 Add Link
 </button>
 </div>
 </div>
 )}

 {/* ── Bulk Upload Queue ── */}
 {addMode === 'bulk' && (
 <div
 className="rounded-xl border p-4 space-y-3"
 style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--accent)', borderWidth: '1.5px' }}
 >
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="material-symbols-outlined text-base text-ember">upload_file</span>
 <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
 {pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''} ready to upload
 </span>
 </div>
 <button onClick={resetForm} disabled={isSubmitting} style={{ color: 'var(--text-muted)' }}>
 <span className="material-symbols-outlined text-base">close</span>
 </button>
 </div>

 {/* File list */}
 <ul className="max-h-48 overflow-y-auto space-y-1.5">
 {pendingFiles.map((file, i) => (
 <li key={i} className="flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-surface)' }}>
 <span className="material-symbols-outlined text-sm flex-shrink-0" style={{ color: 'var(--text-muted)' }}>attach_file</span>
 <span className="flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{file.name}</span>
 <span className="flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{formatBytes(file.size)}</span>
 </li>
 ))}
 </ul>

 {/* Progress bar */}
 {bulkProgress && (
 <div className="space-y-1.5">
 <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
 <span>Uploading…</span>
 <span>{bulkProgress.done} / {bulkProgress.total}</span>
 </div>
 <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)' }}>
 <div
 className="h-full rounded-full transition-all duration-300"
 style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%`, backgroundColor: 'var(--accent)' }}
 />
 </div>
 </div>
 )}

 <div className="flex justify-end gap-2 pt-1">
 <button
 onClick={resetForm}
 disabled={isSubmitting}
 className="text-xs px-3 py-2 rounded-lg border transition-colors disabled:opacity-50"
 style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
 >
 Cancel
 </button>
 <button
 onClick={handleBulkUpload}
 disabled={isSubmitting}
 className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
 style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text, #1a1200)' }}
 >
 {isSubmitting ? (
 <>
 <span className="inline-block w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" />
 Uploading…
 </>
 ) : (
 <>
 <span className="material-symbols-outlined text-sm">cloud_upload</span>
 Upload {pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''}
 </>
 )}
 </button>
 </div>
 </div>
 )}

 {/* ── Add Form ── */}
 {addMode !== 'idle' && addMode !== 'bulk' && (
 <div
 className="rounded-xl border p-4 space-y-3"
 style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--accent)', borderWidth: '1.5px' }}
 >
 {/* Form header */}
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className={`material-symbols-outlined text-base ${colorForType(addMode === 'file' ? (pendingFile?.type.startsWith('image/') ? 'image' : 'pdf') : addMode as MaterialType)}`}>
 {iconForType(addMode === 'file' ? (pendingFile?.type.startsWith('image/') ? 'image' : 'pdf') : addMode as MaterialType)}
 </span>
 <span className="text-sm font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
 {addMode === 'file' ? pendingFile?.name : `New ${addMode}`}
 </span>
 </div>
 <button onClick={resetForm} style={{ color: 'var(--text-muted)' }}>
 <span className="material-symbols-outlined text-base">close</span>
 </button>
 </div>

 {/* Title */}
 <div>
 <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
 Title <span className="text-error">*</span>
 </label>
 <input
 type="text"
 value={form.title}
 onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
 placeholder="Enter a title for this material"
 className="w-full text-sm px-3 py-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-amber-400"
 style={{
 backgroundColor: 'var(--bg-surface)',
 borderColor: 'var(--border)',
 color: 'var(--text-primary)',
 }}
 />
 </div>

 {/* Description */}
 <div>
 <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
 Description <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
 </label>
 <input
 type="text"
 value={form.description}
 onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
 placeholder="Short description of what this material covers"
 className="w-full text-sm px-3 py-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-amber-400"
 style={{
 backgroundColor: 'var(--bg-surface)',
 borderColor: 'var(--border)',
 color: 'var(--text-primary)',
 }}
 />
 </div>

 {/* Content (text / markdown) */}
 {(addMode === 'text' || addMode === 'markdown') && (
 <div>
 <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
 Content <span className="text-error">*</span>
 {addMode === 'markdown' && (
 <span style={{ color: 'var(--text-muted)' }}> — Markdown supported</span>
 )}
 </label>
 <textarea
 value={form.content}
 onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
 placeholder={addMode === 'markdown' ? '# My notes\n\n- Key point 1\n- Key point 2' : 'Write your notes here...'}
 rows={6}
 className="w-full text-sm px-3 py-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono resize-y"
 style={{
 backgroundColor: 'var(--bg-surface)',
 borderColor: 'var(--border)',
 color: 'var(--text-primary)',
 }}
 />
 </div>
 )}

 {/* URL (link) */}
 {addMode === 'link' && (
 <div>
 <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
 URL <span className="text-error">*</span>
 </label>
 <input
 type="url"
 value={form.url}
 onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
 placeholder="https://..."
 className="w-full text-sm px-3 py-2 rounded-lg border focus:outline-none focus:ring-1 focus:ring-amber-400"
 style={{
 backgroundColor: 'var(--bg-surface)',
 borderColor: 'var(--border)',
 color: 'var(--text-primary)',
 }}
 />
 </div>
 )}

 {/* Global toggle */}
 <div className="flex items-center gap-2.5 pt-1">
 <button
 onClick={() => setForm(f => ({ ...f, isGlobal: !f.isGlobal }))}
 className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
 form.isGlobal ? 'bg-amber-400' : 'bg-gray-300'
 }`}
 >
 <span
 className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-transform ${
 form.isGlobal ? 'translate-x-5' : 'translate-x-0.5'
 }`}
 />
 </button>
 <span className="text-xs" style={{ color: form.isGlobal ? 'var(--accent)' : 'var(--text-muted)' }}>
 Add to global Prep Library
 </span>
 </div>

 {/* Actions */}
 <div className="flex justify-end gap-2 pt-1">
 <button
 onClick={resetForm}
 className="text-xs px-3 py-2 rounded-lg border transition-colors"
 style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
 >
 Cancel
 </button>
 <button
 onClick={handleSubmit}
 disabled={isSubmitting || !form.title.trim()}
 className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
 style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text, #1a1200)' }}
 >
 {isSubmitting ? (
 <>
 <span className="inline-block w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" />
 Saving…
 </>
 ) : (
 <>
 <span className="material-symbols-outlined text-sm">save</span>
 Save
 </>
 )}
 </button>
 </div>
 </div>
 )}

 {/* ── Materials list ── */}
 {isLoading ? (
 <div className="flex justify-center py-8">
 <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
 </div>
 ) : materials.length === 0 ? (
 null
 ) : (
 <div className="grid gap-2.5 sm:grid-cols-1">
 {materials.map(m => (
 <MaterialCard
 key={m._id}
 material={m}
 onToggleGlobal={handleToggleGlobal}
 onDelete={handleDelete}
 onSave={handleSaveMaterial}
 onPreview={setPreviewMaterial}
 isUpdating={updatingIds.has(m._id)}
 />
 ))}
 </div>
 )}

 {/* Preview modal */}
 {previewMaterial && (
 <MaterialPreviewModal
 material={previewMaterial}
 onClose={() => setPreviewMaterial(null)}
 />
 )}
 </div>
 );
};

export default InterviewMaterialsPanel;
