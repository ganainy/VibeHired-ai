import React from 'react';
import { ActiveReviewTab } from './reviewTabs';

interface ReviewTabsNavigationProps {
 activeTab: ActiveReviewTab;
 onTabChange: (tab: ActiveReviewTab) => void;
}

const TAB_ITEMS: Array<{
 value: ActiveReviewTab;
 label: string;
 icon: string;
}> = [
 { value: 'job-description', label: 'Job Details', icon: 'check' },
 { value: 'cv', label: 'Tailored CV', icon: 'article' },
 { value: 'cover-letter', label: 'Cover Letter', icon: 'mail' },
 { value: 'mock-interview', label: 'Mock Interview', icon: 'psychology' },
 { value: 'reminders', label: 'Reminders', icon: 'schedule' },
 { value: 'materials', label: 'Prep Materials', icon: 'library_books' },
];

const ReviewTabsNavigation: React.FC<ReviewTabsNavigationProps> = ({
 activeTab,
 onTabChange,
}) => {
 return (
 <div className="mb-6 bg-white rounded-xl shadow-sm border border-theme p-4">
 <div className="relative flex items-center justify-between w-full max-w-7xl mx-auto">
 <div className="absolute left-0 top-1/2 w-full h-0.5 bg-[var(--bg-raised)] -z-10 transform -translate-y-1/2"></div>

 {TAB_ITEMS.map((tab) => {
 const isActive = activeTab === tab.value;
 return (
 <button
 key={tab.value}
 onClick={() => onTabChange(tab.value)}
 className="group flex flex-col items-center focus:outline-none"
 >
 <div
 className={`w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white transition-all duration-200 ${isActive
 ? 'bg-primary text-green-house shadow-lg scale-125'
 : 'bg-[var(--bg-raised)] text-muted-color hover:bg-[var(--border)]'
 }`}
 >
 <span className="material-symbols-outlined text-sm">{tab.icon}</span>
 </div>
 <span
 className={`text-xs font-medium mt-2 transition-colors duration-200 ${isActive
 ? 'text-primary font-bold'
 : 'text-secondary-color'
 }`}
 >
 {tab.label}
 </span>
 </button>
 );
 })}
 </div>
 </div>
 );
};

export default ReviewTabsNavigation;
