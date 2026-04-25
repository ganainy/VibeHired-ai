
import React, { useMemo, useState } from 'react';
import {
 LineChart,
 Line,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 ResponsiveContainer
} from 'recharts';
import { StatusOverTimeData } from '../../services/analyticsApi';

interface ApplicationsOverTimeChartProps {
 data: StatusOverTimeData[];
 onMonthClick?: (month: string | null) => void;
 selectedMonth?: string | null;
}

// Status colors matching JobStatusBadge
const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
 'Applied': { color: '#22c55e', label: 'Applied' },
 'Interview': { color: '#3b82f6', label: 'Interview' },
 'Assessment': { color: '#a855f7', label: 'Assessment' },
 'Offer': { color: '#10b981', label: 'Offer' },
 'Rejected': { color: '#ef4444', label: 'Rejected' },
 'Closed': { color: '#6b7280', label: 'Closed' },
 'Not Applied': { color: '#94a3b8', label: 'Not Applied' },
};

// Statuses to show (in order of priority)
const VISIBLE_STATUSES = ['Applied', 'Interview', 'Assessment', 'Offer', 'Rejected', 'Closed', 'Not Applied'];

export const ApplicationsOverTimeChart: React.FC<ApplicationsOverTimeChartProps> = ({
 data,
 onMonthClick,
 selectedMonth
}) => {
 // Hide 'Not Applied' and 'Closed' by default to reduce clutter
 const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set(['Not Applied', 'Closed']));

 const chartData = useMemo(() => {
 let labels: { key: string; label: string }[] = [];

 if (selectedMonth === 'today') {
 // Today view: Just one day
 const now = new Date();
 const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
 labels.push({
 key: dayKey,
 label: 'Today'
 });
 } else if (selectedMonth === 'last-week') {
 // Last week view: 7 days including today
 const now = new Date();
 for (let i = 6; i >= 0; i--) {
 const date = new Date(now);
 date.setDate(now.getDate() - i);
 const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
 const label = date.toLocaleDateString('en-US', { weekday: 'short' });
 labels.push({ key: dayKey, label });
 }
 } else if (selectedMonth && selectedMonth.match(/^\d{4}-\d{2}$/)) {
 // Daily View: Generate days for the selected month
 const [year, month] = selectedMonth.split('-').map(Number);
 const daysInMonth = new Date(year, month, 0).getDate();

 for (let i = 1; i <= daysInMonth; i++) {
 const dayKey = `${selectedMonth}-${String(i).padStart(2, '0')}`;
 labels.push({
 key: dayKey,
 label: String(i) // Show day number
 });
 }
 } else {
 // Monthly View: Generate last 6 months
 const now = new Date();
 for (let i = 5; i >= 0; i--) {
 const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
 const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
 const monthLabel = date.toLocaleDateString('en-US', { month: 'short' });
 labels.push({ key: monthKey, label: monthLabel });
 }
 }

 // Create a map from key (month or date) to data
 const dataMap: Record<string, StatusOverTimeData> = {};
 data.forEach(item => {
 // item.month contains "YYYY-MM" or "YYYY-MM-DD" depending on view
 dataMap[item.month] = item;
 });

 // Fill in missing points
 return labels.map(l => {
 const existing = dataMap[l.key];
 return {
 key: l.key,
 label: l.label,
 Applied: existing?.Applied || 0,
 'Not Applied': existing?.['Not Applied'] || 0,
 Interview: existing?.Interview || 0,
 Assessment: existing?.Assessment || 0,
 Rejected: existing?.Rejected || 0,
 Closed: existing?.Closed || 0,
 Offer: existing?.Offer || 0,
 };
 });
 }, [data, selectedMonth]);

 const toggleStatus = (status: string) => {
 setHiddenStatuses(prev => {
 const newSet = new Set(prev);
 if (newSet.has(status)) {
 newSet.delete(status);
 } else {
 newSet.add(status);
 }
 return newSet;
 });
 };

 const totals = useMemo(() => {
 const counts: Record<string, number> = {};
 VISIBLE_STATUSES.forEach(status => {
 counts[status] = chartData.reduce((acc, curr) => acc + (curr[status as keyof typeof curr] as number || 0), 0);
 });
 return counts;
 }, [chartData]);

 const hasData = chartData.some(item =>
 VISIBLE_STATUSES.some(status => (item[status as keyof typeof item] as number) > 0)
 );

 const CustomTooltip = ({ active, payload, label }: any) => {
 if (active && payload && payload.length) {
 return (
 <div className="bg-white p-3 border border-theme rounded-lg shadow-lg">
 <p className="font-medium text-primary-color mb-2">{label}</p>
 {payload.map((entry: any) => (
 <div key={entry.name} className="flex items-center gap-2 text-sm">
 <span
 className="w-2 h-2 rounded-full"
 style={{ backgroundColor: entry.color }}
 />
 <span className="text-secondary-color">
 {entry.name}:
 </span>
 <span className="font-semibold text-primary-color">
 {entry.value}
 </span>
 </div>
 ))}
 </div>
 );
 }
 return null;
 };

 const CustomXAxisTick = (props: any) => {
 const { x, y, payload, index } = props;
 const isClickable = !selectedMonth && onMonthClick;

 return (
 <g transform={`translate(${x},${y})`}>
 <text
 x={0}
 y={0}
 dy={16}
 textAnchor="middle"
 fill="var(--text-secondary)"
 fontSize={12}
 className={isClickable ? "cursor-pointer hover:font-bold hover:fill-blue-600 transition-colors duration-200" : ""}
 onClick={() => {
 if (isClickable && onMonthClick && chartData[index]) {
 onMonthClick(chartData[index].key);
 }
 }}
 style={{ pointerEvents: 'all' }}
 >
 {payload.value}
 </text>
 </g>
 );
 };

 if (!hasData) {
 return (
 <div className="h-[300px] flex flex-col items-center justify-center text-muted-color">
 <p>No data to display</p>
 </div>
 );
 }

 return (
 <div className="flex flex-col gap-6 h-full">
 {/* Legend with Totals */}
 <div className="flex flex-wrap gap-3">
 {VISIBLE_STATUSES.map(status => (
 <button
 key={status}
 onClick={() => toggleStatus(status)}
 className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border transition-all ${hiddenStatuses.has(status)
? 'opacity-40 border-transparent bg-elevated'
  : 'opacity-100 border-theme bg-white shadow-sm'
 }`}
 title={hiddenStatuses.has(status) ? `Show ${status}` : `Hide ${status}`}
 >
 <span
 className="w-2.5 h-2.5 rounded-full"
 style={{ backgroundColor: STATUS_CONFIG[status].color }}
 />
 <div className="flex items-baseline gap-1.5">
<span className="text-xs font-bold text-secondary-color">{STATUS_CONFIG[status].label}</span>
<span className="text-[10px] font-black text-muted-color">{totals[status]}</span>
 </div>
 </button>
 ))}
 </div>

 {/* Chart */}
 <div className={`flex-1 min-h-0 w-full min-h-[250px] md:min-h-[300px] overflow-x-auto overflow-y-hidden ${!selectedMonth && onMonthClick ? 'cursor-pointer' : ''}`}>
 <ResponsiveContainer width="100%" height="100%" minWidth="600px">
 <LineChart
 data={chartData}
 margin={{ top: 10, right: 10, left: 0, bottom: 50 }}
 onClick={(e: any) => {
 if (!selectedMonth && onMonthClick && e && e.activePayload && e.activePayload[0]) {
 const clickedMonth = e.activePayload[0].payload.key;
 onMonthClick(clickedMonth);
 }
 }}
 >
 <defs>
 {VISIBLE_STATUSES.map(status => (
 <linearGradient key={status} id={`gradient-${status}`} x1="0" y1="0" x2="0" y2="1">
 <stop offset="5%" stopColor={STATUS_CONFIG[status].color} stopOpacity={0.1} />
 <stop offset="95%" stopColor={STATUS_CONFIG[status].color} stopOpacity={0} />
 </linearGradient>
 ))}
 </defs>
 <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" opacity={0.1} />
 <XAxis
 dataKey="label"
 axisLine={false}
 tickLine={false}
 tick={<CustomXAxisTick />}
 dy={10}
 />
 <YAxis
 axisLine={false}
 tickLine={false}
 tick={{ fill: '#6b7280', fontSize: 12 }}
 allowDecimals={false}
 />
 <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />

 {VISIBLE_STATUSES.map(status => !hiddenStatuses.has(status) && (
 <Line
 key={status}
 type="monotone"
 dataKey={status}
 stroke={STATUS_CONFIG[status].color}
 strokeWidth={3}
 dot={false}
 activeDot={{ r: 6, strokeWidth: 0 }}
 animationDuration={1000}
 />
 ))}
 </LineChart>
 </ResponsiveContainer>
 </div>
 </div>
 );
};