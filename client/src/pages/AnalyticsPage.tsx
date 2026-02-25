import React, { useState, useEffect, useCallback } from 'react';
import { getJobs, updateJob, JobApplication } from '../services/jobApi';
import { getApplicationStats, ApplicationStats } from '../services/analyticsApi';
import { WeeklyGoalWidget } from '../components/analytics/WeeklyGoalWidget';
import { PipelineConversionWidget } from '../components/analytics/PipelineConversionWidget';
import { ApplicationsOverTimeChart } from '../components/analytics/ApplicationsOverTimeChart';
import { RecentActivityWidget } from '../components/analytics/RecentActivityWidget';
import ApplicationPipelineKanban from '../components/jobs/ApplicationPipelineKanban';
import Spinner from '../components/common/Spinner';
import ErrorAlert from '../components/common/ErrorAlert';

const AnalyticsPage: React.FC = () => {
    const [jobs, setJobs] = useState<JobApplication[]>([]);
    const [stats, setStats] = useState<ApplicationStats | null>(null);
    const [isLoadingJobs, setIsLoadingJobs] = useState(true);
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [jobsError, setJobsError] = useState<string | null>(null);
    const [statsError, setStatsError] = useState<string | null>(null);

    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        return localStorage.getItem('analytics_selectedMonth') || 'current-month';
    });

    const [weeklyGoal, setWeeklyGoal] = useState<number>(() => {
        const saved = localStorage.getItem('weekly_application_goal');
        return saved ? parseInt(saved, 10) : 5;
    });

    const fetchJobsData = useCallback(async () => {
        setIsLoadingJobs(true);
        setJobsError(null);
        try {
            const data = await getJobs();
            setJobs(data);
        } catch (error: any) {
            setJobsError(error.message || 'Failed to fetch jobs');
        } finally {
            setIsLoadingJobs(false);
        }
    }, []);

    const fetchStatsData = useCallback(async (period: string) => {
        setIsLoadingStats(true);
        setStatsError(null);
        try {
            const data = await getApplicationStats(period);
            setStats(data);
        } catch (error: any) {
            setStatsError(error.message || 'Failed to fetch statistics');
        } finally {
            setIsLoadingStats(false);
        }
    }, []);

    useEffect(() => {
        fetchJobsData();
    }, [fetchJobsData]);

    useEffect(() => {
        localStorage.setItem('analytics_selectedMonth', selectedMonth);
        fetchStatsData(selectedMonth);
    }, [selectedMonth, fetchStatsData]);

    const handleUpdateWeeklyGoal = (newTarget: number) => {
        setWeeklyGoal(newTarget);
        localStorage.setItem('weekly_application_goal', newTarget.toString());
    };

    const handleStatusChange = async (jobId: string, newStatus: string) => {
        try {
            // Need to handle the type casting as updateJob expects specific status string types
            await updateJob(jobId, { status: newStatus as any });
            fetchJobsData();
            fetchStatsData(selectedMonth);
        } catch (error) {
            console.error('Failed to update job status:', error);
        }
    };

    const monthOptions = [
        { value: 'today', label: 'Today' },
        { value: 'last-week', label: 'Last 7 Days' },
        { value: 'current-month', label: 'Current Month' },
        { value: 'last-month', label: 'Last Month' },
        { value: 'last-3-months', label: 'Last 3 Months' },
        { value: 'year', label: 'Full Year' },
    ];

    if (jobsError || statsError) {
        return (
            <div className="p-8">
                <ErrorAlert message={jobsError || statsError || 'An error occurred'} onRetry={() => { fetchJobsData(); fetchStatsData(selectedMonth); }} />
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="page-title">Analytics Dashboard</h1>
                    <p style={{color: 'var(--text-secondary)'}}>Track your application progress and performance.</p>
                </div>

                <div className="flex items-center gap-3 p-1.5 rounded-xl shadow-sm" style={{background: 'var(--bg-surface)', border: '1px solid var(--border)'}}>
                    <span className="text-sm font-medium ml-2" style={{color: 'var(--text-secondary)'}}>Period:</span>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-transparent border-none focus:ring-0 text-sm font-semibold cursor-pointer pr-8" style={{color: 'var(--text-primary)'}}
                    >
                        <optgroup label="Timeframe">
                            {monthOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </optgroup>
                    </select>
                </div>
            </div>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Applications Goal Widget */}
                <div className={`${selectedMonth === 'today' ? 'md:col-span-2' : 'md:col-span-1'}`}>
                    <WeeklyGoalWidget
                        jobs={jobs}
                        target={weeklyGoal}
                        onUpdateTarget={handleUpdateWeeklyGoal}
                    />
                </div>

                {/* Pipeline Conversion */}
                <div className={`${selectedMonth === 'today' ? 'md:col-span-2' : 'md:col-span-1'}`}>
                    <PipelineConversionWidget stats={stats} />
                </div>

                {/* Application Velocity Chart - Only shown if not 'today' */}
                {selectedMonth !== 'today' && (
                    <div className="md:col-span-2 card p-6 flex flex-col h-[400px] min-w-0">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background: 'var(--accent-bg)'}}>
                                <span className="material-symbols-outlined text-[20px]" style={{color: 'var(--accent)'}}>trending_up</span>
                            </div>
                            <h3 className="text-lg font-bold" style={{fontFamily: 'var(--font-display)', color: 'var(--text-primary)'}}>Application Velocity</h3>
                        </div>
                        <div className="flex-1 min-h-0">
                            {isLoadingStats ? (
                                <div className="h-full flex items-center justify-center">
                                    <Spinner />
                                </div>
                            ) : (
                                <ApplicationsOverTimeChart
                                    data={stats?.applicationsOverTimeByStatus || []}
                                    selectedMonth={selectedMonth}
                                />
                            )}
                        </div>
                    </div>
                )}

                {/* Recent Activity */}
                <div className="md:col-span-2">
                    <RecentActivityWidget jobs={jobs} />
                </div>
            </div>

            {/* Kanban Board Section */}
            <div className="mt-8 pt-8" style={{borderTop: '1px solid var(--border)'}}>
                <h3 className="text-xl font-bold mb-6" style={{fontFamily: 'var(--font-display)', color: 'var(--text-primary)'}}>Application Pipeline</h3>
                <div className="p-4 rounded-xl" style={{background: 'var(--bg-elevated)', border: '1px solid var(--border)'}}>
                    <ApplicationPipelineKanban
                        jobs={jobs}
                        isLoading={isLoadingJobs}
                        onStatusChange={handleStatusChange}
                    />
                </div>
            </div>
        </div>
    );
};

export default AnalyticsPage;
