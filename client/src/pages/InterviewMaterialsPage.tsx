// client/src/pages/InterviewMaterialsPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getGlobalMaterials, deleteMaterial, updateMaterial } from '../services/interviewMaterialsApi';
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
        case 'pdf':      return 'picture_as_pdf';
        case 'image':    return 'image';
        case 'docx':     return 'description';
        case 'text':     return 'article';
        case 'markdown': return 'code';
        case 'link':     return 'link';
        default:         return 'attach_file';
    }
}

function colorForType(type: MaterialType): string {
    switch (type) {
        case 'pdf':      return 'text-red-500';
        case 'image':    return 'text-purple-500';
        case 'docx':     return 'text-blue-500';
        case 'text':     return 'text-green-500';
        case 'markdown': return 'text-cyan-500';
        case 'link':     return 'text-amber-500';
        default:         return 'text-gray-400';
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

// ── Material card ──────────────────────────────────────────────────────────────

const GlobalMaterialCard: React.FC<{
    material: InterviewMaterial;
    showJobChip?: boolean;
    onRemoveGlobal: (id: string) => void;
    onDelete: (id: string) => void;
    onPreview: (m: InterviewMaterial) => void;
    isUpdating: boolean;
}> = ({ material, showJobChip = false, onRemoveGlobal, onDelete, onPreview, isUpdating }) => {
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
            className={`group relative flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-200 ${
                clickable ? 'cursor-pointer hover:border-opacity-60' : ''
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

                        {/* Content preview */}
                        {(material.type === 'text' || material.type === 'markdown') && material.content && (
                            <p className="text-xs mt-1.5 line-clamp-2 font-mono whitespace-pre-wrap px-2 py-1.5 rounded-md" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                                {material.content}
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
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
                        {jobId && (
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

const GroupedView: React.FC<{
    groups: JobGroup[];
    onRemoveGlobal: (id: string) => void;
    onDelete: (id: string) => void;
    onPreview: (m: InterviewMaterial) => void;
    updatingIds: Set<string>;
}> = ({ groups, onRemoveGlobal, onDelete, onPreview, updatingIds }) => {
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(groups.map(g => g.jobId)));

    const toggleGroup = (jobId: string) => {
        setOpenGroups(prev => {
            const next = new Set(prev);
            if (next.has(jobId)) next.delete(jobId);
            else next.add(jobId);
            return next;
        });
    };

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
                            <Link
                                to={`/jobs/${group.jobId}/review/materials`}
                                className="text-xs px-2 py-1 rounded-md transition-colors hover:underline flex items-center gap-0.5"
                                style={{ color: 'var(--text-muted)' }}
                                onClick={e => e.stopPropagation()}
                            >
                                View job
                                <span className="material-symbols-outlined text-xs">arrow_outward</span>
                            </Link>
                            <span className="material-symbols-outlined text-base transition-transform duration-200" style={{ color: 'var(--text-muted)', transform: openGroups.has(group.jobId) ? 'rotate(180deg)' : 'rotate(0)' }}>
                                expand_more
                            </span>
                        </div>
                    </button>

                    {/* Items */}
                    {openGroups.has(group.jobId) && (
                        <div className="p-3 grid gap-2" style={{ backgroundColor: 'var(--bg-surface)' }}>
                            {group.materials.map(m => (
                                <GlobalMaterialCard
                                    key={m._id}
                                    material={m}
                                    showJobChip={false}
                                    onRemoveGlobal={onRemoveGlobal}
                                    onDelete={onDelete}
                                    onPreview={onPreview}
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
    const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
    const [previewMaterial, setPreviewMaterial] = useState<InterviewMaterial | null>(null);

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
        if (!search.trim()) return materials;
        const q = search.toLowerCase();
        return materials.filter(m => {
            const jobRef = getJobRef(m);
            return (
                m.title.toLowerCase().includes(q) ||
                m.description?.toLowerCase().includes(q) ||
                jobRef?.jobTitle.toLowerCase().includes(q) ||
                jobRef?.companyName.toLowerCase().includes(q) ||
                m.url?.toLowerCase().includes(q)
            );
        });
    }, [materials, search]);

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

                {/* View toggle */}
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
                            : 'Open a job, go to the Materials tab, and toggle "Add to Prep Library" on any item'}
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
                    updatingIds={updatingIds}
                />
            ) : (
                <div className="grid gap-2.5">
                    {filtered.map(m => (
                        <GlobalMaterialCard
                            key={m._id}
                            material={m}
                            showJobChip={true}
                            onRemoveGlobal={handleRemoveGlobal}
                            onDelete={handleDelete}
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

export default InterviewMaterialsPage;
