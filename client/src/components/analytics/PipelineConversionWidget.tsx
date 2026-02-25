
import React from 'react';
import { ApplicationStats } from '../../services/analyticsApi';

interface PipelineConversionWidgetProps {
    stats: ApplicationStats | null;
}

export const PipelineConversionWidget: React.FC<PipelineConversionWidgetProps> = ({ stats }) => {

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

    return (
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg border border-zinc-100 dark:border-zinc-800 h-full">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-6">Pipeline Conversion</h3>

            <div className="space-y-6">
                {/* Applied Stage */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600 dark:text-slate-300">Applied</span>
                        <span className="text-slate-900 dark:text-white font-medium">{data.applied}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-2">
                        <div className="bg-slate-400 dark:bg-slate-500 h-2 rounded-full w-full"></div>
                    </div>
                </div>

                {/* Rejected Stage */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600 dark:text-slate-300">Rejected</span>
                        <div className="flex gap-2">
                            <span className="text-slate-900 dark:text-white font-medium">{data.rejected}</span>
                            <span className="text-slate-400">({getPercentage(data.rejected, data.applied)}%)</span>
                        </div>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-2">
                        <div
                            className="bg-red-500 h-2 rounded-full"
                            style={{ width: `${getPercentage(data.rejected, data.applied)}%` }}
                        ></div>
                    </div>
                </div>

                {/* Interview Stage */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600 dark:text-slate-300">Interview</span>
                        <div className="flex gap-2">
                            <span className="text-slate-900 dark:text-white font-medium">{data.interview}</span>
                            <span className="text-slate-400">({getPercentage(data.interview, data.applied)}%)</span>
                        </div>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-2">
                        <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${getPercentage(data.interview, data.applied)}%` }}
                        ></div>
                    </div>
                </div>

                {/* Offer Stage */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-600 dark:text-slate-300">Offer</span>
                        <div className="flex gap-2">
                            <span className="text-slate-900 dark:text-white font-medium">{data.offer}</span>
                            <span className="text-slate-400">({getPercentage(data.offer, data.applied)}%)</span>
                        </div>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-2">
                        <div
                            className="bg-emerald-500 h-2 rounded-full"
                            style={{ width: `${getPercentage(data.offer, data.applied)}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Insight Box */}
            <div className="mt-8 p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-slate-100 dark:border-zinc-800 flex gap-3">
                <div className="text-amber-500 mt-0.5">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                    </svg>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {data.applied === 0 
                        ? <>Start applying to jobs to see your pipeline conversion metrics here. Quality applications lead to better conversion rates!</>
                        : data.interview === 0
                            ? <>No interviews yet. Focus on tailoring your resume to each job description to improve your chances.</>
                            : <>Great progress! A <span className="font-semibold text-slate-900 dark:text-white">{getPercentage(data.interview, data.applied)}%</span> interview rate shows your applications are getting noticed. Keep refining your approach!</>
                    }
                </p>
            </div>
        </div>
    );
};
