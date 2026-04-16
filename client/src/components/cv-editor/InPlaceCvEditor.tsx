import React, { useState, useRef, useEffect, MouseEvent } from 'react';
import FreeformCvRenderer from '../cv-freeform/FreeformCvRenderer';
import { FreeformJsonObject, setValueAtPath, removeValueAtPath, getUiTagForPath, deepClone, appendArrayItem, VIBEHIRED_TAGS_KEY, renameObjectKeyAtPath } from '../cv-freeform/freeformUtils';
import { Button } from '../common';

interface InPlaceCvEditorProps {
  value: FreeformJsonObject;
  onChange?: (next: FreeformJsonObject) => void;
  className?: string;
  readonly?: boolean;
}

interface EditingState {
  path: string; // dot separated path
  tag: string;
  isKey?: boolean;
  rect: DOMRect;
  initialValue: string;
  currentValue: string;
}

const AVAILABLE_TAGS = [
  { value: 'name', label: 'Name' },
  { value: 'title', label: 'Title' },
  { value: 'subtitle', label: 'Subtitle' },
  { value: 'date', label: 'Date/Date Range' },
  { value: 'location', label: 'Location' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'URL/Link' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'bullets', label: 'Bullet Points' },
  { value: 'key_value', label: 'Key-Value' },
];

