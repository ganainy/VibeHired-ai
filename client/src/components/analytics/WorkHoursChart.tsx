import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { WorkTrackerAnalytics } from '../../services/workTrackerApi';

interface WorkHoursChartProps {
    data: WorkTrackerAnalytics['dailyHours'];
    isLoading: boolean;
}

export const WorkHoursChart: React.FC<WorkHoursChartProps> = ({ data, isLoading }) => {
    if (isLoading) {
        return <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Loading chart...</div>;
    }

    if (data.length === 0) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                <span className="material-symbols-outlined text-4xl mb-2 opacity-20">bar_chart</span>
                <p className="text-sm">No work entry data for this period.</p>
            </div>
        );
    }

    // Format dates for display
    const chartData = data.map(day => ({
        ...day,
        displayDate: new Date(day.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    }));

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const dayData = payload[0].payload;
            return (
                <div className="p-3 border rounded-lg shadow-xl" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                    <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{label}</p>
                    <div className="space-y-1.5">
                        {dayData.entries.map((entry: any, i: number) => (
                            <div key={i} className="flex items-center justify-between gap-4 text-xs">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: entry.type === 'shift' ? 'var(--accent)' : 'var(--gold)' }}></div>
                                    <span style={{ color: 'var(--text-secondary)' }}>{entry.employer}</span>
                                </div>
                                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{entry.hours}h</span>
                            </div>
                        ))}
                        <div className="pt-1.5 mt-1.5 border-t flex items-center justify-between font-bold text-xs" style={{ borderColor: 'var(--border)' }}>
                            <span style={{ color: 'var(--text-primary)' }}>Total</span>
                            <span style={{ color: 'var(--accent)' }}>{dayData.totalHours.toFixed(1)}h</span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    barSize={32}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                    <XAxis
                        dataKey="displayDate"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--bg-elevated)', opacity: 0.4 }} />
                    <Bar
                        dataKey="totalHours"
                        radius={[6, 6, 0, 0]}
                    >
                        {chartData.map((_, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill="var(--accent)"
                                fillOpacity={0.8}
                                style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
