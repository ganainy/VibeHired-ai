// client/src/pages/InterviewMaterialsPage.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getGlobalMaterials, deleteMaterial, updateMaterial, createMaterial, generateMaterialTitle } from '../services/interviewMaterialsApi';
import { InterviewMaterial, MaterialJobRef, MaterialType } from '../types/interviewMaterial';
import MaterialPreviewModal, { canPreviewInline } from '../components/jobs/MaterialPreviewModal';

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
        case 'pdf': return 'text-red-500';
        case 'image': return 'text-purple-500';
        case 'docx': return 'text-blue-500';
        case 'text': return 'text-green-500';
        case 'markdown': return 'text-cyan-500';
        case 'link': return 'text-amber-500';
        default: return 'text-gray-400';
    }
}

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

// ── Add Form Types ─────────────────────────────────────────────────────────────

type AddMode = 'idle' | 'file' | 'bulk' | 'text' | 'markdown' | 'link';

interface AddFormState {
    title: string;
    description: string;
    content: string;
    url: string;
}

// ── Material card ──────────────────────────────────────────────────────────────

const GlobalMaterialCard: React.FC<{
    material: InterviewMaterial;
    showJobChip?: boolean;
    isAssignedToJob?: boolean;
    onRemoveGlobal: (id: string) => void;
    onDelete: (id: string) => void;
    onPreview: (m: InterviewMaterial) => void;
    onToggleFavorite: (id: string) => void;
    isUpdating: boolean;
}> = ({ material, showJobChip = false, isAssignedToJob = false, onRemoveGlobal, onDelete, onPreview, onToggleFavorite, isUpdating }) => {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const isLink = material.type === 'link';
    const clickable = canPreviewInline(material.type) || isLink;
    const jobRef = getJobRef(material);
    const jobId = getJobId(material);

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
            className={`group relative flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-200 ${clickable ? 'cursor-pointer hover:border-opacity-60' : ''
                }`}
            style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
        >
            {/* Type icon */}
            <div className="flex-shrink-0 mt-0.5">
                <span className={`material-symbols-outlined text-xl ${colorForType(material.type)}`}>
                    {iconForType(material.type)}
                </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        {/* Title */}
                        <p className="text-sm font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                            {material.title}
                        </p>

                        {/* Metadata */}
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
                            {material.url && (
                                <span
                                    className="text-xs truncate max-w-[220px] underline"
                                    style={{ color: 'var(--accent)' }}
                                >
                                    {material.url}
                                </span>
                            )}
                            {/* Job chip (shown in flat view) */}
                            {showJobChip && jobRef && jobId && (
                                <Link
                                    to={`/jobs/${jobId}/review/materials`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-xs px-2 py-0.5 rounded-full font-medium hover:opacity-80 transition-opacity"
                                    style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' }}
                                >
                                    {jobRef.companyName} — {jobRef.jobTitle}
                                </Link>
                            )}
                        </div>

                        {/* Description */}
                        {material.description && (
                            <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                                {material.description}
                            </p>
                        )}


                    </div>

                    {/* Right: favourite star + hover actions */}
                    <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        {/* Favourite star — always visible */}
                        <button
                            onClick={() => onToggleFavorite(material._id)}
                            disabled={isUpdating}
                            title={material.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
                            className="p-1.5 rounded-lg transition-all disabled:opacity-50"
                            style={{
                                color: material.isFavorite ? 'var(--accent)' : 'var(--text-muted)',
                                opacity: material.isFavorite ? 1 : 0.35,
                            }}
                        >
                            <span
                                className="material-symbols-outlined text-base"
                                style={material.isFavorite ? { fontVariationSettings: "'FILL' 1" } : undefined}
                            >
                                star
                            </span>
                        </button>
                        {/* Other actions — shown on hover */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {material.cloudinaryUrl && (
                                <a
                                    href={material.cloudinaryUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Open / download"
                                    className="p-1.5 rounded-lg transition-colors"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    <span className="material-symbols-outlined text-base">open_in_new</span>
                                </a>
                            )}
                            {isAssignedToJob && (
                                <Link
                                    to={`/jobs/${jobId}/review/materials`}
                                    title="Go to job"
                                    className="p-1.5 rounded-lg transition-colors"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    <span className="material-symbols-outlined text-base">arrow_outward</span>
                                </Link>
                            )}
                            {confirmDelete ? (
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => onDelete(material._id)}
                                        disabled={isUpdating}
                                        className="text-xs px-2 py-1 rounded-md bg-red-500 text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                                    >
                                        Delete
                                    </button>
                                    <button
                                        onClick={() => setConfirmDelete(false)}
                                        className="text-xs px-2 py-1 rounded-md transition-colors"
                                        style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface)' }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setConfirmDelete(true)}
                                    title="Delete"
                                    disabled={isUpdating}
                                    className="p-1.5 rounded-lg transition-colors hover:text-red-500 disabled:opacity-50"
                                    style={{ color: 'var(--text-muted)' }}
                                >
                                    <span className="material-symbols-outlined text-base">delete</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Remove from library */}
                <button
                    onClick={() => onRemoveGlobal(material._id)}
                    disabled={isUpdating}
                    className="flex items-center gap-1 mt-2 text-xs transition-colors disabled:opacity-50 hover:text-red-500"
                    style={{ color: 'var(--text-muted)' }}
                >
                    <span className="material-symbols-outlined text-sm">remove_circle_outline</span>
                    Remove from library
                </button>
            </div>
        </div>
    );
};

// ── Grouped view ───────────────────────────────────────────────────────────────

interface JobGroup {
    jobId: string;
    jobTitle: string;
    companyName: string;
    materials: InterviewMaterial[];
}

const STORAGE_KEY = 'interviewMaterials_openGroups';

const loadOpenGroups = (): Set<string> => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            return new Set(JSON.parse(saved));
        }
    } catch (e) {
        console.error('Failed to load open groups:', e);
    }
    return new Set();
};

