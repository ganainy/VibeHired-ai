import React, { useState } from 'react';
import { CVDocument } from '../../services/cvApi';

interface SidebarProps {
    primaryCv: CVDocument | null;
    branchCvs: CVDocument[];
    activeCvId: string | null;
    onSelectCv: (id: string) => void;
    onAddNewCv: () => void;
    onDeleteCv?: (id: string) => void;
    onReplaceCv?: (id: string) => void;
    onSetPrimary?: (id: string) => void;
    onRenameBranch?: (id: string, newName: string) => void;
    onCreateBranch?: () => void;
    className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({
    primaryCv,
    branchCvs,
    activeCvId,
    onSelectCv,
    onAddNewCv,
    onDeleteCv,
    onReplaceCv,
    onSetPrimary,
    onRenameBranch,
    onCreateBranch,
    className = ''
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredBranchCvs = branchCvs.filter(cv => {
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

    const CvCard = ({ cv, isPrimary = false }: { cv: CVDocument, isPrimary?: boolean }) => {
        const isActive = activeCvId === cv._id;
        const displayName = cv.displayName || cv.category || 'Unnamed CV';

        return (
            <div
                onClick={() => onSelectCv(cv._id)}
                className={`
                    group relative p-3 rounded-xl border cursor-pointer transition-all duration-200 w-64 flex-shrink-0
                    ${isActive
                        ? 'bg-white border-blue-500 shadow-sm ring-1 ring-blue-500/20'
                        : 'bg-white border-gray-50 hover:border-gray-200 hover:shadow-sm'
                    }
                    dark:bg-gray-800 dark:border-gray-700
                `}
            >
                {isActive && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-xl" />
                )}

                <div className="flex justify-between items-start mb-1">
                    <h3 className={`font-semibold text-sm line-clamp-1 ${isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-200'}`}>
                        {displayName}
                    </h3>
                    {isPrimary && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                            <svg className="w-3 h-3 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            PRIMARY
                        </span>
                    )}
                </div>

                <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500 self-end">
                        Edited: {getRelativeTime(cv.updatedAt)}
                    </span>

                    <div className="flex gap-1.5">
                        {cv.category && (
                            <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 rounded text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                                {cv.category}
                            </span>
                        )}
                        <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] text-gray-500 font-medium">
                            English
                        </span>
                    </div>
                </div>

                {/* Hover Actions */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    {!isPrimary && onSetPrimary && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onSetPrimary(cv._id);
                            }}
                            className="p-1 text-gray-400 hover:text-amber-500 bg-white/80 dark:bg-gray-800 rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/40"
                            title="Set as Primary"
                        >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                        </button>
                    )}
                    {onRenameBranch && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const newName = prompt('Enter new name:', cv.displayName || cv.category || '');
                                if (newName && newName.trim()) {
                                    onRenameBranch(cv._id, newName.trim());
                                }
                            }}
                            className="p-1 text-gray-400 hover:text-blue-500 bg-white/80 dark:bg-gray-800 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/40"
                            title="Rename"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                    )}
                    {onDeleteCv && !isPrimary && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteCv(cv._id);
                            }}
                            className="p-1 text-gray-400 hover:text-red-500 bg-white/80 dark:bg-gray-800 rounded-md hover:bg-red-50 dark:hover:bg-red-900/40"
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
        <div className={`flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
            <div className="flex flex-col gap-4 p-4 border-b border-gray-100 dark:border-gray-700/50">
                {/* Row 1: Title & Filter */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h2 className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-widest">My Documents</h2>

                        {/* Search moved here */}
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
                                className="w-full py-1.5 pl-8 pr-3 text-[11px] bg-gray-50/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder-gray-400 font-medium"
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
                                    className="flex flex-col items-center justify-center gap-2 w-32 rounded-xl border-2 border-dashed border-blue-200 dark:border-blue-900/50 bg-blue-50/20 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 hover:border-blue-400 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/30 transition-all group"
                                    title="Create a new CV"
                                >
                                    <div className="w-8 h-8 rounded-full bg-blue-100/50 dark:bg-blue-900/50 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-tight">New CV</span>
                                </button>
                            )}

                            {primaryCv && <CvCard cv={primaryCv} isPrimary />}
                            {filteredBranchCvs.map(cv => (
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
