import React, { useState, useEffect, useCallback } from 'react';
import { getJobs, JobApplication } from '../services/jobApi';
import { getApplicationStats, ApplicationStats } from '../services/analyticsApi';
import { WeeklyGoalWidget } from '../components/analytics/WeeklyGoalWidget';
import { PipelineConversionWidget } from '../components/analytics/PipelineConversionWidget';
import { ApplicationsOverTimeChart } from '../components/analytics/ApplicationsOverTimeChart';
import { RecentActivityWidget } from '../components/analytics/RecentActivityWidget';
import { WorkTrackerStatsWidget } from '../components/analytics/WorkTrackerStatsWidget';
import { WorkHoursChart } from '../components/analytics/WorkHoursChart';
import { EmployerDistributionChart } from '../components/analytics/EmployerDistributionChart';
// import ApplicationPipelineKanban from '../components/jobs/ApplicationPipelineKanban'; // Archived
import { getWorkTrackerAnalytics, WorkTrackerAnalytics, getWorkMonths } from '../services/workTrackerApi';
import Spinner from '../components/common/Spinner';
import ErrorAlert from '../components/common/ErrorAlert';
import { Briefcase, Clock, ChevronDown } from 'lucide-react';
import TourBanner from '../components/onboarding/TourBanner';
import { usePageTour } from '../hooks/usePageTour';
import { getMockAnalyticsData } from '../data/mockTourData';

