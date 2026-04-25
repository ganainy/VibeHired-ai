import React, { useState, useEffect } from 'react';
import {
 getPromptTemplates,
 updatePromptTemplates,
 PromptTemplate
} from '../../services/settingsApi';
import { Button } from './index';
import Spinner from './Spinner';

interface PromptTemplateSelectorProps {
 type: 'cv' | 'coverLetter';
 value: string;
 onChange: (value: string) => void;
 onTemplateSelect?: (id: string) => void;
 label?: string;
 placeholder?: string;
 defaultContent?: string;
 defaultSystemPrompt?: string;
 defaultUserPrompt?: string;
}

export const PromptTemplateSelector: React.FC<PromptTemplateSelectorProps> = ({
 type,
 value,
 onChange,
 onTemplateSelect,
 label = "Custom Instructions",
 placeholder = "Enter your instructions here...",
 defaultContent = "",
 defaultSystemPrompt,
 defaultUserPrompt
}) => {
 const [templates, setTemplates] = useState<PromptTemplate[]>([]);
 const [selectedTemplateId, setSelectedTemplateId] = useState<string>('default-system');
 const [isLoading, setIsLoading] = useState(false);
 const [isSaving, setIsSaving] = useState(false);

 // UI states for saving/naming
 const [showSaveInput, setShowSaveInput] = useState(false);
 const [newTemplateName, setNewTemplateName] = useState('');
 
 // State for prompt preview modal
 const [showPromptModal, setShowPromptModal] = useState(false);

 // Toggle for collapsing
 const [isOpen, setIsOpen] = useState(false);

 useEffect(() => {
 loadTemplates();
 }, [type]);

 const loadTemplates = async () => {
 setIsLoading(true);
 try {
 const allTemplates = await getPromptTemplates();
 setTemplates(allTemplates.filter(t => t.type === type));
 } catch (error) {
 console.error('Failed to load templates', error);
 } finally {
 setIsLoading(false);
 }
 };

 const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
 const id = e.target.value;
 setSelectedTemplateId(id);
 onTemplateSelect?.(id);

 if (id === 'default-system') {
 onChange(defaultContent);
 } else if (id === 'default-user') {
 onChange(defaultUserPrompt || defaultContent);
 } else if (id) {
 const template = templates.find(t => t.id === id);
 if (template) {
 onChange(template.content);
 }
 }
 };

 const handleSaveNewTemplate = async () => {
 if (!newTemplateName.trim() || !value.trim()) return;

 setIsSaving(true);
 try {
 const newTemplate: PromptTemplate = {
 id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2),
 name: newTemplateName,
 type,
 content: value,
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString()
 };

 const allTemplates = await getPromptTemplates();
 const updatedAll = [...allTemplates, newTemplate];
 await updatePromptTemplates(updatedAll);

 setTemplates(prev => [...prev, newTemplate]);
 setSelectedTemplateId(newTemplate.id);
 onTemplateSelect?.(newTemplate.id);
 setShowSaveInput(false);
 setNewTemplateName('');
 } catch (error) {
 console.error('Failed to save template', error);
 } finally {
 setIsSaving(false);
 }
 };

 const handleUpdateTemplate = async () => {
 if (!selectedTemplateId) return;
 setIsSaving(true);
 try {
 const allTemplates = await getPromptTemplates();
 const updatedAll = allTemplates.map(t => {
 if (t.id === selectedTemplateId) {
 return { ...t, content: value, updatedAt: new Date().toISOString() };
 }
 return t;
 });
 await updatePromptTemplates(updatedAll);

 // Update local state
 setTemplates(prev => prev.map(t =>
 t.id === selectedTemplateId ? { ...t, content: value } : t
 ));
 } catch (error) {
 console.error('Failed to update template', error);
 } finally {
 setIsSaving(false);
 }
 };

 const handleDeleteTemplate = async () => {
 if (!selectedTemplateId || !confirm('Are you sure?')) return;
 setIsSaving(true);
 try {
 const allTemplates = await getPromptTemplates();
 const updatedAll = allTemplates.filter(t => t.id !== selectedTemplateId);
 await updatePromptTemplates(updatedAll);

 setTemplates(prev => prev.filter(t => t.id !== selectedTemplateId));
 setSelectedTemplateId('');
 onTemplateSelect?.('');
 onChange(''); // Optional: clear input after delete?
 } catch (error) {
 console.error('Failed to delete template', error);
 } finally {
 setIsSaving(false);
 }
 };

 // Get the content to display in the modal based on selected template
 const getPromptContent = () => {
 if (selectedTemplateId === 'default-system') {
 return defaultSystemPrompt || defaultContent;
 } else if (selectedTemplateId === 'default-user') {
 return defaultUserPrompt || defaultContent;
 } else if (selectedTemplateId) {
 const template = templates.find(t => t.id === selectedTemplateId);
 return template?.content || '';
 }
 return '';
 };

 const getTemplateName = () => {
 if (selectedTemplateId === 'default-system') {
 return 'Default System Prompt';
 } else if (selectedTemplateId === 'default-user') {
 return 'Default User Prompt';
 } else if (selectedTemplateId) {
 return templates.find(t => t.id === selectedTemplateId)?.name || 'Unknown Template';
 }
 return 'No template selected';
 };

 return (
 <div className="w-full">
 <div 
 className="flex items-center justify-between cursor-pointer group hover:bg-gold-50 p-2 -mx-2 rounded-lg transition-colors mb-2"
 onClick={() => setIsOpen(!isOpen)}
 >
 <div className="flex items-center gap-2">
 <span className="material-symbols-outlined" style={{color:"var(--accent)"}}>tune</span>
<h3 className="text-lg font-bold text-primary-color transition-colors">{label}</h3>
  <span className={`material-symbols-outlined text-muted-color transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
 expand_more
 </span>
 </div>

 {!isOpen && selectedTemplateId && (
 <div className="text-xs font-medium flex items-center gap-1.5 opacity-80 group-hover:opacity-100" style={{color:"var(--accent)"}}>
 <span className="material-symbols-outlined text-xs">info</span>
 {getTemplateName()}
 </div>
 )}
 </div>

 {isOpen && (
 <div className="space-y-3 pt-1">
 {/* Template Controls */}
 <div className="flex items-center justify-end gap-2">
 {isLoading ? (
 <Spinner size="sm" />
 ) : (
 <>
 <div className="relative flex items-center">
 {!selectedTemplateId && (
 <div className="mr-2 flex items-center text-ember animate-pulse" title="Please select a template to proceed">
 <span className="material-symbols-outlined text-xl">warning</span>
 </div>
 )}
 <select
 value={selectedTemplateId}
 onChange={handleTemplateChange}
 onClick={(e) => e.stopPropagation()}
 className={`text-sm border-theme rounded-lg shadow-sm focus:border-gold focus:ring-gold bg-white text-primary-color py-1.5 pl-3 pr-10 ${!selectedTemplateId ? 'border-[var(--ember)] ring-1 ring-amber-300' : ''
 }`}
 >
 <option value="">Select a template...</option>
 <option value="default-system">Default System Prompt</option>
 {defaultUserPrompt && <option value="default-user">Default User Prompt</option>}
 {templates.map(t => (
 <option key={t.id} value={t.id}>{t.name}</option>
 ))}
 </select>
 </div>

 {selectedTemplateId && (
 <div className="flex items-center gap-1">
 <button
 onClick={(e) => { e.stopPropagation(); handleUpdateTemplate(); }}
 disabled={isSaving}
 className="p-1.5 text-green-house hover:bg-elevated rounded"
 title="Update selected template with current text"
 >
 <span className="material-symbols-outlined text-lg">save</span>
 </button>
 <button
 onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(); }}
 disabled={isSaving}
 className="p-1.5 text-error hover:bg-red-50 rounded"
 title="Delete template"
 >
 <span className="material-symbols-outlined text-lg">delete</span>
 </button>
 </div>
 )}
 </>
 )}
 </div>

 <div className="p-4 rounded-lg border" style={{background:"var(--accent-bg)", borderColor:"var(--accent-dim)"}}>
 <textarea
 value={value}
 onChange={(e) => onChange(e.target.value)}
 className="w-full bg-transparent border-0 p-0 text-secondary-color placeholder-muted-color focus:ring-0 text-sm resize-y min-h-[80px]"
 placeholder={placeholder}
 rows={3}
 />

 <div className="flex justify-between items-center mt-2 pt-2 border-t" style={{borderColor:"var(--accent-dim)"}}>
 <button
 type="button"
 onClick={() => selectedTemplateId && setShowPromptModal(true)}
 disabled={!selectedTemplateId}
 className={`text-xs font-medium flex items-center gap-1 ${
 selectedTemplateId 
 ? 'text-gold hover:text-gold-800 cursor-pointer underline underline-offset-2' 
 : 'text-muted-color cursor-not-allowed'
 }`}
 title={selectedTemplateId ? 'Click to view full prompt' : 'No template selected'}
 >
 <span className="material-symbols-outlined text-sm">visibility</span>
 Active Template: {getTemplateName()}
 </button>

 {!showSaveInput ? (
 <button
 onClick={() => setShowSaveInput(true)}
 className="text-xs flex items-center gap-1 text-gold-dark hover:text-gold-900"
 >
 <span className="material-symbols-outlined text-sm">add</span>
 Save as new template
 </button>
 ) : (
 <div className="flex items-center gap-2">
 <input
 type="text"
 value={newTemplateName}
 onChange={(e) => setNewTemplateName(e.target.value)}
 placeholder="Template name"
 className="text-xs px-2 py-1 rounded border focus:outline-none" style={{borderColor:"var(--accent-dim)"}}
 />
 <button
 onClick={handleSaveNewTemplate}
 disabled={isSaving || !newTemplateName}
 className="text-xs px-2 py-1 rounded disabled:opacity-50 text-green-house" style={{background:"var(--accent)"}}
 >
 Save
 </button>
 <button
 onClick={() => setShowSaveInput(false)}
 className="text-xs text-muted-color hover:text-secondary-color"
 >
 Cancel
 </button>
 </div>
 )}
 </div>
 </div>
 </div>
 )}

 {/* Prompt Preview Modal */}
 {showPromptModal && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
<div className="w-full max-w-4xl max-h-[80vh] bg-white rounded-xl shadow-2xl overflow-hidden border border-theme">
  <div className="flex items-center justify-between p-4 border-b border-theme">
  <div className="flex items-center gap-2">
  <span className="material-symbols-outlined" style={{color:"var(--accent)"}}>description</span>
  <h3 className="text-lg font-semibold text-primary-color">
 {getTemplateName()}
 </h3>
 </div>
 <button
 onClick={() => setShowPromptModal(false)}
 className="p-2 text-muted-color hover:text-secondary-color rounded-lg hover:bg-[var(--bg-elevated)] transition-colors"
 >
 <span className="material-symbols-outlined">close</span>
 </button>
 </div>
 <div className="p-4 overflow-auto max-h-[calc(80vh-80px)]">
 <pre className="whitespace-pre-wrap text-sm text-secondary-color font-mono p-4 rounded-lg border border-theme" style={{ background: 'var(--bg-elevated)' }}>
 {getPromptContent()}
 </pre>
 </div>
 <div className="flex justify-end p-4 border-t border-theme">
 <Button onClick={() => setShowPromptModal(false)}>
 Close
 </Button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};
