export const REVIEW_FINALIZE_TABS = [
    'job-description',
    'cover-letter',
    'cv',
    'mock-interview',
] as const;

export type ActiveReviewTab = typeof REVIEW_FINALIZE_TABS[number];

export function isActiveReviewTab(tab: string): tab is ActiveReviewTab {
    return (REVIEW_FINALIZE_TABS as readonly string[]).includes(tab);
}
