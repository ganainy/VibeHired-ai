// ATS Score Card component - displays overall ATS scores from Gemini AI
import React from 'react';
import { AtsScores } from '../../services/atsApi';
import SimpleLoader from '../common/SimpleLoader';

interface AtsScoreCardProps {
    atsScores: AtsScores | null;
    isLoading?: boolean;
}

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
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="none"
                    className="text-gray-200 dark:text-gray-700"
                />
                {/* Progress circle */}
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

const AtsScoreCard: React.FC<AtsScoreCardProps> = ({ atsScores, isLoading }) => {
    if (isLoading) {
        return (
            <div className="p-12 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
                <SimpleLoader message="Analyzing ATS compatibility..." />
            </div>
        );
    }

    if (!atsScores) {
        return (
            <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">ATS Scores</h3>
                <p className="text-gray-600 dark:text-gray-400">No ATS scores available. Run an ATS scan to get started.</p>
            </div>
        );
    }

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

    return (
        <div className="p-6 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">ATS Compatibility Scores</h3>
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    Powered by Gemini AI
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Overall ATS Score */}
                <div className={`p-6 rounded-xl bg-gradient-to-br ${getScoreBgGradient(overallScore)} border border-gray-200 dark:border-gray-700 transition-all hover:shadow-md`}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span className="font-semibold text-gray-800 dark:text-gray-200">Overall ATS Score</span>
                        </div>
                        {hasError && (
                            <span className="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded">Error</span>
                        )}
                    </div>
                    {overallScore !== null && overallScore !== undefined ? (
                        <div className="flex flex-col items-center">
                            <CircularProgress score={overallScore} size={140} color={overallColor} />
                            <div className="mt-4 text-center">
                                <div className={`text-lg font-semibold mb-1 ${overallColor === 'green' ? 'text-green-700 dark:text-green-400' :
                                    overallColor === 'yellow' ? 'text-yellow-700 dark:text-yellow-400' :
                                        'text-red-700 dark:text-red-400'
                                    }`}>
                                    {getScoreInterpretation(overallScore)}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                    Overall ATS Compatibility
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center py-8">
                            <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-4">
                                <span className="text-gray-500 dark:text-gray-400">N/A</span>
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">Not available</div>
                        </div>
                    )}
                </div>

                {/* Resume Matching Percentage */}
                <div className={`p-6 rounded-xl bg-gradient-to-br ${getScoreBgGradient(skillMatchScore)} border border-gray-200 dark:border-gray-700 transition-all hover:shadow-md`}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span className="font-semibold text-gray-800 dark:text-gray-200">Resume Matching Percentage</span>
                        </div>
                    </div>
                    {skillMatchScore !== null && skillMatchScore !== undefined ? (
                        <div className="flex flex-col items-center">
                            <CircularProgress score={skillMatchScore} size={140} color={skillColor} />
                            <div className="mt-4 text-center">
                                <div className={`text-lg font-semibold mb-1 ${skillColor === 'green' ? 'text-green-700 dark:text-green-400' :
                                    skillColor === 'yellow' ? 'text-yellow-700 dark:text-yellow-400' :
                                        'text-red-700 dark:text-red-400'
                                    }`}>
                                    {getScoreInterpretation(skillMatchScore)}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                    How well your resume aligns with job requirements
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center py-8">
                            <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-4">
                                <span className="text-gray-500 dark:text-gray-400">N/A</span>
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">Not available</div>
                        </div>
                    )}
                </div>
            </div>

            {hasError && (
                <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <p className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">Analysis Error:</p>
                            <p className="text-xs text-red-700 dark:text-red-400">{atsScores.error}</p>
                        </div>
                    </div>
                </div>
            )}

            {atsScores.lastAnalyzedAt && (
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Last analyzed: <span className="text-gray-900 dark:text-gray-100">{new Date(atsScores.lastAnalyzedAt).toLocaleString()}</span>
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AtsScoreCard;