export const InPlaceCvEditor: React.FC<InPlaceCvEditorProps> = ({ value, onChange, className = '', readonly = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);

  const handleContainerClick = (e: MouseEvent) => {
    if (readonly) return;
    
    // Check if we clicked inside the floating editor, ignore if so
    if ((e.target as Element).closest('#inplace-editor-overlay')) {
      return;
    }

    const target = (e.target as Element).closest('[data-path]');
    if (target) {
      const pathStr = target.getAttribute('data-path');
      const tagStr = target.getAttribute('data-tag') || '';
      const isKey = target.getAttribute('data-is-key') === 'true';
      
      if (!pathStr) return;
      
      const rect = target.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      
      if (!containerRect) return;
      
      // Calculate relative to the container
      const relativeRect = new DOMRect(
        rect.left - containerRect.left + containerRef.current!.scrollLeft,
        rect.top - containerRect.top + containerRef.current!.scrollTop,
        rect.width,
        rect.height
      );

      // Extract the current value from the CV data
      const pathParts = pathStr.split('.');
      let val;
      if (isKey) {
        val = pathParts[pathParts.length - 1];
      } else {
        val = pathParts.reduce((acc: any, part) => acc?.[part], value);
      }
      
      setEditing({
        path: pathStr,
        tag: tagStr,
        isKey,
        rect: relativeRect,
        initialValue: typeof val === 'string' ? val : String(val || ''),
        currentValue: typeof val === 'string' ? val : String(val || ''),
      });
    } else {
      setEditing(null);
    }
  };

  const handleSave = () => {
    if (!editing) return;
    
    // Commit changes
    const pathParts = editing.path.split('.');
    
    // Check for auto-split: text changed from paragraph to bullets, and contains newlines
    let nextValue = deepClone(value);
    
    if (editing.isKey) {
      if (editing.currentValue.trim() !== editing.initialValue.trim()) {
         const parentPath = pathParts.slice(0, -1);
         const oldKey = pathParts[pathParts.length - 1];
         nextValue = renameObjectKeyAtPath(nextValue, parentPath, oldKey, editing.currentValue);
         
         // Update the key in __vh_tags if needed
         if (nextValue[VIBEHIRED_TAGS_KEY]) {
             const tagsMap = nextValue[VIBEHIRED_TAGS_KEY] as Record<string, string>;
             const newTagsMap: Record<string, string> = {};
             
             // If a path prefix matches the old path, rename it
             const oldPathPrefix = pathParts.join('.');
             const newPathPrefix = [...parentPath, editing.currentValue.trim()].join('.');
             
             for (const [k, v] of Object.entries(tagsMap)) {
                 if (k === oldPathPrefix) {
                     newTagsMap[newPathPrefix] = v;
                 } else if (k.startsWith(oldPathPrefix + '.')) {
                     newTagsMap[newPathPrefix + k.substring(oldPathPrefix.length)] = v;
                 } else {
                     newTagsMap[k] = v;
                 }
             }
             nextValue[VIBEHIRED_TAGS_KEY] = newTagsMap;
         }
      }
    } else {
      if (editing.tag === 'bullets') {
        if (editing.currentValue.includes('\n')) {
            const parts = editing.currentValue.split('\n').filter(s => s.trim());
            nextValue = setValueAtPath(nextValue, pathParts, parts);
        } else {
            // Even if no newline, a bullet tag should enforce array structure if it isn't one.
            nextValue = setValueAtPath(nextValue, pathParts, [editing.currentValue.trim()]);
        }
      } else {
        nextValue = setValueAtPath(nextValue, pathParts, editing.currentValue);
      }
    }

    // Update tags if changed (apply for both keys and values since the tag belongs to the path)
    if (!nextValue[VIBEHIRED_TAGS_KEY]) nextValue[VIBEHIRED_TAGS_KEY] = {};
    const tagsMap = nextValue[VIBEHIRED_TAGS_KEY] as Record<string, string>;
    
    // We already handled path renaming for keys above, so if it was a key rename, 
    // the new path is now newPathPrefix, otherwise it's just pathParts.
    const effectivePathParts = editing.isKey && editing.currentValue.trim() !== editing.initialValue.trim() 
        ? [...pathParts.slice(0, -1), editing.currentValue.trim()] 
        : pathParts;
        
    const oldTag = getUiTagForPath(value, pathParts);
    if (oldTag !== editing.tag) {
      const pathForTags = effectivePathParts.map(p => isNaN(Number(p)) ? p : '*').join('.');
      if (editing.tag) {
          tagsMap[pathForTags] = editing.tag;
      } else {
          delete tagsMap[pathForTags];
      }
    }

    if (onChange) onChange(nextValue);
    setEditing(null);
  };

  return (
    <div ref={containerRef} className={`relative group ${className}`} onClick={handleContainerClick}>
      {!readonly && (
        <style>{`
          .inplace-container [data-path] {
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
            outline: 2px solid transparent;
            outline-offset: 2px;
          }
          .inplace-container [data-path]:hover {
            outline-color: var(--accent);
            background-color: var(--accent-bg);
            border-radius: 4px;
          }
        `}</style>
      )}
      
      <div className={readonly ? '' : 'inplace-container'}>
        <FreeformCvRenderer value={value} />
      </div>

      {editing && (
        <div 
          id="inplace-editor-overlay"
          className="absolute z-50 bg-white dark:bg-zinc-900 shadow-xl rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 flex flex-col gap-3 min-w-[300px]"
          style={{
            top: editing.rect.top - 10,
            left: editing.rect.left - 10,
            // Keep it bounded to parent if possible, but absolute positioning can go out of bounds.
            width: Math.max(editing.rect.width + 20, 300)
          }}
        >
          <div className="flex gap-2 w-full justify-between items-center text-xs text-zinc-500 font-medium">
            <span className="truncate max-w-[150px] font-mono tracking-tighter" title={editing.path}>
              {editing.path.split('.').pop()}
            </span>
            <div className="flex items-center gap-1">
              <label htmlFor="tag-selector" className="sr-only">Field Type</label>
              <select
                id="tag-selector"
                value={editing.tag}
                onChange={e => setEditing(p => p ? { ...p, tag: e.target.value } : null)}
                className="bg-zinc-100 dark:bg-zinc-800 border-none rounded px-2 py-1 text-xs"
              >
                <option value="">(Auto/Default)</option>
                {AVAILABLE_TAGS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <textarea 
            className="w-full text-sm bg-transparent border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 focus:ring-2 focus:ring-[var(--accent)] resize-vertical min-h-[60px]"
            value={editing.currentValue}
            onChange={e => setEditing(p => p ? { ...p, currentValue: e.target.value } : null)}
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Escape') setEditing(null);
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSave();
              }
            }}
          />

          <div className="flex items-center justify-between mt-1">
            <button
              className="text-xs text-red-500 hover:text-red-600 font-medium px-2 py-1 flex items-center gap-1"
              onClick={() => {
                const nextValue = removeValueAtPath(deepClone(value), editing.path.split('.'));
                if (onChange) onChange(nextValue);
                setEditing(null);
              }}
            >
              <span className="material-symbols-outlined text-[14px]">delete</span> Remove
            </button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)} className="px-3 py-1 text-xs">
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} className="px-3 py-1 text-xs">
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InPlaceCvEditor;
