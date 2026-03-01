import React from 'react';
import { WorkTrackerAnalytics } from '../../services/workTrackerApi';
import SimpleLoader from '../common/SimpleLoader';

interface WorkTrackerStatsWidgetProps {
    data: WorkTrackerAnalytics['summary'] | null;
    isLoading: boolean;
}

export const WorkTrackerStatsWidget: React.FC<WorkTrackerStatsWidgetProps> = ({ data, isLoading }) => {
    if (isLoading) {
        return (
            <div className="py-8">
                <SimpleLoader message="Lade Statistiken..." height="100px" />
            </div>
        );
    }

    const stats = [
        {
            label: 'Total Hours',
            value: data?.totalHours.toFixed(1) || '0.0',
            unit: 'hrs',
            icon: 'schedule',
            color: 'var(--accent)'
        },
        {
            label: 'Avg Daily',
            value: data?.avgHoursPerDay.toFixed(1) || '0.0',
            unit: 'hrs',
            icon: 'monitoring',
            color: 'var(--ember)'
        },
        {
            label: 'Total Entries',
            value: data?.totalEntries || '0',
            unit: 'shifts',
            icon: 'format_list_bulleted',
            color: 'var(--jade)'
        },
        {
            label: 'Break Time',
            value: data?.totalBreakMinutes || '0',
            unit: 'mins',
            icon: 'coffee',
            color: 'var(--rose)'
        },
        {
            label: 'Paid KM',
            value: data?.totalPaidKm.toFixed(1) || '0.0',
            unit: 'km',
            icon: 'directions_car',
            color: 'var(--accent-dim)'
        }
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {stats.map((stat, index) => (
                <div
                    key={index}
                    className="p-4 rounded-xl border transition-all duration-300 hover:shadow-md group"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
                >
                    <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-[18px] opacity-70 group-hover:opacity-100 transition-opacity" style={{ color: stat.color }}>
                            {stat.icon}
                        </span>
                        <span className="text-[11px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-muted)' }}>
                            {stat.label}
                        </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                            {stat.value}
                        </span>
                        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                            {stat.unit}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
};
