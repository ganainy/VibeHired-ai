
import React from 'react';
import { ApplicationStats } from '../../services/analyticsApi';
import { ApplicationsByStatusChart } from './ApplicationsByStatusChart';
import { PipelineConversionWidget } from './PipelineConversionWidget';

interface ApplicationsOverallWidgetProps {
 stats: ApplicationStats | null;
}

export const ApplicationsOverallWidget: React.FC<ApplicationsOverallWidgetProps> = ({ stats }) => {
 return (
 <div className="md:col-span-2 border rounded-xl p-8 overflow-hidden shadow-sm flex flex-col h-full" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
 <div className="flex items-center justify-between mb-8">
 <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Application Performance Overview</h3>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-5 gap-12 items-center flex-1">
 <div className="md:col-span-2 flex flex-col justify-center border-r border-[var(--border-subtle)] pr-0 md:pr-12 h-full">
 <h4 className="text-[10px] uppercase tracking-widest font-bold mb-4 text-center opacity-70" style={{ color: 'var(--text-muted)' }}>Status Distribution</h4>
 <ApplicationsByStatusChart data={stats?.applicationsByStatus || []} />
 </div>

 <div className="md:col-span-3 flex flex-col justify-center h-full">
 <h4 className="text-[10px] uppercase tracking-widest font-bold mb-8 text-center md:text-left opacity-70" style={{ color: 'var(--text-muted)' }}>Pipeline Conversion</h4>
 <PipelineConversionWidget stats={stats} hideCardStyles={true} />
 </div>
 </div>
 </div>
 );
};
