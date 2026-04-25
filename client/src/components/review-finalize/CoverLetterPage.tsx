import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CoverLetterEditor from '../CoverLetterEditor';
import { Button, Card, Input, Select, Textarea } from '../common';
import ErrorAlert from '../common/ErrorAlert';
import Spinner from '../common/Spinner';
import PromptChecklist from '../common/PromptChecklist';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { JobApplication } from '../../services/jobApi';
import { CoverLetterBase } from '../../services/coverLetterBaseApi';

interface CoverLetterPageProps {
 // Job Application & Basic State
 jobApplication: JobApplication;
 jobId: string;
 
 // Cover Letter State
 coverLetterText: string;
 handleCoverLetterChange: (value: string) => void;
 
 // Download & Actions
 finalPdfFiles: { cv: string | null; cl: string | null };
 isRenderingCoverLetterPdf: boolean;
 isClCopied: boolean;
 handleCopyCoverLetter: () => void;
 handleDownload: (filename: string) => void;
 handleGenerateCoverLetterPdf: () => void;
 setIsEmailModalOpen: (open: boolean) => void;
 
 // Cover Letter Generation
 isGeneratingCoverLetter: boolean;
 coverLetterError: string | null;
 setCoverLetterError: (error: string | null) => void;
 
 // Creation Mode
 clCreationMode: 'ai' | 'import';
 setClCreationMode: (mode: 'ai' | 'import') => void;
 
 // Library Panel
 showClLibraryPanel: boolean;
 setShowClLibraryPanel: (show: boolean) => void;
 baseCoverLetters: CoverLetterBase[];
 selectedBaseClId: string;
 setSelectedBaseClId: (id: string) => void;
 clUploadFile: File | null;
 setClUploadFile: (file: File | null) => void;
 clUploadFileRef: React.RefObject<HTMLInputElement>;
 isApplyingBaseCl: boolean;
 applyClError: string | null;
 setApplyClError: (error: string | null) => void;
 handleApplyBaseCoverLetter: () => Promise<void>;
 handleSaveClSnapshot: () => Promise<void>;
 
 // AI Generation Form
 tailoredJobTitle: string;
 setTailoredJobTitle: (value: string) => void;
 tailoredCompanyName: string;
 setTailoredCompanyName: (value: string) => void;
 tailoredJobDescription: string;
 setTailoredJobDescription: (value: string) => void;
 clCustomInstructions: string;
 setClCustomInstructions: (value: string) => void;
 
 // CV Selection
 selectedClBaseCvId: string;
 handleSelectedClBaseCvIdChange: (id: string) => void;
 availableCvs: { id: string; name: string; data: any }[];
 currentCvId: string | null;
 hasLocalCv: boolean;
 hasMasterCv: boolean;
 
 // Humanize option
 humanize: boolean;
 setHumanize: (value: boolean) => void;
 
 // Actions
 handleGenerateCoverLetter: () => void;
 updateJob: (jobId: string, updates: any) => Promise<any>;
 showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
 onCoverLetterDeleted: () => void;
}

