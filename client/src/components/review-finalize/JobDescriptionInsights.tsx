import React from 'react';
import { JobApplication } from '../../services/jobApi';

interface JobDescriptionInsightsProps {
 jobApplication: JobApplication;
}

const JobDescriptionInsights: React.FC<JobDescriptionInsightsProps> = ({ jobApplication }) => {
 return (
 <>
<div className="bg-white rounded-xl shadow-sm border border-theme p-6 mt-6">
  <div className="flex items-center gap-2 mb-4">
  <span className="material-symbols-outlined text-primary">lightbulb</span>
  <h2 className="text-lg font-bold text-text-main-light">Key Highlights</h2>
 </div>
 <ul className="space-y-3">
 {jobApplication.extractedData?.location && (
 <li className="flex items-start gap-3">
 <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
 <span className="text-sm text-text-sub-light">
 <strong className="text-text-main-light">Location:</strong> {jobApplication.extractedData.location}
 </span>
 </li>
 )}
 {(jobApplication.extractedData?.salaryRaw || jobApplication.extractedData?.estimatedSalary) && (
 <li className="flex items-start gap-3">
 <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
 <span className="text-sm text-text-sub-light">
 <strong className="text-text-main-light">Salary:</strong>{' '}
 {jobApplication.extractedData?.salaryRaw
 ? jobApplication.extractedData.salaryRaw
 : jobApplication.extractedData?.estimatedSalary}
 {' '}
 {jobApplication.extractedData?.salaryIsEstimate === false ? (
<span className="inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-[var(--jade-bg)] text-green">
  From posting
  </span>
  ) : (
  <span className="inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-[var(--ember-bg)] text-ember" title="This salary is an AI estimate based on the job data">
 AI Estimate
 </span>
 )}
 </span>
 </li>
 )}
 {jobApplication.contactEmail && (
 <li className="flex items-start gap-3">
 <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
 <span className="text-sm text-text-sub-light">
 <strong className="text-text-main-light">Contact Email:</strong>{' '}
 <a href={`mailto:${jobApplication.contactEmail}`} className="hover:underline" style={{ color: 'var(--accent)' }}>
 {jobApplication.contactEmail}
 </a>
 </span>
 </li>
 )}
 {jobApplication.contactPhone && (
 <li className="flex items-start gap-3">
 <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
 <span className="text-sm text-text-sub-light flex flex-wrap items-center gap-2">
 <strong className="text-text-main-light">Contact Phone:</strong>
 {jobApplication.contactPhone}
 </span>
 </li>
 )}
 {jobApplication.hiringManagerName && (
 <li className="flex items-start gap-3">
 <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
 <span className="text-sm text-text-sub-light">
 <strong className="text-text-main-light">Hiring Manager:</strong> {jobApplication.hiringManagerName}
 </span>
 </li>
 )}
 {jobApplication.applicationUrl && (
 <li className="flex items-start gap-3">
 <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
 <span className="text-sm text-text-sub-light">
 <strong className="text-text-main-light">Application Portal:</strong>{' '}
 <a href={jobApplication.applicationUrl} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--accent)' }}>
 {jobApplication.applicationUrl.length > 50 ? jobApplication.applicationUrl.substring(0, 50) + '...' : jobApplication.applicationUrl}
 </a>
 </span>
 </li>
 )}
 {jobApplication.extractedData?.keyDetails && (
 Array.isArray(jobApplication.extractedData.keyDetails) ? (
 jobApplication.extractedData.keyDetails.map((item: { key: string; value: string }, idx: number) => (
 <li key={idx} className="flex items-start gap-3">
 <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
 <span className="text-sm text-text-sub-light">
 <strong className="text-text-main-light">{item.key}:</strong> {item.value}
 </span>
 </li>
 ))
 ) : (
 (jobApplication.extractedData.keyDetails as string).split('\n').filter((line: string) => line.trim()).map((line: string, idx: number) => (
 <li key={idx} className="flex items-start gap-3">
 <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></span>
 <span className="text-sm text-text-sub-light leading-relaxed">
 {line.replace(/^[\*\-]\s*/, '')}
 </span>
 </li>
 ))
 )
 )}
 </ul>
 </div>

 {jobApplication.jobPrerequisites && (
<div className="bg-white rounded-xl shadow-sm border border-theme p-6 mt-6">
  <div className="flex justify-between items-center mb-4">
  <h2 className="text-lg font-bold text-text-main-light flex items-center gap-2">
 <span className="material-symbols-outlined">checklist</span>
 Requirements Description
 </h2>
 </div>
 <div className="text-sm text-text-main-light leading-relaxed">
 <div className="whitespace-pre-wrap">
 {jobApplication.jobPrerequisites}
 </div>
 </div>
 </div>
 )}
 </>
 );
};

export default JobDescriptionInsights;
