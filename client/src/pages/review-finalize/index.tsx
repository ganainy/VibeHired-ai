// Re-export the primary job workspace page until the coordinator is fully wired.
// The extracted hooks (useJobApplication, useCvEditor, etc.) and tab components
// (JobDetailsTab, CoverLetterTab, CvEditorTab) are available for incremental adoption.
export { default } from '../JobApplicationWorkspacePage';
