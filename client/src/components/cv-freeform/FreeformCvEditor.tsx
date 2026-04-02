import React, { useCallback, useEffect, useState } from 'react';
import {
  addObjectField,
  appendArrayItem,
  createDefaultArrayItem,
  formatKeyLabel,
  FreeformJsonObject,
  FreeformJsonValue,
  getUiTagForPath,
  getVisibleEntries,
  getValueAtPath,
  isMetaKey,
  isPlainObject,
  JsonPath,
  removeValueAtPath,
  renameObjectKeyAtPath,
  setValueAtPath,
} from './freeformUtils';

interface FreeformCvEditorProps {
  value: FreeformJsonObject;
  onChange: (next: FreeformJsonObject) => void;
  /** Namespace the localStorage key so different CVs keep their own expand state */
  cvId?: string;
}

interface NodeEditorProps {
  root: FreeformJsonObject;
  path: JsonPath;
  nodeKey?: string;
  depth: number;
  onChange: (next: FreeformJsonObject) => void;
  /** Keys currently expanded (depth-0 sections only) */
  expandedKeys?: Set<string>;
  onToggleKey?: (key: string) => void;
  onRenameSectionKey?: (oldKey: string, nextKey: string) => void;
}

const inputBase =
  'w-full px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]/30';

const SectionKeyInput: React.FC<{
  value: string;
  onCommit: (nextValue: string) => void;
  className?: string;
  style?: React.CSSProperties;
}> = ({ value, onCommit, className, style }) => {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commitIfNeeded = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) return;
    onCommit(trimmed);
  };

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commitIfNeeded}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitIfNeeded();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setDraft(value);
        }
      }}
      className={className}
      style={style}
    />
  );
};

/** Returns the first short string value inside an array item for a summary label */
function getItemSummary(item: FreeformJsonValue): string {
  if (!isPlainObject(item)) return '';
  for (const [, v] of getVisibleEntries(item)) {
    if (typeof v === 'string' && v.trim() && v.length < 80) return v.trim();
  }
  return '';
}

const RemoveButton: React.FC<{ onClick: () => void; label?: string }> = ({ onClick, label = 'Remove' }) => (
  <button
    type="button"
    onClick={onClick}
    className="text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors flex-shrink-0"
    style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)' }}
    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--rose, #f87171)')}
    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
  >
    {label}
  </button>
);

const RemoveIconButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="mt-6 p-1.5 rounded-lg transition-colors flex-shrink-0"
    style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)' }}
    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--rose, #f87171)')}
    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
    title="Remove field"
  >
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>
);

const AddDashedButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-2 w-full justify-center px-4 py-2.5 rounded-xl text-sm font-medium border-2 border-dashed transition-colors"
    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = 'var(--accent)';
      e.currentTarget.style.color = 'var(--accent)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = 'var(--border)';
      e.currentTarget.style.color = 'var(--text-muted)';
    }}
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
    {label}
  </button>
);

const PrimitiveEditor: React.FC<{
  label?: string;
  value: string | number | boolean | null;
  tag?: string;
  onChange: (value: FreeformJsonValue) => void;
}> = ({ label, value, tag, onChange }) => {
  if (typeof value === 'boolean') {
    return (
      <label className="flex items-center gap-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label && <span className="min-w-[120px]">{formatKeyLabel(label)}</span>}
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      </label>
    );
  }

  if (typeof value === 'number') {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {formatKeyLabel(label)}
          </span>
        )}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={inputBase}
          style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
      </div>
    );
  }

  const stringValue = value === null ? '' : String(value);
  const multiline = tag === 'paragraph' || stringValue.includes('\n') || stringValue.length > 120;
  const inputType =
    tag === 'email' ? 'email' :
    tag === 'url' ? 'url' :
    tag === 'phone' ? 'tel' :
    tag === 'date' ? 'date' : 'text';

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {formatKeyLabel(label)}
        </span>
      )}
      {multiline ? (
        <textarea
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          rows={Math.min(Math.max(stringValue.split('\n').length + 1, 3), 10)}
          className={`${inputBase} leading-6 resize-none`}
          style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
      ) : (
        <input
          type={inputType}
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          className={inputBase}
          style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
      )}
    </div>
  );
};

