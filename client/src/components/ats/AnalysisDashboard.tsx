import React, { useMemo } from 'react';
import { AtsScores } from '../../services/atsApi';
import { SectionAnalysisResult } from '../../services/analysisApi';
import SimpleLoader from '../common/SimpleLoader';

interface AnalysisDashboardProps {
    atsScores: AtsScores | null;
    analyses: Record<string, SectionAnalysisResult[]>;
    isLoading: boolean;
    onRefresh: () => void;
}

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({
    atsScores,
    analyses,
    isLoading,
    onRefresh
}) => {
    // Calculate section health
    const sectionHealth = useMemo(() => {
        const sections = ['work', 'education', 'skills', 'summary'];
        return sections.map(section => {
            const sectionAnalyses = analyses[section] || [];
            const totalItems = sectionAnalyses.length;
            const itemsNeedingImprovement = sectionAnalyses.filter(a => a.needsImprovement).length;
            const isHealthy = totalItems > 0 && itemsNeedingImprovement === 0;

            return {
                name: section.charAt(0).toUpperCase() + section.slice(1),
                isHealthy,
                issuesCount: itemsNeedingImprovement,
                totalCount: totalItems
            };
        });
    }, [analyses]);

    // Extract top suggestions
    const topSuggestions = useMemo(() => {
        const allSuggestions: { section: string; feedback: string }[] = [];

        Object.entries(analyses).forEach(([section, results]) => {
            results.forEach(result => {
                if (result.needsImprovement && result.feedback) {
                    allSuggestions.push({
                        section: section.charAt(0).toUpperCase() + section.slice(1),
                        feedback: result.feedback
                    });
                }
            });
        });

        // Return top 3 suggestions
        return allSuggestions.slice(0, 3);
    }, [analyses]);

    const score = atsScores?.score || 0;
    const scoreColor = score >= 80 ? 'text-green-600 dark:text-green-400' : score >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
    const scoreBg = score >= 80 ? 'bg-green-100 dark:bg-green-900/30' : score >= 60 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-red-100 dark:bg-red-900/30';

    if (isLoading) {
        return (
            <div className="py-20 card flex flex-col items-center justify-center min-h-[300px]">
                <SimpleLoader message="Lade Dashboard-Analyse..." height="auto" />
            </div>
        );
    }

    if (!atsScores && Object.keys(analyses).length === 0) {
        return (
            <div className="p-8 text-center">
                <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No Analysis Data</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Run an analysis to get insights on your CV.</p>
                <button
                    onClick={onRefresh}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Run Analysis
                </button>
            </div>
        );
    }

    return (
        <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* ATS Score Card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center justify-center text-center shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">ATS Compatibility</h3>
                    <div className={`relative w-32 h-32 flex items-center justify-center rounded-full border-8 ${score >= 80 ? 'border-green-100 dark:border-green-900/30' : score >= 60 ? 'border-amber-100 dark:border-amber-900/30' : 'border-red-100 dark:border-red-900/30'} mb-4`}>
                        <div className={`text-4xl font-bold ${scoreColor}`}>
                            {Math.round(score)}%
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {score >= 80 ? 'Excellent! Your CV is ATS friendly.' : score >= 60 ? 'Good, but could be improved.' : 'Needs attention to pass ATS filters.'}
                    </p>
                </div>

                {/* Section Health */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Section Health</h3>
                    <div className="space-y-4">
                        {sectionHealth.map((section) => (
                            <div key={section.name} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${section.isHealthy ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">{section.name}</span>
                                </div>
                                {section.issuesCount > 0 ? (
                                    <span className="text-xs font-medium px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
                                        {section.issuesCount} suggestions
                                    </span>
                                ) : (
                                    <span className="text-xs font-medium px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                                        Healthy
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top Improvements */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">Top Improvements</h3>
                    {topSuggestions.length > 0 ? (
                        <div className="space-y-4">
                            {topSuggestions.map((suggestion, index) => (
                                <div key={index} className="flex gap-3">
                                    <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold">
                                        {index + 1}
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-0.5">{suggestion.section}</p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{suggestion.feedback}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400">
                            <svg className="w-10 h-10 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-sm">No major issues found!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnalysisDashboard;
