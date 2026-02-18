
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { JobApplication } from '../../services/jobApi';
import { MoreHorizontal } from 'lucide-react';

interface WeeklyGoalWidgetProps {
    jobs: JobApplication[];
    target: number;
    onUpdateTarget: (newTarget: number) => void;
}

export const WeeklyGoalWidget: React.FC<WeeklyGoalWidgetProps> = ({ jobs, target, onUpdateTarget }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(target.toString());
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSave = () => {
        const val = parseInt(editValue, 10);
        if (!isNaN(val) && val > 0) {
            onUpdateTarget(val);
            setIsEditing(false);
            setIsMenuOpen(false);
        }
    };

    const currentWeekCount = useMemo(() => {
        const now = new Date();
        const startOfWeek = new Date(now);
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);

        return jobs.filter(job => {
            const jobDate = new Date(job.createdAt);
            return jobDate >= startOfWeek;
        }).length;
    }, [jobs]);

    const percentage = Math.min(100, Math.round((currentWeekCount / target) * 100));

    // Circle calculations
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-slate-200 dark:border-zinc-800 flex flex-col h-full relative">
            <div className="flex justify-between items-start mb-6">
                <h3 className="font-semibold text-slate-900 dark:text-white">Weekly Goal</h3>
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                        <MoreHorizontal className="w-5 h-5" />
                    </button>

                    {isMenuOpen && (
                        <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-lg z-10 py-1">
                            <button
                                onClick={() => {
                                    setIsEditing(true);
                                    setIsMenuOpen(false);
                                    setEditValue(target.toString());
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-700"
                            >
                                Edit Goal
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center">
                {isEditing ? (
                    <div className="flex flex-col items-center gap-3 animate-in fade-in duration-200">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Set Weekly Target</label>
                        <input
                            type="number"
                            min="1"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave();
                                if (e.key === 'Escape') setIsEditing(false);
                            }}
                            className="w-20 text-center border border-slate-300 dark:border-zinc-700 rounded-md px-2 py-1 bg-transparent text-slate-900 dark:text-white font-bold"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="relative w-40 h-40 flex items-center justify-center">
                        {/* Background Circle */}
                        <svg className="w-full h-full transform -rotate-90">
                            <circle
                                cx="80"
                                cy="80"
                                r={radius}
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="transparent"
                                className="text-slate-100 dark:text-zinc-800"
                            />
                            {/* Progress Circle */}
                            <circle
                                cx="80"
                                cy="80"
                                r={radius}
                                stroke="currentColor"
                                strokeWidth="12"
                                fill="transparent"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                className="text-indigo-600 dark:text-indigo-500 transition-all duration-1000 ease-out"
                            />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                            <span className="text-3xl font-bold text-slate-900 dark:text-white">{currentWeekCount}</span>
                            <span className="text-sm text-slate-500 dark:text-slate-400">of {target} sent</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-6 text-center">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                    {percentage >= 100
                        ? "You've hit your weekly applications target! Great job!"
                        : currentWeekCount === 0
                            ? <>Get started by sending your first application this week!</>
                            : <>You're on track to hit your weekly applications target. <span className="text-green-600 dark:text-green-400 font-medium">Keep it up!</span></>
                    }
                </p>
                <div className="flex justify-between text-xs text-slate-400 mt-4">
                    <span>Goal Period</span>
                    <span>{(() => {
                        const now = new Date();
                        const day = now.getDay();
                        const daysToMonday = day === 0 ? 6 : day - 1;

                        const start = new Date(now);
                        start.setDate(now.getDate() - daysToMonday);

                        const end = new Date(start);
                        end.setDate(start.getDate() + 6);

                        const format = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        return `${format(start)} - ${format(end)}`;
                    })()}</span>
                </div>
            </div>
        </div>
    );
};
