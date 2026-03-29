import React from 'react';
import { EditorProps } from './types';
import { JsonResumeSkillItem } from '../../../../server/src/types/jsonresume';
import ArrayItemControls from './ArrayItemControls';

// Update props to include analysis and onApplyImprovements
interface SkillsEditorProps extends EditorProps<JsonResumeSkillItem[] | undefined> {
    analysis?: unknown;
    onApplyImprovements?: () => Promise<void>;
}

const SkillsEditor: React.FC<SkillsEditorProps> = ({ data = [], onChange, analysis }) => {
    void analysis;

    const handleItemChange = (index: number, field: keyof JsonResumeSkillItem, value: string | string[]) => {
        const newData = [...data];
        if (!newData[index]) {
            newData[index] = { name: '', level: '', keywords: [] }; // Initialize if missing
        }
        // Handle keywords array specifically if needed, otherwise treat as string for simplicity now
        newData[index] = { ...newData[index], [field]: value };
        onChange(newData);
    };

    const handleKeywordsChange = (index: number, value: string) => {
        // Simple comma-separated string to array conversion
        const keywordsArray = value.split(',').map(k => k.trim()).filter(k => k);
        handleItemChange(index, 'keywords', keywordsArray);
    };

    const handleDelete = (index: number) => {
        const newData = data.filter((_, i) => i !== index);
        onChange(newData);
    };

    const handleAdd = () => {
        const newItem: JsonResumeSkillItem = { name: '', level: '', keywords: [] };
        onChange([...data, newItem]);
    };

    return (
        <div>
            {/* TODO: Fix SectionAnalysisPanel props to match interface */}
            {/* {showAnalysis && analysis && (
                <div className="mb-2">
                    <SectionAnalysisPanel issues={analysis.issues} suggestions={analysis.suggestions} />
                </div>
            )} */}

            {data.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 italic text-xs">No skills added yet.</p>
            ) : (
                <ul className="space-y-2">
                    {data.map((item, index) => (
                        <li key={index} className="p-2 border dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 space-y-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                                {/* Name (Category) */}
                                <div>
                                    <label htmlFor={`skill-name-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Skill Category/Name</label>
                                    <input
                                        type="text"
                                        id={`skill-name-${index}`}
                                        value={item.name || ''}
                                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                                        placeholder="e.g., Programming Languages, Web Development"
                                        className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                                    />
                                </div>
                                {/* Level */}
                                <div>
                                    <label htmlFor={`skill-level-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Level (Optional)</label>
                                    <input
                                        type="text"
                                        id={`skill-level-${index}`}
                                        value={item.level || ''}
                                        onChange={(e) => handleItemChange(index, 'level', e.target.value)}
                                        placeholder="e.g., Advanced, Intermediate"
                                        className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                                    />
                                </div>
                                {/* Keywords (as textarea) */}
                                <div className="md:col-span-2">
                                    <label htmlFor={`skill-keywords-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Specific Skills/Keywords (comma-separated)</label>
                                    <textarea
                                        id={`skill-keywords-${index}`}
                                        value={(item.keywords || []).join(', ')}
                                        onChange={(e) => handleKeywordsChange(index, e.target.value)}
                                        placeholder="e.g., JavaScript, TypeScript, React, Node.js"
                                        className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                                        rows={2}
                                    />
                                </div>
                            </div>
                            <ArrayItemControls index={index} onDelete={handleDelete} />
                        </li>
                    ))}
                </ul>
            )}
            <button
                type="button"
                onClick={handleAdd}
                className="mt-2 px-2 py-1 bg-blue-500 dark:bg-blue-700 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-800 text-xs"
            >
                Add Skill Category
            </button>
        </div>
    );
};

export default SkillsEditor;