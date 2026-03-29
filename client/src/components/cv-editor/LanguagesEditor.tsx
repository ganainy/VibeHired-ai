import React from 'react';
import { EditorProps } from './types';
import { JsonResumeLanguageItem } from '../../../../server/src/types/jsonresume';
import ArrayItemControls from './ArrayItemControls';

// Update props to include analysis and onApplyImprovements
interface LanguagesEditorProps extends EditorProps<JsonResumeLanguageItem[] | undefined> {
    analysis?: unknown;
    onApplyImprovements?: () => Promise<void>;
}

const LanguagesEditor: React.FC<LanguagesEditorProps> = ({ data = [], onChange, analysis }) => {
    void analysis;

    const handleItemChange = (index: number, field: keyof JsonResumeLanguageItem, value: string) => {
        const newData = [...data];
        if (!newData[index]) {
            newData[index] = { language: '', fluency: '' }; // Initialize if missing
        }
        newData[index] = { ...newData[index], [field]: value };
        onChange(newData);
    };

    const handleDelete = (index: number) => {
        const newData = data.filter((_, i) => i !== index);
        onChange(newData);
    };

    const handleAdd = () => {
        const newItem: JsonResumeLanguageItem = { language: '', fluency: '' };
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
                <p className="text-gray-500 dark:text-gray-400 italic text-xs">No languages added yet.</p>
            ) : (
                <ul className="space-y-2">
                    {data.map((item, index) => (
                        <li key={index} className="p-2 border dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 space-y-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                                <div>
                                    <label htmlFor={`lang-language-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Language</label>
                                    <input
                                        type="text"
                                        id={`lang-language-${index}`}
                                        value={item.language || ''}
                                        onChange={(e) => handleItemChange(index, 'language', e.target.value)}
                                        placeholder="e.g., English, Spanish"
                                        className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                                    />
                                </div>
                                <div>
                                    <label htmlFor={`lang-fluency-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Fluency</label>
                                    <input
                                        type="text"
                                        id={`lang-fluency-${index}`}
                                        value={item.fluency || ''}
                                        onChange={(e) => handleItemChange(index, 'fluency', e.target.value)}
                                        placeholder="e.g., Native, Fluent, Conversational"
                                        className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
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
                Add Language
            </button>
        </div>
    );
};

export default LanguagesEditor;