// ATS Analysis Panel - merged component displaying scores and detailed feedback from Gemini AI
import React, { useState } from 'react';
import { AtsScores } from '../../services/atsApi';
import SimpleLoader from '../common/SimpleLoader';

interface AtsFeedbackPanelProps {
    atsScores: AtsScores | null;
    isLoading?: boolean;
}

type TabType = 'skills' | 'compliance' | 'recommendations';

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
                <div className="p-4 bg-white dark:bg-gray-800">
                    {children}
                </div>
            )}
        </div>
    );
};

interface CircularProgressProps {
    score: number;
    size?: number;
    strokeWidth?: number;
    color?: string;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
    score,
    size = 120,
    strokeWidth = 8,
    color = 'blue'
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (score / 100) * circumference;

    const colorClasses = {
        green: 'stroke-green-600 dark:stroke-green-400',
        yellow: 'stroke-yellow-600 dark:stroke-yellow-400',
        red: 'stroke-red-600 dark:stroke-red-400',
        blue: 'stroke-blue-600 dark:stroke-blue-400',
    };

    const strokeColor = colorClasses[color as keyof typeof colorClasses] || colorClasses.blue;

    return (
        <div className="relative inline-flex items-center justify-center">
            <svg width={size} height={size} className="transform -rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="none"
                    className="text-gray-200 dark:text-gray-700"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className={strokeColor}
                    style={{
                        transition: 'stroke-dashoffset 0.6s ease-in-out',
                    }}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {Math.round(score)}%
                </span>
            </div>
        </div>
    );
};

