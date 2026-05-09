import React from 'react';
import { JobApplication } from '../../services/jobApi';

interface JobDescriptionTabProps {
  jobApplication: JobApplication;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
}

const JobDescriptionTab: React.FC<JobDescriptionTabProps> = ({ jobApplication, isEditing, setIsEditing }) => {
  const statusConfig: Record<string, { dot: string; label: string }> = {
    'Applied': { dot: 'bg-green', label: 'Applied' },
    'Not Applied': { dot: 'bg-gray-400', label: 'Not Applied' },
    'Interview': { dot: 'bg-green-house', label: 'Interview' },
    'Assessment': { dot: 'bg-amber-500', label: 'Assessment' },
    'Rejected': { dot: 'bg-red-500', label: 'Rejected' },
    'Closed': { dot: 'bg-gray-400', label: 'Closed' },
    'Offer': { dot: 'bg-green', label: 'Offer' },
  };

  const getTags = (): string[] => {
    const tags: string[] = [];
    const seen = new Set<string>();
    const push = (v?: string | null) => {
      if (!v) return;
      const t = v.trim().replace(/\s+/g, ' ');
      if (!t || seen.has(t.toLowerCase())) return;
      seen.add(t.toLowerCase());
      tags.push(t);
    };
    if (Array.isArray(jobApplication.jobTags)) {
      jobApplication.jobTags.forEach(push);
    }
    if (jobApplication.jobCategory) {
      push(jobApplication.jobCategory);
    }
    return tags;
  };

  const jobTags = getTags();

  if (isEditing) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Job Details Card ── */}
      <div className="card p-6 md:p-8">
        <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg" style={{ background: 'var(--accent-bg)' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>work</span>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--accent)' }}>Job Details</h2>
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="btn-primary text-sm"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
            Edit Job
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
          <div>
            <p className="label-overline mb-1">Job Title</p>
            <p className="text-base md:text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {jobApplication.jobTitle || <span className="italic" style={{ color: 'var(--text-muted)' }}>—</span>}
            </p>
          </div>
          <div>
            <p className="label-overline mb-1">Company</p>
            <p className="text-base md:text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {jobApplication.companyName || <span className="italic" style={{ color: 'var(--text-muted)' }}>—</span>}
            </p>
          </div>
          <div>
            <p className="label-overline mb-1">Status</p>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-sm font-semibold"
              style={{
                background: 'var(--accent-bg)',
                color: 'var(--accent)',
              }}
            >
              <span className={`w-2 h-2 rounded-full ${statusConfig[jobApplication.status]?.dot || 'bg-gray-400'}`} />
              {statusConfig[jobApplication.status]?.label || jobApplication.status}
            </span>
          </div>
          <div>
            <p className="label-overline mb-1">Language</p>
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {jobApplication.language === 'de' ? 'German' : jobApplication.language === 'en' ? 'English' : <span className="italic" style={{ color: 'var(--text-muted)' }}>—</span>}
            </p>
          </div>
          <div>
            <p className="label-overline mb-1">Employment Type</p>
            <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              {jobApplication.jobType ? jobApplication.jobType.replace(/-/g, ' ') : <span className="italic" style={{ color: 'var(--text-muted)' }}>—</span>}
            </p>
          </div>
          <div>
            <p className="label-overline mb-1">Date Added</p>
            <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>
              {jobApplication.createdAt ? new Date(jobApplication.createdAt).toLocaleDateString() : <span className="italic" style={{ color: 'var(--text-muted)' }}>—</span>}
            </p>
          </div>
          {jobApplication.baseCvId && (
            <div>
              <p className="label-overline mb-1">Base CV</p>
              <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>{jobApplication.baseCvId}</p>
            </div>
          )}
          {jobApplication.jobUrl && (
            <div>
              <p className="label-overline mb-1">Job URL</p>
              <a
                href={jobApplication.jobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium hover:underline break-all"
                style={{ color: 'var(--accent)' }}
              >
                {jobApplication.jobUrl.length > 60 ? jobApplication.jobUrl.substring(0, 60) + '…' : jobApplication.jobUrl}
              </a>
            </div>
          )}
          {jobTags.length > 0 && (
            <div className="md:col-span-2">
              <p className="label-overline mb-3">Tags</p>
              <div className="flex flex-wrap gap-2">
                {jobTags.map((tag) => (
                  <span
                    key={tag}
                    className="badge badge-ink"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Key Highlights Card ── */}
      {(jobApplication.extractedData?.location ||
        jobApplication.extractedData?.salaryRaw ||
        jobApplication.extractedData?.estimatedSalary ||
        jobApplication.contactEmail ||
        jobApplication.contactPhone ||
        jobApplication.hiringManagerName ||
        jobApplication.applicationUrl ||
        jobApplication.extractedData?.keyDetails) && (
        <div className="card p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-lg" style={{ background: 'var(--accent-bg)' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>emoji_objects</span>
            </div>
            <h2 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--accent)' }}>Key Highlights</h2>
          </div>
          <div className="space-y-3">
            {jobApplication.extractedData?.location && (
              <div className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full shrink-0 mt-2" style={{ background: 'var(--accent)' }} />
                <p style={{ color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Location:</strong> {jobApplication.extractedData.location}
                </p>
              </div>
            )}
            {(jobApplication.extractedData?.salaryRaw || jobApplication.extractedData?.estimatedSalary) && (
              <div className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full shrink-0 mt-2" style={{ background: 'var(--accent)' }} />
                <p style={{ color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Salary:</strong>{' '}
                  {jobApplication.extractedData?.salaryRaw || jobApplication.extractedData?.estimatedSalary}
                  {jobApplication.extractedData?.salaryIsEstimate === false ? (
                    <span className="badge badge-jade ml-2 text-[10px]">From posting</span>
                  ) : (
                    <span className="badge badge-ember ml-2 text-[10px]">AI Estimate</span>
                  )}
                </p>
              </div>
            )}
            {jobApplication.contactEmail && (
              <div className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full shrink-0 mt-2" style={{ background: 'var(--accent)' }} />
                <p style={{ color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Contact Email:</strong>{' '}
                  <a href={`mailto:${jobApplication.contactEmail}`} className="hover:underline" style={{ color: 'var(--accent)' }}>
                    {jobApplication.contactEmail}
                  </a>
                </p>
              </div>
            )}
            {jobApplication.contactPhone && (
              <div className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full shrink-0 mt-2" style={{ background: 'var(--accent)' }} />
                <p style={{ color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Contact Phone:</strong> {jobApplication.contactPhone}
                </p>
              </div>
            )}
            {jobApplication.hiringManagerName && (
              <div className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full shrink-0 mt-2" style={{ background: 'var(--accent)' }} />
                <p style={{ color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Hiring Manager:</strong> {jobApplication.hiringManagerName}
                </p>
              </div>
            )}
            {jobApplication.applicationUrl && (
              <div className="flex items-start gap-3">
                <span className="w-2 h-2 rounded-full shrink-0 mt-2" style={{ background: 'var(--accent)' }} />
                <p style={{ color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Application Portal:</strong>{' '}
                  <a href={jobApplication.applicationUrl} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: 'var(--accent)' }}>
                    {jobApplication.applicationUrl.length > 60 ? jobApplication.applicationUrl.substring(0, 60) + '…' : jobApplication.applicationUrl}
                  </a>
                </p>
              </div>
            )}
            {jobApplication.extractedData?.keyDetails && (
              (Array.isArray(jobApplication.extractedData.keyDetails)
                ? jobApplication.extractedData.keyDetails
                : (jobApplication.extractedData.keyDetails as string).split('\n').filter(Boolean)
              ).map((item: any, idx: number) => {
                const key = typeof item === 'string' ? item.replace(/^[\*\-]\s*/, '') : item.key;
                const value = typeof item === 'string' ? '' : item.value;
                return (
                  <div key={idx} className="flex items-start gap-3">
                    <span className="w-2 h-2 rounded-full shrink-0 mt-2" style={{ background: 'var(--accent)' }} />
                    <p style={{ color: 'var(--text-secondary)' }}>
                      {value ? (
                        <><strong style={{ color: 'var(--text-primary)' }}>{key}:</strong> {value}</>
                      ) : (
                        key
                      )}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Requirements Card ── */}
      {jobApplication.jobPrerequisites && (
        <div className="card p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-lg" style={{ background: 'var(--accent-bg)' }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>checklist</span>
            </div>
            <h2 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--accent)' }}>Requirements Description</h2>
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
            {jobApplication.jobPrerequisites}
          </div>
        </div>
      )}

      {/* ── Job Description Card ── */}
      <div className="card p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-lg" style={{ background: 'var(--accent-bg)' }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--accent)' }}>description</span>
          </div>
          <h2 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--accent)' }}>Job Description</h2>
        </div>
        {jobApplication.jobDescriptionText ? (
          <div className="whitespace-pre-wrap text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {jobApplication.jobDescriptionText}
          </div>
        ) : (
          <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
            No job description available.
          </p>
        )}
      </div>
    </div>
  );
};

export default JobDescriptionTab;
