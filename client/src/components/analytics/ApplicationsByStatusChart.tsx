
import React, { useMemo } from 'react';

interface ApplicationsByStatusChartProps {
 data: { _id: string; count: number }[];
}

interface StatusData {
 label: string;
 count: number;
 color: string;
 dashArray: string;
 dashOffset: number;
}

export const ApplicationsByStatusChart: React.FC<ApplicationsByStatusChartProps> = ({ data }) => {
 const { statusData, total } = useMemo(() => {
 const statusMap: Record<string, number> = {};
 data.forEach(item => {
 statusMap[item._id] = (statusMap[item._id] || 0) + item.count;
 });

 const applied = statusMap['Applied'] || 0;
 const interview = (statusMap['Interview'] || 0) + (statusMap['Assessment'] || 0);
 const offer = statusMap['Offer'] || 0;
 const saved = statusMap['Not Applied'] || 0;

 const total = applied + interview + offer + saved;

 if (total === 0) {
 return { statusData: [], total: 0 };
 }

 const statusData: StatusData[] = [];
 let currentOffset = 0;
 const circumference = 100; // 100% for the circle

 if (applied > 0) {
 const percentage = (applied / total) * 100;
 statusData.push({
 label: 'Applied',
 count: applied,
 color: 'text-blue-500',
 dashArray: `${percentage}, ${circumference}`,
 dashOffset: currentOffset
 });
 currentOffset -= percentage;
 }

 if (interview > 0) {
 const percentage = (interview / total) * 100;
 statusData.push({
 label: 'Interviewing',
 count: interview,
 color: 'text-yellow-500',
 dashArray: `${percentage}, ${circumference}`,
 dashOffset: currentOffset
 });
 currentOffset -= percentage;
 }

 if (offer > 0) {
 const percentage = (offer / total) * 100;
 statusData.push({
 label: 'Offers',
 count: offer,
 color: 'text-green-500',
 dashArray: `${percentage}, ${circumference}`,
 dashOffset: currentOffset
 });
 currentOffset -= percentage;
 }

 if (saved > 0) {
 const percentage = (saved / total) * 100;
 statusData.push({
 label: 'Saved',
 count: saved,
 color: 'text-blue-200',
 dashArray: `${percentage}, ${circumference}`,
 dashOffset: currentOffset
 });
 }

 return { statusData, total };
 }, [data]);

 if (total === 0) {
 return (
 <div className="text-center text-secondary-color py-4">
 No application status data to display.
 </div>
 );
 }

 const getColorClass = (label: string) => {
 switch (label) {
 case 'Applied':
 return 'var(--azure)';
 case 'Interviewing':
 return 'var(--amber)';
 case 'Offers':
 return 'var(--jade)';
 case 'Saved':
 return 'var(--text-muted)';
 default:
 return 'var(--text-muted)';
 }
 };

 const getStrokeColor = (label: string) => {
 switch (label) {
 case 'Applied':
 return 'var(--azure)';
 case 'Interviewing':
 return 'var(--amber)';
 case 'Offers':
 return 'var(--jade)';
 case 'Saved':
 return 'var(--text-muted)';
 default:
 return 'var(--text-muted)';
 }
 };

 return (
 <div className="flex flex-col items-center justify-center gap-8 py-2">
 <div className="relative w-36 h-36 flex-shrink-0">
 <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
 <path
 style={{ stroke: 'var(--bg-elevated)' }}
 d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
 fill="none"
 strokeWidth="3"
 />
 {statusData.map((status) => (
 <path
 key={status.label}
 style={{ stroke: getStrokeColor(status.label) }}
 d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
 fill="none"
 strokeDasharray={status.dashArray}
 strokeDashoffset={status.dashOffset}
 strokeLinecap="round"
 strokeWidth="3.5"
 className="transition-all duration-1000 ease-in-out"
 />
 ))}
 </svg>
 <div className="absolute inset-0 flex flex-col items-center justify-center">
 <span className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{total}</span>
 <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--text-muted)' }}>Total Apps</span>
 </div>
 </div>
 <div className="w-full space-y-3">
 {statusData.map((status) => (
 <div key={status.label} className="flex items-center justify-between text-sm group">
 <div className="flex items-center gap-2.5">
 <span className="h-2.5 w-2.5 rounded-full transition-all group-hover:scale-125" style={{ background: getColorClass(status.label) }}></span>
 <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>
 {status.label}
 </span>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[var(--bg-raised)]" style={{ color: 'var(--text-primary)' }}>
 {Math.round((status.count / total) * 100)}%
 </span>
 <span className="font-bold min-w-[20px] text-right" style={{ color: 'var(--text-primary)' }}>
 {status.count}
 </span>
 </div>
 </div>
 ))}
 </div>
 </div>
 );
};
