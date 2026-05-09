
import React from 'react';
import { ApplicationStats } from '../../services/analyticsApi';

interface PipelineConversionWidgetProps {
    stats: ApplicationStats | null;
    hideCardStyles?: boolean;
}

export const PipelineConversionWidget: React.FC<PipelineConversionWidgetProps> = ({ stats, hideCardStyles = false }) => {

    const data = React.useMemo(() => {
        if (!stats) return { applied: 0, interview: 0, offer: 0, rejected: 0 };
        const getCount = (status: string) => stats.applicationsByStatus.find(s => s._id === status)?.count || 0;

        return {
            applied: stats.totalApplications || 0,
            interview: getCount('Interview'),
            offer: getCount('Offer'),
            rejected: getCount('Rejected')
        };
    }, [stats]);

    const getPercentage = (value: number, total: number) => {
        if (total === 0) return 0;
        return Math.round((value / total) * 100);
    };

    const containerStyles = hideCardStyles
        ? "w-full space-y-8"
        : "p-6 rounded-lg border h-full transition-all duration-300";

    const containerInlineStyles = hideCardStyles
        ? {}
        : { background: 'var(--bg-surface)', borderColor: 'var(--border)' };

    return (
        <div className={containerStyles} style={containerInlineStyles}>
            {!hideCardStyles && <h3 className="font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>Pipeline Conversion</h3>}

            <div className="space-y-8">
                {/* Applied Stage */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Applied</span>
                        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{data.applied}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: data.applied > 0 ? '100%' : '0%', background: '#00754A' }}></div>
                    </div>
                </div>

                {/* Rejected Stage */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Rejected</span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{data.rejected}</span>
                            <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>({getPercentage(data.rejected, data.applied)}%)</span>
                        </div>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                        <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                                width: `${getPercentage(data.rejected, data.applied)}%`,
                                background: '#c82014'
                            }}
                        ></div>
                    </div>
                </div>

                {/* Interview Stage */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Interview</span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{data.interview}</span>
                            <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>({getPercentage(data.interview, data.applied)}%)</span>
                        </div>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                        <div
                            className="h-full rounded-full transition-all duration-700 ease-out delay-100 relative"
                            style={{
                                width: `${Math.max(1, getPercentage(data.interview, data.applied))}%`,
                                background: '#1E3932'
                            }}
                        >
                            {data.interview > 0 && (
                                <div
                                    className="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2"
                                    style={{ background: '#1E3932', borderColor: 'var(--bg-surface)' }}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Offer Stage */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end">
                        <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Offer</span>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{data.offer}</span>
                            <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>({getPercentage(data.offer, data.applied)}%)</span>
                        </div>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                        <div
                            className="h-full rounded-full transition-all duration-1000 ease-out delay-200"
                            style={{
                                width: `${getPercentage(data.offer, data.applied)}%`,
                                background: '#d1d5db'
                            }}
                        ></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