const AnalyticsPage: React.FC = () => {
    const [jobs, setJobs] = useState<JobApplication[]>([]);
    const [stats, setStats] = useState<ApplicationStats | null>(null);
    const [workAnalytics, setWorkAnalytics] = useState<WorkTrackerAnalytics | null>(null);

    const { showTour: showAnalyticsTour, dismiss: dismissAnalyticsTour } = usePageTour('analytics');

    // Auto-dismiss tour when user has real job data
    useEffect(() => {
        if (jobs.length > 0) dismissAnalyticsTour();
    }, [jobs.length]);

    // Stable mock data for the demo tour (generated once on mount)
    const mockAnalyticsData = React.useMemo(() => getMockAnalyticsData(), []);

    const [activeTab, setActiveTab] = useState<'jobs' | 'work'>(() => {
        return (localStorage.getItem('analytics_activeTab') as 'jobs' | 'work') || 'jobs';
    });

    const handleTabChange = (tab: 'jobs' | 'work') => {
        setActiveTab(tab);
        localStorage.setItem('analytics_activeTab', tab);
    };

    const [isLoadingJobs, setIsLoadingJobs] = useState(true);
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [isLoadingWork, setIsLoadingWork] = useState(true);
    const [workMonths, setWorkMonths] = useState<string[]>([]);

    const [jobsError, setJobsError] = useState<string | null>(null);
    const [statsError, setStatsError] = useState<string | null>(null);
    const [workError, setWorkError] = useState<string | null>(null);

    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        return localStorage.getItem('analytics_selectedMonth') || 'current-month';
    });

    const [weeklyGoal, setWeeklyGoal] = useState<number>(() => {
        const saved = localStorage.getItem('weekly_application_goal');
        return saved ? parseInt(saved, 10) : 20;
    });

    // When in demo tour mode, feed mock data into the real widgets
    const isDemo = showAnalyticsTour && jobs.length === 0 && !isLoadingJobs;
    const displayJobs = isDemo ? mockAnalyticsData.jobs : jobs;
    const displayStats = isDemo ? mockAnalyticsData.stats : stats;
    const displayWeeklyGoalTarget = isDemo ? mockAnalyticsData.weeklyGoalTarget : weeklyGoal;


    const monthOptions = [
        { value: 'today', label: 'Today' },
        { value: 'last-week', label: 'Last 7 Days' },
        { value: 'current-month', label: 'Current Month' },
        { value: 'last-month', label: 'Last Month' },
        { value: 'last-3-months', label: 'Last 3 Months' },
        { value: 'year', label: 'Full Year' },
    ];

    const currentMonthOptions = activeTab === 'work'
        ? (() => {
            const now = new Date();
            const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const lastDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const last = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`;

            const uniqueMonths = Array.from(new Set([current, last, ...workMonths])).sort().reverse();

            return uniqueMonths.map(monthStr => {
                const [year, month] = monthStr.split('-');
                const date = new Date(parseInt(year), parseInt(month) - 1);
                return {
                    value: monthStr,
                    label: date.toLocaleString('default', { month: 'long', year: 'numeric' })
                };
            });
        })()
        : monthOptions;

    // Reset selected month if it's not available in the current tab's options
    useEffect(() => {
        const isValid = currentMonthOptions.some(opt => opt.value === selectedMonth);
        if (!isValid) {
            // Pick a reasonable default if the current selection is invalid for this tab
            if (activeTab === 'work' && workMonths.length > 0) {
                const now = new Date();
                const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                setSelectedMonth(workMonths.includes(currentMonthStr) ? currentMonthStr : workMonths[0]);
            } else {
                setSelectedMonth('current-month');
            }
        }
    }, [activeTab, selectedMonth, currentMonthOptions, workMonths]);

    useEffect(() => {
        const fetchMonths = async () => {
            try {
                const months = await getWorkMonths();
                setWorkMonths(months);
            } catch (err) {
                console.error('Failed to fetch worked months:', err);
            }
        };
        fetchMonths();
    }, []);

    const fetchJobsData = useCallback(async () => {
        setIsLoadingJobs(true);
        setJobsError(null);
        try {
            const data = await getJobs();
            setJobs(data.jobs);
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

    const fetchWorkAnalytics = useCallback(async (period: string) => {
        setIsLoadingWork(true);
        setWorkError(null);
        try {
            // Map period to YYYY-MM if it's current-month or similar
            let monthParam: string | undefined;
            if (period === 'current-month') {
                const now = new Date();
                monthParam = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            } else if (period === 'last-month') {
                const now = new Date();
                const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                monthParam = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`;
            }

            const data = await getWorkTrackerAnalytics(monthParam || period);
            setWorkAnalytics(data);
        } catch (error: any) {
            setWorkError(error.message || 'Failed to fetch work analytics');
        } finally {
            setIsLoadingWork(false);
        }
    }, []);

    useEffect(() => {
        fetchJobsData();
    }, [fetchJobsData]);

    useEffect(() => {
        localStorage.setItem('analytics_selectedMonth', selectedMonth);
        fetchStatsData(selectedMonth);
        fetchWorkAnalytics(selectedMonth);
    }, [selectedMonth, fetchStatsData, fetchWorkAnalytics]);

    const handleUpdateWeeklyGoal = (newTarget: number) => {
        setWeeklyGoal(newTarget);
        localStorage.setItem('weekly_application_goal', newTarget.toString());
    };

    /* Archived: Implementation for Job Status Updates in Kanban
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
    */

    // Options moved up to be used in filtering logic

    if (jobsError || statsError || workError) {
        return (
            <div className="p-8">
                <ErrorAlert message={jobsError || statsError || workError || 'An error occurred'} onRetry={() => { fetchJobsData(); fetchStatsData(selectedMonth); fetchWorkAnalytics(selectedMonth); }} />
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                    <h1 className="page-title">Analytics Dashboard</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Track your application progress and work performance.</p>
                </div>

                <div className="flex flex-col items-center md:items-end gap-3">
                    <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }} data-onboarding="primary-action">
                        {[
                            { key: 'jobs', label: 'Job Applications', icon: <Briefcase size={15} /> },
                            { key: 'work', label: 'Work Tracker', icon: <Clock size={15} /> },
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => handleTabChange(tab.key as any)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                                style={{
                                    background: activeTab === tab.key ? 'var(--bg-raised)' : 'transparent',
                                    border: activeTab === tab.key ? '1px solid var(--border-bright)' : '1px solid transparent',
                                    color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                                    boxShadow: activeTab === tab.key ? '0 1px 4px rgba(14,14,23,0.4)' : 'none',
                                }}
                            >
                                <span style={{ color: activeTab === tab.key ? 'var(--accent)' : 'inherit' }}>{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3 p-1 px-4 rounded-xl transition-all hover:bg-[var(--bg-elevated)]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Period:</span>
                        <div className="relative flex items-center">
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="appearance-none bg-transparent border-none focus:ring-0 text-sm font-bold cursor-pointer pr-6 py-0.5"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                {currentMonthOptions.map(option => (
                                    <option key={option.value} value={option.value} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-0 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
                        </div>
                    </div>
                </div>
            </div>

            {/*  Demo Tour Banner  */}
            {isDemo && (
                <div className="mb-6">
                    <TourBanner pageLabel="Analytics Dashboard" onDismiss={dismissAnalyticsTour} />
                </div>
            )}

            {activeTab === 'jobs' ? (
                /* Application Sections */
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1">
                            <WeeklyGoalWidget
                                jobs={displayJobs}
                                target={displayWeeklyGoalTarget}
                                onUpdateTarget={handleUpdateWeeklyGoal}
                            />
                        </div>

                        <div className="md:col-span-2 border rounded-xl p-8 overflow-hidden shadow-sm flex flex-col h-full" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                            <div className="flex justify-between items-center mb-10">
                                <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Pipeline Conversion</h3>
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                                <PipelineConversionWidget stats={displayStats} hideCardStyles={true} />
                            </div>
                        </div>

                        {selectedMonth !== 'today' && (
                            <div className="md:col-span-3 card p-3 md:p-4 lg:p-6 flex flex-col h-[450px] md:h-[400px] min-w-0 overflow-hidden">
                                <div className="flex items-center gap-2 mb-6">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-bg-dim)' }}>
                                        <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--accent)' }}>trending_up</span>
                                    </div>
                                    <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Application Volume Over Time</h3>
                                </div>
                                <div className="flex-1 min-h-0">
                                    {isLoadingStats && !isDemo ? (
                                        <div className="h-full flex items-center justify-center"><Spinner /></div>
                                    ) : (
                                        <ApplicationsOverTimeChart
                                            data={displayStats?.applicationsOverTimeByStatus || []}
                                            selectedMonth={selectedMonth}
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="card p-3 sm:p-6 overflow-hidden shadow-sm">
                        <RecentActivityWidget jobs={displayJobs} />
                    </div>

                    {/* Archived Application Pipeline Section
                    <div>
                        <div className="flex items-center gap-2 mb-6 ml-1">
                            <span className="material-symbols-outlined text-[24px]" style={{ color: 'var(--accent)' }}>view_kanban</span>
                            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Application Pipeline</h2>
                        </div>
                        <ApplicationPipelineKanban
                            jobs={jobs}
                            onStatusChange={handleStatusChange}
                        />
                    </div>
                    */}
                </div>
            ) : (
                /* Work Tracker Sections */
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <WorkTrackerStatsWidget data={workAnalytics?.summary || null} isLoading={isLoadingWork} />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                        {/* Daily Hours Chart */}
                        <div className="md:col-span-2 card p-3 md:p-4 lg:p-6 overflow-hidden h-[400px] md:h-[450px]">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-bg-dim)' }}>
                                        <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--accent)' }}>bar_chart</span>
                                    </div>
                                    <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Daily Work Hours Breakdown</h3>
                                </div>
                            </div>
                            <div className="h-[340px]">
                                <WorkHoursChart data={workAnalytics?.dailyHours || []} isLoading={isLoadingWork} />
                            </div>
                        </div>

                        {/* Employer Distribution Chart */}
                        <div className="md:col-span-1 card p-3 md:p-4 lg:p-6 overflow-hidden h-[400px] md:h-[450px]">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-bg-dim)' }}>
                                    <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--accent)' }}>pie_chart</span>
                                </div>
                                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Hours by Employer</h3>
                            </div>
                            <div className="h-[340px]">
                                <EmployerDistributionChart data={workAnalytics?.employerBreakdown || []} isLoading={isLoadingWork} />
                            </div>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
};

export default AnalyticsPage;