const NodeEditor: React.FC<NodeEditorProps> = ({
  root,
  path,
  nodeKey,
  depth,
  onChange,
  expandedKeys,
  onToggleKey,
  onRenameSectionKey,
}) => {
  const node = getValueAtPath(root, path) as FreeformJsonValue;

  // ── Depth-0 root object: render each key as a named section ──
  if (isPlainObject(node) && depth === 0 && !nodeKey) {
    const sections = getVisibleEntries(node);

    return (
      <div className="flex flex-col">
        {sections.map(([sectionKey]) => {
          const sectionPath = [...path, sectionKey];
          const isExpanded = expandedKeys?.has(sectionKey) ?? false;

          return (
            <section key={sectionKey} className="border-b" style={{ borderColor: 'var(--border)' }}>
              {/* Header — always visible */}
              <div className="flex items-center gap-2 py-4">
                <button
                  type="button"
                  onClick={() => onToggleKey?.(sectionKey)}
                  className="flex-shrink-0 p-0.5 rounded transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  title={isExpanded ? 'Collapse' : 'Expand'}
                >
                  <svg
                    className="w-4 h-4 transition-transform duration-200"
                    style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <SectionKeyInput
                  value={sectionKey}
                  onCommit={(nextValue) => {
                    onRenameSectionKey?.(sectionKey, nextValue);
                    onChange(renameObjectKeyAtPath(root, path, sectionKey, nextValue));
                  }}
                  className="text-base font-bold tracking-tight bg-transparent border-0 focus:outline-none focus:ring-0 p-0 flex-1"
                  style={{ color: 'var(--text-primary)' }}
                />
                <button
                  type="button"
                  onClick={() => onChange(removeValueAtPath(root, sectionPath))}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex-shrink-0"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--rose, #f87171)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Remove
                </button>
              </div>

              {/* Collapsible body */}
              {isExpanded && (
                <div className="pb-5">
                  <NodeEditor root={root} path={sectionPath} nodeKey={sectionKey} depth={depth + 1} onChange={onChange} />
                </div>
              )}
            </section>
          );
        })}

        <div className="pt-5">
          <AddDashedButton onClick={() => onChange(addObjectField(root, path, 'new_section'))} label="Add Section" />
        </div>
      </div>
    );
  }

  // ── Primitive ──
  if (!Array.isArray(node) && !isPlainObject(node)) {
    const fieldTag = getUiTagForPath(root, path);
    return (
      <PrimitiveEditor
        label={nodeKey}
        value={node as string | number | boolean | null}
        tag={fieldTag}
        onChange={(nextValue) => onChange(setValueAtPath(root, path, nextValue))}
      />
    );
  }

  // ── Array ──
  if (Array.isArray(node)) {
    return (
      <div className="flex flex-col gap-3">
        {node.map((item, index) => (
          <div
            key={index}
            className="rounded-xl border p-4"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-md flex-shrink-0"
                  style={{ background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)' }}
                >
                  #{index + 1}
                </span>
                {(() => {
                  const summary = getItemSummary(item);
                  return summary ? (
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                      {summary}
                    </span>
                  ) : null;
                })()}
              </div>
              <RemoveButton onClick={() => onChange(removeValueAtPath(root, [...path, index]))} label="Delete" />
            </div>
            <NodeEditor root={root} path={[...path, index]} depth={depth + 1} onChange={onChange} />
          </div>
        ))}

        <AddDashedButton
          onClick={() => onChange(appendArrayItem(root, path, createDefaultArrayItem(node)))}
          label="Add Item"
        />

        {nodeKey && (
          <div className="flex justify-start">
            <RemoveButton onClick={() => onChange(removeValueAtPath(root, path))} label="Remove Section" />
          </div>
        )}
      </div>
    );
  }

  // ── Object (nested) ──
  const entries = getVisibleEntries(node);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {entries.map(([childKey, childValue]) => {
          if (isMetaKey(childKey)) return null;
          const childPath = [...path, childKey];
          const childTag = getUiTagForPath(root, childPath);
          const isComplex = Array.isArray(childValue) || isPlainObject(childValue);

          return (
            <div key={childKey}>
              {isComplex ? (
                <div
                  className="rounded-xl border p-4"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <SectionKeyInput
                      value={childKey}
                      onCommit={(nextValue) => onChange(renameObjectKeyAtPath(root, path, childKey, nextValue))}
                      className="text-sm font-semibold bg-transparent border-0 focus:outline-none focus:ring-0 p-0 flex-1"
                      style={{ color: 'var(--text-primary)' }}
                    />
                    <RemoveButton onClick={() => onChange(removeValueAtPath(root, childPath))} />
                  </div>
                  <NodeEditor root={root} path={childPath} nodeKey={childKey} depth={depth + 1} onChange={onChange} />
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <PrimitiveEditor
                      label={childKey}
                      value={childValue as string | number | boolean | null}
                      tag={childTag}
                      onChange={(nextValue) => onChange(setValueAtPath(root, childPath, nextValue))}
                    />
                  </div>
                  <RemoveIconButton onClick={() => onChange(removeValueAtPath(root, childPath))} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onChange(addObjectField(root, path, 'new_field'))}
        className="flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
        style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--accent)';
          e.currentTarget.style.borderColor = 'var(--accent-dim)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-muted)';
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Field
      </button>
    </div>
  );
};

const STORAGE_KEY_PREFIX = 'freeform_expanded_';

const FreeformCvEditor: React.FC<FreeformCvEditorProps> = ({ value, onChange, cvId }) => {
  const storageKey = `${STORAGE_KEY_PREFIX}${cvId ?? 'default'}`;

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? new Set<string>(JSON.parse(stored) as string[]) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // Re-read from storage when the CV changes (different cvId)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      setExpandedKeys(stored ? new Set<string>(JSON.parse(stored) as string[]) : new Set<string>());
    } catch {
      setExpandedKeys(new Set<string>());
    }
  }, [storageKey]);

  const toggleKey = useCallback((key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      } catch { /* quota exceeded — silently ignore */ }
      return next;
    });
  }, [storageKey]);

  const handleSectionRename = useCallback((oldKey: string, nextKey: string) => {
    setExpandedKeys((prev) => {
      if (!prev.has(oldKey)) return prev;
      const next = new Set(prev);
      next.delete(oldKey);
      next.add(nextKey);
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(next)));
      } catch { /* quota exceeded — silently ignore */ }
      return next;
    });
  }, [storageKey]);

  return (
    <div>
      <NodeEditor
        root={value}
        path={[]}
        depth={0}
        onChange={onChange}
        expandedKeys={expandedKeys}
        onToggleKey={toggleKey}
        onRenameSectionKey={handleSectionRename}
      />
    </div>
  );
};

export default FreeformCvEditor;