// Mock data used for per-page demo tours.
// These objects are visual-only — never sent to the server.
import type { JobApplication } from '../services/jobApi';
import type { ApplicationStats } from '../services/analyticsApi';

/** A demo job application shown on the Dashboard tour. */
export const MOCK_JOB = {
  _id: '__mock_job__',
  jobTitle: 'Senior Frontend Developer',
  companyName: 'TechCorp Inc.',
  status: 'Applied',
  jobType: 'full-time',
  salary: '€70,000 – €90,000',
  jobUrl: '',
  isFavorite: false,
  notes: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as const;

/** A demo prep material shown on the Interview Materials tour. */
export const MOCK_MATERIAL = {
  _id: '__mock_material__',
  type: 'markdown' as const,
  title: 'Top 50 React Interview Questions',
  description: 'Common React questions covering hooks, performance, and state management.',
  content: '## Common Topics\n- useState & useEffect\n- Context API\n- Performance optimization\n- Testing with React Testing Library',
  isFavorite: true,
  isGlobal: true,
  createdAt: new Date().toISOString(),
};

/** A demo employer + work entry shown on the Work Tracker tour. */
export const MOCK_WORK_ENTRY = {
  _id: '__mock_entry__',
  employerName: 'Acme Solutions GmbH',
  type: 'appointment' as const,
  title: 'Client Strategy Meeting',
  date: (() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  })(),
  startTime: '09:00',
  endTime: '11:00',
  status: 'planned' as const,
};

/** A demo calendar event shown on the Calendar tour. */
export const MOCK_CALENDAR_EVENT = {
  id: '__mock_cal__',
  summary: 'Technical Interview @ TechCorp Inc.',
  location: 'Google Meet (link in description)',
  description: 'Round 2 — Live coding + System Design',
  start: {
    dateTime: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(14, 0, 0, 0);
      return d.toISOString();
    })(),
  },
  end: {
    dateTime: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      d.setHours(15, 30, 0, 0);
      return d.toISOString();
    })(),
  },
};

/** A demo CV document shown on the CV Workspace (manage-cv) tour. */
export const MOCK_CV = {
  _id: '__mock_cv__',
  displayName: 'My Professional CV',
  category: 'Base',
  isPrimary: true,
  jobApplicationId: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as const;

/** Mock analytics stats shown on the Analytics tour. */
export const MOCK_ANALYTICS = {
  totalApplications: 12,
  applied: 8,
  interviews: 4,
  assessments: 2,
  offers: 1,
  rejected: 3,
  responseRate: '33%',
  avgTimeToResponse: '5 days',
};

/**
 * Generates realistic mock jobs + stats for the Analytics demo tour.
 * Dates are computed at call-time so the weekly goal counter always reflects
 * the current week, and the chart shows the last 6 calendar months.
 */
export const getMockAnalyticsData = (): {
  jobs: JobApplication[];
  stats: ApplicationStats;
  weeklyGoalTarget: number;
} => {
  const now = Date.now();
  const h = (n: number) => new Date(now - n * 3_600_000).toISOString();
  const d = (n: number) => new Date(now - n * 86_400_000).toISOString();

  // Ensure "this week" jobs are anchored to Monday (WeeklyGoalWidget logic)
  const today = new Date(now);
  const dayOfWeek = today.getDay();
  const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysToMon, 9, 0, 0, 0);
  const mon = (extraHours: number) => new Date(monday.getTime() + extraHours * 3_600_000).toISOString();

  const jobs: JobApplication[] = [
    // --- This week (all anchored to Monday so the weekly counter is always correct) ---
    { _id: 'demo-1', jobTitle: 'Software Engineer', companyName: 'Google', status: 'Interview', createdAt: mon(0), updatedAt: h(2) } as JobApplication,
    { _id: 'demo-2', jobTitle: 'Frontend Developer', companyName: 'Meta', status: 'Interview', createdAt: mon(1), updatedAt: h(6) } as JobApplication,
    { _id: 'demo-3', jobTitle: 'Full Stack Engineer', companyName: 'Stripe', status: 'Interview', createdAt: mon(2), updatedAt: h(28) } as JobApplication,
    { _id: 'demo-4', jobTitle: 'React Developer', companyName: 'Airbnb', status: 'Interview', createdAt: mon(3), updatedAt: h(50) } as JobApplication,
    { _id: 'demo-5', jobTitle: 'Senior Engineer', companyName: 'Shopify', status: 'Assessment', createdAt: mon(4), updatedAt: h(54) } as JobApplication,
    { _id: 'demo-6', jobTitle: 'Product Engineer', companyName: 'Notion', status: 'Assessment', createdAt: mon(5), updatedAt: h(72) } as JobApplication,
    { _id: 'demo-7', jobTitle: 'iOS Developer', companyName: 'Netflix', status: 'Applied', createdAt: mon(6), updatedAt: h(80) } as JobApplication,
    { _id: 'demo-8', jobTitle: 'Backend Engineer', companyName: 'Linear', status: 'Applied', createdAt: mon(7), updatedAt: h(88) } as JobApplication,
    // --- Older (not this week) ---
    { _id: 'demo-9', jobTitle: 'Cloud Engineer', companyName: 'Microsoft', status: 'Offer', createdAt: d(9), updatedAt: h(22) } as JobApplication,
    { _id: 'demo-10', jobTitle: 'DevOps Engineer', companyName: 'Amazon', status: 'Rejected', createdAt: d(12), updatedAt: d(10) } as JobApplication,
    { _id: 'demo-11', jobTitle: 'ML Engineer', companyName: 'Apple', status: 'Rejected', createdAt: d(18), updatedAt: d(16) } as JobApplication,
    { _id: 'demo-12', jobTitle: 'Data Scientist', companyName: 'Spotify', status: 'Rejected', createdAt: d(22), updatedAt: d(20) } as JobApplication,
  ];

  const monthKey = (monthsAgo: number): string => {
    const dt = new Date();
    dt.setDate(1);
    dt.setMonth(dt.getMonth() - monthsAgo);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  };

  const stats: ApplicationStats = {
    totalApplications: 12,
    applicationsByStatus: [
      { _id: 'Interview', count: 4 },
      { _id: 'Assessment', count: 2 },
      { _id: 'Applied', count: 2 },
      { _id: 'Offer', count: 1 },
      { _id: 'Rejected', count: 3 },
    ],
    applicationsOverTime: [],
    applicationsOverTimeByStatus: [
      { month: monthKey(5), Applied: 3,  'Not Applied': 0, Interview: 0, Assessment: 0, Rejected: 1, Closed: 0, Offer: 0 },
      { month: monthKey(4), Applied: 5,  'Not Applied': 0, Interview: 1, Assessment: 0, Rejected: 1, Closed: 0, Offer: 0 },
      { month: monthKey(3), Applied: 7,  'Not Applied': 0, Interview: 2, Assessment: 1, Rejected: 2, Closed: 0, Offer: 0 },
      { month: monthKey(2), Applied: 9,  'Not Applied': 0, Interview: 3, Assessment: 1, Rejected: 3, Closed: 0, Offer: 0 },
      { month: monthKey(1), Applied: 11, 'Not Applied': 0, Interview: 4, Assessment: 2, Rejected: 2, Closed: 0, Offer: 1 },
      { month: monthKey(0), Applied: 12, 'Not Applied': 0, Interview: 4, Assessment: 2, Rejected: 3, Closed: 0, Offer: 1 },
    ],
  };

  return { jobs, stats, weeklyGoalTarget: 15 };
};

