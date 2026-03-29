import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { WorkTrackerAnalytics } from '../../services/workTrackerApi';

interface EmployerDistributionChartProps {
    data: WorkTrackerAnalytics['employerBreakdown'];
    isLoading: boolean;
}

const COLORS = [
    'var(--azure)',
    'var(--amber)',
    'var(--jade)',
    'var(--rose)',
    'var(--accent)',
    'var(--text-muted)'
];

export const EmployerDistributionChart: React.FC<EmployerDistributionChartProps> = ({ data, isLoading }) => {
    if (isLoading) {
        return <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Loading...</div>;
    }

    if (data.length === 0) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                <span className="material-symbols-outlined text-4xl mb-2 opacity-20">pie_chart</span>
                <p className="text-sm">No employer data available.</p>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const item = payload[0].payload;
            return (
                <div className="p-3 border rounded-lg shadow-xl" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                    <p className="text-xs font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                    <div className="flex items-center gap-2 text-xs">
                        <span style={{ color: 'var(--text-secondary)' }}>Hours:</span>
                        <span className="font-semibold" style={{ color: 'var(--accent)' }}>{item.hours.toFixed(1)}h</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs mt-1">
                        <span style={{ color: 'var(--text-secondary)' }}>Shifts:</span>
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{item.count}</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="hours"
                        stroke="none"
                    >
                        {data.map((_, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                                style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }}
                            />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value) => <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{value}</span>}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
};
