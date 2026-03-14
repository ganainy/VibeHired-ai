import React from 'react';
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
}

interface NodeEditorProps {
  root: FreeformJsonObject;
  path: JsonPath;
  nodeKey?: string;
  depth: number;
  onChange: (next: FreeformJsonObject) => void;
}

const containerCardStyle = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900';
const nestedCardStyle = 'rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/70';
const inputStyle = 'w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-gray-100';
const subtleButtonStyle = 'px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors';
const destructiveButtonStyle = 'px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-semibold hover:bg-red-100 transition-colors';
const primaryButtonStyle = 'px-3 py-1.5 rounded-lg text-white text-xs font-semibold transition-colors';

const PrimitiveEditor: React.FC<{
  label?: string;
  value: string | number | boolean | null;
  tag?: string;
  onChange: (value: FreeformJsonValue) => void;
}> = ({ label, value, tag, onChange }) => {
  if (typeof value === 'boolean') {
    return (
      <label className="flex items-center gap-3 text-sm font-medium text-gray-700 dark:text-gray-200">
        {label && <span className="min-w-[120px]">{formatKeyLabel(label)}</span>}
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      </label>
    );
  }

  if (typeof value === 'number') {
    return (
      <label className="block space-y-2">
        {label && <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{formatKeyLabel(label)}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={inputStyle}
        />
      </label>
    );
  }

  const stringValue = value === null ? '' : String(value);
  const multiline = tag === 'paragraph' || stringValue.includes('\n') || stringValue.length > 120;
  const inputType = tag === 'email' ? 'email' : tag === 'url' ? 'url' : tag === 'phone' ? 'tel' : tag === 'date' ? 'date' : 'text';

  return (
    <label className="block space-y-2">
      {label && <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{formatKeyLabel(label)}</span>}
      {multiline ? (
        <textarea
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          rows={Math.min(Math.max(stringValue.split('\n').length + 1, 4), 12)}
          className={`${inputStyle} leading-6`}
        />
      ) : (
        <input
          type={inputType}
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
          className={inputStyle}
        />
      )}
    </label>
  );
};

const NodeEditor: React.FC<NodeEditorProps> = ({ root, path, nodeKey, depth, onChange }) => {
  const node = getValueAtPath(root, path) as FreeformJsonValue;

  if (isPlainObject(node) && depth === 0 && !nodeKey) {
    const sections = getVisibleEntries(node);

    return (
      <div className="divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
        {sections.map(([sectionKey, sectionValue]) => {
          const sectionPath = [...path, sectionKey];
          const sectionMeta = Array.isArray(sectionValue)
            ? `${sectionValue.length} item${sectionValue.length === 1 ? '' : 's'}`
            : isPlainObject(sectionValue)
              ? `${getVisibleEntries(sectionValue).length} field${getVisibleEntries(sectionValue).length === 1 ? '' : 's'}`
              : 'Text section';

          return (
            <section key={sectionKey} className="py-6 scroll-mt-28">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <input
                      type="text"
                      value={sectionKey}
                      onChange={(e) => onChange(renameObjectKeyAtPath(root, path, sectionKey, e.target.value))}
                      className="min-w-[220px] rounded-lg border border-transparent bg-transparent px-0 py-0 text-lg font-bold tracking-tight text-gray-900 dark:text-white focus:border-gray-300 dark:focus:border-gray-700 focus:bg-white dark:focus:bg-gray-950 focus:px-3 focus:py-2"
                    />
                    <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      {sectionMeta}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Edit this section while keeping the original freeform structure.</p>
                </div>
                <button
                  type="button"
                  onClick={() => onChange(removeValueAtPath(root, sectionPath))}
                  className={destructiveButtonStyle}
                >
                  Remove Section
                </button>
              </div>

              <NodeEditor root={root} path={sectionPath} nodeKey={sectionKey} depth={depth + 1} onChange={onChange} />
            </section>
          );
        })}

        <div className="pt-6">
          <button
            type="button"
            onClick={() => onChange(addObjectField(root, path, 'new_section'))}
            className="flex items-center gap-2 w-full justify-center px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Section
          </button>
        </div>
      </div>
    );
  }

  if (!Array.isArray(node) && !isPlainObject(node)) {
    const fieldTag = getUiTagForPath(root, path);
    return (
      <div className="space-y-2">
        <PrimitiveEditor
          label={nodeKey}
          value={node as string | number | boolean | null}
          tag={fieldTag}
          onChange={(nextValue) => onChange(setValueAtPath(root, path, nextValue))}
        />
      </div>
    );
  }

  if (Array.isArray(node)) {
    return (
      <div className={`${nestedCardStyle} p-4 space-y-4`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            {nodeKey && <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatKeyLabel(nodeKey)}</h4>}
            <p className="text-xs text-gray-500 dark:text-gray-400">Array with {node.length} item{node.length === 1 ? '' : 's'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange(appendArrayItem(root, path, createDefaultArrayItem(node)))}
              className={primaryButtonStyle}
              style={{ background: 'var(--accent)', color: '#0e0e17' }}
            >
              Add Item
            </button>
            {nodeKey && (
              <button
                type="button"
                onClick={() => onChange(removeValueAtPath(root, path))}
                className={destructiveButtonStyle}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {node.map((item, index) => (
            <div key={index} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Item {index + 1}</span>
                <button
                  type="button"
                  onClick={() => onChange(removeValueAtPath(root, [...path, index]))}
                  className="text-xs font-semibold text-red-500"
                >
                  Delete
                </button>
              </div>
              <NodeEditor root={root} path={[...path, index]} depth={depth + 1} onChange={onChange} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const entries = getVisibleEntries(node);

  return (
    <div className={`${depth <= 1 ? containerCardStyle : nestedCardStyle} p-4 space-y-4`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          {nodeKey && <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatKeyLabel(nodeKey)}</h4>}
          <p className="text-xs text-gray-500 dark:text-gray-400">Object with {entries.length} field{entries.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(addObjectField(root, path, depth === 0 ? 'new_section' : 'new_field'))}
            className={depth <= 1 ? subtleButtonStyle : primaryButtonStyle}
            style={depth <= 1 ? undefined : { background: 'var(--accent)', color: '#0e0e17' }}
          >
            {depth === 0 ? 'Add Section' : 'Add Field'}
          </button>
          {nodeKey && (
            <button
              type="button"
              onClick={() => onChange(removeValueAtPath(root, path))}
              className={destructiveButtonStyle}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
          {entries.map(([childKey, childValue]) => {
          if (isMetaKey(childKey)) return null;
          const childPath = [...path, childKey];
          const childTag = getUiTagForPath(root, childPath);

          return (
            <div key={childKey} className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={childKey}
                  onChange={(e) => onChange(renameObjectKeyAtPath(root, path, childKey, e.target.value))}
                  className="min-w-[180px] rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-3 py-2 text-sm font-semibold text-gray-800 dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={() => onChange(removeValueAtPath(root, childPath))}
                  className="text-xs font-semibold text-red-500"
                >
                  Delete
                </button>
              </div>
              {Array.isArray(childValue) || isPlainObject(childValue) ? (
                <NodeEditor root={root} path={childPath} nodeKey={childKey} depth={depth + 1} onChange={onChange} />
              ) : (
                <PrimitiveEditor
                  value={childValue as string | number | boolean | null}
                  tag={childTag}
                  onChange={(nextValue) => onChange(setValueAtPath(root, childPath, nextValue))}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const FreeformCvEditor: React.FC<FreeformCvEditorProps> = ({ value, onChange }) => {
  return (
    <div className="space-y-5">
      <div className="pb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Freeform CV Sections</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Edit the CV exactly as stored from the original document structure.
        </p>
      </div>
      <NodeEditor root={value} path={[]} depth={0} onChange={onChange} />
    </div>
  );
};

export default FreeformCvEditor;