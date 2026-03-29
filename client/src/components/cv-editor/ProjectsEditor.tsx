import React from 'react';
import { EditorProps } from './types';
import { JsonResumeProjectItem } from '../../../../server/src/types/jsonresume';
import ArrayItemControls from './ArrayItemControls';

// Update props to include analysis and onApplyImprovements
interface ProjectsEditorProps extends EditorProps<JsonResumeProjectItem[] | undefined> {
    analysis?: unknown;
    onApplyImprovements?: () => Promise<void>;
}

const ProjectsEditor: React.FC<ProjectsEditorProps> = ({ data = [], onChange, analysis }) => {
    void analysis;

    const handleItemChange = (index: number, field: keyof JsonResumeProjectItem, value: string | string[]) => {
        const newData = [...data];
        if (!newData[index]) {
            // Initialize with all potential fields
            newData[index] = { name: '', description: '', startDate: '', endDate: '', url: '', highlights: [], keywords: [], entity: '', type: '', roles: [] };
        }
        newData[index] = { ...newData[index], [field]: value };
        onChange(newData);
    };

    // Specific handlers for array fields (highlights, keywords, roles) using comma-separated input
    const handleArrayFieldChange = (index: number, field: 'highlights' | 'keywords' | 'roles', value: string, separator: string = ',') => {
        const arrayValue = value.split(separator).map(k => k.trim()).filter(k => k);
        handleItemChange(index, field, arrayValue);
    };

    const handleDelete = (index: number) => {
        const newData = data.filter((_, i) => i !== index);
        onChange(newData);
    };

    const handleAdd = () => {
        const newItem: JsonResumeProjectItem = { name: '', description: '', startDate: '', endDate: '', url: '', highlights: [], keywords: [], entity: '', type: '', roles: [] };
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
                <p className="text-gray-500 dark:text-gray-400 italic text-xs">No projects added yet.</p>
            ) : (
                <ul className="space-y-2">
                    {data.map((item, index) => (
                        <li key={index} className="p-2 border dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 space-y-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                                {/* Name */}
                                <div>
                                    <label htmlFor={`proj-name-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Project Name</label>
                                    <input
                                        type="text"
                                        id={`proj-name-${index}`}
                                        value={item.name || ''}
                                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                                        placeholder="Project Title"
                                        className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                                    />
                                </div>
                                {/* Description */}
                                <div className="md:col-span-2">
                                    <label htmlFor={`proj-description-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Description</label>
                                    <textarea
                                        id={`proj-description-${index}`}
                                        value={item.description || ''}
                                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                        placeholder="Brief description of the project"
                                        className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                                        rows={2}
                                    />
                                </div>
                                {/* Start Date */}
                                <div>
                                    <label htmlFor={`proj-startDate-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Start Date</label>
                                    <input
                                        type="text"
                                        id={`proj-startDate-${index}`}
                                        value={item.startDate || ''}
                                        onChange={(e) => handleItemChange(index, 'startDate', e.target.value)}
                                        placeholder="YYYY-MM-DD or YYYY-MM"
                                        className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                                    />
                                </div>
                                {/* End Date */}
                                <div>
                                    <label htmlFor={`proj-endDate-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">End Date (or Ongoing)</label>
                                    <input
                                        type="text"
                                        id={`proj-endDate-${index}`}
                                        value={item.endDate || ''}
                                        onChange={(e) => handleItemChange(index, 'endDate', e.target.value)}
                                        placeholder="YYYY-MM-DD or Present"
                                        className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                                    />
                                </div>
                                {/* URL */}
                                <div>
                                    <label htmlFor={`proj-url-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Project URL (Optional)</label>
                                    <input
                                        type="url"
                                        id={`proj-url-${index}`}
                                        value={item.url || ''}
                                        onChange={(e) => handleItemChange(index, 'url', e.target.value)}
                                        placeholder="https://github.com/user/project"
                                        className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                                    />
                                </div>
                                {/* Roles (as text input) */}
                                <div>
                                    <label htmlFor={`proj-roles-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Your Role(s) (Optional, comma-separated)</label>
                                    <input
                                        type="text"
                                        id={`proj-roles-${index}`}
                                        value={(item.roles || []).join(', ')}
                                        onChange={(e) => handleArrayFieldChange(index, 'roles', e.target.value)}
                                        placeholder="e.g., Developer, Designer"
                                        className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                                    />
                                </div>
                                {/* Entity/Company */}
                                <div>
                                    <label htmlFor={`proj-entity-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Associated Entity/Company (Optional)</label>
                                    <input
                                        type="text"
                                        id={`proj-entity-${index}`}
                                        value={item.entity || ''}
                                        onChange={(e) => handleItemChange(index, 'entity', e.target.value)}
                                        placeholder="e.g., University Project, Personal"
                                        className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                                    />
                                </div>
                                {/* Type */}
                                <div>
                                    <label htmlFor={`proj-type-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Project Type (Optional)</label>
                                    <input
                                        type="text"
                                        id={`proj-type-${index}`}
                                        value={item.type || ''}
                                        onChange={(e) => handleItemChange(index, 'type', e.target.value)}
                                        placeholder="e.g., Web Application, Library"
                                        className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                                    />
                                </div>
                                {/* Highlights (as textarea) */}
                                <div className="md:col-span-2">
                                    <label htmlFor={`proj-highlights-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Highlights (Optional, one per line)</label>
                                    <textarea
                                        id={`proj-highlights-${index}`}
                                        value={(item.highlights || []).join('\n')}
                                        onChange={(e) => handleArrayFieldChange(index, 'highlights', e.target.value, '\n')}
                                        placeholder="- Implemented feature X\n- Achieved Y result"
                                        className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                                        rows={2}
                                    />
                                </div>
                                {/* Keywords (as text input) */}
                                <div className="md:col-span-2">
                                    <label htmlFor={`proj-keywords-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Keywords/Technologies (Optional, comma-separated)</label>
                                    <input
                                        type="text"
                                        id={`proj-keywords-${index}`}
                                        value={(item.keywords || []).join(', ')}
                                        onChange={(e) => handleArrayFieldChange(index, 'keywords', e.target.value)}
                                        placeholder="e.g., React, Node.js, TypeScript"
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
                Add Project
            </button>
        </div>
    );
};

export default ProjectsEditor;