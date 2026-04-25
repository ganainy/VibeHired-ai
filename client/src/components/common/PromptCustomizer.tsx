import React, { useState, useEffect } from 'react';
import {
 getCustomPrompts,
 updateCustomPrompts,
 CustomPrompts,
 getPromptTemplates,
 updatePromptTemplates,
 PromptTemplate
} from '../../services/settingsApi';
import { Button } from './index';

interface PromptCustomizerProps {
 type: 'cv' | 'coverLetter';
 defaultPrompt: string;
 onPromptChange?: (prompt: string | null) => void;
}

const PromptCustomizer: React.FC<PromptCustomizerProps> = ({
 type,
 defaultPrompt,
 onPromptChange,
}) => {
 const [isExpanded, setIsExpanded] = useState(false);
 const [customPrompt, setCustomPrompt] = useState<string>('');
 const [isLoading, setIsLoading] = useState(false);
 const [isSaving, setIsSaving] = useState(false);
 const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
 const [useCustom, setUseCustom] = useState(false);

 // Template State
 const [templates, setTemplates] = useState<PromptTemplate[]>([]);
 const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
 const [newTemplateName, setNewTemplateName] = useState('');
 const [showSaveTemplateInput, setShowSaveTemplateInput] = useState(false);
 const [isSavingTemplate, setIsSavingTemplate] = useState(false);

 useEffect(() => {
 const loadData = async () => {
 setIsLoading(true);
 try {
 const [prompts, fetchedTemplates] = await Promise.all([
 getCustomPrompts(),
 getPromptTemplates()
 ]);

 // Filter templates by type
 const relevantTemplates = fetchedTemplates.filter(t => t.type === type);
 setTemplates(relevantTemplates);

 const savedPrompt = type === 'cv' ? prompts.cvPrompt : prompts.coverLetterPrompt;

 if (savedPrompt) {
 setCustomPrompt(savedPrompt);
 setUseCustom(true);
 onPromptChange?.(savedPrompt);

 // Try to match with an existing template
 const matchingTemplate = relevantTemplates.find(t => t.content === savedPrompt);
 if (matchingTemplate) {
 setSelectedTemplateId(matchingTemplate.id);
 }
 } else {
 setCustomPrompt(defaultPrompt);
 setUseCustom(false);
 onPromptChange?.(null);
 }
 } catch (error) {
 console.error('Error loading data:', error);
 setCustomPrompt(defaultPrompt);
 } finally {
 setIsLoading(false);
 }
 };

 if (isExpanded) {
 loadData();
 }
 }, [type, defaultPrompt, onPromptChange, isExpanded]);

 const handleSave = async () => {
 setIsSaving(true);
 setSaveStatus('idle');
 try {
 const updateData: Partial<CustomPrompts> = {};
 if (type === 'cv') {
 updateData.cvPrompt = useCustom ? customPrompt : null;
 } else {
 updateData.coverLetterPrompt = useCustom ? customPrompt : null;
 }
 await updateCustomPrompts(updateData);
 onPromptChange?.(useCustom ? customPrompt : null);
 setSaveStatus('saved');
 setTimeout(() => setSaveStatus('idle'), 2000);
 } catch (error) {
 console.error('Error saving prompt:', error);
 setSaveStatus('error');
 setTimeout(() => setSaveStatus('idle'), 3000);
 } finally {
 setIsSaving(false);
 }
 };

 const handleReset = () => {
 setCustomPrompt(defaultPrompt);
 setUseCustom(false);
 setSelectedTemplateId('');
 };

 const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
 const id = e.target.value;
 setSelectedTemplateId(id);

 if (id === 'default') {
 setCustomPrompt(defaultPrompt);
 // Don't disable custom mode automatically, let user decide if they want to save default as custom setting
 // but usually selecting default means resetting. 
 // setUseCustom(false); // Let's not force this, user might want to edit default.
 } else {
 const template = templates.find(t => t.id === id);
 if (template) {
 setCustomPrompt(template.content);
 setUseCustom(true);
 }
 }
 };

 const handleSaveTemplate = async () => {
 if (!newTemplateName.trim()) return;

 setIsSavingTemplate(true);
 try {
 const newTemplate: PromptTemplate = {
 id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2),
 name: newTemplateName,
 type: type,
 content: customPrompt,
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString()
 };

 const updatedTemplates = [...templates, newTemplate];

 // We need to fetch ALL templates to update (merged list)
 // But efficiently we just assume we add to the list of THIS type.
 // However, the API expects the FULL list of templates (replace all).
 // So we should really fetch fresh, append, and save, OR rely on what we have + filter.
 // The safest is to get all current templates first.
 const allTemplates = await getPromptTemplates();
 const newAllTemplates = [...allTemplates, newTemplate];

 await updatePromptTemplates(newAllTemplates);

 // Update local state
 setTemplates(prev => [...prev, newTemplate]);
 setSelectedTemplateId(newTemplate.id);
 setNewTemplateName('');
 setShowSaveTemplateInput(false);
 } catch (error) {
 console.error('Error saving template:', error);
 } finally {
 setIsSavingTemplate(false);
 }
 };

 const handleDeleteTemplate = async () => {
 if (!selectedTemplateId || selectedTemplateId === 'default') return;

 if (!confirm('Are you sure you want to delete this template?')) return;

 try {
 // Get all, remove one, save
 const allTemplates = await getPromptTemplates();
 const newAllTemplates = allTemplates.filter(t => t.id !== selectedTemplateId);
 await updatePromptTemplates(newAllTemplates);

 setTemplates(prev => prev.filter(t => t.id !== selectedTemplateId));
 setSelectedTemplateId('');
 } catch (error) {
 console.error('Error deleting template:', error);
 }
 };

 const handleUpdateTemplate = async () => {
 if (!selectedTemplateId || selectedTemplateId === 'default') return;

 setIsSavingTemplate(true);
 try {
 const timestamp = new Date().toISOString();

 // Optimistic update local state
 setTemplates(prev => prev.map(t =>
 t.id === selectedTemplateId
 ? { ...t, content: customPrompt, updatedAt: timestamp }
 : t
 ));

 // Update on server
 const allTemplates = await getPromptTemplates();
 const newAllTemplates = allTemplates.map(t =>
 t.id === selectedTemplateId
 ? { ...t, content: customPrompt, updatedAt: timestamp }
 : t
 );

 await updatePromptTemplates(newAllTemplates);
 } catch (error) {
 console.error('Error updating template:', error);
 } finally {
 setIsSavingTemplate(false);
 }
 };

 const label = type === 'cv' ? 'CV Generation' : 'Cover Letter Generation';

 return (
 <div className="mb-4">
 <button
 onClick={() => setIsExpanded(!isExpanded)}
 className="flex items-center gap-2 text-sm font-medium text-secondary-color hover:text-primary-color transition-colors"
 >
 <svg
 className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
 </svg>
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
 </svg>
 <span>Customize {label} Prompt</span>
 {useCustom && (
 <span className="px-2 py-0.5 text-xs font-medium rounded-full text-green-house" style={{background:"var(--accent)"}}>
 Custom
 </span>
 )}
 </button>

 {isExpanded && (
<div className="mt-3 p-4 rounded-lg border border-theme" style={{ background: 'var(--bg-elevated)' }}>
  {isLoading ? (
  <div className="flex items-center justify-center py-8">
  <svg className="animate-spin h-5 w-5 text-muted-color" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 </div>
 ) : (
 <>
 <div className="flex flex-col gap-3 mb-3">
 <div className="flex items-center justify-between">
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="checkbox"
 checked={useCustom}
 onChange={(e) => setUseCustom(e.target.checked)}
className="w-4 h-4 accent-gold border-theme rounded"
  />
  <span className="text-sm text-secondary-color">Use custom prompt</span>
 </label>

 <div className="flex items-center gap-2">
 <select
 value={selectedTemplateId}
 onChange={handleTemplateChange}
 disabled={!useCustom}
 className="text-sm border-theme rounded-md shadow-sm focus:border-gold focus:ring focus:ring-gold-lightest focus:ring-opacity-50"
 >
 <option value="">-- Select Template --</option>
 <option value="default">Default System Prompt</option>
 {templates.map(t => (
 <option key={t.id} value={t.id}>{t.name}</option>
 ))}
 </select>

 {selectedTemplateId && selectedTemplateId !== 'default' && (
 <button
 onClick={handleDeleteTemplate}
 className="p-1 text-error hover:text-error transition-colors"
 title="Delete Template"
 >
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
 </svg>
 </button>
 )}
 </div>
 </div>

 {useCustom && (
 <div className="flex items-center justify-end gap-2">
 {selectedTemplateId && selectedTemplateId !== 'default' && !showSaveTemplateInput && (
 <button
 onClick={handleUpdateTemplate}
 disabled={isSavingTemplate}
 className="text-xs text-gold hover:text-gold-800 mr-2"
 >
 Update Template
 </button>
 )}
 {!showSaveTemplateInput ? (
 <button
 onClick={() => setShowSaveTemplateInput(true)}
 className="text-xs text-gold hover:text-gold-800"
 >
 + Save as new template
 </button>
 ) : (
 <div className="flex items-center gap-2">
 <input
 type="text"
 value={newTemplateName}
 onChange={(e) => setNewTemplateName(e.target.value)}
 placeholder="Template Name"
 className="text-xs px-2 py-1 border rounded"
 />
 <button
 onClick={handleSaveTemplate}
 disabled={isSavingTemplate || !newTemplateName.trim()}
 className="text-xs px-2 py-1 rounded disabled:opacity-50" style={{background:"var(--accent-bg)", color:"var(--accent)"}}
 >
 {isSavingTemplate ? 'Saving...' : 'Save'}
 </button>
 <button
 onClick={() => setShowSaveTemplateInput(false)}
 className="text-xs text-muted-color hover:text-secondary-color"
 >
 Cancel
 </button>
 </div>
 )}
 </div>
 )}
 </div>

 <textarea
 value={customPrompt}
 onChange={(e) => {
 setCustomPrompt(e.target.value);
 if (selectedTemplateId) {
 // If user edits a selected template, strictly speaking it's no longer that template
 // But we can keep it selected to allow "update" if we implemented that. 
 // For now, let's keep it simple.
 }
 }}
 disabled={!useCustom}
 placeholder="Enter your custom prompt here..."
 className="w-full h-48 px-3 py-2 text-sm font-mono text-primary-color bg-white border border-theme rounded-lg focus:ring-2 focus:ring-gold/50 focus:border-gold disabled:opacity-50 disabled:cursor-not-allowed resize-y"
 />

 <div className="flex items-center justify-between mt-3">
 <button
 onClick={handleReset}
 disabled={!useCustom}
 className="text-sm text-muted-color hover:text-secondary-color disabled:opacity-50 disabled:cursor-not-allowed"
 >
 Reset to default
 </button>

 <div className="flex items-center gap-3">
 {saveStatus === 'saved' && (
 <span className="text-sm text-green flex items-center gap-1">
 <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
 </svg>
 Saved
 </span>
 )}
 {saveStatus === 'error' && (
 <span className="text-sm text-error">Failed to save</span>
 )}
 <Button
 onClick={handleSave}
 disabled={isSaving}
 className="rounded-lg flex items-center gap-2"
 >
 {isSaving ? (
 <>
 <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
 </svg>
 <span>Saving...</span>
 </>
 ) : (
 <span>Save & Apply Prompt</span>
 )}
 </Button>
 </div>
 </div>

 <p className="mt-3 text-xs text-muted-color">
 Tip: The prompt will be used when generating the {label.toLowerCase()}.
 Variables like job description and CV data are automatically included.
 </p>
 </>
 )}
 </div>
 )}
 </div>
 );
};

export default PromptCustomizer;
