// client/src/pages/InterviewMaterialsPage.tsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getGlobalMaterials, deleteMaterial, updateMaterial, createMaterial, generateMaterialTitle, shareMaterial, unshareMaterial } from '../services/interviewMaterialsApi';
import { InterviewMaterial, MaterialJobRef, MaterialType } from '../types/interviewMaterial';
import { getJobs } from '../services/jobApi';
import MaterialPreviewModal from '../components/jobs/MaterialPreviewModal';
import GlobalMaterialCard from '../components/interview-materials/GlobalMaterialCard';

// ─── Color Helpers ───

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
  ember: 'var(--ember)',
  emberBg: 'var(--ember-bg)',
  info: 'var(--info)',
} as const;

// Legacy S palette for colors not in design system tokens
const S = {
  light: '#d4e9e2', // Light green tint for backgrounds
} as const;

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
    case 'pdf': return '#b71c1c';
    case 'image': return '#6d28d9';
    case 'docx': return '#1d4ed8';
    case 'text': return '#047857';
    case 'markdown': return '#0e7490';
    case 'link': return '#c2410c';
    default: return V.textMuted;
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

// Add Form Types

type AddMode = 'idle' | 'file' | 'bulk' | 'text' | 'markdown' | 'link';

interface AddFormState {
  title: string;
  description: string;
  content: string;
  url: string;
  jobApplicationId: string;
}

