import React, { useState } from 'react';
import { Input } from '../common';
import { TableOrCards, ColumnDef } from '../common/TableOrCards';
import Spinner from '../common/Spinner';
import EditBaseCvModal from './EditBaseCvModal';
import { CVDocument } from '../../services/cvApi';

interface SidebarProps {
 cvs: CVDocument[];
 activeCvId: string | null;
 isLoading?: boolean;
 onSelectCv: (id: string) => void;
 onAddNewCv: () => void;
 onDeleteCv?: (id: string) => void;
 onReplaceCv?: (id: string) => void;
 onRenameBranch?: (id: string, payload: { displayName: string; category: string | null }) => Promise<boolean>;
 onCreateBranch?: () => void;
 onToggleStar?: (id: string, nextValue: boolean) => void;
 className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({
 cvs,
 activeCvId,
 isLoading = false,
 onSelectCv,
 onAddNewCv,
 onDeleteCv,
 onReplaceCv,
 onRenameBranch,
 onCreateBranch,
 onToggleStar,
 className = ''
}) => {
 void onAddNewCv;
 void onReplaceCv;
 const [searchTerm, setSearchTerm] = useState('');
 const [editCv, setEditCv] = useState<CVDocument | null>(null);
 const [isEditModalOpen, setIsEditModalOpen] = useState(false);
 const [currentPage, setCurrentPage] = useState(1);
 const [sortKey, setSortKey] = useState<'edited' | 'usage'>('edited');
 const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
 const [languageFilter, setLanguageFilter] = useState<'all' | 'english' | 'german' | 'unknown'>('all');
 const [focusFilter, setFocusFilter] = useState<string>('all');
 const [starFilter, setStarFilter] = useState<'all' | 'starred' | 'unstarred'>('all');
 const hasActiveFilters = Boolean(
 searchTerm.trim()
 || languageFilter !== 'all'
 || focusFilter !== 'all'
 || starFilter !== 'all'
 );

 const focusOptions = Array.from(new Set(
 cvs
 .map(cv => (cv.category || '').trim())
 .filter(Boolean)
 )).sort((a, b) => a.localeCompare(b));

 const filteredCvs = cvs.filter(cv => {
 const displayName = cv.displayName || cv.category || 'Unnamed CV';
 const focusLabel = cv.category || '';
 const matchesSearch = `${displayName} ${focusLabel}`.toLowerCase().includes(searchTerm.toLowerCase());

 const languageLabel = getCvLanguageLabel(cv).toLowerCase();
 const matchesLanguage = languageFilter === 'all'
 || (languageFilter === 'english' && languageLabel === 'english')
 || (languageFilter === 'german' && languageLabel === 'german')
 || (languageFilter === 'unknown' && languageLabel === 'unknown');

 const matchesFocus = focusFilter === 'all'
 || (cv.category || '').toLowerCase() === focusFilter.toLowerCase();

 const matchesStar = starFilter === 'all'
 || (starFilter === 'starred' && cv.isStarred)
 || (starFilter === 'unstarred' && !cv.isStarred);

 return matchesSearch && matchesLanguage && matchesFocus && matchesStar;
 });

 const totalCount = cvs.length;
 const filteredCount = filteredCvs.length;

 const clearFilters = () => {
 setSearchTerm('');
 setLanguageFilter('all');
 setFocusFilter('all');
 setStarFilter('all');
 setCurrentPage(1);
 };

 const sortedCvs = [...filteredCvs].sort((a, b) => {
 if (sortKey === 'usage') {
 const aUsage = a.usedByJobCount || 0;
 const bUsage = b.usedByJobCount || 0;
 return sortDirection === 'asc' ? aUsage - bUsage : bUsage - aUsage;
 }
 const aTime = new Date(a.updatedAt).getTime();
 const bTime = new Date(b.updatedAt).getTime();
 return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
 });

 const handleSort = (key: 'edited' | 'usage') => {
 if (sortKey === key) {
 setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
 return;
 }
 setSortKey(key);
 setSortDirection('desc');
 };

 const pageSize = 5;
 const totalPages = Math.max(1, Math.ceil(sortedCvs.length / pageSize));
 const safePage = Math.min(currentPage, totalPages);
 const startIndex = (safePage - 1) * pageSize;
 const pagedCvs = sortedCvs.slice(startIndex, startIndex + pageSize);

 React.useEffect(() => {
 setCurrentPage(1);
 }, [searchTerm, languageFilter, focusFilter, starFilter, cvs.length]);

 const getRelativeTime = (dateString: string) => {
 const date = new Date(dateString);
 const now = new Date();
 const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

 if (diffInSeconds < 60) return 'Just now';
 if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
 if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
 if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
 return `${Math.floor(diffInSeconds / 604800)}w ago`;
 };

 function getCvLanguageLabel(cv: CVDocument): 'English' | 'German' | 'Unknown' {
 const data: any = cv.cvJson || {};

 const metaLanguageCandidates = [
 data?.meta?.language,
 data?.meta?.lang,
 data?.meta?.locale,
 ]
 .filter((v: unknown) => typeof v === 'string')
 .map((v: string) => v.toLowerCase());

 const explicit = metaLanguageCandidates.find((v: string) => v.startsWith('de') || v.startsWith('en'));
 if (explicit?.startsWith('de')) return 'German';
 if (explicit?.startsWith('en')) return 'English';

 const sampleChunks: string[] = [];
 const push = (value: unknown) => {
 if (typeof value === 'string' && value.trim()) {
 sampleChunks.push(value.trim().toLowerCase());
 }
 };

 push(data?.basics?.label);
 push(data?.basics?.summary);
 push(data?.work?.[0]?.position);
 push(data?.work?.[0]?.summary);
 push(data?.education?.[0]?.studyType);
 push(data?.education?.[0]?.area);

 const sectionLabels = data?.meta?.sectionLabels;
 if (sectionLabels && typeof sectionLabels === 'object') {
 Object.values(sectionLabels).forEach(push);
 }

 const signals = `${sampleChunks.join(' ')} ${(cv.displayName || '').toLowerCase()} ${(cv.category || '').toLowerCase()}`;

 const germanHints = [
 /\b(berufserfahrung|ausbildung|kenntnisse|sprachen|zusammenfassung|lebenslauf)\b/i,
 /\b(und|mit|der|die|das|ich|für|im|als)\b/i,
 /\b(deutsch|german|de)\b/i,
 ];
 const englishHints = [
 /\b(experience|education|skills|summary|resume|cover letter)\b/i,
 /\b(and|with|the|for|responsible|developed)\b/i,
 /\b(english|en)\b/i,
 ];

 const germanScore = germanHints.reduce((acc, re) => acc + (re.test(signals) ? 1 : 0), 0);
 const englishScore = englishHints.reduce((acc, re) => acc + (re.test(signals) ? 1 : 0), 0);

 if (germanScore > englishScore) return 'German';
 if (englishScore > germanScore) return 'English';
 return 'Unknown';
 }

 const columns: ColumnDef<CVDocument>[] = [
 {
 key: 'displayName',
 label: 'CV Name',
 render: (cv) => {
 const displayName = cv.displayName || cv.category || 'Unnamed CV';
 const isDefault = cv.isDefault;
 return (
 <div className="flex items-center gap-2 min-w-0">
 <div className="flex flex-col min-w-0">
 <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{displayName}</span>
 </div>
 {isDefault && (
 <span
 className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-1"
 style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b' }}
 >
 <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
 <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
 </svg>
 Default
 </span>
 )}
 </div>
 );
 },
 },
 {
 key: 'jobFocus',
 label: 'Job Focus',
 render: (cv) => (
 <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
 {cv.category || 'General'}
 </span>
 ),
 className: 'w-32',
 },
 {
 key: 'language',
 label: 'Lang',
 render: (cv) => {
 const languageLabel = getCvLanguageLabel(cv);
 const languageCode = languageLabel === 'English' ? 'EN' : languageLabel === 'German' ? 'DE' : '??';
 return (
 <span
 className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
 style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
 >
 {languageCode}
 </span>
 );
 },
 className: 'w-20',
 },
 {
 key: 'usedByJobCount',
 label: 'Usage',
 sortable: true,
 onSort: () => handleSort('usage'),
 sortDirection: sortKey === 'usage' ? sortDirection : null,
 render: (cv) => (
 <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
 {`${cv.usedByJobCount || 0} job CV${(cv.usedByJobCount || 0) === 1 ? '' : 's'}`}
 </span>
 ),
 className: 'w-28',
 },
 {
 key: 'createdAt',
 label: 'Created',
 render: (cv) => (
 <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
 {getRelativeTime(cv.createdAt)}
 </span>
 ),
 className: 'w-24',
 },
 {
 key: 'updatedAt',
 label: 'Edited',
 sortable: true,
 onSort: () => handleSort('edited'),
 sortDirection: sortKey === 'edited' ? sortDirection : null,
 render: (cv) => (
 <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
 {getRelativeTime(cv.updatedAt)}
 </span>
 ),
 className: 'w-24',
 },
 {
 key: 'actions',
 label: 'Actions',
 align: 'right',
 render: (cv) => (
 <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
 {onToggleStar && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 onToggleStar(cv._id, !cv.isStarred);
 }}
 className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${cv.isStarred ? 'text-amber-600 bg-amber-100' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-100'}`}
 title={cv.isStarred ? 'Unstar' : 'Star'}
 >
 <svg className="w-4 h-4" fill={cv.isStarred ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
 <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
 </svg>
 </button>
 )}
 {onRenameBranch && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 setEditCv(cv);
 setIsEditModalOpen(true);
 }}
 className="p-1.5 rounded-lg transition-colors"
 style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)' }}
 onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
 onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
 title="Rename"
 >
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
 </svg>
 </button>
 )}
 {onDeleteCv && (
 <button
 onClick={(e) => {
 e.stopPropagation();
 onDeleteCv(cv._id);
 }}
 className="p-1.5 rounded-lg transition-colors"
 style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)' }}
 onMouseEnter={e => (e.currentTarget.style.color = 'var(--rose)')}
 onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
 title="Delete"
 >
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 </button>
 )}
 </div>
 ),
 className: 'w-24',
 },
 ];

 return (
 <>
 <div className={`flex flex-col ${className}`}>
 <div
 className="flex flex-col gap-3 p-4 sm:p-5 border-b"
 style={{
 borderColor: 'var(--border)',
 background: 'linear-gradient(180deg, color-mix(in srgb, var(--bg-surface) 96%, var(--accent) 4%) 0%, var(--bg-surface) 100%)',
 }}
 >
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
 <div className="flex items-center gap-2">
 {hasActiveFilters && (
 <span
 className="text-[10px] font-semibold px-2 py-1 rounded-full border"
 style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}
 >
 Filtered
 </span>
 )}
 {hasActiveFilters && (
 <button
 type="button"
 onClick={clearFilters}
 className="text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors"
 style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-surface)' }}
 >
 Clear filters
 </button>
 )}
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-[minmax(220px,1fr)_repeat(3,minmax(130px,160px))] gap-2.5">
 <div className="relative">
 <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
 </svg>
 </span>
 <Input
 type="text"
 placeholder="Search base CVs"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full py-2 pl-9 pr-3 text-xs font-medium rounded-full border"
 aria-label="Search base CVs"
 icon={
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
 </svg>
 }
 />
 </div>
 <select
 value={languageFilter}
 onChange={(e) => setLanguageFilter(e.target.value as typeof languageFilter)}
 className="px-3 py-2 text-xs rounded-full border"
 style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
 aria-label="Filter by language"
 >
 <option value="all">All languages</option>
 <option value="english">English</option>
 <option value="german">German</option>
 <option value="unknown">Unknown</option>
 </select>
 <select
 value={focusFilter}
 onChange={(e) => setFocusFilter(e.target.value)}
 className="px-3 py-2 text-xs rounded-full border"
 style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
 aria-label="Filter by job focus"
 >
 <option value="all">All job focus</option>
 {focusOptions.map((focus) => (
 <option key={focus} value={focus}>{focus}</option>
 ))}
 </select>
 <select
 value={starFilter}
 onChange={(e) => setStarFilter(e.target.value as typeof starFilter)}
 className="px-3 py-2 text-xs rounded-full border"
 style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
 aria-label="Filter by star status"
 >
 <option value="all">All stars</option>
 <option value="starred">Starred</option>
 <option value="unstarred">Unstarred</option>
 </select>
 </div>

 {/* Row 2: TableOrCards */}
 <div className="flex flex-col gap-2">
 <TableOrCards
 data={isLoading ? [] : pagedCvs}
 columns={columns}
 onRowClick={(cv) => onSelectCv(cv._id)}
 rowClassName={(cv) => {
 const isActive = activeCvId === cv._id;
 const isMock = cv._id === '__mock_cv__';
 const baseClass = 'hover:bg-[var(--bg-elevated)] ring-1 ring-transparent';
 if (isMock) return `pointer-events-none opacity-70 ${baseClass}`;
 return isActive
 ? `bg-amber-50 ${baseClass}`
 : baseClass;
 }}
 emptyMessage="No CVs found."
 emptyState={isLoading ? (
 <div className="p-10 text-center" style={{ color: 'var(--text-muted)' }}>
 <div className="flex items-center justify-center gap-2 text-xs">
 <Spinner size="sm" />
 Loading CVs...
 </div>
 </div>
 ) : undefined}
 className="rounded-xl border-transparent md:border"
 />

 {!isLoading && filteredCvs.length > pageSize && (
 <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
 <span>
 Showing {startIndex + 1}-{Math.min(startIndex + pageSize, sortedCvs.length)} of {sortedCvs.length}
 </span>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
 disabled={safePage === 1}
 className="px-2 py-1 rounded-md border text-xs disabled:opacity-50"
 style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
 >
 Prev
 </button>
 <span>
 Page {safePage} / {totalPages}
 </span>
 <button
 type="button"
 onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
 disabled={safePage === totalPages}
 className="px-2 py-1 rounded-md border text-xs disabled:opacity-50"
 style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
 >
 Next
 </button>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 {onRenameBranch && (
 <EditBaseCvModal
 isOpen={isEditModalOpen}
 cv={editCv}
 onClose={() => setIsEditModalOpen(false)}
 onSave={async (payload) => {
 if (!editCv) return false;
 return onRenameBranch(editCv._id, payload);
 }}
 />
 )}
 </>
 );
};

export default Sidebar;
