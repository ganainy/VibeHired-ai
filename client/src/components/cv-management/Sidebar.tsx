import React, { useState } from 'react';
import { CVDocument } from '../../services/cvApi';

interface SidebarProps {
    cvs: CVDocument[];
    activeCvId: string | null;
    onSelectCv: (id: string) => void;
    onAddNewCv: () => void;
    onDeleteCv?: (id: string) => void;
    onReplaceCv?: (id: string) => void;
    onRenameBranch?: (id: string, newName: string) => void;
    onCreateBranch?: () => void;
    className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({
    cvs,
    activeCvId,
    onSelectCv,
    onAddNewCv,
    onDeleteCv,
    onReplaceCv,
    onRenameBranch,
    onCreateBranch,
    className = ''
}) => {
    const [searchTerm, setSearchTerm] = useState('');

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

        return (
            <div
                onClick={() => onSelectCv(cv._id)}
                style={isActive ? {background:'var(--bg-surface)', borderColor:'var(--accent)', boxShadow:'0 0 0 1px rgba(232,184,68,0.2)'} : {background:'var(--bg-surface)', borderColor:'var(--border)'}}
                className={`group relative p-3 rounded-xl border transition-all duration-200 w-64 flex-shrink-0 hover:border-opacity-70 overflow-hidden ${isMock ? 'pointer-events-none select-none opacity-70' : 'cursor-pointer'}`}
            >
                {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{background:'var(--accent)'}} />
                )}

                <div className="flex justify-between items-start mb-1">
                    <h3 className="font-semibold text-sm line-clamp-1 flex items-center gap-1.5" style={{color:'var(--text-primary)'}}>
                        {isMock && (
                            <span
                                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                                style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}
                            >
                                demo
                            </span>
                        )}
                        {displayName}
                    </h3>
                </div>

                <div className="flex items-center justify-between mt-2">
                    <span className="text-xs self-end" style={{color:'var(--text-muted)'}}>
                        Edited: {getRelativeTime(cv.updatedAt)}
                    </span>

                    <div className="flex gap-1.5">
                        {cv.category && (
                            <span className="badge badge-gold text-[10px] px-1.5 py-0.5">
                                {cv.category}
                            </span>
                        )}
                        <span className="badge badge-ink text-[10px] px-1.5 py-0.5">
                            {languageLabel}
                        </span>
                    </div>
                </div>

                {/* Hover Actions */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    {onRenameBranch && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const newName = prompt('Enter new name:', cv.displayName || cv.category || '');
                                if (newName && newName.trim()) {
                                    onRenameBranch(cv._id, newName.trim());
                                }
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
        <div className={`flex flex-col rounded-xl overflow-hidden ${className}`} style={{background:'var(--bg-surface)', border:'1px solid var(--border)', boxShadow:'0 2px 8px rgba(0,0,0,0.3)'}}>
            <div className="flex flex-col gap-4 p-4 border-b" style={{borderColor:'var(--border)'}}>
                {/* Row 1: Title & Filter */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h2 className="text-sm font-extrabold uppercase tracking-widest label-overline" style={{color:'var(--text-primary)'}}>My Documents</h2>

                        <div className="relative w-48 flex-shrink-0">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-gray-400">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </span>
                            <input
                                type="text"
                                placeholder="Filter CVs..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="input-base w-full py-1.5 pl-8 pr-3 text-[11px] font-medium focus:ring-gold-500/30"
                            />
                        </div>
                    </div>
                </div>

                {/* Row 2: Cards Only */}
                <div className="flex items-center">
                    {/* Scrollable Cards */}
                    <div className="flex-1 overflow-x-auto custom-scrollbar">
                        <div className="flex items-stretch gap-3 py-1 min-w-max px-1">
                            {/* Create Branch Card */}
                            {onCreateBranch && (
                                <button
                                    onClick={onCreateBranch}
                                    className="flex flex-col items-center justify-center gap-2 w-32 rounded-xl border-2 border-dashed transition-all group pb-2.5"
                                    style={{borderColor:'var(--accent-dim)', background:'var(--accent-bg)', color:'var(--accent)'}}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.background='var(--accent-bg-hover,rgba(232,184,68,0.14))'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor='var(--accent-dim)'; e.currentTarget.style.background='var(--accent-bg)'; }}
                                    title="Create a new CV"
                                >
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform" style={{background:'var(--accent-bg)'}}>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-tight">New CV</span>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#e8b844', color: '#0e0e17' }}>2 cr</span>
                                </button>
                            )}

                            {filteredCvs.map(cv => (
                                <CvCard key={cv._id} cv={cv} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