const CoverLetterPage: React.FC<CoverLetterPageProps> = ({
 jobApplication,
 jobId,
 coverLetterText,
 handleCoverLetterChange,
 finalPdfFiles,
 isRenderingCoverLetterPdf,
 isClCopied,
 handleCopyCoverLetter,
 handleDownload,
 handleGenerateCoverLetterPdf,
 setIsEmailModalOpen,
 isGeneratingCoverLetter,
 coverLetterError,
 setCoverLetterError,
 clCreationMode,
 setClCreationMode,
 showClLibraryPanel,
 setShowClLibraryPanel,
 baseCoverLetters,
 selectedBaseClId,
 setSelectedBaseClId,
 clUploadFile,
 setClUploadFile,
 clUploadFileRef,
 isApplyingBaseCl,
 applyClError,
 setApplyClError,
 handleApplyBaseCoverLetter,
 tailoredJobTitle,
 setTailoredJobTitle,
 tailoredCompanyName,
 setTailoredCompanyName,
 tailoredJobDescription,
 setTailoredJobDescription,
 setClCustomInstructions,
 selectedClBaseCvId,
 handleSelectedClBaseCvIdChange,
 availableCvs,
 currentCvId,
 hasLocalCv,
 hasMasterCv,
 humanize,
 setHumanize,
 handleGenerateCoverLetter,
 updateJob,
 showToast,
 onCoverLetterDeleted,
}) => {
 const navigate = useNavigate();

 // Handle Word document download
 const handleDownloadWord = async () => {
 try {
 // Create a new document
 const doc = new Document({
 sections: [{
 properties: {},
 children: coverLetterText.split('\n').map(line =>
 new Paragraph({
 children: [new TextRun(line)],
 })
 ),
 }],
 });

 // Generate and download the document
 const blob = await Packer.toBlob(doc);
 const filename = `Cover_Letter_${jobApplication.companyName || 'Company'}_${jobApplication.jobTitle || 'Position'}.docx`;
 saveAs(blob, filename.replace(/[^a-zA-Z0-9_-]/g, '_'));
 } catch (error) {
 console.error('Error generating Word document:', error);
 showToast('Failed to generate Word document', 'error');
 }
 };

 const handleDeleteCoverLetter = async () => {
 if (window.confirm('Are you sure you want to delete this cover letter? You will need to regenerate it.')) {
 try {
 await updateJob(jobId, { draftCoverLetterText: null });
 onCoverLetterDeleted();
 showToast('Cover letter deleted successfully', 'success');
 } catch (err) {
 console.error('Failed to delete cover letter', err);
 showToast('Failed to delete cover letter', 'error');
 }
 }
 };

 return (
 <div>
 {jobApplication.draftCoverLetterText ? (
 <div className="bg-surface rounded-xl overflow-hidden border border-theme shadow-sm flex flex-col h-[calc(100vh-280px)] min-h-[800px]">
 {/* Header part */}
 <div className="bg-elevated px-4 py-3 border-b border-theme">
 <div className="flex items-center justify-between">
 <h2 className="text-xl font-semibold text-primary-color">Edit Cover Letter</h2>

 {/* Action buttons - positioned on the right */}
 <div className="flex items-center gap-3">
 {/* Download Buttons Group */}
 <div className="flex items-center gap-2">
 {/* Copy Button */}
 <Button
 variant="secondary"
 onClick={handleCopyCoverLetter}
 className="group flex items-center gap-2 px-3 py-2 text-xs"
 title="Copy to clipboard"
 >
 {isClCopied ? (
 <span className="material-symbols-outlined text-green text-sm">check</span>
 ) : (
 <span className="material-symbols-outlined text-sm">content_copy</span>
 )}
 <span>{isClCopied ? 'Copied' : 'Copy'}</span>
 </Button>

 {/* Download PDF Button */}
 <Button
 onClick={finalPdfFiles.cl ? () => handleDownload(finalPdfFiles.cl as string) : handleGenerateCoverLetterPdf}
 disabled={isRenderingCoverLetterPdf}
 className="group flex items-center gap-2 px-3 py-2 text-xs"
 title="Download as PDF"
 >
 {isRenderingCoverLetterPdf ? (
 <Spinner size="sm" />
 ) : (
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
 </svg>
 )}
 <span>PDF</span>
 </Button>

 {/* Download Word Button */}
 <Button
 variant="secondary"
 onClick={handleDownloadWord}
 className="group flex items-center gap-2 px-3 py-2 text-xs"
 title="Download as Word Document"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
 </svg>
 <span>Word</span>
 </Button>

 {/* Email Format Button */}
 <Button
 onClick={() => setIsEmailModalOpen(true)}
 className="group flex items-center gap-2 px-3 py-2 text-xs bg-green text-white hover:bg-green"
 title="View as Email Format"
 >
 <span className="material-symbols-outlined text-sm">mail</span>
 <span>Email</span>
 </Button>
 </div>

 {/* Delete Cover Letter Button */}
 <Button
 variant="danger"
 onClick={handleDeleteCoverLetter}
 className="group flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm"
 title="Delete cover letter to regenerate with new instructions"
 >
 <span className="material-symbols-outlined text-sm">delete</span>
 </Button>
 </div>
 </div>

 <div className="mt-4 flex items-center gap-2 p-3 rounded-lg text-sm" style={{ background: 'var(--accent-bg)', color: 'var(--text-secondary)', border: '1px solid var(--accent-dim)' }}>
 <span className="material-symbols-outlined text-base">info</span>
 <p>
 To regenerate the cover letter with different instructions, please delete the current cover letter using the trash icon above.
 </p>
 </div>

 {/* Cover Letter Library Panel */}
 {showClLibraryPanel && (
 <div className="mt-4 p-4 rounded-xl space-y-4" style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-dim)' }}>
 <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--accent)' }}>
 <span className="material-symbols-outlined text-base">folder_open</span>
 Attach Cover Letter from Library
 </h3>

 {applyClError && (
 <p className="text-xs text-error">{applyClError}</p>
 )}

 {/* Select from existing base cover letters */}
 <div className="space-y-1">
 <label className="block text-xs font-medium text-secondary-color">Select from library</label>
 <select
 value={selectedBaseClId}
 onChange={(e) => { setSelectedBaseClId(e.target.value); setClUploadFile(null); }}
 disabled={!!clUploadFile || isApplyingBaseCl}
 className="w-full px-3 py-2 text-sm border border-theme rounded-lg bg-white text-primary-color focus:ring-2 disabled:opacity-50" style={{ caretColor: 'var(--accent)' }}
 >
 <option value="">— choose a cover letter —</option>
 {baseCoverLetters.map(cl => (
 <option key={cl._id} value={cl._id}>{cl.displayName}</option>
 ))}
 </select>
 </div>

 {/* OR divider */}
 <div className="flex items-center gap-3">
<hr className="flex-1 border-theme" />
  <span className="text-xs text-muted-color">OR</span>
  <hr className="flex-1 border-theme" />
 </div>

 {/* Upload a file */}
 <div className="space-y-1">
 <label className="block text-xs font-medium text-secondary-color">Upload a file (PDF / DOCX)</label>
 <input
 type="file"
 accept=".pdf,.docx"
 ref={clUploadFileRef}
 className="hidden"
 onChange={(e) => { const f = e.target.files?.[0] ?? null; setClUploadFile(f); if (f) setSelectedBaseClId(''); }}
 />
 {clUploadFile ? (
<div className="flex items-center gap-2 px-3 py-2 bg-white border border-theme rounded-lg text-sm">
  <span className="material-symbols-outlined text-base text-muted-color">description</span>
  <span className="flex-1 truncate text-primary-color">{clUploadFile.name}</span>
  <button onClick={() => { setClUploadFile(null); if (clUploadFileRef.current) clUploadFileRef.current.value = ''; }} className="text-muted-color hover:text-error transition-colors">
 <span className="material-symbols-outlined text-base">close</span>
 </button>
 </div>
 ) : (
 <button
 onClick={() => clUploadFileRef.current?.click()}
 disabled={isApplyingBaseCl}
 className="flex items-center gap-2 px-3 py-2 text-sm border border-dashed rounded-lg transition-colors disabled:opacity-50" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
 >
 <span className="material-symbols-outlined text-base">upload_file</span>
 Choose file…
 </button>
 )}
 </div>

 {/* Isolation notice */}
 <p className="text-xs text-muted-color flex items-start gap-1">
 <span className="material-symbols-outlined text-base shrink-0">lock</span>
 A full independent copy will be stored for this job. Editing or deleting the original will not affect this application.
 </p>

 {/* Actions */}
 <div className="flex gap-2">
 <Button
 onClick={handleApplyBaseCoverLetter}
 disabled={isApplyingBaseCl || (!selectedBaseClId && !clUploadFile)}
 className="flex items-center gap-2"
 >
 {isApplyingBaseCl ? <Spinner size="sm" /> : <span className="material-symbols-outlined text-base">attach_file</span>}
 Attach to Job
 </Button>
 <Button
 variant="ghost"
 onClick={() => { setShowClLibraryPanel(false); setApplyClError(null); }}
 className="px-4 py-2 text-sm"
 >
 Cancel
 </Button>
 </div>
 </div>
 )}
 </div>

 {/* Editor part */}
 <div className="flex-1 overflow-hidden p-6" style={{ background: 'var(--bg-elevated)' }}>
 {coverLetterError && (
 <div className="mb-4">
 <ErrorAlert
 message={coverLetterError}
 onDismiss={() => setCoverLetterError(null)}
 />
 </div>
 )}
 <CoverLetterEditor
 value={coverLetterText}
 onChange={handleCoverLetterChange}
 placeholder="Edit your cover letter here..."
 className="h-full"
 />
 </div>
 </div>
 ) : (
 <div>
 <div className="mb-8">
<h2 className="text-3xl font-bold text-primary-color mb-2">Cover Letter</h2>
  <p className="text-secondary-color text-lg">
 How would you like to add a cover letter for this job?
 </p>
 </div>

 {/* Cover letter mode picker */}
 <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-8">
 {/* Option A – AI Generate */}
 <button
 type="button"
 onClick={() => setClCreationMode('ai')}
 className={`group relative flex-1 flex flex-row items-center gap-3 rounded-xl border-2 px-3 py-2 text-left transition-all focus:outline-none min-w-0 ${clCreationMode === 'ai'
 ? 'border-gold shadow-md' : 'hover:border-gold'
 }`}
 style={clCreationMode === 'ai' ? { background: 'var(--bg-surface)', borderColor: 'var(--accent)' } : {}}
 >
<div className={`flex items-center justify-center w-8 h-8 rounded-lg ${clCreationMode === 'ai' ? 'text-green-house' : 'text-muted-color'}`} style={clCreationMode !== 'ai' ? { background: 'var(--bg-elevated)' } : undefined}
 >
 <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
 </div>
 <div className="flex-1 min-w-0">
<p className="font-semibold text-primary-color text-sm">Generate with AI</p>
  <p className="text-xs text-muted-color leading-tight">Let the AI write a tailored cover letter based on your CV and the job description.</p>
 </div>
 {clCreationMode === 'ai' && (
 <span className="absolute top-2 right-2 flex items-center justify-center w-4 h-4 rounded-full text-green-house" style={{ background: 'var(--accent)' }}>
 <span className="material-symbols-outlined text-[13px]">check</span>
 </span>
 )}
 </button>

 {/* Option B – Upload / Library */}
 <button
 type="button"
 onClick={() => setClCreationMode('import')}
 className={`group relative flex-1 flex flex-row items-center gap-3 rounded-xl border-2 px-3 py-2 text-left transition-all focus:outline-none min-w-0 ${clCreationMode === 'import'
 ? 'border-gold shadow-md' : 'hover:border-gold'
 }`}
 style={clCreationMode === 'import' ? { background: 'var(--bg-surface)', borderColor: 'var(--accent)' } : {}}
 >
<div className={`flex items-center justify-center w-8 h-8 rounded-lg ${clCreationMode === 'import' ? 'text-green-house' : 'text-muted-color'}`} style={clCreationMode !== 'import' ? { background: 'var(--bg-elevated)' } : undefined}
 >
 <span className="material-symbols-outlined text-[20px]">upload_file</span>
 </div>
 <div className="flex-1 min-w-0">
<p className="font-semibold text-primary-color text-sm">Use my own cover letter</p>
  <p className="text-xs text-muted-color leading-tight">Upload a PDF / DOCX file or pick an existing one from your library.</p>
 </div>
 {clCreationMode === 'import' && (
 <span className="absolute top-2 right-2 flex items-center justify-center w-4 h-4 rounded-full text-green-house" style={{ background: 'var(--accent)' }}>
 <span className="material-symbols-outlined text-[13px]">check</span>
 </span>
 )}
 </button>
 </div>

 {/* Option B form: Import / Upload */}
 {clCreationMode === 'import' && (
 <Card padding="none" className="p-8 space-y-6">
 <h3 className="text-lg font-bold text-primary-color flex items-center gap-2">
 <span className="material-symbols-outlined" style={{ color: "var(--accent)" }}>folder_open</span>
 Attach Cover Letter
 </h3>

 {applyClError && (
 <ErrorAlert message={applyClError} onDismiss={() => setApplyClError(null)} />
 )}

 {/* Upload a file */}
 <div className="space-y-2">
 <label className="block text-sm font-medium text-secondary-color">Upload a file <span className="text-muted-color font-normal">(PDF or DOCX)</span></label>
 <input
 type="file"
 accept=".pdf,.docx"
 ref={clUploadFileRef}
 className="hidden"
 onChange={(e) => { const f = e.target.files?.[0] ?? null; setClUploadFile(f); if (f) setSelectedBaseClId(''); }}
 />
 {clUploadFile ? (
 <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "var(--accent-bg)", borderColor: "var(--accent-dim)", border: "1px solid var(--accent-dim)" }}>
 <span className="material-symbols-outlined" style={{ color: "var(--accent)" }}>description</span>
 <span className="flex-1 truncate text-sm text-primary-color font-medium">{clUploadFile.name}</span>
 <button
 onClick={() => { setClUploadFile(null); if (clUploadFileRef.current) clUploadFileRef.current.value = ''; }}
 className="text-muted-color hover:text-error transition-colors"
 >
 <span className="material-symbols-outlined text-base">close</span>
 </button>
 </div>
 ) : (
 <button
 onClick={() => clUploadFileRef.current?.click()}
 disabled={isApplyingBaseCl}
 className="flex items-center gap-3 w-full px-4 py-4 border-2 border-dashed border-theme rounded-xl text-secondary-color hover:border-gold hover:text-gold hover:bg-gold-50 transition-all disabled:opacity-50"
 >
 <span className="material-symbols-outlined text-2xl">upload_file</span>
 <span className="text-sm font-medium">Click to choose a PDF or DOCX file…</span>
 </button>
 )}
 </div>

 {/* OR divider */}
 <div className="flex items-center gap-4">
 <hr className="flex-1 border-theme" />
 <span className="text-sm font-medium text-muted-color">OR</span>
 <hr className="flex-1 border-theme" />
 </div>

 {/* Select from library */}
 <div className="space-y-2">
 <label className="block text-sm font-medium text-secondary-color">Select from your library</label>
 <div className="relative">
 <Select
 value={selectedBaseClId}
 onChange={(e) => { setSelectedBaseClId(e.target.value); setClUploadFile(null); if (clUploadFileRef.current) clUploadFileRef.current.value = ''; }}
 disabled={!!clUploadFile || isApplyingBaseCl}
 className="w-full px-4 py-3 pr-11 appearance-none bg-elevated border border-theme rounded-xl text-secondary-color disabled:opacity-50"
 >
 <option value="">— choose a saved cover letter —</option>
 {baseCoverLetters.map(cl => (
 <option key={cl._id} value={cl._id}>{cl.displayName}</option>
 ))}
 </Select>
 <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-secondary-color">
 <span className="material-symbols-outlined">expand_more</span>
 </div>
 </div>
 {baseCoverLetters.length === 0 && (
 <p className="text-xs text-muted-color">No saved cover letters yet. You can upload a file above.</p>
 )}
 </div>

 <p className="text-xs text-secondary-color flex items-start gap-1.5">
 <span className="material-symbols-outlined text-base shrink-0">lock</span>
 A full independent copy will be stored for this job. Editing or deleting the original will not affect this application.
 </p>

 {/* Actions */}
 <div className="flex items-center justify-end gap-3 pt-2">
 <Button
 variant="ghost"
 onClick={() => { setClCreationMode('ai'); setApplyClError(null); setClUploadFile(null); setSelectedBaseClId(''); }}
 className="px-5 py-2.5 text-sm"
 >
 Switch to AI Generate
 </Button>
 <Button
 onClick={handleApplyBaseCoverLetter}
 disabled={isApplyingBaseCl || (!selectedBaseClId && !clUploadFile)}
 icon={isApplyingBaseCl ? <Spinner size="sm" /> : <span className="material-symbols-outlined text-base">attach_file</span>}
 >
 Attach to Job
 </Button>
 </div>
 </Card>
 )}

 {/* Option A form: AI Generate */}
 {clCreationMode === 'ai' && (
 <>
 {coverLetterError && (
 <div className="mb-6">
 <ErrorAlert
 message={coverLetterError}
 onDismiss={() => setCoverLetterError(null)}
 />
 </div>
 )}

 <Card padding="none" className="p-8 space-y-8">
 {/* Target Role Section */}
 <div className="space-y-4">
 <div className="flex items-center gap-2 mb-2">
 <span className="material-symbols-outlined" style={{ color: "var(--accent)" }}>work</span>
 <h3 className="text-lg font-bold text-primary-color">Target Role</h3>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div className="space-y-2">
 <label className="block text-sm font-medium text-secondary-color">
 Job Title
 </label>
 <Input
 type="text"
 value={tailoredJobTitle}
 onChange={(e) => setTailoredJobTitle(e.target.value)}
 className="w-full px-4 py-3 bg-elevated border border-theme"
 placeholder="e.g. Senior Product Manager"
 />
 </div>
 <div className="space-y-2">
 <label className="block text-sm font-medium text-secondary-color">
 Company Name
 </label>
 <Input
 type="text"
 value={tailoredCompanyName}
 onChange={(e) => setTailoredCompanyName(e.target.value)}
 className="w-full px-4 py-3 bg-elevated border border-theme"
 placeholder="e.g. Acme Innovations"
 />
 </div>
 </div>
 </div>

 {/* Job Description Section */}
 <div className="space-y-4">
 <div className="flex items-center justify-between mb-2">
 <div className="flex items-center gap-2">
 <span className="material-symbols-outlined" style={{ color: "var(--accent)" }}>description</span>
 <h3 className="text-lg font-bold text-primary-color">Job Description</h3>
 </div>
 </div>
 <div className="relative">
 <Textarea
 value={tailoredJobDescription}
 onChange={(e) => setTailoredJobDescription(e.target.value)}
 className="w-full px-4 py-4 bg-elevated border border-theme min-h-[200px]"
 placeholder="Paste the full job description here... Our AI will analyze key requirements."
 />
 </div>
 </div>

 {/* Base Resume Selection */}
 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
 <div className="space-y-4">
 <div className="flex items-center gap-2 mb-2">
 <span className="material-symbols-outlined" style={{ color: "var(--accent)" }}>folder</span>
 <h3 className="text-lg font-bold text-primary-color">Base Resume</h3>
 </div>
 <div className="relative">
 <Select
 value={selectedClBaseCvId}
 onChange={(e) => handleSelectedClBaseCvIdChange(e.target.value)}
 className="w-full px-4 py-3 pr-11 appearance-none bg-elevated border border-theme rounded-lg text-secondary-color"
 >
 {currentCvId && hasLocalCv && (
 <option value="__job_cv__">📄 This Job's CV (attached)</option>
 )}
 {availableCvs.map(cv => (
 <option key={cv.id} value={cv.id}>{cv.name || 'Unnamed CV'}</option>
 ))}
 {availableCvs.length === 0 && <option value="master">Loading CVs...</option>}
 </Select>
 <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-secondary-color">
 <span className="material-symbols-outlined">expand_more</span>
 </div>
 </div>
 <p className="text-xs text-secondary-color">
 Select the CV version to use for this cover letter.
 </p>
 </div>
 </div>

 {/* Humanize Toggle */}
 <div className="flex items-center gap-3 py-2">
 <button
 type="button"
 role="switch"
 aria-checked={humanize}
 onClick={() => setHumanize(!humanize)}
 className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${humanize ? 'bg-green' : 'bg-[var(--border)]'}`}
 >
 <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${humanize ? 'translate-x-6' : 'translate-x-1'}`} />
 </button>
 <div>
 <p className="text-sm font-medium text-primary-color">Humanize cover letter</p>
 <p className="text-xs text-secondary-color">Runs a second AI pass to make the text sound more natural and less robotic.</p>
 </div>
 </div>

 {/* Custom Instructions */}
 <PromptChecklist
 type="coverLetter"
 onChange={setClCustomInstructions}
 />

 {/* Footer Actions */}
 <div className="mt-8 flex items-center justify-end gap-4">
 <Button
 variant="ghost"
 onClick={() => navigate('/dashboard')}
 className="px-6 py-2.5 text-secondary-color font-medium hover:text-primary-color"
 >
 Cancel
 </Button>
 <Button
 onClick={handleGenerateCoverLetter}
 disabled={isGeneratingCoverLetter || !hasMasterCv || !tailoredJobDescription}
 className="font-semibold shadow-md hover:shadow-lg"
 >
 {isGeneratingCoverLetter ? (
 <>
 <Spinner size="sm" className="text-white" />
 <span>Generating...</span>
 </>
 ) : (
 <>
 <span className="material-symbols-outlined text-white">auto_awesome</span>
 <span>Generate Cover Letter</span>
 <span className="text-[10px] font-bold ml-1 px-1.5 py-0.5 rounded-full" style={{ background: '#e8b844', color: '#0e0e17' }}>3 Credit</span>
 </>
 )}
 </Button>
 </div>

 {!hasMasterCv && (
 <div className="mt-4 text-center">
 <p className="text-sm text-ember">
 ⚠️ You need to upload a CV first. Go to <Link to="/manage-cv" className="underline font-medium">CV Management</Link> to upload it.
 </p>
 </div>
 )}
 </Card>
 </>
 )}
 </div>
 )}
 </div>
 );
};

export default CoverLetterPage;