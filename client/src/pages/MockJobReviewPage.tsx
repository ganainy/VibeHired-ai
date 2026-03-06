// client/src/pages/MockJobReviewPage.tsx
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TourBanner from '../components/onboarding/TourBanner';
import { usePageTour } from '../hooks/usePageTour';
import JobStatusBadge from '../components/jobs/JobStatusBadge';

type MockTab = 'job-description' | 'cv' | 'cover-letter' | 'mock-interview' | 'reminders' | 'materials';

const VALID_TABS: MockTab[] = [
    'job-description',
    'cv',
    'cover-letter',
    'mock-interview',
    'reminders',
    'materials',
];

function getMockReminderDate() {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d;
}

const MockJobReviewPage: React.FC = () => {
    const { tab } = useParams<{ tab?: string }>();
    const navigate = useNavigate();
    const { dismiss: dismissDashboardTour } = usePageTour('dashboard');

    const initialTab = (VALID_TABS.includes(tab as MockTab) ? tab : 'job-description') as MockTab;
    const [activeTab, setActiveTab] = useState<MockTab>(initialTab);

    const handleTabChange = (newTab: MockTab) => {
        setActiveTab(newTab);
        navigate(`/jobs/__mock_job__/review/${newTab}`, { replace: true });
    };

    const handleDismiss = () => {
        dismissDashboardTour();
        navigate('/dashboard');
    };

    const reminderDate = getMockReminderDate();
    const reminderMonthShort = reminderDate
        .toLocaleString('en-US', { month: 'short' })
        .toUpperCase();
    const reminderDay = reminderDate.getDate();
    const reminderDateStr = reminderDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-24">
            <div className="p-6 lg:p-8">
                {/* Tour Banner */}
                <TourBanner pageLabel="Job Review" onDismiss={handleDismiss} />

                {/* Page Header */}
                <div className="flex items-start justify-between gap-4 mt-4 mb-6">
                    {/* Left: Job Info */}
                    <div className="flex-1 min-w-0">
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="inline-flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors mb-2"
                        >
                            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                            Dashboard
                        </button>
                        <div className="flex items-center gap-2">
                            <span
                                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
                                style={{
                                    background: 'var(--accent-bg)',
                                    color: 'var(--accent)',
                                    border: '1px solid var(--accent-dim)',
                                }}
                            >
                                demo
                            </span>
                            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                                Product Manager
                            </h1>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400 mt-1.5">
                            <span className="inline-flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[18px]">apartment</span>
                                Acme Corp
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[18px]">schedule</span>
                                Created: Today
                            </span>
                        </div>
                    </div>

                    {/* Right: Status & Match */}
                    <div className="flex items-start gap-6 flex-shrink-0">
                        <div className="text-center">
                            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                                Status
                            </p>
                            <JobStatusBadge type="application" status="Applied" />
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">
                                Match
                            </p>
                            <p className="text-sm font-semibold text-green-600 dark:text-green-400">87%</p>
                        </div>
                    </div>
                </div>

                {/* Tabs Navigation */}
                <div className="mb-6 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-4">
                    <div className="relative flex items-center justify-between w-full max-w-4xl mx-auto">
                        <div className="absolute left-0 top-1/2 w-full h-0.5 bg-gray-200 dark:bg-gray-600 -z-10 transform -translate-y-1/2" />

                        {/* Tab 1: Job Details */}
                        <button
                            onClick={() => handleTabChange('job-description')}
                            className="group flex flex-col items-center focus:outline-none"
                        >
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-gray-800 transition-all duration-200 ${
                                    activeTab === 'job-description'
                                        ? 'bg-primary text-ink-950 shadow-lg scale-125'
                                        : 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                            >
                                <span className="material-symbols-outlined text-sm">check</span>
                            </div>
                            <span
                                className={`text-xs font-medium mt-2 transition-colors duration-200 ${
                                    activeTab === 'job-description'
                                        ? 'text-primary font-bold'
                                        : 'text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                Job Details
                            </span>
                        </button>

                        {/* Tab 2: Tailored CV */}
                        <button
                            onClick={() => handleTabChange('cv')}
                            className="group flex flex-col items-center focus:outline-none"
                        >
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-gray-800 transition-all duration-200 ${
                                    activeTab === 'cv'
                                        ? 'bg-primary text-ink-950 shadow-lg scale-125'
                                        : 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                            >
                                <span className="material-symbols-outlined text-sm">article</span>
                            </div>
                            <span
                                className={`text-xs font-medium mt-2 transition-colors duration-200 ${
                                    activeTab === 'cv'
                                        ? 'text-primary font-bold'
                                        : 'text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                Tailored CV
                            </span>
                        </button>

                        {/* Tab 3: Cover Letter */}
                        <button
                            onClick={() => handleTabChange('cover-letter')}
                            className="group flex flex-col items-center focus:outline-none"
                        >
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-gray-800 transition-all duration-200 ${
                                    activeTab === 'cover-letter'
                                        ? 'bg-primary text-ink-950 shadow-lg scale-125'
                                        : 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                            >
                                <span className="material-symbols-outlined text-sm">mail</span>
                            </div>
                            <span
                                className={`text-xs font-medium mt-2 transition-colors duration-200 ${
                                    activeTab === 'cover-letter'
                                        ? 'text-primary font-bold'
                                        : 'text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                Cover Letter
                            </span>
                        </button>

                        {/* Tab 4: Mock Interview */}
                        <button
                            onClick={() => handleTabChange('mock-interview')}
                            className="group flex flex-col items-center focus:outline-none"
                        >
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-gray-800 transition-all duration-200 ${
                                    activeTab === 'mock-interview'
                                        ? 'bg-gold-500 text-ink-950 shadow-lg scale-125'
                                        : 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                            >
                                <span className="material-symbols-outlined text-sm">mic</span>
                            </div>
                            <span
                                className={`text-xs font-medium mt-2 transition-colors duration-200 ${
                                    activeTab === 'mock-interview'
                                        ? 'text-gold-600 dark:text-gold-400 font-bold'
                                        : 'text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                Interview
                            </span>
                        </button>

                        {/* Tab 5: Reminders */}
                        <button
                            onClick={() => handleTabChange('reminders')}
                            className="group flex flex-col items-center focus:outline-none"
                        >
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-gray-800 transition-all duration-200 ${
                                    activeTab === 'reminders'
                                        ? 'bg-amber-500 text-white shadow-lg scale-125'
                                        : 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                            >
                                <span className="material-symbols-outlined text-sm">notifications</span>
                            </div>
                            <span
                                className={`text-xs font-medium mt-2 transition-colors duration-200 ${
                                    activeTab === 'reminders'
                                        ? 'text-amber-600 dark:text-amber-400 font-bold'
                                        : 'text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                Reminders (1)
                            </span>
                        </button>

                        {/* Tab 6: Prep Materials */}
                        <button
                            onClick={() => handleTabChange('materials')}
                            className="group flex flex-col items-center focus:outline-none"
                        >
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-gray-800 transition-all duration-200 ${
                                    activeTab === 'materials'
                                        ? 'bg-emerald-500 text-white shadow-lg scale-125'
                                        : 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                            >
                                <span className="material-symbols-outlined text-sm">library_books</span>
                            </div>
                            <span
                                className={`text-xs font-medium mt-2 transition-colors duration-200 ${
                                    activeTab === 'materials'
                                        ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                                        : 'text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                Materials
                            </span>
                        </button>
                    </div>
                </div>

                {/* Tab Content */}
                <div className="px-0 py-6">

                    {/* ── Tab 1: Job Details ── */}
                    {activeTab === 'job-description' && (
                        <div className="w-full space-y-6">
                            {/* Job Details Card */}
                            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-primary">work</span>
                                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                        Job Details
                                    </h2>
                                    <span
                                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                        style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}
                                    >
                                        sample
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pointer-events-none select-none">
                                    <div>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-0.5">
                                            Job Title
                                        </p>
                                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                            Product Manager
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-0.5">
                                            Company
                                        </p>
                                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                            Acme Corp
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-0.5">
                                            Type
                                        </p>
                                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                            Full-time
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-0.5">
                                            Salary
                                        </p>
                                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                            $60,000 – $80,000
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-0.5">
                                            Status
                                        </p>
                                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                            Applied
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-0.5">
                                            Language
                                        </p>
                                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                            English
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Job Description Card */}
                            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-primary">description</span>
                                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                        Job Description
                                    </h2>
                                    <span
                                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                        style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}
                                    >
                                        sample
                                    </span>
                                </div>
                                <div className="text-sm text-zinc-700 dark:text-zinc-300 space-y-4 leading-relaxed pointer-events-none select-none">
                                    <p>
                                        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Acme Corp is
                                        seeking a motivated <strong>Product Manager</strong> to join our growing
                                        team. In this role you will collaborate closely with cross-functional
                                        teams to deliver high-quality work on our core product.
                                    </p>
                                    <div>
                                        <p className="font-semibold mb-1">Responsibilities:</p>
                                        <ul className="list-disc list-inside space-y-1">
                                            <li>Lorem ipsum dolor sit amet, consectetur adipiscing elit</li>
                                            <li>Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua</li>
                                            <li>Ut enim ad minim veniam, quis nostrud exercitation ullamco</li>
                                            <li>Duis aute irure dolor in reprehenderit in voluptate velit esse</li>
                                            <li>Cillum dolore eu fugiat nulla pariatur excepteur sint occaecat</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="font-semibold mb-1">Requirements:</p>
                                        <ul className="list-disc list-inside space-y-1">
                                            <li>3+ years of experience in a relevant field</li>
                                            <li>Lorem ipsum dolor sit amet consectetur adipiscing elit</li>
                                            <li>Sed do eiusmod tempor incididunt ut labore et dolore</li>
                                            <li>Strong communication skills and ability to work in a team</li>
                                            <li>Ut enim ad minim veniam quis nostrud exercitation</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="font-semibold mb-1">What we offer:</p>
                                        <ul className="list-disc list-inside space-y-1">
                                            <li>Competitive salary: $60,000 – $80,000 depending on experience</li>
                                            <li>Lorem ipsum dolor sit amet flexible working arrangements</li>
                                            <li>Comprehensive benefits package and paid time off</li>
                                            <li>Ongoing learning and development opportunities</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Tab 2: Tailored CV ── */}
                    {activeTab === 'cv' && (
                        <div className="pointer-events-none select-none">
                            <div className="flex flex-col lg:flex-row gap-6">
                                {/* Left: CV Sections */}
                                <div className="flex-1 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-5 space-y-5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-primary">article</span>
                                            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                                Tailored CV
                                            </h2>
                                        </div>
                                        <span
                                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                            style={{
                                                background: 'var(--accent-bg)',
                                                color: 'var(--accent)',
                                                border: '1px solid var(--accent-dim)',
                                            }}
                                        >
                                            demo
                                        </span>
                                    </div>

                                    {/* Basics */}
                                    <div className="space-y-2">
                                        <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-700 pb-1">
                                            Personal Info
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                                                <p className="text-[10px] text-zinc-400 mb-0.5">Full Name</p>
                                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                    John Doe
                                                </p>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                                                <p className="text-[10px] text-zinc-400 mb-0.5">Location</p>
                                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                    City, Country
                                                </p>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                                                <p className="text-[10px] text-zinc-400 mb-0.5">Email</p>
                                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                    john.doe@example.com
                                                </p>
                                            </div>
                                            <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                                                <p className="text-[10px] text-zinc-400 mb-0.5">Phone</p>
                                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                    +1 (555) 000-0000
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Work Experience */}
                                    <div className="space-y-2">
                                        <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-700 pb-1">
                                            Work Experience
                                        </h3>
                                        <div className="space-y-2">
                                            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                                        Product Manager
                                                    </p>
                                                    <span className="text-[10px] text-zinc-400">2022 – Present</span>
                                                </div>
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                                                    Acme Corp, New York
                                                </p>
                                                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                                    Lorem ipsum dolor sit amet consectetur adipiscing elit sed do
                                                    eiusmod tempor incididunt ut labore et dolore magna aliqua.
                                                </p>
                                            </div>
                                            <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                                        Business Analyst
                                                    </p>
                                                    <span className="text-[10px] text-zinc-400">2019 – 2022</span>
                                                </div>
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                                                    Lorem Corp, Boston
                                                </p>
                                                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                                    Ut enim ad minim veniam quis nostrud exercitation ullamco laboris.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Education */}
                                    <div className="space-y-2">
                                        <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-700 pb-1">
                                            Education
                                        </h3>
                                        <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                                            <div className="flex justify-between items-start">
                                                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                                    B.Sc. Information Technology
                                                </p>
                                                <span className="text-[10px] text-zinc-400">2015 – 2019</span>
                                            </div>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                                State University
                                            </p>
                                        </div>
                                    </div>

                                    {/* Skills */}
                                    <div className="space-y-2">
                                        <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-200 dark:border-zinc-700 pb-1">
                                            Skills
                                        </h3>
                                        <div className="flex flex-wrap gap-1.5">
                                            {[
                                                'Communication',
                                                'Project Management',
                                                'Data Analysis',
                                                'Agile',
                                                'Stakeholder Management',
                                                'SQL',
                                            ].map((skill) => (
                                                <span
                                                    key={skill}
                                                    className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                                                >
                                                    {skill}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right: CV Preview */}
                                <div className="w-full lg:w-[400px] xl:w-[480px] flex-shrink-0 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-zinc-400 text-sm">preview</span>
                                        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                            CV Preview
                                        </span>
                                        <span
                                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                            style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}
                                        >
                                            sample
                                        </span>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        {/* Header */}
                                        <div className="border-b-2 border-zinc-800 dark:border-zinc-300 pb-3">
                                            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                                                John Doe
                                            </h2>
                                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                                Product Manager
                                            </p>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                                                john.doe@example.com · City, Country · +1 (555) 000-0000
                                            </p>
                                        </div>
                                        {/* Summary */}
                                        <div>
                                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400 mb-1">
                                                Summary
                                            </h3>
                                            <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                                Lorem ipsum dolor sit amet consectetur adipiscing elit sed do
                                                eiusmod tempor incididunt ut labore et dolore magna aliqua ut
                                                enim ad minim veniam.
                                            </p>
                                        </div>
                                        {/* Experience */}
                                        <div>
                                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400 mb-2">
                                                Experience
                                            </h3>
                                            <div className="space-y-2.5">
                                                <div>
                                                    <div className="flex justify-between">
                                                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                                            Product Manager
                                                        </p>
                                                        <p className="text-[10px] text-zinc-500">2022 – Present</p>
                                                    </div>
                                                    <p className="text-[11px] text-zinc-500">Acme Corp, New York</p>
                                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-500 mt-0.5">
                                                        Lorem ipsum dolor sit amet consectetur adipiscing elit.
                                                    </p>
                                                </div>
                                                <div>
                                                    <div className="flex justify-between">
                                                        <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                                            Business Analyst
                                                        </p>
                                                        <p className="text-[10px] text-zinc-500">2019 – 2022</p>
                                                    </div>
                                                    <p className="text-[11px] text-zinc-500">Lorem Corp, Boston</p>
                                                    <p className="text-[11px] text-zinc-500 dark:text-zinc-500 mt-0.5">
                                                        Sed do eiusmod tempor incididunt ut labore et dolore.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Education */}
                                        <div>
                                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400 mb-1">
                                                Education
                                            </h3>
                                            <div className="flex justify-between">
                                                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                                                    B.Sc. Information Technology
                                                </p>
                                                <p className="text-[10px] text-zinc-500">2015 – 2019</p>
                                            </div>
                                            <p className="text-[11px] text-zinc-500">State University</p>
                                        </div>
                                        {/* Skills */}
                                        <div>
                                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400 mb-1">
                                                Skills
                                            </h3>
                                            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                                                Communication · Project Management · Data Analysis · Agile · SQL
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Tab 3: Cover Letter ── */}
                    {activeTab === 'cover-letter' && (
                        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                            <div className="bg-zinc-50 dark:bg-zinc-800 px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                                        Cover Letter
                                    </h2>
                                    <span
                                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                        style={{
                                            background: 'var(--accent-bg)',
                                            color: 'var(--accent)',
                                            border: '1px solid var(--accent-dim)',
                                        }}
                                    >
                                        demo
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 pointer-events-none opacity-50">
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300">
                                        <span className="material-symbols-outlined text-sm">content_copy</span>
                                        Copy
                                    </button>
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300">
                                        <span className="material-symbols-outlined text-sm">download</span>
                                        Download
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 lg:p-10 max-w-3xl mx-auto pointer-events-none select-none">
                                <div className="text-sm text-zinc-700 dark:text-zinc-300 space-y-4 leading-relaxed">
                                    <p>
                                        City, Country
                                        <br />
                                        March 10, 2026
                                    </p>
                                    <p>
                                        Hiring Manager
                                        <br />
                                        <strong>Acme Corp</strong>
                                    </p>
                                    <p>Dear Hiring Manager,</p>
                                    <p>
                                        Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
                                        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
                                        veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
                                        commodo consequat.
                                    </p>
                                    <p>
                                        Duis aute irure dolor in reprehenderit in voluptate velit esse cillum
                                        dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non
                                        proident, sunt in culpa qui officia deserunt mollit anim id est laborum
                                        sed perspiciatis unde omnis iste natus error sit voluptatem.
                                    </p>
                                    <p>
                                        Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut
                                        fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem
                                        sequi nesciunt neque porro quisquam est qui dolorem ipsum.
                                    </p>
                                    <p>
                                        At vero eos et accusamus et iusto odio dignissimos ducimus qui
                                        blanditiis praesentium voluptatum deleniti atque corrupti quos dolores
                                        et quas molestias excepturi sint occaecati cupiditate non provident.
                                    </p>
                                    <p>
                                        Thank you for your time and consideration. I look forward to the
                                        opportunity to discuss how I can contribute to your team.
                                    </p>
                                    <p>
                                        Sincerely,
                                        <br />
                                        <strong>John Doe</strong>
                                        <br />
                                        john.doe@example.com
                                        <br />
                                        +1 (555) 000-0000
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Tab 4: Mock Interview ── */}
                    {activeTab === 'mock-interview' && (
                        <div className="w-full max-w-3xl mx-auto space-y-6 pointer-events-none select-none">
                            {/* Header */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-xl text-ink-950 shadow-sm" style={{ background: 'var(--accent)' }}>
                                    <span className="material-symbols-outlined text-[22px]">mic</span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Mock Interview</h2>
                                        <span
                                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                            style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}
                                        >
                                            sample
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Practise for Product Manager at Acme Corp</p>
                                </div>
                            </div>

                            {/* Idle phase card — mirrors real MockInterviewPanel */}
                            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-slate-800 p-8 text-center space-y-6 shadow-sm">
                                <div className="mx-auto w-20 h-20 rounded-full flex items-center justify-center" style={{ background: 'var(--accent-bg)' }}>
                                    <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--accent)' }}>record_voice_over</span>
                                </div>
                                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed max-w-md mx-auto">
                                    The AI will generate 7 tailored interview questions based on the job description. Answer each one — by typing or using your microphone — and get instant feedback.
                                </p>
                                <div className="flex flex-col items-center gap-3">
                                    <button
                                        className="opacity-60 btn-primary font-semibold rounded-xl shadow-md hover:shadow-lg"
                                        tabIndex={-1}
                                    >
                                        <span className="material-symbols-outlined text-base">play_arrow</span>
                                        Start Interview
                                        <span className="text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded-full" style={{ background: '#e8b844', color: '#0e0e17' }}>3 cr</span>
                                    </button>

                                    {/* Copy prompts for external AI */}
                                    <div className="w-full border-t border-zinc-100 dark:border-slate-800 pt-4 mt-1 space-y-3">
                                        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                                            Copy a ready-made prompt and paste it into ChatGPT, Claude, or any AI.
                                        </p>
                                        <div className="grid grid-cols-2 gap-2.5">
                                            {/* First interview prompt */}
                                            <button
                                                className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-sm font-medium border transition-all duration-150"
                                                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}
                                                tabIndex={-1}
                                            >
                                                <span className="material-symbols-outlined text-xl" style={{ color: 'var(--jade)' }}>waving_hand</span>
                                                <span className="font-semibold text-xs">1st Interview</span>
                                                <span className="text-[10px] text-center leading-tight" style={{ color: 'var(--text-muted)' }}>General · Behavioural · Culture fit</span>
                                            </button>
                                            {/* Second interview prompt */}
                                            <button
                                                className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl text-sm font-medium border transition-all duration-150"
                                                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: 'var(--bg-elevated)' }}
                                                tabIndex={-1}
                                            >
                                                <span className="material-symbols-outlined text-xl" style={{ color: 'var(--rose)' }}>terminal</span>
                                                <span className="font-semibold text-xs">2nd Interview</span>
                                                <span className="text-[10px] text-center leading-tight" style={{ color: 'var(--text-muted)' }}>Technical · Deep-dive · Problem-solving</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Tab 5: Reminders ── */}
                    {activeTab === 'reminders' && (
                        <div className="max-w-2xl space-y-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-amber-500">
                                        notifications
                                    </span>
                                    <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                        Reminders
                                    </h2>
                                    <span
                                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                        style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}
                                    >
                                        sample
                                    </span>
                                </div>
                                <button
                                    className="pointer-events-none opacity-50 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                                    style={{
                                        background: 'var(--accent-bg)',
                                        color: 'var(--accent)',
                                        border: '1px solid var(--accent-dim)',
                                    }}
                                >
                                    <span className="material-symbols-outlined text-sm">add</span>
                                    Add Reminder
                                </button>
                            </div>

                            <ul className="space-y-2 pointer-events-none select-none">
                                <li className="relative flex items-start gap-3 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                                    {/* Left accent bar */}
                                    <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-green-500" />
                                    {/* Date badge */}
                                    <div className="flex-shrink-0 flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                                        <span className="text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-400">
                                            {reminderMonthShort}
                                        </span>
                                        <span className="text-base font-bold text-amber-800 dark:text-amber-300">
                                            {reminderDay}
                                        </span>
                                    </div>
                                    {/* Content */}
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                            Follow up with Acme Corp
                                        </p>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                            {reminderDateStr}, 10:00 AM · notify 30 min before
                                        </p>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                            Send a follow-up email regarding your application status.
                                        </p>
                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                            Synced to Calendar
                                        </span>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    )}

                    {/* ── Tab 6: Prep Materials ── */}
                    {activeTab === 'materials' && (
                        <div className="space-y-5 pointer-events-none select-none">
                            {/* Header — mirrors real InterviewMaterialsPanel */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>library_books</span>
                                    <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Prep Materials</h2>
                                    <span
                                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                                        style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' }}
                                    >
                                        3
                                    </span>
                                    <span
                                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                                        style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}
                                    >
                                        sample
                                    </span>
                                </div>
                                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    Upload PDFs, images, notes, or links to use when preparing for this interview
                                </p>
                            </div>

                            {/* Drop zone + quick-add buttons */}
                            <div className="space-y-3">
                                <div
                                    className="relative flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed"
                                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
                                >
                                    <span className="material-symbols-outlined text-3xl" style={{ color: 'var(--text-muted)' }}>cloud_upload</span>
                                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Drag &amp; drop files, or click to browse</p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>PDF, DOCX, PNG, JPG, TXT, MD — up to 30 MB each</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border"
                                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }}
                                        tabIndex={-1}
                                    >
                                        <span className="material-symbols-outlined text-sm text-green-500">article</span>
                                        Add Note
                                    </button>
                                    <button
                                        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border"
                                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }}
                                        tabIndex={-1}
                                    >
                                        <span className="material-symbols-outlined text-sm text-cyan-500">code</span>
                                        Add Markdown
                                    </button>
                                    <button
                                        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border"
                                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }}
                                        tabIndex={-1}
                                    >
                                        <span className="material-symbols-outlined text-sm text-amber-500">link</span>
                                        Add Link
                                    </button>
                                </div>
                            </div>

                            {/* Material cards — MaterialCard style */}
                            <div className="space-y-2">
                                {/* Link */}
                                <div
                                    className="group relative flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-200"
                                    style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
                                >
                                    <div className="flex-shrink-0 mt-0.5">
                                        <span className="material-symbols-outlined text-xl text-amber-500">link</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium leading-snug truncate" style={{ color: 'var(--text-primary)' }}>Acme Corp – About Us</p>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    <span className="text-xs px-1.5 py-0.5 rounded-md capitalize font-medium" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)' }}>link</span>
                                                    <span className="text-xs truncate max-w-[220px] underline" style={{ color: 'var(--accent)' }}>https://example.com/about</span>
                                                </div>
                                                <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>Company overview, mission and key products page.</p>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <button className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }} tabIndex={-1}>
                                                    <span className="material-symbols-outlined text-base">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2.5">
                                            <button className="relative inline-flex h-5 w-9 items-center rounded-full bg-amber-400" tabIndex={-1}>
                                                <span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform translate-x-4.5" />
                                            </button>
                                            <span className="text-xs" style={{ color: 'var(--accent)' }}>In Prep Library</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Text note */}
                                <div
                                    className="group relative flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-200"
                                    style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
                                >
                                    <div className="flex-shrink-0 mt-0.5">
                                        <span className="material-symbols-outlined text-xl text-green-500">article</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium leading-snug truncate" style={{ color: 'var(--text-primary)' }}>Key Talking Points</p>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    <span className="text-xs px-1.5 py-0.5 rounded-md capitalize font-medium" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)' }}>text</span>
                                                </div>
                                                <p className="text-xs mt-1 line-clamp-3 font-mono whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                                                    {'- Highlight 3+ years of relevant PM experience\n- Emphasize cross-functional collaboration\n- Prepare a STAR-format story about a key project outcome'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <button className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }} tabIndex={-1}>
                                                    <span className="material-symbols-outlined text-base">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2.5">
                                            <button className="relative inline-flex h-5 w-9 items-center rounded-full bg-gray-300 dark:bg-gray-600" tabIndex={-1}>
                                                <span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform translate-x-0.5" />
                                            </button>
                                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Add to Prep Library</span>
                                        </div>
                                    </div>
                                </div>

                                {/* PDF */}
                                <div
                                    className="group relative flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-200"
                                    style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
                                >
                                    <div className="flex-shrink-0 mt-0.5">
                                        <span className="material-symbols-outlined text-xl text-red-500">picture_as_pdf</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium leading-snug truncate" style={{ color: 'var(--text-primary)' }}>Sample Interview Questions</p>
                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                    <span className="text-xs px-1.5 py-0.5 rounded-md capitalize font-medium" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)' }}>pdf</span>
                                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>124 KB</span>
                                                </div>
                                                <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>Common interview questions for Product Manager roles with suggested answers.</p>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                                <button className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }} tabIndex={-1}>
                                                    <span className="material-symbols-outlined text-base">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2.5">
                                            <button className="relative inline-flex h-5 w-9 items-center rounded-full bg-gray-300 dark:bg-gray-600" tabIndex={-1}>
                                                <span className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform translate-x-0.5" />
                                            </button>
                                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Add to Prep Library</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MockJobReviewPage;