// Grouped view

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
  onEdit: (id: string, payload: import('../types/interviewMaterial').UpdateMaterialPayload) => Promise<void>;
  onShare: (id: string) => void;
  onShowShare: (m: InterviewMaterial) => void;
  onAssignJob?: (id: string) => void;
  onUnassignJob?: (id: string) => void;
  updatingIds: Set<string>;
}> = ({ groups, onRemoveGlobal, onDelete, onPreview, onToggleFavorite, onEdit, onShare, onShowShare, onAssignJob, onUnassignJob, updatingIds }) => {
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const saved = loadOpenGroups();
    const existingGroupIds = new Set(groups.map(g => g.jobId));
    const filtered = new Set([...saved].filter(id => existingGroupIds.has(id)));
    return filtered.size > 0 ? filtered : new Set(groups.map(g => g.jobId));
  });

  const toggleGroup = (jobId: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      saveOpenGroups(next);
      return next;
    });
  };

  const isGroupOpen = (jobId: string) => openGroups.has(jobId);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-6">
      {groups.map(group => (
        <div key={group.jobId} className="bg-white rounded-xl overflow-hidden border border-theme shadow-warm-sm">
          {/* Group header */}
          <button
            onClick={() => toggleGroup(group.jobId)}
            className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-[#f9f8f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <div className="flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: S.light }}
              >
                <span className="material-symbols-outlined text-lg" style={{ color: V.accent }}>
                  work
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold" style={{ color: V.textPrimary }}>
                    {group.companyName}
                  </p>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                    style={{ backgroundColor: S.light, color: V.accent }}
                  >
                    {group.materials.length} item{group.materials.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-xs" style={{ color: V.textSecondary }}>
                  {group.jobTitle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className="material-symbols-outlined text-base transition-transform duration-200"
                style={{ color: V.textSecondary, transform: openGroups.has(group.jobId) ? 'rotate(180deg)' : 'rotate(0)' }}
              >
                expand_more
              </span>
            </div>
          </button>

          {/* Items */}
          {isGroupOpen(group.jobId) && (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" style={{ backgroundColor: V.bgBase }}>
              {group.materials.map(m => (
                <GlobalMaterialCard
                  key={m._id}
                  material={m}
                  showJobChip={false}
                  isAssignedToJob={group.jobId !== '__unassigned__'}
                  onRemoveGlobal={onRemoveGlobal}
                  onDelete={onDelete}
                  onPreview={onPreview}
                  onToggleFavorite={onToggleFavorite}
                  onEdit={onEdit}
                  onShare={onShare}
                  onShowShare={onShowShare}
                  onAssignJob={group.jobId === '__unassigned__' ? onAssignJob : undefined}
                  onUnassignJob={group.jobId !== '__unassigned__' ? onUnassignJob : undefined}
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

// Page

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

  const [jobs, setJobs] = useState<Array<{ _id: string; jobTitle: string; companyName: string }>>([]);
  const [assignJobModal, setAssignJobModal] = useState<{ materialId: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<AddFormState>({
    title: '',
    description: '',
    content: '',
    url: '',
    jobApplicationId: '',
  });

  useEffect(() => {
    getJobs({ limit: 'all', sortBy: 'createdAt', sortOrder: 'desc' })
      .then(res => setJobs(res.jobs.map(j => ({ _id: j._id, jobTitle: j.jobTitle, companyName: j.companyName }))))
      .catch(() => {});
  }, []);

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

  // Filter

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

  // Build groups

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

  // Actions

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
    setMaterials(prev => prev.map(m => m._id === materialId ? { ...m, isFavorite: newValue } : m));
    setUpdating(materialId, true);
    try {
      await updateMaterial(materialId, { isFavorite: newValue });
    } catch (e: any) {
      setMaterials(prev => prev.map(m => m._id === materialId ? { ...m, isFavorite: !newValue } : m));
      setError(e.message ?? 'Failed to update favourite');
    } finally {
      setUpdating(materialId, false);
    }
  };

  const handleEdit = async (materialId: string, payload: import('../types/interviewMaterial').UpdateMaterialPayload) => {
    setUpdating(materialId, true);
    try {
      const updated = await updateMaterial(materialId, payload);
      setMaterials(prev => prev.map(m => m._id === materialId ? { ...m, ...updated } : m));
    } catch (e: any) {
      setError(e.message ?? 'Failed to save changes');
      throw e;
    } finally {
      setUpdating(materialId, false);
    }
  };

  const handleAssignJob = async (materialId: string, jobId: string | null) => {
    setUpdating(materialId, true);
    try {
      const payload: import('../types/interviewMaterial').UpdateMaterialPayload = {};
      if (jobId === null) {
        payload.jobApplicationId = null;
      } else {
        payload.jobApplicationId = jobId;
      }
      const updated = await updateMaterial(materialId, payload);
      setMaterials(prev => prev.map(m => m._id === materialId ? { ...m, ...updated } : m));
    } catch (e: any) {
      setError(e.message ?? 'Failed to assign job');
    } finally {
      setUpdating(materialId, false);
    }
  };

  const handleOpenAssignJob = (materialId: string) => {
    setAssignJobModal({ materialId });
  };

  const handleCloseAssignJob = () => {
    setAssignJobModal(null);
  };

  const handleSelectJobForMaterial = async (jobId: string) => {
    if (!assignJobModal) return;
    await handleAssignJob(assignJobModal.materialId, jobId);
    setAssignJobModal(null);
  };

  const handleUnassignJob = async (materialId: string) => {
    await handleAssignJob(materialId, null);
  };

  const [shareModal, setShareModal] = useState<{ material: InterviewMaterial; shareUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleShare = async (materialId: string) => {
    setUpdating(materialId, true);
    try {
      const result = await shareMaterial(materialId);
      setMaterials(prev => prev.map(m => m._id === materialId ? { ...m, shareToken: result.material.shareToken } : m));
      const baseUrl = window.location.origin;
      setShareModal({
        material: materials.find(m => m._id === materialId) || materials[0],
        shareUrl: `${baseUrl}/shared/${result.material.shareToken}`
      });
    } catch (e: any) {
      setError(e.message ?? 'Failed to share material');
    } finally {
      setUpdating(materialId, false);
    }
  };

  const handleShowShare = (material: InterviewMaterial) => {
    if (material.shareToken) {
      const baseUrl = window.location.origin;
      setShareModal({
        material,
        shareUrl: `${baseUrl}/shared/${material.shareToken}`
      });
    }
  };

  const handleUnshare = async (materialId: string) => {
    setUpdating(materialId, true);
    try {
      await unshareMaterial(materialId);
      setMaterials(prev => prev.map(m => m._id === materialId ? { ...m, shareToken: undefined } : m));
      setShareModal(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to unshare material');
    } finally {
      setUpdating(materialId, false);
    }
  };

  // Form helpers

  const resetForm = () => {
    setForm({ title: '', description: '', content: '', url: '', jobApplicationId: '' });
    setPendingFile(null);
    setPendingFiles([]);
    setBulkProgress(null);
    setAddMode('idle');
  };

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0) return;
    if (files.length === 1) {
      setPendingFile(files[0]);
      const baseName = files[0].name.replace(/\.[^.]+$/, '');
      setForm(f => ({ ...f, title: baseName }));
      setAddMode('file');
    } else {
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
        const material = await createMaterial({ jobApplicationId: form.jobApplicationId || null, title, isGlobal: true }, file);
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

      const jobIdVal = form.jobApplicationId || undefined;
      if (addMode === 'file' && pendingFile) {
        payload = {
          jobApplicationId: jobIdVal,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          isGlobal: true,
        };
        const created = await createMaterial(payload, pendingFile);
        setMaterials(prev => [created, ...prev]);
      } else {
        const type = addMode as MaterialType;
        payload = {
          jobApplicationId: jobIdVal,
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

  // ─── Inline Styles ───
  const dragDropDashed = {
    backgroundImage: `url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='12' ry='12' stroke='var(--accent)' stroke-width='1.5' stroke-dasharray='8%2c 8' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e")`,
  } as React.CSSProperties;

  // Render

  return (
    <div className="min-h-screen" style={{ backgroundColor: V.bgBase, fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.01em', color: V.textPrimary }}>
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-14">

        {/* Title Section */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: S.light }}>
              <span className="material-symbols-outlined text-xl" style={{ color: V.accent }}>library_books</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: V.accent }}>
              Prep Library
            </h1>
          </div>
          <p className="text-sm font-normal max-w-2xl" style={{ color: V.textSecondary }}>
            Manage your preparation guides, case studies, and reference documents in one place.
          </p>
        </header>

        {/* Upload Section */}
        {addMode === 'idle' && (
          <section className="mb-10">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="bg-white rounded-xl p-8 sm:p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 border border-[var(--border)] hover:shadow-warm"
              style={{
                ...(!isDragOver ? dragDropDashed : {}),
                ...(isDragOver ? { border: `2px solid ${V.accent}`, backgroundColor: S.light } : {}),
              }}
            >
              <div className="w-14 h-14 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: S.light }}>
                <span className="material-symbols-outlined text-3xl" style={{ color: V.accent }}>upload_file</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-semibold mb-2 tracking-tight" style={{ color: V.textPrimary }}>
                Upload new material
              </h2>
              <p className="text-sm font-normal mb-6 max-w-md" style={{ color: V.textSecondary }}>
                Drag and drop your PDF, DOCX or links here. Max file size 25MB.
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="inline-flex items-center justify-center rounded-full font-semibold text-white px-8 transition-all duration-200 hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                style={{ backgroundColor: V.accent, height: '50px' }}
              >
                Upload Material
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.gif,.webp,.txt,.md"
                onChange={handleFileInputChange}
              />
            </div>

            {/* Quick add buttons */}
            <div className="flex flex-wrap gap-3 mt-4">
              <button
                onClick={() => setAddMode('text')}
                className="flex items-center gap-1.5 text-xs px-4 py-2.5 rounded-full border transition-all hover:-translate-y-0.5 hover:shadow-warm-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                style={{ borderColor: V.border, color: V.textPrimary, backgroundColor: V.bgSurface }}
              >
                <span className="material-symbols-outlined text-sm" style={{ color: '#047857' }}>article</span>
                Add Note
              </button>
              <button
                onClick={() => setAddMode('markdown')}
                className="flex items-center gap-1.5 text-xs px-4 py-2.5 rounded-full border transition-all hover:-translate-y-0.5 hover:shadow-warm-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                style={{ borderColor: V.border, color: V.textPrimary, backgroundColor: V.bgSurface }}
              >
                <span className="material-symbols-outlined text-sm" style={{ color: '#0e7490' }}>code</span>
                Add Markdown
              </button>
              <button
                onClick={() => setAddMode('link')}
                className="flex items-center gap-1.5 text-xs px-4 py-2.5 rounded-full border transition-all hover:-translate-y-0.5 hover:shadow-warm-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                style={{ borderColor: V.border, color: V.textPrimary, backgroundColor: V.bgSurface }}
              >
                <span className="material-symbols-outlined text-sm" style={{ color: '#c2410c' }}>link</span>
                Add Link
              </button>
            </div>
          </section>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm px-4 py-3 rounded-xl mb-6 alert-error">
            <span className="material-symbols-outlined text-base">error</span>
            <span className="flex-1 whitespace-pre-line">{error}</span>
            <button onClick={() => setError(null)} className="p-1 rounded-lg hover:bg-[#c82014]/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {/* Search, Filter & Toolbar - Consolidated */}
        <section className="mb-8">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* Search input */}
            <div className="relative bg-white rounded-lg flex items-center px-4 py-3 flex-1 border border-theme focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 transition-all">
              <span className="material-symbols-outlined mr-3" style={{ fontSize: '22px', color: V.textSecondary }}>search</span>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by title, description, or company..."
                className="w-full border-none focus:ring-0 p-0 text-sm bg-transparent tracking-tight placeholder:text-[rgba(0,0,0,0.45)]"
                style={{ color: V.textPrimary }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="p-1 rounded-full hover:bg-[var(--bg-base)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  style={{ color: V.textSecondary }}
                >
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              )}
            </div>

            {/* Toolbar controls */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Favourites filter */}
              <button
                onClick={() => setShowFavoritesOnly(v => !v)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                style={{
                  borderColor: showFavoritesOnly ? V.accent : V.border,
                  backgroundColor: showFavoritesOnly ? S.light : V.bgSurface,
                  color: showFavoritesOnly ? V.accent : V.textPrimary,
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

              {/* View toggle */}
              <div className="flex items-center rounded-full border border-theme overflow-hidden">
                <button
                  onClick={() => setViewMode('grouped')}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                  style={{
                    backgroundColor: viewMode === 'grouped' ? S.light : V.bgSurface,
                    color: viewMode === 'grouped' ? V.accent : V.textSecondary,
                  }}
                >
                  <span className="material-symbols-outlined text-sm">view_agenda</span>
                  <span className="hidden sm:inline">Grouped</span>
                </button>
                <button
                  onClick={() => setViewMode('flat')}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                  style={{
                    backgroundColor: viewMode === 'flat' ? S.light : V.bgSurface,
                    color: viewMode === 'flat' ? V.accent : V.textSecondary,
                  }}
                >
                  <span className="material-symbols-outlined text-sm">grid_view</span>
                  <span className="hidden sm:inline">Grid</span>
                </button>
              </div>

              {/* Stats */}
              {!isLoading && (
                <span className="text-xs px-2 py-1 rounded-full" style={{ color: V.textMuted, backgroundColor: V.bgElevated }}>
                  {filtered.length}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Bulk Upload Queue */}
        {addMode === 'bulk' && (
          <div
            className="rounded-xl p-5 space-y-4 mb-8 bg-white border-2 border-accent/30 shadow-warm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: S.light }}>
                  <span className="material-symbols-outlined text-base" style={{ color: V.accent }}>upload_file</span>
                </div>
                <span className="text-sm font-semibold" style={{ color: V.textPrimary }}>
                  {pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''} ready to upload
                </span>
              </div>
              <button onClick={resetForm} disabled={isSubmitting} className="p-1.5 rounded-lg hover:bg-[var(--bg-base)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" style={{ color: V.textSecondary }}>
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <ul className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar">
              {pendingFiles.map((file, i) => (
                <li key={i} className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-lg" style={{ backgroundColor: V.bgBase }}>
                  <span className="material-symbols-outlined text-sm flex-shrink-0" style={{ color: V.textSecondary }}>attach_file</span>
                  <span className="flex-1 truncate font-medium" style={{ color: V.textPrimary }}>{file.name}</span>
                  <span className="flex-shrink-0 font-mono" style={{ color: V.textMuted }}>{formatBytes(file.size)}</span>
                </li>
              ))}
            </ul>

            {bulkProgress && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium" style={{ color: V.textSecondary }}>
                  <span>Uploading</span>
                  <span>{bulkProgress.done} / {bulkProgress.total}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: V.bgElevated }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%`, backgroundColor: V.accent }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={resetForm}
                disabled={isSubmitting}
                className="text-xs px-4 py-2.5 rounded-full border transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                style={{ borderColor: V.border, color: V.textPrimary }}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkUpload}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 text-xs px-5 py-2.5 rounded-full font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                style={{ backgroundColor: V.accent, color: '#fff' }}
              >
                {isSubmitting ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                    Uploading
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

        {/* Add Form */}
        {addMode !== 'idle' && addMode !== 'bulk' && (
          <div
            className="rounded-xl p-5 space-y-4 mb-8 bg-white border-2 border-accent/30 shadow-warm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: S.light }}>
                  <span className="material-symbols-outlined text-base" style={{ color: colorForType(addMode === 'file' ? (pendingFile?.type.startsWith('image/') ? 'image' : 'pdf') : addMode as MaterialType) }}>
                    {iconForType(addMode === 'file' ? (pendingFile?.type.startsWith('image/') ? 'image' : 'pdf') : addMode as MaterialType)}
                  </span>
                </div>
                <span className="text-sm font-semibold capitalize" style={{ color: V.textPrimary }}>
                  {addMode === 'file' ? pendingFile?.name : `New ${addMode}`}
                </span>
              </div>
              <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-[var(--bg-base)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" style={{ color: V.textSecondary }}>
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-semibold" style={{ color: V.textPrimary }}>
                  Title <span style={{ color: '#c82014' }}>*</span>
                </label>
                <button
                  type="button"
                  onClick={handleGenerateTitle}
                  disabled={isGeneratingTitle}
                  className="p-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  style={{
                    backgroundColor: S.light,
                    color: V.accent,
                  }}
                  title="Generate title with AI"
                >
                  {isGeneratingTitle ? (
                    <span className="inline-block w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: V.accent, borderTopColor: 'transparent' }} />
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
                className="w-full text-sm px-3.5 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all input-base"
                style={{
                  backgroundColor: V.bgSurface,
                  borderColor: V.border,
                  color: V.textPrimary,
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: V.textPrimary }}>
                Description <span style={{ color: V.textMuted }}>(optional)</span>
              </label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Short description of what this material covers"
                className="w-full text-sm px-3.5 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all input-base"
                style={{
                  backgroundColor: V.bgSurface,
                  borderColor: V.border,
                  color: V.textPrimary,
                }}
              />
            </div>

            {(addMode === 'text' || addMode === 'markdown') && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: V.textPrimary }}>
                  Content <span style={{ color: '#c82014' }}>*</span>
                  {addMode === 'markdown' && (
                    <span style={{ color: V.textMuted }}> Markdown supported</span>
                  )}
                </label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  placeholder={addMode === 'markdown' ? '# My notes\n\n- Key point 1\n- Key point 2' : 'Write your notes here...'}
                  rows={6}
                  className="w-full text-sm px-3.5 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all font-mono resize-y input-base"
                  style={{
                    backgroundColor: V.bgSurface,
                    borderColor: V.border,
                    color: V.textPrimary,
                  }}
                />
              </div>
            )}

            {addMode === 'link' && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: V.textPrimary }}>
                  URL <span style={{ color: '#c82014' }}>*</span>
                </label>
                <input
                  type="url"
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://..."
                  className="w-full text-sm px-3.5 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all input-base"
                  style={{
                    backgroundColor: V.bgSurface,
                    borderColor: V.border,
                    color: V.textPrimary,
                  }}
                />
              </div>
            )}

            {jobs.length > 0 && (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: V.textPrimary }}>
                  Assign to Job <span style={{ color: V.textMuted }}>(optional)</span>
                </label>
                <select
                  value={form.jobApplicationId}
                  onChange={e => setForm(f => ({ ...f, jobApplicationId: e.target.value }))}
                  className="w-full text-sm px-3.5 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all input-base"
                  style={{
                    backgroundColor: V.bgSurface,
                    borderColor: V.border,
                    color: V.textPrimary,
                  }}
                >
                  <option value="">No job (standalone material)</option>
                  {jobs.map(job => (
                    <option key={job._id} value={job._id}>
                      {job.companyName} — {job.jobTitle}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={resetForm}
                disabled={isSubmitting}
                className="text-xs px-4 py-2.5 rounded-full border transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                style={{ borderColor: V.border, color: V.textPrimary }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !form.title.trim()}
                className="flex items-center gap-1.5 text-xs px-5 py-2.5 rounded-full font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                style={{ backgroundColor: V.accent, color: '#fff' }}
              >
                {isSubmitting ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                    Saving
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

        {/* Materials Content */}
        <section>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative">
                <div
                  className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: V.accent, borderTopColor: 'transparent' }}
                />
                <div
                  className="absolute inset-2 rounded-full animate-pulse"
                  style={{ backgroundColor: S.light, opacity: 0.5 }}
                />
              </div>
              <p className="text-base font-medium" style={{ color: V.textSecondary }}>Loading your prep library...</p>
              <p className="text-sm" style={{ color: V.textMuted }}>This should only take a moment</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="card-elevated flex flex-col items-center py-16 px-8 gap-5 text-center max-w-lg mx-auto rounded-2xl">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ backgroundColor: S.light }}>
                <span className="material-symbols-outlined text-5xl" style={{ color: V.accent }}>
                  library_books
                </span>
              </div>
              <div className="space-y-2">
                <p className="text-xl font-semibold" style={{ color: V.textPrimary }}>
                  {search ? 'No materials match your search' : 'Your Prep Library is empty'}
                </p>
                <p className="text-sm max-w-sm mx-auto" style={{ color: V.textSecondary }}>
                  {search
                    ? 'Try a different search term or clear your filters'
                    : 'Add general learning materials here, or open a job and toggle "Add to Prep Library" on any item'}
                </p>
              </div>
              {!search && (
                <Link
                  to="/dashboard"
                  className="mt-2 inline-flex items-center gap-2 text-sm px-6 py-3 rounded-full font-semibold transition-all hover:opacity-90 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 hover:-translate-y-0.5 hover:shadow-warm"
                  style={{ backgroundColor: V.accent, color: '#fff' }}
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
              onEdit={handleEdit}
              onShare={handleShare}
              onShowShare={handleShowShare}
              onAssignJob={handleOpenAssignJob}
              onUnassignJob={handleUnassignJob}
              updatingIds={updatingIds}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
                  onEdit={handleEdit}
                  onShare={handleShare}
                  onShowShare={handleShowShare}
                  onAssignJob={!getJobId(m) ? handleOpenAssignJob : undefined}
                  onUnassignJob={getJobId(m) ? handleUnassignJob : undefined}
                  isUpdating={updatingIds.has(m._id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Preview modal */}
        {previewMaterial && (
          <MaterialPreviewModal
            material={previewMaterial}
            onClose={() => setPreviewMaterial(null)}
          />
        )}

        {/* Toast notification */}
        {toast && (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-sm font-medium whisper-shadow"
            style={{ backgroundColor: V.info, color: '#fff' }}
          >
            {toast}
          </div>
        )}

        {/* Assign to Job modal */}
        {assignJobModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
            onClick={handleCloseAssignJob}
          >
            <div
              className="w-full max-w-md rounded-xl p-6 shadow-xl bg-white"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: V.textPrimary }}>
                  Assign to Job
                </h3>
                <button onClick={handleCloseAssignJob} className="p-1 rounded-lg transition-colors" style={{ color: V.textSecondary }}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <p className="text-sm mb-4" style={{ color: V.textSecondary }}>
                Select a job to assign this material to:
              </p>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {jobs.length === 0 ? (
                  <p className="text-sm" style={{ color: V.textMuted }}>No jobs found. Create a job first.</p>
                ) : (
                  jobs.map(job => (
                    <button
                      key={job._id}
                      onClick={() => handleSelectJobForMaterial(job._id)}
                      className="w-full text-left px-4 py-3 rounded-lg transition-colors hover:bg-[#f9f8f6]"
                      style={{ border: `1px solid ${V.bgElevated}` }}
                    >
                      <p className="text-sm font-semibold" style={{ color: V.textPrimary }}>{job.companyName}</p>
                      <p className="text-xs" style={{ color: V.textSecondary }}>{job.jobTitle}</p>
                    </button>
                  ))
                )}
              </div>

              <div className="flex justify-end mt-4">
                <button
                  onClick={handleCloseAssignJob}
                  className="text-xs px-4 py-2.5 rounded-full border transition-colors"
                  style={{ borderColor: V.bgElevated, color: V.textSecondary }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Share modal */}
        {shareModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
            onClick={() => { setShareModal(null); setCopied(false); setToast(null); }}
          >
            <div
              className="w-full max-w-md rounded-xl p-6 shadow-xl bg-white"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: V.textPrimary }}>
                  Share Material
                </h3>
                <button
                  onClick={() => { setShareModal(null); setCopied(false); setToast(null); }}
                  className="p-1 rounded-lg transition-colors"
                  style={{ color: V.textSecondary }}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <p className="text-sm mb-4" style={{ color: V.textSecondary }}>
                Anyone with the link below can view this material:
              </p>

              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  readOnly
                  value={shareModal.shareUrl}
                  className="flex-1 px-3 py-2.5 text-sm rounded-lg border"
                  style={{
                    backgroundColor: V.bgBase,
                    borderColor: V.bgElevated,
                    color: V.textPrimary,
                  }}
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareModal.shareUrl);
                    setCopied(true);
                    setToast('Link copied to clipboard');
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors"
                  style={{
                    backgroundColor: copied ? V.bgBase : V.accent,
                    color: copied ? V.textSecondary : '#fff',
                    border: copied ? `1px solid ${V.bgElevated}` : 'none',
                  }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => handleUnshare(shareModal.material._id)}
                  className="text-sm transition-colors hover:opacity-80"
                  style={{ color: '#c62828' }}
                >
                  Stop sharing
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default InterviewMaterialsPage;
