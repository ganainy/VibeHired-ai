// General CV ATS Analysis Panel - for CV analysis without job description
import React, { useState, useMemo } from 'react';
import { AtsScores } from '../../services/atsApi';
import { SectionAnalysisResult } from '../../services/analysisApi';
import SimpleLoader from '../common/SimpleLoader';

interface GeneralCvAtsPanelProps {
    atsScores: AtsScores | null;
    analyses?: Record<string, SectionAnalysisResult[]>;
    isLoading?: boolean;
}

type TabType = 'overview' | 'keywords' | 'formatting' | 'completeness' | 'quantifiable' | 'skills' | 'length' | 'readability' | 'blocking' | 'headers' | 'recommendations';

interface CollapsibleSectionProps {
    title: string;
    icon?: React.ReactNode;
    defaultOpen?: boolean;
    children: React.ReactNode;
    count?: number;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
    title,
    icon,
    defaultOpen = false,
    children,
    count
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors flex items-center justify-between"
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="font-medium text-gray-900 dark:text-gray-100">{title}</span>
                    {count !== undefined && count > 0 && (
                        <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs">
                            {count}
                        </span>
                    )}
                </div>
                <svg
                    className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && (
                <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                    {children}
                </div>
            )}
        </div>
    );
};

const GeneralCvAtsPanel: React.FC<GeneralCvAtsPanelProps> = ({ atsScores, analyses, isLoading }) => {
    const [activeTab, setActiveTab] = useState<TabType>('overview');

    const sectionHealth = useMemo(() => {
        if (!analyses) return [];
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

    const getRecommendationPriority = (rec: string): 'critical' | 'high' | 'medium' => {
        const lowerRec = rec.toLowerCase();
        if (lowerRec.includes('crucial') || lowerRec.includes('critical') || lowerRec.includes('significantly') || lowerRec.includes('must') || lowerRec.includes('required')) {
            return 'critical';
        }
        if (lowerRec.includes('important') || lowerRec.includes('should') || lowerRec.includes('consider') || lowerRec.includes('recommend')) {
            return 'high';
        }
        return 'medium';
    };

    if (isLoading) {
        return (
            <div className="p-12 card flex flex-col items-center justify-center min-h-[300px]">
                <SimpleLoader message="Analyzing your CV for ATS compatibility..." height="auto" />
            </div>
        );
    }

    if (!atsScores) {
        return (
            <div className="p-8 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900/50 dark:to-blue-900/10 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl text-center">
                <div className="max-w-md mx-auto">
                    <div className="mb-4 flex justify-center">
                        <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                            <svg className="w-12 h-12 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        Ready to Analyze Your CV?
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                        Get instant insights into your CV's ATS compatibility. Our AI-powered analysis will check:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 text-left">
                        <div className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs text-gray-700 dark:text-gray-300">Skill identification</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs text-gray-700 dark:text-gray-300">Keyword optimization</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs text-gray-700 dark:text-gray-300">ATS compliance</span>
                        </div>
                        <div className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-xs text-gray-700 dark:text-gray-300">Improvement tips</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const complianceDetails = atsScores.complianceDetails;
    const skillMatchDetails = atsScores.skillMatchDetails;

    const recommendations = complianceDetails?.suggestions || [];
    const formattingIssues = complianceDetails?.formattingIssues || [];

    // New comprehensive metrics
    const sectionCompleteness = complianceDetails?.sectionCompleteness;
    const quantifiableMetrics = complianceDetails?.quantifiableMetrics;
    const skillsAnalysis = complianceDetails?.skillsAnalysis;
    const lengthAnalysis = complianceDetails?.lengthAnalysis;
    const readabilityScore = complianceDetails?.readabilityScore;
    const atsBlockingElements = complianceDetails?.atsBlockingElements || [];
    const standardHeaders = complianceDetails?.standardHeaders;
    const keywordsMatched = complianceDetails?.keywordsMatched || [];
    const keywordsMissing = complianceDetails?.keywordsMissing || [];

    // Define severity type for better organization
    type SeverityType = 'critical' | 'important' | 'enhancement' | null;

    interface TabConfig {
        id: TabType;
        label: string;
        count?: number;
        severity: SeverityType;
    }

    // Severity indicators
    const severityConfig = {
        critical: { emoji: '🔴', color: 'text-red-600 dark:text-red-400', border: 'border-l-2 border-red-500' },
        important: { emoji: '🟡', color: 'text-amber-600 dark:text-amber-400', border: 'border-l-2 border-amber-500' },
        enhancement: { emoji: '🟢', color: 'text-green-600 dark:text-green-400', border: 'border-l-2 border-green-500' }
    };

    // Build tabs array with priority order: Critical → Important → Enhancement → Recommendations
    const allTabs: TabConfig[] = [
        // Critical 🔴 - Direct ATS pass/fail impact
        { id: 'overview' as TabType, label: 'Overview', severity: 'critical' },
        ...(atsBlockingElements.length > 0 ? [{ id: 'blocking' as TabType, label: 'Blocking Elements', count: atsBlockingElements.length, severity: 'critical' as SeverityType }] : []),

        // Important 🟡 - Strong impact on ATS ranking
        ...(keywordsMatched.length > 0 || keywordsMissing.length > 0 ? [{ id: 'keywords' as TabType, label: 'Keywords', count: keywordsMatched.length + keywordsMissing.length, severity: 'important' as SeverityType }] : []),
        ...((sectionCompleteness || sectionHealth.length > 0) ? [{ id: 'completeness' as TabType, label: 'Completeness', severity: 'important' as SeverityType }] : []),
        ...(formattingIssues.length > 0 ? [{ id: 'formatting' as TabType, label: 'Formatting', count: formattingIssues.length, severity: 'important' as SeverityType }] : []),
        ...(standardHeaders ? [{ id: 'headers' as TabType, label: 'Headers', severity: 'important' as SeverityType }] : []),

        // Enhancement 🟢 - Improves quality but less critical
        ...(quantifiableMetrics ? [{ id: 'quantifiable' as TabType, label: 'Metrics', severity: 'enhancement' as SeverityType }] : []),
        ...(skillsAnalysis ? [{ id: 'skills' as TabType, label: 'Skills', severity: 'enhancement' as SeverityType }] : []),
        ...(readabilityScore !== undefined ? [{ id: 'readability' as TabType, label: 'Readability', severity: 'enhancement' as SeverityType }] : []),
        ...(lengthAnalysis ? [{ id: 'length' as TabType, label: 'Length', severity: 'enhancement' as SeverityType }] : []),

        // Always last - Actionable recommendations
        // { id: 'recommendations' as TabType, label: 'Recommendations', count: recommendations.length, severity: null }
    ];

    const tabs = allTabs;

    const score = atsScores?.score || 0;
    const scoreColor = score >= 80 ? 'text-green-600 dark:text-green-400' : score >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';

    return (
        <div className="space-y-6">
            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
                <nav className="flex space-x-1 min-w-max" aria-label="Tabs">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        const severityStyle = tab.severity ? severityConfig[tab.severity] : null;

                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative
                                    ${isActive
                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                    }
                                    ${severityStyle ? severityStyle.border : ''}
                                `}
                            >
                                <span className="flex items-center gap-1.5">
                                    {severityStyle && (
                                        <span className="text-xs" title={`${tab.severity?.charAt(0).toUpperCase()}${tab.severity?.slice(1)} Priority`}>
                                            {severityStyle.emoji}
                                        </span>
                                    )}
                                    {tab.label}
                                    {(tab.count ?? 0) > 0 && (
                                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${isActive
                                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                            }`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="space-y-4">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {/* ATS Score Card - Prominent Display */}
                        {atsScores && atsScores.score !== null && atsScores.score !== undefined && (
                            <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center justify-center text-center shadow-lg">
                                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">ATS Compatibility Score</h3>
                                <div className={`relative w-24 h-24 flex items-center justify-center rounded-full border-8 ${score >= 80 ? 'border-green-100 dark:border-green-900/30' : score >= 60 ? 'border-amber-100 dark:border-amber-900/30' : 'border-red-100 dark:border-red-900/30'} mb-4`}>
                                    <div className={`text-3xl font-bold ${scoreColor}`}>
                                        {Math.round(score)}%
                                    </div>
                                </div>
                                <p className="text-base text-gray-700 dark:text-gray-300 font-medium">
                                    {score >= 80 ? 'Excellent! Your CV is ATS friendly.' : score >= 60 ? 'Good, but could be improved.' : 'Needs attention to pass ATS filters.'}
                                </p>
                            </div>
                        )}

                        {/* Recommendations Content Merged into Overview */}
                        <div className="space-y-3">
                            {formattingIssues.length > 0 && (
                                <CollapsibleSection
                                    title="Formatting Issues"
                                    icon={
                                        <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    }
                                    count={formattingIssues.length}
                                    defaultOpen={true}
                                >
                                    <ul className="space-y-2">
                                        {formattingIssues.map((issue, index) => (
                                            <li key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                <span className="text-red-500 dark:text-red-400 mt-0.5">•</span>
                                                <span>{issue}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CollapsibleSection>
                            )}

                            {recommendations.length > 0 ? (
                                <div className="space-y-3">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Actionable Recommendations</h3>
                                    {recommendations.map((rec, index) => {
                                        const priority = getRecommendationPriority(rec);
                                        const priorityConfig = {
                                            critical: {
                                                bg: 'bg-red-50 dark:bg-red-900/20',
                                                border: 'border-red-200 dark:border-red-800',
                                                badge: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
                                                number: 'bg-red-600 dark:bg-red-500',
                                                label: 'Critical'
                                            },
                                            high: {
                                                bg: 'bg-orange-50 dark:bg-orange-900/20',
                                                border: 'border-orange-200 dark:border-orange-800',
                                                badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
                                                number: 'bg-orange-600 dark:bg-orange-500',
                                                label: 'High'
                                            },
                                            medium: {
                                                bg: 'bg-blue-50 dark:bg-blue-900/20',
                                                border: 'border-blue-200 dark:border-blue-800',
                                                badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
                                                number: 'bg-blue-600 dark:bg-blue-500',
                                                label: 'Medium'
                                            }
                                        };
                                        const config = priorityConfig[priority];

                                        return (
                                            <div
                                                key={index}
                                                className={`p-4 ${config.bg} border ${config.border} rounded-lg`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="flex-shrink-0 mt-0.5">
                                                        <div className={`w-6 h-6 ${config.number} rounded-full flex items-center justify-center text-white text-xs font-bold`}>
                                                            {index + 1}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${config.badge}`}>
                                                                {config.label}
                                                            </span>
                                                            {priority === 'critical' && (
                                                                <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                                                                    Crucial Improvement
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-700 dark:text-gray-300">{rec}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-8">
                                    No recommendations available.
                                </p>
                            )}
                        </div>
                    </div>
                )}

            </div>

            {/* Last Analyzed */}
            {
                atsScores.lastAnalyzedAt && (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Last analyzed: <span className="text-gray-900 dark:text-gray-100">{new Date(atsScores.lastAnalyzedAt).toLocaleString()}</span>
                            </span>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default GeneralCvAtsPanel;

