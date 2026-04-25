// client/src/components/common/PromptChecklist.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
 getPromptChecklists,
 updatePromptChecklists,
 PromptChecklistItem,
} from '../../services/settingsApi';

// ─── Default items ────────────────────────────────────────────────────────────

const DEFAULT_CV_ITEMS: Omit<PromptChecklistItem, 'id'>[] = [
 { text: 'No fabrication — only use information present in the base CV. Do not add skills or experiences not in the original.', enabled: true, isDefault: true },
 { text: 'Keep the length similar to the original CV — do not pad, expand, or add sections.', enabled: true, isDefault: true },
 { text: 'Rewrite descriptions to emphasise relevance and incorporate keywords from the job description.', enabled: true, isDefault: true },
 { text: 'Optimise the order of entries to highlight the most relevant experience first.', enabled: true, isDefault: true },
 { text: 'Do not mention the target company name anywhere in the CV content.', enabled: true, isDefault: true },
];

const DEFAULT_CL_ITEMS: Omit<PromptChecklistItem, 'id'>[] = [
 { text: 'Keep it concise — maximum 250 words.', enabled: true, isDefault: true },
 { text: 'Make it sound natural and personal, not generic or template-like.', enabled: true, isDefault: true },
 { text: 'Focus on relevant skills only — do not repeat the job description.', enabled: true, isDefault: true },
 { text: 'Do not fabricate experience. For anything not clearly in the CV, use phrases like "I am eager to quickly get up to speed with…" rather than implying expertise.', enabled: true, isDefault: true },
 { text: 'No Markdown formatting, no bullet points, no bold or italic text.', enabled: true, isDefault: true },
 { text: 'No contact-info header or date — begin directly with the salutation.', enabled: true, isDefault: true },
 { text: 'No emojis.', enabled: true, isDefault: true },
];

