// Mock data used for per-page demo tours.
// These objects are visual-only — never sent to the server.

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