const AtsFeedbackPanel: React.FC<AtsFeedbackPanelProps> = ({ atsScores, isLoading }) => {
    const [activeTab, setActiveTab] = useState<TabType>('skills');

    if (isLoading) {
        return (
            <div className="p-12 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
                <SimpleLoader message="Loading ATS feedback..." />
            </div>
        );
    }

    if (!atsScores) {
        return (
            <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
                <p className="text-gray-600 dark:text-gray-400">No ATS feedback available. Run an ATS scan to get detailed feedback.</p>
            </div>
        );
    }

    const skillMatchDetails = atsScores.skillMatchDetails;
    const complianceDetails = atsScores.complianceDetails;

    // Separate matched skills and keywords
    const matchedSkills = skillMatchDetails?.matchedSkills || [];
    const matchedKeywords = complianceDetails?.keywordsMatched || [];
    const uniqueMatchedSkills = Array.from(new Set(matchedSkills));
    const uniqueMatchedKeywords = Array.from(new Set(matchedKeywords));

    // Separate missing skills and keywords
    const missingSkills = skillMatchDetails?.missingSkills || [];
    const missingKeywords = complianceDetails?.keywordsMissing || [];
    const uniqueMissingSkills = Array.from(new Set(missingSkills));
    const uniqueMissingKeywords = Array.from(new Set(missingKeywords));

    // Merge recommendations and suggestions (remove duplicates)
    const allRecommendations = [
        ...(skillMatchDetails?.recommendations || []),
        ...(complianceDetails?.suggestions || [])
    ];
    const uniqueRecommendations = Array.from(new Set(allRecommendations));

    const getSectionScoreColor = (score: number): string => {
        if (score >= 80) return 'text-green-600 dark:text-green-400';
        if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-red-600 dark:text-red-400';
    };

    const getSectionScoreBgColor = (score: number): string => {
        if (score >= 80) return 'bg-green-100 dark:bg-green-900/30';
        if (score >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30';
        return 'bg-red-100 dark:bg-red-900/30';
    };

    const getScoreColor = (score: number | null | undefined): 'green' | 'yellow' | 'red' | 'blue' => {
        if (score === null || score === undefined) return 'blue';
        if (score >= 80) return 'green';
        if (score >= 60) return 'yellow';
        return 'red';
    };

    const getScoreInterpretation = (score: number | null | undefined): string => {
        if (score === null || score === undefined) return 'Not Available';
        if (score >= 80) return 'Excellent';
        if (score >= 60) return 'Good';
        if (score >= 40) return 'Fair';
        return 'Needs Improvement';
    };

    const getScoreBgGradient = (score: number | null | undefined): string => {
        if (score === null || score === undefined) return 'from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-800/50';
        if (score >= 80) return 'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20';
        if (score >= 60) return 'from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20';
        return 'from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20';
    };

    const overallScore = atsScores.score;
    const skillMatchScore = atsScores.skillMatchDetails?.skillMatchPercentage;
    const hasError = !!atsScores.error;

    const overallColor = getScoreColor(overallScore);
    const skillColor = getScoreColor(skillMatchScore);

    const tabs: Array<{ id: TabType; label: string; icon: React.ReactNode; count?: number }> = [
        {
            id: 'skills',
            label: 'Skills',
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
            ),
            count: (uniqueMatchedSkills.length + uniqueMissingSkills.length) || undefined,
        },
        {
            id: 'compliance',
            label: 'Compliance',
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
            ),
            count: (complianceDetails?.formattingIssues?.length || 0) + (complianceDetails?.sectionScores ? Object.keys(complianceDetails.sectionScores).length : 0) || undefined,
        },
        {
            id: 'recommendations',
            label: 'Recommendations',
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
            ),
            count: uniqueRecommendations.length || undefined,
        },
    ];

    return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
            {/* Header with Gemini branding */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
                <div className="flex items-center justify-end mb-4">
                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        Powered by Gemini AI
                    </span>
                </div>

                {/* Score Cards Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Overall ATS Score */}
                    <div className={`p-4 rounded-lg bg-gradient-to-br ${getScoreBgGradient(overallScore)} border border-gray-200 dark:border-gray-700`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Overall ATS Score</span>
                            </div>
                            {hasError && (
                                <span className="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded">Error</span>
                            )}
                        </div>
                        {overallScore !== null && overallScore !== undefined ? (
                            <div className="flex flex-col items-center">
                                <CircularProgress score={overallScore} size={100} color={overallColor} />
                                <div className="mt-3 text-center">
                                    <div className={`text-sm font-semibold mb-1 ${overallColor === 'green' ? 'text-green-700 dark:text-green-400' :
                                        overallColor === 'yellow' ? 'text-yellow-700 dark:text-yellow-400' :
                                            'text-red-700 dark:text-red-400'
                                        }`}>
                                        {getScoreInterpretation(overallScore)}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">
                                        Overall ATS Compatibility
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center py-4">
                                <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-2">
                                    <span className="text-gray-500 dark:text-gray-400 text-sm">N/A</span>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Not available</div>
                            </div>
                        )}
                    </div>

                    {/* Resume Matching Percentage */}
                    <div className={`p-4 rounded-lg bg-gradient-to-br ${getScoreBgGradient(skillMatchScore)} border border-gray-200 dark:border-gray-700`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Resume Matching Percentage</span>
                            </div>
                        </div>
                        {skillMatchScore !== null && skillMatchScore !== undefined ? (
                            <div className="flex flex-col items-center">
                                <CircularProgress score={skillMatchScore} size={100} color={skillColor} />
                                <div className="mt-3 text-center">
                                    <div className={`text-sm font-semibold mb-1 ${skillColor === 'green' ? 'text-green-700 dark:text-green-400' :
                                        skillColor === 'yellow' ? 'text-yellow-700 dark:text-yellow-400' :
                                            'text-red-700 dark:text-red-400'
                                        }`}>
                                        {getScoreInterpretation(skillMatchScore)}
                                    </div>
                                    <div className="text-xs text-gray-600 dark:text-gray-400">
                                        How well your resume aligns with job requirements
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center py-4">
                                <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-2">
                                    <span className="text-gray-500 dark:text-gray-400 text-sm">N/A</span>
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Not available</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Score Breakdown - Enhanced visualization */}
                {complianceDetails?.scoreBreakdown && (
                    <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            Score Breakdown
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: 'Technical Skills', score: complianceDetails.scoreBreakdown.technicalSkills, weight: '40%' },
                                { label: 'Experience', score: complianceDetails.scoreBreakdown.experienceRelevance, weight: '30%' },
                                { label: 'Additional Skills', score: complianceDetails.scoreBreakdown.additionalSkills, weight: '20%' },
                                { label: 'Formatting', score: complianceDetails.scoreBreakdown.formatting, weight: '10%' },
                            ].map((item, idx) => (
                                <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{item.label}</span>
                                        <span className="text-xs text-gray-400 dark:text-gray-500">({item.weight})</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full transition-all duration-500 ${item.score >= 80 ? 'bg-green-500' :
                                                    item.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                                    }`}
                                                style={{ width: `${item.score}%` }}
                                            ></div>
                                        </div>
                                        <span className={`text-sm font-bold w-10 text-right ${item.score >= 80 ? 'text-green-600 dark:text-green-400' :
                                            item.score >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                                            }`}>
                                            {item.score}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {hasError && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p className="text-xs font-medium text-red-800 dark:text-red-300 mb-1">Analysis Error:</p>
                                <p className="text-xs text-red-700 dark:text-red-400">{atsScores.error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {atsScores.lastAnalyzedAt && (
                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Last analyzed: {new Date(atsScores.lastAnalyzedAt).toLocaleString()}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <div className="flex overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap border-b-2 ${activeTab === tab.id
                                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800'
                                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === tab.id
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="p-6 space-y-4">

                {/* Skills Tab */}
                {activeTab === 'skills' && (
                    <div className="space-y-4">
                        {/* Skill Match Percentage (Secondary Display) */}
                        {skillMatchDetails?.skillMatchPercentage !== undefined && (
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Skill Match Percentage</span>
                                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                        {skillMatchDetails.skillMatchPercentage}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                    <div
                                        className="bg-blue-600 dark:bg-blue-500 h-3 rounded-full transition-all duration-500"
                                        style={{ width: `${skillMatchDetails.skillMatchPercentage}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}

                        {/* Matched Skills */}
                        <CollapsibleSection
                            title="Matched Skills"
                            defaultOpen={true}
                            count={uniqueMatchedSkills.length}
                            icon={
                                <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            }
                        >
                            {uniqueMatchedSkills.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {uniqueMatchedSkills.map((skill, index) => (
                                        <span
                                            key={index}
                                            className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-lg text-sm font-medium border border-green-200 dark:border-green-800"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400">No matched skills found.</p>
                            )}
                        </CollapsibleSection>

                        {/* Missing Skills */}
                        <CollapsibleSection
                            title="Missing Skills"
                            defaultOpen={true}
                            count={uniqueMissingSkills.length}
                            icon={
                                <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            }
                        >
                            {uniqueMissingSkills.length > 0 ? (
                                <>
                                    <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            These missing skills are crucial for getting your resume shortlisted
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {uniqueMissingSkills.map((skill, index) => (
                                            <span
                                                key={index}
                                                className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-lg text-sm font-medium border-2 border-red-300 dark:border-red-700 shadow-sm"
                                            >
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400">No missing skills identified.</p>
                            )}
                        </CollapsibleSection>

                        {/* Gap Analysis */}
                        {skillMatchDetails?.gapAnalysis && Object.keys(skillMatchDetails.gapAnalysis).length > 0 && (
                            <CollapsibleSection
                                title="Gap Analysis"
                                defaultOpen={false}
                                icon={
                                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                }
                            >
                                <div className="space-y-4">
                                    {/* Strong Alignments */}
                                    {skillMatchDetails.gapAnalysis.strongAlignments && Array.isArray(skillMatchDetails.gapAnalysis.strongAlignments) && skillMatchDetails.gapAnalysis.strongAlignments.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <p className="text-sm font-semibold text-green-700 dark:text-green-400">Strong Alignments</p>
                                            </div>
                                            <ul className="space-y-2 ml-7">
                                                {skillMatchDetails.gapAnalysis.strongAlignments.map((alignment: string, index: number) => (
                                                    <li key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                        <span className="text-green-600 dark:text-green-400 mt-1">✓</span>
                                                        <span>{alignment}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Key Gaps */}
                                    {skillMatchDetails.gapAnalysis.keyGaps && Array.isArray(skillMatchDetails.gapAnalysis.keyGaps) && skillMatchDetails.gapAnalysis.keyGaps.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Key Gaps</p>
                                            </div>
                                            <ul className="space-y-2 ml-7">
                                                {skillMatchDetails.gapAnalysis.keyGaps.map((gap: string, index: number) => (
                                                    <li key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                        <span className="text-amber-600 dark:text-amber-400 mt-1">⚠</span>
                                                        <span>{gap}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </CollapsibleSection>
                        )}
                    </div>
                )}

                {/* Compliance Tab */}
                {activeTab === 'compliance' && (
                    <div className="space-y-4">
                        {/* Section Scores */}
                        {complianceDetails?.sectionScores && Object.keys(complianceDetails.sectionScores).length > 0 && (
                            <CollapsibleSection
                                title="Section Scores"
                                defaultOpen={true}
                                count={Object.keys(complianceDetails.sectionScores).length}
                                icon={
                                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                }
                            >
                                <div className="space-y-3">
                                    {Object.entries(complianceDetails.sectionScores).map(([section, score]) => (
                                        <div key={section} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">{section}</span>
                                            <div className="flex items-center gap-3">
                                                <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                    <div
                                                        className={`h-2 rounded-full transition-all duration-500 ${getSectionScoreBgColor(score)}`}
                                                        style={{ width: `${score}%` }}
                                                    ></div>
                                                </div>
                                                <span className={`text-sm font-bold w-12 text-right ${getSectionScoreColor(score)}`}>
                                                    {score}%
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CollapsibleSection>
                        )}

                        {/* Matched Keywords - Highlighted */}
                        <CollapsibleSection
                            title="Matched Keywords (Highlighted)"
                            defaultOpen={true}
                            count={uniqueMatchedKeywords.length}
                            icon={
                                <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            }
                        >
                            {uniqueMatchedKeywords.length > 0 ? (
                                <>
                                    <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                        <p className="text-sm font-medium text-green-800 dark:text-green-300">
                                            These keywords from the job description were found in your resume - great match!
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {uniqueMatchedKeywords.map((keyword, index) => (
                                            <span
                                                key={index}
                                                className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-lg text-sm font-semibold border-2 border-green-300 dark:border-green-700 shadow-sm"
                                            >
                                                ✓ {keyword}
                                            </span>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400">No matched keywords found.</p>
                            )}
                        </CollapsibleSection>

                        {/* Missing Keywords - Gap Identification */}
                        <CollapsibleSection
                            title="Missing Keywords - Gap Identification"
                            defaultOpen={true}
                            count={uniqueMissingKeywords.length}
                            icon={
                                <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            }
                        >
                            {uniqueMissingKeywords.length > 0 ? (
                                <>
                                    <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg">
                                        <p className="text-sm font-semibold text-red-800 dark:text-red-300 flex items-start gap-2">
                                            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            <span>
                                                <strong>Critical for shortlisting:</strong> These keywords from the job description are missing from your resume. Identifying and adding these missing keywords is crucial for getting your resume shortlisted by the ATS system.
                                            </span>
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {uniqueMissingKeywords.map((keyword, index) => (
                                            <span
                                                key={index}
                                                className="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-lg text-sm font-semibold border-2 border-red-300 dark:border-red-700 shadow-sm"
                                            >
                                                ✗ {keyword}
                                            </span>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400">No missing keywords identified.</p>
                            )}
                        </CollapsibleSection>

                        {/* Formatting Issues */}
                        {complianceDetails?.formattingIssues && complianceDetails.formattingIssues.length > 0 && (
                            <CollapsibleSection
                                title="Formatting Issues"
                                defaultOpen={true}
                                count={complianceDetails.formattingIssues.length}
                                icon={
                                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                }
                            >
                                <ul className="space-y-2">
                                    {complianceDetails.formattingIssues.map((issue, index) => (
                                        <li key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                                            <span className="text-amber-600 dark:text-amber-400 mt-1">•</span>
                                            <span>{issue}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CollapsibleSection>
                        )}
                    </div>
                )}

                {/* Recommendations Tab */}
                {activeTab === 'recommendations' && (
                    <div className="space-y-4">
                        {/* Actionable Feedback with Priority and Impact */}
                        {complianceDetails?.actionableFeedback && complianceDetails.actionableFeedback.length > 0 ? (
                            <div className="space-y-3">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                    Prioritized actions to improve your ATS score, sorted by impact.
                                </p>
                                {/* High Priority */}
                                {complianceDetails.actionableFeedback.filter(f => f.priority === 'high').length > 0 && (
                                    <div className="space-y-2">
                                        <h5 className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                            High Priority
                                        </h5>
                                        {complianceDetails.actionableFeedback.filter(f => f.priority === 'high').map((feedback, index) => (
                                            <div
                                                key={`high-${index}`}
                                                className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                    </svg>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{feedback.action}</p>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1">
                                                            <span className="font-medium text-green-600 dark:text-green-400">Impact:</span> {feedback.impact}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {/* Medium Priority */}
                                {complianceDetails.actionableFeedback.filter(f => f.priority === 'medium').length > 0 && (
                                    <div className="space-y-2">
                                        <h5 className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wide flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                                            Medium Priority
                                        </h5>
                                        {complianceDetails.actionableFeedback.filter(f => f.priority === 'medium').map((feedback, index) => (
                                            <div
                                                key={`medium-${index}`}
                                                className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500 rounded-lg"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{feedback.action}</p>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1">
                                                            <span className="font-medium text-green-600 dark:text-green-400">Impact:</span> {feedback.impact}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {/* Low Priority */}
                                {complianceDetails.actionableFeedback.filter(f => f.priority === 'low').length > 0 && (
                                    <div className="space-y-2">
                                        <h5 className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                            Low Priority
                                        </h5>
                                        {complianceDetails.actionableFeedback.filter(f => f.priority === 'low').map((feedback, index) => (
                                            <div
                                                key={`low-${index}`}
                                                className="p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-lg"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                                    </svg>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{feedback.action}</p>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1">
                                                            <span className="font-medium text-green-600 dark:text-green-400">Impact:</span> {feedback.impact}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : uniqueRecommendations.length > 0 ? (
                            <div className="space-y-3">
                                {uniqueRecommendations.map((rec, index) => (
                                    <div
                                        key={index}
                                        className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
                                    >
                                        <div className="flex items-start gap-3">
                                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                            </svg>
                                            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{rec}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                </svg>
                                <p className="text-sm text-gray-500 dark:text-gray-400">No recommendations available at this time.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AtsFeedbackPanel;

