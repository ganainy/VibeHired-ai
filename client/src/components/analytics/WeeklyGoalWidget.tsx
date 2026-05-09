
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '../common';
import { JobApplication } from '../../services/jobApi';

interface WeeklyGoalWidgetProps {
 jobs: JobApplication[];
 target: number;
 onUpdateTarget: (newTarget: number) => void;
 hideCardStyles?: boolean;
}

export const WeeklyGoalWidget: React.FC<WeeklyGoalWidgetProps> = ({ jobs, target, onUpdateTarget, hideCardStyles = false }) => {
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

  const containerClass = hideCardStyles
    ? "flex flex-col h-full relative"
    : "bg-white px-6 py-6 pb-4 rounded-xl border border-[var(--border-subtle)] flex flex-col h-full relative";

  const containerStyle = hideCardStyles
    ? {}
    : { background: 'var(--bg-surface)', borderColor: 'var(--border)' };

  return (
  <div className={containerClass} style={containerStyle}>
 <div className="flex justify-between items-start mb-6">
 <h3 className="text-sm font-bold uppercase tracking-widest w-full text-center" style={{ color: 'var(--text-muted)' }}>Weekly Goal</h3>
 <div className="absolute right-4 top-4" ref={menuRef}>
 <button
 onClick={() => setIsMenuOpen(!isMenuOpen)}
 className="text-muted-color hover:text-secondary-color p-1 rounded-md hover:bg-[var(--bg-raised)] transition-colors"
 >
 <MoreHorizontal className="w-5 h-5" />
 </button>

 {isMenuOpen && (
 <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-[var(--border-subtle)] rounded-lg shadow-lg z-10 py-1">
 <button
 onClick={() => {
 setIsEditing(true);
 setIsMenuOpen(false);
 setEditValue(target.toString());
 }}
 className="w-full text-left px-4 py-2 text-sm text-secondary-color hover:bg-elevated"
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
 <label className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-muted)' }}>Set Target</label>
 <input
 type="number"
 min="1"
 value={editValue}
 onChange={(e) => setEditValue(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') handleSave();
 if (e.key === 'Escape') setIsEditing(false);
 }}
 className="w-20 text-center border-b-2 border-accent-dim bg-transparent text-xl font-bold py-1 focus:outline-none focus:border-accent"
 style={{ color: 'var(--text-primary)' }}
 autoFocus
 />
 <div className="flex gap-2">
 <Button
 variant="ghost"
 size="sm"
 onClick={() => setIsEditing(false)}
 className="text-secondary-color hover:text-secondary-color"
 >
 Cancel
 </Button>
 <Button size="sm" onClick={handleSave}>
 Save
 </Button>
 </div>
 </div>
 ) : (
 <div className="relative w-36 h-36 flex items-center justify-center">
 <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
 <path
 style={{ stroke: 'var(--bg-elevated)' }}
 d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
 fill="none"
 strokeWidth="3"
 />
 <path
 style={{ stroke: 'var(--accent)' }}
 d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
 fill="none"
 strokeDasharray={`${percentage}, 100`}
 strokeDashoffset="0"
 strokeLinecap="round"
 strokeWidth="3.5"
 className="transition-all duration-1000 ease-in-out"
 />
 </svg>
 <div className="absolute inset-0 flex flex-col items-center justify-center">
 <span className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{currentWeekCount}</span>
 <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--text-muted)' }}>of {target} sent</span>
 </div>
 </div>
 )}
 </div>

 <div className="mt-8 text-center px-2">
 <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
 {percentage >= 100
 ? "You've hit your weekly target! Great job!"
 : currentWeekCount === 0
 ? <>Start by sending your first application this week!</>
 : <>On track to hit your weekly target. <span style={{ color: 'var(--jade)' }} className="font-bold uppercase tracking-widest text-[10px]">Keep it up!</span></>
 }
 </p>
 <div className="flex justify-between items-center text-[10px] uppercase tracking-tighter font-bold mt-6 pt-4 border-t" style={{ borderColor: 'var(--border-dim)', color: 'var(--text-muted)' }}>
 <span>Goal Period</span>
 <span style={{ color: 'var(--text-secondary)' }}>{(() => {
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
