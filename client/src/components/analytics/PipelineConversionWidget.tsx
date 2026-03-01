
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

            <div className="space-y-6">
                {/* Applied Stage */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span style={{ color: 'var(--text-secondary)' }}>Applied</span>
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{data.applied}</span>
                    </div>
                    <div className="w-full rounded-full h-2" style={{ background: 'var(--bg-elevated)' }}>
                        <div className="h-2 rounded-full w-full transition-all duration-500" style={{ background: 'var(--accent-dim)' }}></div>
                    </div>
                </div>

                {/* Rejected Stage */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span style={{ color: 'var(--text-secondary)' }}>Rejected</span>
                        <div className="flex gap-2">
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{data.rejected}</span>
                            <span style={{ color: 'var(--text-muted)' }}>({getPercentage(data.rejected, data.applied)}%)</span>
                        </div>
                    </div>
                    <div className="w-full rounded-full h-2" style={{ background: 'var(--bg-elevated)' }}>
                        <div
                            className="h-2 rounded-full transition-all duration-700 ease-out"
                            style={{
                                width: `${getPercentage(data.rejected, data.applied)}%`,
                                background: 'var(--rose)'
                            }}
                        ></div>
                    </div>
                </div>

                {/* Interview Stage */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span style={{ color: 'var(--text-secondary)' }}>Interview</span>
                        <div className="flex gap-2">
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{data.interview}</span>
                            <span style={{ color: 'var(--text-muted)' }}>({getPercentage(data.interview, data.applied)}%)</span>
                        </div>
                    </div>
                    <div className="w-full rounded-full h-2" style={{ background: 'var(--bg-elevated)' }}>
                        <div
                            className="h-2 rounded-full transition-all duration-700 ease-out delay-100"
                            style={{
                                width: `${getPercentage(data.interview, data.applied)}%`,
                                background: 'var(--accent)'
                            }}
                        ></div>
                    </div>
                </div>

                {/* Offer Stage */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span style={{ color: 'var(--text-secondary)' }}>Offer</span>
                        <div className="flex gap-2">
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{data.offer}</span>
                            <span style={{ color: 'var(--text-muted)' }}>({getPercentage(data.offer, data.applied)}%)</span>
                        </div>
                    </div>
                    <div className="w-full rounded-full h-2" style={{ background: 'var(--bg-elevated)' }}>
                        <div
                            className="h-2 rounded-full transition-all duration-1000 ease-out delay-200"
                            style={{
                                width: `${getPercentage(data.offer, data.applied)}%`,
                                background: 'var(--emerald)'
                            }}
                        ></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
