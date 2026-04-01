import React, { useState } from 'react';
import { Input } from '../common';
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
    className = ''
}) => {
    void onAddNewCv;
    void onReplaceCv;
    const [searchTerm, setSearchTerm] = useState('');
    const [editCv, setEditCv] = useState<CVDocument | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const filteredCvs = cvs.filter(cv => {
        const displayName = cv.displayName || cv.category || 'Unnamed CV';
        return displayName.toLowerCase().includes(searchTerm.toLowerCase());
    });

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

    const getCvLanguageLabel = (cv: CVDocument): 'English' | 'German' | 'Unknown' => {
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

        const vhTagKeys = data?.__vh_tags && typeof data.__vh_tags === 'object'
            ? Object.keys(data.__vh_tags)
            : [];
        vhTagKeys.slice(0, 20).forEach(push);

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
    };

    const CvCard = ({ cv }: { cv: CVDocument }) => {
        const isActive = activeCvId === cv._id;
        const isMock = cv._id === '__mock_cv__';
        const displayName = cv.displayName || cv.category || 'Unnamed CV';
        const languageLabel = getCvLanguageLabel(cv);
        const isPrimary = cv.isPrimary || cv.isMasterCv;
        const languageCode = languageLabel === 'English' ? 'EN' : languageLabel === 'German' ? 'DE' : '??';
        const usedCount = cv.usedByJobCount || 0;
        const focusLabel = cv.category && cv.category !== displayName ? cv.category : null;

        return (
            <div
                onClick={() => onSelectCv(cv._id)}
                style={isActive ? {background:'var(--bg-surface)', borderColor:'var(--accent)', boxShadow:'0 0 0 1px rgba(232,184,68,0.2)'} : {background:'var(--bg-surface)', borderColor:'var(--border)'}}
                className={`group relative p-3 rounded-xl border transition-all duration-200 w-56 sm:w-64 flex-shrink-0 snap-start hover:border-opacity-70 overflow-hidden ${isMock ? 'pointer-events-none select-none opacity-70' : 'cursor-pointer'}`}
            >
                {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{background:'var(--accent)'}} />
                )}

                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <h3 className="font-semibold text-sm line-clamp-1" style={{color:'var(--text-primary)'}}>
                            {displayName}
                        </h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span
                            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                            style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}
                        >
                            Base CV
                        </span>
                        {isPrimary && (
                            <span
                                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-1"
                                style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #f59e0b' }}
                            >
                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                </svg>
                                Primary
                            </span>
                        )}
                        <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                        >
                            {languageCode}
                        </span>
                    </div>
                    {focusLabel && (
                        <div className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                            Job focus: <span style={{ color: 'var(--text-primary)' }}>{focusLabel}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs flex items-center gap-1" style={{color:'var(--text-muted)'}}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            {`Base for ${usedCount} job CV${usedCount === 1 ? '' : 's'}`}
                        </span>
                        <span className="text-xs" style={{color:'var(--text-muted)'}}>
                            Edited: {getRelativeTime(cv.updatedAt)}
                        </span>
                    </div>
                </div>

                {/* Hover Actions */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    {onRenameBranch && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setEditCv(cv);
                                setIsEditModalOpen(true);
                            }}
                            className="p-1 rounded-md transition-colors"
                            style={{color:'var(--text-muted)', background:'var(--bg-elevated)'}}
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
                            className="p-1 rounded-md transition-colors"
                            style={{color:'var(--text-muted)', background:'var(--bg-elevated)'}}
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
            </div>
        );
    };

    return (
        <>
        <div className={`flex flex-col rounded-xl overflow-hidden ${className}`} style={{background:'var(--bg-surface)', border:'1px solid var(--border)', boxShadow:'0 2px 8px rgba(0,0,0,0.3)'}}>
            <div className="flex flex-col gap-2 p-3 border-b" style={{borderColor:'var(--border)'}}>
                {/* Row 1: Title & Filter - stack on mobile */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex flex-col">
                        <h2 className="text-sm font-extrabold uppercase tracking-widest label-overline" style={{color:'var(--text-primary)'}}>Base CVs</h2>
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            Reusable masters used to generate tailored CVs and cover letters.
                        </span>
                    </div>

                    <div className="relative w-full sm:w-48 flex-shrink-0">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-gray-400">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </span>
                        <Input
                            type="text"
                            placeholder="Filter CVs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full py-1.5 pl-8 pr-3 text-[11px] font-medium focus:ring-gold-500/30"
                            icon={
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            }
                        />
                    </div>
                </div>

                {/* Row 2: Cards - horizontal scroll on mobile */}
                <div className="flex items-center">
                    {/* Scrollable Cards - full viewport width on mobile */}
                    <div className="flex-1 overflow-x-auto custom-scrollbar snap-x snap-mandatory">
                        <div className="flex items-stretch gap-2 py-1">
                            {isLoading ? (
                                <div
                                    className="flex items-center justify-center gap-2 w-full min-h-[96px] rounded-xl border border-dashed"
                                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                                >
                                    <Spinner size="sm" />
                                    <span className="text-xs font-medium">Loading CVs...</span>
                                </div>
                            ) : (
                                <>
                                    {/* Create Branch Card */}
                                    {onCreateBranch && (
                                        <button
                                            onClick={onCreateBranch}
                                            className="flex flex-col items-center justify-center gap-2 w-28 sm:w-32 flex-shrink-0 snap-start rounded-xl border-2 border-dashed transition-all group pt-2.5 pb-2.5"
                                            style={{borderColor:'var(--accent-dim)', background:'var(--accent-bg)', color:'var(--accent)'}}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.background='var(--accent-bg-hover,rgba(232,184,68,0.14))'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--accent-dim)'; e.currentTarget.style.background='var(--accent-bg)'; }}
                                            title="Create a specialized version for a different career focus (e.g., one for frontend, one for DevOps)"
                                        >
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform" style={{background:'var(--accent-bg)'}}>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                </svg>
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-tight">New CV</span>
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#e8b844', color: '#0e0e17' }}>2 Credits</span>
                                        </button>
                                    )}

                                    {filteredCvs.map(cv => (
                                        <CvCard key={cv._id} cv={cv} />
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
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
