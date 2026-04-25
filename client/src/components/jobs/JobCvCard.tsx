// Component for displaying individual job-specific CV cards with editing
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { JobApplication } from '../../services/jobApi';
import { JsonResumeSchema } from '../../../../server/src/types/jsonresume';
import { getJobCv, updateCv, createJobCv, getAllCvs, createJobCvFromBase, uploadCvForJob, CVDocument } from '../../services/cvApi';
import CvFormEditor from '../cv-editor/CvFormEditor';
import { Button, Select } from '../common';

interface JobCvCardProps {
 jobApplication: JobApplication;
 onUpdate?: (updatedJob: JobApplication) => void;
}

const JobCvCard: React.FC<JobCvCardProps> = ({ jobApplication, onUpdate }) => {
 const navigate = useNavigate();
 const [cvData, setCvData] = useState<JsonResumeSchema>({ basics: {} });
 const [isSaving, setIsSaving] = useState<boolean>(false);
 const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
 const [isExpanded, setIsExpanded] = useState<boolean>(false);
 const [currentCvId, setCurrentCvId] = useState<string | null>(null);

 // --- CV Attach / Replace Panel ---
 const [showAttachCvPanel, setShowAttachCvPanel] = useState<boolean>(false);
 const [baseCvList, setBaseCvList] = useState<CVDocument[]>([]);
 const [selectedBaseCvId, setSelectedBaseCvId] = useState<string>('');
 const [cvAttachFile, setCvAttachFile] = useState<File | null>(null);
 const [isAttachingCv, setIsAttachingCv] = useState<boolean>(false);
 const [attachCvError, setAttachCvError] = useState<string | null>(null);
 const attachCvFileRef = useRef<HTMLInputElement>(null);

 // Fetch Job CV
 useEffect(() => {
 const fetchCv = async () => {
 try {
 const res = await getJobCv(jobApplication._id);
 if (res.cv && res.cv.cvJson) {
 setCvData(res.cv.cvJson);
 setCurrentCvId(res.cv._id);
 originalCvDataRef.current = JSON.parse(JSON.stringify(res.cv.cvJson));
 }
 } catch (err) {
 // Ignore errors, CV will use empty default state
 }
 };
 fetchCv();
 }, [jobApplication._id]);

 const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
 const originalCvDataRef = useRef<JsonResumeSchema>({ basics: {} });

 // Load base CVs for the attach panel (only when panel opens)
 useEffect(() => {
 if (!showAttachCvPanel) return;
 getAllCvs()
 .then(res => {
 // Only show base CVs (not job-specific)
 setBaseCvList((res.cvs || []).filter(cv => !cv.jobApplicationId));
 })
 .catch(err => console.error('Failed to load base CVs:', err));
 }, [showAttachCvPanel]);

 // Handler: attach a base CV or upload a file as the job's independent CV copy
 const handleAttachCv = async () => {
 setIsAttachingCv(true);
 setAttachCvError(null);
 try {
 let newCvData: JsonResumeSchema | null = null;
 if (cvAttachFile) {
 const res = await uploadCvForJob(jobApplication._id, cvAttachFile);
 newCvData = res.cv?.cvJson || null;
 setCvAttachFile(null);
 if (attachCvFileRef.current) attachCvFileRef.current.value = '';
 } else if (selectedBaseCvId) {
 const res = await createJobCvFromBase(jobApplication._id, selectedBaseCvId);
 newCvData = res.cv?.cvJson || null;
 } else {
 throw new Error('Please select a base CV or upload a file.');
 }

 if (newCvData) {
 setCvData(newCvData);
 originalCvDataRef.current = JSON.parse(JSON.stringify(newCvData));
 }

 // Refresh currentCvId
 const freshCv = await getJobCv(jobApplication._id);
 if (freshCv.cv) setCurrentCvId(freshCv.cv._id);

 setShowAttachCvPanel(false);
 setSelectedBaseCvId('');
 } catch (err: any) {
 setAttachCvError(err?.message || 'Failed to attach CV.');
 } finally {
 setIsAttachingCv(false);
 }
 };

 const AUTO_SAVE_DELAY_MS = 2000;

 // Cleanup auto-save timeout on unmount
 useEffect(() => {
 return () => {
 if (autoSaveTimeoutRef.current) {
 clearTimeout(autoSaveTimeoutRef.current);
 }
 };
 }, []);

 // Handle CV changes with auto-save
 const handleCvChange = (updatedCv: JsonResumeSchema) => {
 setCvData(updatedCv);
 setSaveStatus('idle');

 // Clear existing timeout
 if (autoSaveTimeoutRef.current) {
 clearTimeout(autoSaveTimeoutRef.current);
 }

 // Set new timeout for auto-save
 autoSaveTimeoutRef.current = setTimeout(() => {
 handleSaveCv(updatedCv, true);
 }, AUTO_SAVE_DELAY_MS);
 };

 // Save CV changes
 const handleSaveCv = useCallback(async (cvDataToSave?: JsonResumeSchema, isAutoSave: boolean = false) => {
 const dataToSave = cvDataToSave || cvData;

 if (!isAutoSave) {
 setIsSaving(true);
 }
 setSaveStatus('saving');

 try {
 // Save to Unified CV Model
 if (currentCvId) {
 await updateCv(currentCvId, { cvJson: dataToSave });
 } else {
 const newCv = await createJobCv(jobApplication._id, { cvJson: dataToSave });
 setCurrentCvId(newCv.cv._id);
 }

 originalCvDataRef.current = JSON.parse(JSON.stringify(dataToSave));
 setSaveStatus('saved');

 if (onUpdate) {
 onUpdate(jobApplication);
 }

 setTimeout(() => {
 setSaveStatus('idle');
 }, 3000);
 } catch (error: any) {
 console.error("Error saving CV:", error);
 setSaveStatus('error');

 setTimeout(() => {
 setSaveStatus('idle');
 }, 5000);
 } finally {
 if (!isAutoSave) {
 setIsSaving(false);
 }
 }
 }, [cvData, jobApplication._id, onUpdate, currentCvId]);

 // Format date helper
 const formatDate = (dateString?: string) => {
 if (!dateString) return 'N/A';
 try {
 const date = new Date(dateString);
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

 if (diffDays === 0) return 'Today';
 if (diffDays === 1) return 'Yesterday';
 if (diffDays < 7) return `${diffDays} days ago`;

 return date.toLocaleDateString('en-US', {
 year: 'numeric',
 month: 'short',
 day: 'numeric',
 });
 } catch {
 return 'N/A';
 }
 };

 return (
 <div className="border-2 border-theme rounded-2xl bg-white shadow-lg overflow-hidden transition-all duration-300">
 {/* Card Header - Always Visible */}
 <div className="p-6 border-b" style={{background:"color-mix(in srgb, var(--accent-bg) 80%, transparent)"}}>
 <div className="flex items-start justify-between gap-4">
 <div className="flex-1">
 <div className="flex items-center gap-3 mb-2">
 <h3 className="text-xl font-bold text-primary-color">
 {jobApplication.jobTitle}
 </h3>
<span className={`px-3 py-1 rounded-full text-xs font-semibold ${jobApplication.status === 'Applied' ? 'bg-[var(--jade-bg)] text-green' :
  jobApplication.status === 'Interview' ? 'bg-[var(--accent-bg)] text-green-house' :
  'bg-[var(--bg-elevated)] text-secondary-color'
 }`}>
 {jobApplication.status}
 </span>
 </div>
 <p className="text-base text-secondary-color mb-2">
 {jobApplication.companyName}
 </p>
 <div className="flex items-center gap-4 text-sm text-muted-color">
 <span>Updated: {formatDate(jobApplication.updatedAt)}</span>
 {jobApplication.dateApplied && (
 <span>Applied: {formatDate(jobApplication.dateApplied)}</span>
 )}
 </div>
 </div>

 <div className="flex items-center gap-2">
 {/* Save Status Indicator */}
 {saveStatus !== 'idle' && (
<div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${saveStatus === 'saving' ? 'bg-[var(--accent-bg)] text-green-house' :
  saveStatus === 'saved' ? 'bg-[var(--jade-bg)] text-green' :
  'bg-[var(--rose-bg)] text-error'
 }`}>
 {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Error'}
 </div>
 )}

 {/* Expand/Collapse Button */}
 <button
 onClick={() => setIsExpanded(!isExpanded)}
 className="px-4 py-2 bg-white border border-theme text-secondary-color rounded-lg hover:bg-[var(--bg-elevated)] transition-colors font-medium text-sm flex items-center gap-2"
 >
 {isExpanded ? (
 <>
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
 </svg>
 Collapse
 </>
 ) : (
 <>
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 Expand & Edit
 </>
 )}
 </button>

 {/* Link to Full Review Page */}
 <Button
 onClick={() => navigate(`/jobs/${jobApplication._id}/workspace/`)}
 className="rounded-lg font-medium text-sm flex items-center gap-2"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
 </svg>
 Full Details
 </Button>
 </div>
 </div>
 </div>

 {/* Expandable Content */}
 {isExpanded && (
 <div className="p-6 space-y-6">
 {/* Tailored Copy Info Banner */}
 {currentCvId && (
 <div className="bg-[var(--accent-bg)] rounded-lg px-3 py-2 text-sm text-green-house flex items-start gap-2">
 <svg className="w-4 h-4 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
 <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
 </svg>
 <span>This is a tailored copy — edits here don't affect your base resume.</span>
 </div>
 )}

 {/* CV Editor Section */}
 <div>
 <div className="flex items-center justify-between mb-4">
 <h4 className="text-lg font-semibold text-primary-color">Edit CV</h4>
 <div className="flex items-center gap-2">
 {/* Replace CV button */}
 <Button
 variant="secondary"
 onClick={() => { setShowAttachCvPanel(v => !v); setAttachCvError(null); }}
 className="rounded-lg text-sm flex items-center gap-1.5 px-3 py-2 border font-medium"
 style={{background:"var(--accent-bg)", borderColor:"var(--accent-dim)", color:"var(--accent)"}}
 title="Replace this job's CV with a base CV or uploaded file"
 >
 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
 </svg>
 Replace with Base CV
 </Button>
 <Button
 onClick={() => handleSaveCv(undefined, false)}
 disabled={isSaving}
 className="px-4 py-2 rounded-lg text-sm flex items-center gap-2"
 >
 {isSaving ? (
 <>
 <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
 </svg>
 Saving...
 </>
 ) : (
 <>
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
 </svg>
 Save Changes
 </>
 )}
 </Button>
 </div>
 </div>

 {/* Attach / Replace CV Panel */}
 {showAttachCvPanel && (
 <div className="mb-4 p-4 rounded-xl space-y-3 border" style={{background:"var(--accent-bg)", borderColor:"var(--accent-dim)"}}>
 <div>
 <p className="text-sm font-medium" style={{color:"var(--accent)"}}>
 Replace this job's CV with an independent copy:
 </p>
 <p className="text-xs mt-1" style={{color:"var(--accent-dim)"}}>
 Replacing will create a fresh copy from the selected base resume. Your current tailored CV will be overwritten.
 </p>
 </div>

 {/* Select base CV */}
 <div>
 <label className="block text-xs font-medium mb-1" style={{color:"var(--accent)"}}>From existing base CV</label>
 <Select
 value={selectedBaseCvId}
 onChange={(e) => { setSelectedBaseCvId(e.target.value); setCvAttachFile(null); if (attachCvFileRef.current) attachCvFileRef.current.value = ''; }}
 className="w-full bg-white text-sm text-primary-color"
 >
 <option value="">-- Select base CV --</option>
 {baseCvList.map(cv => (
 <option key={cv._id} value={cv._id}>
 {cv.displayName || cv.category || 'CV'}
 </option>
 ))}
 </Select>
 </div>

 {/* Divider */}
 <div className="flex items-center gap-2 text-xs" style={{color:"var(--accent)"}}>
 <div className="flex-1 border-t" style={{borderColor:"var(--accent-dim)"}} />
 <span>OR</span>
 <div className="flex-1 border-t" style={{borderColor:"var(--accent-dim)"}} />
 </div>

 {/* Upload file */}
 <div>
 <label className="block text-xs font-medium mb-1" style={{color:"var(--accent)"}}>Upload a PDF or DOCX</label>
 <input
 ref={attachCvFileRef}
 type="file"
 accept=".pdf,.docx"
 className="block w-full text-xs text-secondary-color file:mr-3 file:py-1.5 file:px-3 file:border-0 file:rounded file:text-xs file:font-medium file:bg-gold-lightest file:text-gold-dark hover:file:cursor-pointer"
 onChange={(e) => { const f = e.target.files?.[0] ?? null; setCvAttachFile(f); if (f) setSelectedBaseCvId(''); }}
 />
 </div>

 {attachCvError && (
 <p className="text-xs text-error">{attachCvError}</p>
 )}

 <p className="text-xs italic" style={{color:"var(--accent)"}}>
 A full independent copy will be stored for this job. Editing the original will not affect this job.
 </p>

 <div className="flex gap-2 pt-1">
 <Button
 onClick={handleAttachCv}
 disabled={isAttachingCv || (!selectedBaseCvId && !cvAttachFile)}
 className="rounded-lg text-sm font-medium flex items-center gap-2"
 >
 {isAttachingCv ? (
 <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>Attaching…</>
 ) : 'Attach CV'}
 </Button>
 <button
 onClick={() => { setShowAttachCvPanel(false); setAttachCvError(null); setCvAttachFile(null); setSelectedBaseCvId(''); }}
 className="px-4 py-2 bg-white border border-theme text-secondary-color rounded-lg text-sm hover:bg-[var(--bg-elevated)]"
 >
 Cancel
 </button>
 </div>
 </div>
 )}

 <div className="border border-theme rounded-xl p-4" style={{ background: 'var(--bg-elevated)' }}>
 <CvFormEditor data={cvData} onChange={handleCvChange} />
 </div>
 </div>
 </div>
 )}
 </div>
 );
};

export default JobCvCard;