function makeId(): string {
 return typeof crypto !== 'undefined' && crypto.randomUUID
 ? crypto.randomUUID()
 : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function buildDefaults(type: 'cv' | 'coverLetter'): PromptChecklistItem[] {
 const base = type === 'cv' ? DEFAULT_CV_ITEMS : DEFAULT_CL_ITEMS;
 return base.map(item => ({ ...item, id: makeId() }));
}

function assembleText(items: PromptChecklistItem[]): string {
 return items
 .filter(i => i.enabled)
 .map(i => `- ${i.text}`)
 .join('\n');
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PromptChecklistProps {
 type: 'cv' | 'coverLetter';
 onChange: (assembledText: string) => void;
}

const PromptChecklist: React.FC<PromptChecklistProps> = ({ type, onChange }) => {
 const [items, setItems] = useState<PromptChecklistItem[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [isExpanded, setIsExpanded] = useState(false);
 const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
 const [newItemText, setNewItemText] = useState('');
 const [editingId, setEditingId] = useState<string | null>(null);
 const [editingText, setEditingText] = useState('');
 const editInputRef = useRef<HTMLTextAreaElement>(null);
 const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 // ── load from DB once ──────────────────────────────────────────────────
 useEffect(() => {
 let cancelled = false;
 setIsLoading(true);
 getPromptChecklists()
 .then(checklists => {
 if (cancelled) return;
 const saved = type === 'cv' ? checklists.cv : checklists.coverLetter;
 const resolved = (saved && saved.length > 0) ? saved : buildDefaults(type);
 setItems(resolved);
 onChange(assembleText(resolved));
 })
 .catch(() => {
 if (cancelled) return;
 const defaults = buildDefaults(type);
 setItems(defaults);
 onChange(assembleText(defaults));
 })
 .finally(() => { if (!cancelled) setIsLoading(false); });
 return () => { cancelled = true; };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [type]);

 // focus edit input when editing starts
 useEffect(() => {
 if (editingId && editInputRef.current) {
 editInputRef.current.focus();
 const len = editInputRef.current.value.length;
 editInputRef.current.setSelectionRange(len, len);
 }
 }, [editingId]);

 // ── debounced save to DB ───────────────────────────────────────────────
 const scheduleSave = useCallback((nextItems: PromptChecklistItem[]) => {
 if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
 setSaveStatus('saving');
 saveTimerRef.current = setTimeout(async () => {
 try {
 const payload = type === 'cv' ? { cv: nextItems } : { coverLetter: nextItems };
 await updatePromptChecklists(payload);
 setSaveStatus('saved');
 setTimeout(() => setSaveStatus('idle'), 1500);
 } catch {
 setSaveStatus('error');
 }
 }, 600);
 }, [type]);

 // ── helpers ───────────────────────────────────────────────────────────
 const applyChange = useCallback((nextItems: PromptChecklistItem[]) => {
 setItems(nextItems);
 onChange(assembleText(nextItems));
 scheduleSave(nextItems);
 }, [onChange, scheduleSave]);

 const toggleItem = (id: string) => {
 applyChange(items.map(i => i.id === id ? { ...i, enabled: !i.enabled } : i));
 };

 const deleteItem = (id: string) => {
 applyChange(items.filter(i => i.id !== id));
 };

 const startEdit = (item: PromptChecklistItem) => {
 setEditingId(item.id);
 setEditingText(item.text);
 };

 const commitEdit = () => {
 if (!editingId) return;
 const trimmed = editingText.trim();
 if (trimmed) {
 applyChange(items.map(i => i.id === editingId ? { ...i, text: trimmed } : i));
 }
 setEditingId(null);
 setEditingText('');
 };

 const addItem = () => {
 const trimmed = newItemText.trim();
 if (!trimmed) return;
 const newItem: PromptChecklistItem = { id: makeId(), text: trimmed, enabled: true, isDefault: false };
 setNewItemText('');
 applyChange([...items, newItem]);
 };

 const resetToDefaults = () => {
 if (!window.confirm('Reset to default instructions? Your customisations will be lost.')) return;
 const defaults = buildDefaults(type);
 applyChange(defaults);
 };

 // ── render ─────────────────────────────────────────────────────────────
 if (isLoading) {
 return (
 <div className="flex items-center gap-2 py-4 text-muted-color text-sm">
 <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
 </svg>
 Loading instructions…
 </div>
 );
 }

 const enabledCount = items.filter(i => i.enabled).length;

 return (
 <div className="space-y-3">
 {/* Header row */}
 <div className="flex items-center justify-between">
 <button
 type="button"
 onClick={() => setIsExpanded(prev => !prev)}
 className="inline-flex items-center gap-2 text-left"
 aria-expanded={isExpanded}
 >
<span className="material-symbols-outlined text-base text-secondary-color">
  {isExpanded ? 'expand_less' : 'expand_more'}
  </span>
  <span className="text-sm font-semibold text-primary-color">
  Custom Instructions
  </span>
  <span className="text-xs text-muted-color">
 ({enabledCount} of {items.length} active)
 </span>
 </button>
 <div className="flex items-center gap-2">
 {isExpanded && saveStatus === 'saving' && (
 <span className="text-xs text-muted-color flex items-center gap-1">
 <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
 </svg>
 Saving…
 </span>
 )}
 {isExpanded && saveStatus === 'saved' && (
 <span className="text-xs text-green flex items-center gap-1">
 <span className="material-symbols-outlined text-sm">check</span>
 Saved
 </span>
 )}
 {isExpanded && saveStatus === 'error' && (
 <span className="text-xs text-error">Save failed</span>
 )}
 {isExpanded && (
 <button
 type="button"
 onClick={resetToDefaults}
 className="text-xs text-muted-color hover:text-secondary-color transition-colors underline underline-offset-2"
 title="Reset to default instructions"
 >
 Reset defaults
 </button>
 )}
 </div>
 </div>

 {/* Checklist */}
 {isExpanded && (
 <>
 <div className="rounded-xl border border-theme divide-y overflow-hidden" style={{ '--tw-divide-color': 'var(--border)' } as React.CSSProperties}>
 {items.map(item => (
 <div
 key={item.id}
 className={`flex items-start gap-3 px-4 py-3 transition-colors ${
 item.enabled
? 'bg-white'
    : ''}`}
  style={!item.enabled ? { background: 'var(--bg-elevated)' } : undefined}
 >
 {/* Checkbox */}
 <button
 type="button"
 onClick={() => toggleItem(item.id)}
 className={`mt-0.5 shrink-0 flex items-center justify-center w-5 h-5 rounded border-2 transition-all ${
 item.enabled
 ? 'text-green-house border-transparent'
 : 'border-theme bg-white'
 }`}
 style={item.enabled ? { background: 'var(--accent)' } : {}}
 aria-checked={item.enabled}
 role="checkbox"
 >
 {item.enabled && (
 <span className="material-symbols-outlined text-[13px]">check</span>
 )}
 </button>

 {/* Text — viewing or editing */}
 <div className="flex-1 min-w-0">
 {editingId === item.id ? (
 <textarea
 ref={editInputRef}
 value={editingText}
 onChange={e => setEditingText(e.target.value)}
 onBlur={commitEdit}
 onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); } if (e.key === 'Escape') { setEditingId(null); } }}
 rows={2}
 className="w-full text-sm rounded-lg px-2 py-1 text-primary-color resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 border" style={{ background: 'var(--accent-bg)', borderColor: 'var(--accent-dim)' }}
 />
 ) : (
 <span
 className={`text-sm cursor-text select-none block ${
 item.enabled
? 'text-primary-color'
  : 'text-muted-color line-through'
 }`}
 onClick={() => startEdit(item)}
 title="Click to edit"
 >
 {item.text}
 </span>
 )}
 </div>

 {/* Edit / Delete actions */}
 <div className="shrink-0 flex items-center gap-1 ml-1">
 {editingId !== item.id && (
 <button
 type="button"
 onClick={() => startEdit(item)}
 className="p-1 text-muted-color hover:text-gold transition-colors rounded"
 title="Edit"
 >
 <span className="material-symbols-outlined text-base">edit</span>
 </button>
 )}
 <button
 type="button"
 onClick={() => deleteItem(item.id)}
 className="p-1 text-muted-color hover:text-error transition-colors rounded"
 title="Remove instruction"
 >
 <span className="material-symbols-outlined text-base">close</span>
 </button>
 </div>
 </div>
 ))}

 {/* Add new item row */}
<div className="flex items-center gap-2 px-4 py-3" style={{ background: 'var(--bg-elevated)' }}>
  <span className="material-symbols-outlined text-base text-muted-color shrink-0">add</span>
 <input
 type="text"
 value={newItemText}
 onChange={e => setNewItemText(e.target.value)}
 onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
 placeholder="Add a custom instruction…"
 className="flex-1 text-sm bg-transparent border-none outline-none text-secondary-color placeholder-muted-color"
 />
 {newItemText.trim() && (
 <button
 type="button"
 onClick={addItem}
 className="text-xs font-medium text-gold hover:text-gold-800 transition-colors whitespace-nowrap"
 >
 Add
 </button>
 )}
 </div>
 </div>

 <p className="text-xs text-muted-color">
 Check items to include them in the AI prompt. Click any item to edit its text. Changes are saved automatically.
 </p>
 </>
 )}
 </div>
 );
};

export default PromptChecklist;