const saveOpenGroups = (groups: Set<string>) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(groups)));
    } catch (e) {
        console.error('Failed to save open groups:', e);
    }
};

const GroupedView: React.FC<{
    groups: JobGroup[];
    onRemoveGlobal: (id: string) => void;
    onDelete: (id: string) => void;
    onPreview: (m: InterviewMaterial) => void;
    onToggleFavorite: (id: string) => void;
    updatingIds: Set<string>;
}> = ({ groups, onRemoveGlobal, onDelete, onPreview, onToggleFavorite, updatingIds }) => {
    const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
        const saved = loadOpenGroups();
        // Keep only groups that still exist
        const existingGroupIds = new Set(groups.map(g => g.jobId));
        const filtered = new Set([...saved].filter(id => existingGroupIds.has(id)));
        // If no saved state, default to all expanded
        return filtered.size > 0 ? filtered : new Set(groups.map(g => g.jobId));
    });

    const toggleGroup = (jobId: string) => {
        setOpenGroups(prev => {
            const next = new Set(prev);
            if (next.has(jobId)) next.delete(jobId);
            else next.add(jobId);
            // Save to localStorage
            saveOpenGroups(next);
            return next;
        });
    };

    const isGroupOpen = (jobId: string) => openGroups.has(jobId);

    if (groups.length === 0) return null;

    return (
        <div className="space-y-4">
            {groups.map(group => (
                <div key={group.jobId} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                    {/* Group header */}
                    <button
                        onClick={() => toggleGroup(group.jobId)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                        style={{ backgroundColor: 'var(--bg-elevated)' }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-base" style={{ color: 'var(--accent)' }}>
                                work
                            </span>
                            <div>
                                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                    {group.companyName}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    {group.jobTitle}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span
                                className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' }}
                            >
                                {group.materials.length} item{group.materials.length !== 1 ? 's' : ''}
                            </span>
                            {group.jobId !== '__unassigned__' && (
                                <Link
                                    to={`/jobs/${group.jobId}/review/materials`}
                                    className="text-xs px-2 py-1 rounded-md transition-colors hover:underline flex items-center gap-0.5"
                                    style={{ color: 'var(--text-muted)' }}
                                    onClick={e => e.stopPropagation()}
                                >
                                    View job
                                    <span className="material-symbols-outlined text-xs">arrow_outward</span>
                                </Link>
                            )}
                            <span className="material-symbols-outlined text-base transition-transform duration-200" style={{ color: 'var(--text-muted)', transform: openGroups.has(group.jobId) ? 'rotate(180deg)' : 'rotate(0)' }}>
                                expand_more
                            </span>
                        </div>
                    </button>

                    {/* Items */}
                    {isGroupOpen(group.jobId) && (
                        <div className="p-3 grid gap-2" style={{ backgroundColor: 'var(--bg-surface)' }}>
                            {group.materials.map(m => (
                                <GlobalMaterialCard
                                    key={m._id}
                                    material={m}
                                    showJobChip={false}
                                    isAssignedToJob={false}
                                    onRemoveGlobal={onRemoveGlobal}
                                    onDelete={onDelete}
                                    onPreview={onPreview}
                                    onToggleFavorite={onToggleFavorite}
                                    isUpdating={updatingIds.has(m._id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

// ── Page ───────────────────────────────────────────────────────────────────────

type ViewMode = 'grouped' | 'flat';

const InterviewMaterialsPage: React.FC = () => {
    const [materials, setMaterials] = useState<InterviewMaterial[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('grouped');
    const [search, setSearch] = useState('');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
    const [previewMaterial, setPreviewMaterial] = useState<InterviewMaterial | null>(null);
    const [addMode, setAddMode] = useState<AddMode>('idle');
    const [isDragOver, setIsDragOver] = useState(false);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; errors: string[] } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [form, setForm] = useState<AddFormState>({
        title: '',
        description: '',
        content: '',
        url: '',
    });

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getGlobalMaterials();
            setMaterials(data);
        } catch (e: any) {
            setError(e.message ?? 'Failed to load materials');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // ── Filter ──────────────────────────────────────────────────────────────

    const filtered = useMemo(() => {
        let result = materials;
        if (showFavoritesOnly) result = result.filter(m => m.isFavorite);
        if (!search.trim()) return result;
        const q = search.toLowerCase();
        return result.filter(m => {
            const jobRef = getJobRef(m);
            return (
                m.title.toLowerCase().includes(q) ||
                m.description?.toLowerCase().includes(q) ||
                jobRef?.jobTitle.toLowerCase().includes(q) ||
                jobRef?.companyName.toLowerCase().includes(q) ||
                m.url?.toLowerCase().includes(q)
            );
        });
    }, [materials, search, showFavoritesOnly]);

    // ── Build groups ─────────────────────────────────────────────────────────

    const groups = useMemo<JobGroup[]>(() => {
        const map = new Map<string, JobGroup>();

        for (const m of filtered) {
            const jobRef = getJobRef(m);
            const jobId = getJobId(m) ?? '__unassigned__';

            if (!map.has(jobId)) {
                map.set(jobId, {
                    jobId,
                    jobTitle: jobRef?.jobTitle ?? 'No Job',
                    companyName: jobRef?.companyName ?? 'Unassigned',
                    materials: [],
                });
            }
            map.get(jobId)!.materials.push(m);
        }

        return Array.from(map.values()).sort((a, b) =>
            `${a.companyName}${a.jobTitle}`.localeCompare(`${b.companyName}${b.jobTitle}`)
        );
    }, [filtered]);

    // ── Actions ───────────────────────────────────────────────────────────────

    const setUpdating = (id: string, value: boolean) => {
        setUpdatingIds(prev => {
            const next = new Set(prev);
            if (value) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const handleRemoveGlobal = async (materialId: string) => {
        setUpdating(materialId, true);
        try {
            await updateMaterial(materialId, { isGlobal: false });
            setMaterials(prev => prev.filter(m => m._id !== materialId));
        } catch (e: any) {
            setError(e.message ?? 'Failed to update material');
        } finally {
            setUpdating(materialId, false);
        }
    };

    const handleDelete = async (materialId: string) => {
        setUpdating(materialId, true);
        try {
            await deleteMaterial(materialId);
            setMaterials(prev => prev.filter(m => m._id !== materialId));
        } catch (e: any) {
            setError(e.message ?? 'Failed to delete material');
        } finally {
            setUpdating(materialId, false);
        }
    };

    const handleToggleFavorite = async (materialId: string) => {
        const material = materials.find(m => m._id === materialId);
        if (!material) return;
        const newValue = !material.isFavorite;
        // Optimistic update
        setMaterials(prev => prev.map(m => m._id === materialId ? { ...m, isFavorite: newValue } : m));
        setUpdating(materialId, true);
        try {
            await updateMaterial(materialId, { isFavorite: newValue });
        } catch (e: any) {
            // Revert on failure
            setMaterials(prev => prev.map(m => m._id === materialId ? { ...m, isFavorite: !newValue } : m));
            setError(e.message ?? 'Failed to update favourite');
        } finally {
            setUpdating(materialId, false);
        }
    };

    // ── Form helpers ─────────────────────────────────────────────────────────

    const resetForm = () => {
        setForm({ title: '', description: '', content: '', url: '' });
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

    const handleGenerateTitle = async () => {
        setIsGeneratingTitle(true);
        setError(null);
        try {
            const type = addMode === 'file' ? 'file' : addMode as MaterialType;
            const content = form.content || undefined;
            const description = form.description || undefined;
            const result = await generateMaterialTitle(type, content, description);
            setForm(f => ({ ...f, title: result.title }));
        } catch (e: any) {
            setError(e.message ?? 'Failed to generate title');
        } finally {
            setIsGeneratingTitle(false);
        }
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
                const material = await createMaterial({ jobApplicationId: null, title, isGlobal: true }, file);
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

    const handleSubmit = async () => {
        if (!form.title.trim()) return;
        setIsSubmitting(true);
        setError(null);
        try {
            let payload;

            if (addMode === 'file' && pendingFile) {
                payload = {
                    jobApplicationId: null,
                    title: form.title.trim(),
                    description: form.description.trim() || undefined,
                    isGlobal: true,
                };
                const created = await createMaterial(payload, pendingFile);
                setMaterials(prev => [created, ...prev]);
            } else {
                const type = addMode as MaterialType;
                payload = {
                    jobApplicationId: null,
                    type,
                    title: form.title.trim(),
                    description: form.description.trim() || undefined,
                    content: (type === 'text' || type === 'markdown') ? form.content : undefined,
                    url: type === 'link' ? form.url.trim() : undefined,
                    isGlobal: true,
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

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

            {/* Page header */}
            <div>
                <div className="flex items-center gap-2.5 mb-1">
                    <span className="material-symbols-outlined text-2xl" style={{ color: 'var(--accent)' }}>
                        library_books
                    </span>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Fraunces, Georgia, serif' }}>
                        Prep Library
                    </h1>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    All interview preparation materials you've marked to share across jobs — PDFs, notes, links, and more.
                </p>
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                    <span className="material-symbols-outlined text-base">error</span>
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto">
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="flex-1 min-w-[180px] relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-base" style={{ color: 'var(--text-muted)' }}>
                        search
                    </span>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search materials, jobs…"
                        className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-1 focus:ring-amber-400"
                        style={{
                            backgroundColor: 'var(--bg-elevated)',
                            borderColor: 'var(--border)',
                            color: 'var(--text-primary)',
                        }}
                    />
                </div>

                {/* Favourites filter */}
                <button
                    onClick={() => setShowFavoritesOnly(v => !v)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors"
                    style={{
                        borderColor: showFavoritesOnly ? 'var(--accent)' : 'var(--border)',
                        backgroundColor: showFavoritesOnly ? 'var(--accent-bg)' : 'var(--bg-elevated)',
                        color: showFavoritesOnly ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                >
                    <span
                        className="material-symbols-outlined text-sm"
                        style={showFavoritesOnly ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    >
                        star
                    </span>
                    Favourites
                </button>

                {/* View toggle */}}
                <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
                    <button
                        onClick={() => setViewMode('grouped')}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors"
                        style={{
                            backgroundColor: viewMode === 'grouped' ? 'var(--accent-bg)' : 'var(--bg-elevated)',
                            color: viewMode === 'grouped' ? 'var(--accent)' : 'var(--text-secondary)',
                        }}
                    >
                        <span className="material-symbols-outlined text-sm">view_agenda</span>
                        Grouped
                    </button>
                    <button
                        onClick={() => setViewMode('flat')}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors"
                        style={{
                            backgroundColor: viewMode === 'flat' ? 'var(--accent-bg)' : 'var(--bg-elevated)',
                            color: viewMode === 'flat' ? 'var(--accent)' : 'var(--text-secondary)',
                        }}
                    >
                        <span className="material-symbols-outlined text-sm">list</span>
                        Flat
                    </button>
                </div>

                {/* Stats */}
                {!isLoading && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {filtered.length} item{filtered.length !== 1 ? 's' : ''}{search ? ' found' : ''}
                    </span>
                )}
            </div>

            {/* ── Drop zone / Add buttons ── */}
            {addMode === 'idle' && (
                <div className="space-y-3">
                    {/* Drag-drop upload zone */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                        onDragLeave={() => setIsDragOver(false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className="relative flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200"
                        style={{
                            borderColor: isDragOver ? 'var(--accent)' : 'var(--border)',
                            backgroundColor: isDragOver ? 'var(--accent-bg)' : 'var(--bg-elevated)',
                        }}
                    >
                        <span
                            className="material-symbols-outlined text-3xl"
                            style={{ color: isDragOver ? 'var(--accent)' : 'var(--text-muted)' }}
                        >
                            cloud_upload
                        </span>
                        <p className="text-sm font-medium" style={{ color: isDragOver ? 'var(--accent)' : 'var(--text-secondary)' }}>
                            Drag & drop files, or click to browse
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
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
                            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-all hover:border-opacity-60"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }}
                        >
                            <span className="material-symbols-outlined text-sm text-green-500">article</span>
                            Add Note
                        </button>
                        <button
                            onClick={() => setAddMode('markdown')}
                            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-all hover:border-opacity-60"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }}
                        >
                            <span className="material-symbols-outlined text-sm text-cyan-500">code</span>
                            Add Markdown
                        </button>
                        <button
                            onClick={() => setAddMode('link')}
                            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-all hover:border-opacity-60"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }}
                        >
                            <span className="material-symbols-outlined text-sm text-amber-500">link</span>
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
                            <span className="material-symbols-outlined text-base text-amber-500">upload_file</span>
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
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                                Title <span className="text-red-500">*</span>
                            </label>
                            <button
                                type="button"
                                onClick={handleGenerateTitle}
                                disabled={isGeneratingTitle}
                                className="p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-100/10"
                                style={{
                                    backgroundColor: isGeneratingTitle ? 'var(--bg-elevated)' : 'var(--accent-bg)',
                                    color: isGeneratingTitle ? 'var(--text-muted)' : 'var(--accent)',
                                    border: `1px solid ${isGeneratingTitle ? 'var(--border)' : 'var(--accent-dim)'}`,
                                }}
                                title="Generate title with AI"
                            >
                                {isGeneratingTitle ? (
                                    <span className="inline-block w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)' }} />
                                ) : (
                                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                )}
                            </button>
                        </div>
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
                                Content <span className="text-red-500">*</span>
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
                                URL <span className="text-red-500">*</span>
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

                    {/* Actions */}
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
                                    <span className="material-symbols-outlined text-sm">add</span>
                                    Add to Library
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Content */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <div
                        className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
                    />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading your prep library…</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center py-16 gap-3 text-center">
                    <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--text-muted)' }}>
                        library_books
                    </span>
                    <p className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>
                        {search ? 'No materials match your search' : 'Your Prep Library is empty'}
                    </p>
                    <p className="text-sm max-w-xs" style={{ color: 'var(--text-muted)' }}>
                        {search
                            ? 'Try a different search term'
                            : 'Add general learning materials here, or open a job and toggle "Add to Prep Library" on any item'}
                    </p>
                    {!search && (
                        <Link
                            to="/dashboard"
                            className="mt-2 flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg font-medium transition-all"
                            style={{ backgroundColor: 'var(--accent)', color: 'var(--accent-text, #1a1200)' }}
                        >
                            <span className="material-symbols-outlined text-sm">dashboard</span>
                            Go to Dashboard
                        </Link>
                    )}
                </div>
            ) : viewMode === 'grouped' ? (
                <GroupedView
                    groups={groups}
                    onRemoveGlobal={handleRemoveGlobal}
                    onDelete={handleDelete}
                    onPreview={setPreviewMaterial}
                    onToggleFavorite={handleToggleFavorite}
                    updatingIds={updatingIds}
                />
            ) : (
                <div className="grid gap-2.5">
                    {filtered.map(m => (
                        <GlobalMaterialCard
                            key={m._id}
                            material={m}
                            showJobChip={!!getJobId(m)}
                            isAssignedToJob={!!getJobId(m)}
                            onRemoveGlobal={handleRemoveGlobal}
                            onDelete={handleDelete}
                            onPreview={setPreviewMaterial}
                            onToggleFavorite={handleToggleFavorite}
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

export default InterviewMaterialsPage;
