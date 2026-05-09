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
  { value: 'cv', label: 'Tailored CV', icon: 'description' },
  { value: 'cover-letter', label: 'Cover Letter', icon: 'mail_outline' },
  { value: 'mock-interview', label: 'Mock Interview', icon: 'psychology' },
];

const ReviewTabsNavigation: React.FC<ReviewTabsNavigationProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="px-4 pb-4 bg-white">
      <div className="bg-[#f7f6f3] rounded-2xl p-4 flex flex-wrap justify-between items-center gap-2">
        {TAB_ITEMS.map((tab) => {
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => onTabChange(tab.value)}
              className="flex-1 min-w-[100px] group flex flex-col items-center gap-2 focus:outline-none"
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? 'bg-[#006241] shadow-lg shadow-[rgba(0,98,65,0.2)] scale-110'
                    : 'bg-white shadow-sm group-hover:scale-110'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-xl transition-colors ${
                    isActive ? 'text-white' : 'text-[rgba(0,0,0,0.38)]'
                  }`}
                >
                  {tab.icon}
                </span>
              </div>
              <span
                className={`text-xs font-bold transition-colors duration-200 ${
                  isActive
                    ? 'text-[#006241]'
                    : 'text-[rgba(0,0,0,0.38)] group-hover:text-[rgba(0,0,0,0.87)]'
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
