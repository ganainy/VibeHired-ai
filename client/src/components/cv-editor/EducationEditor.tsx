import React from 'react';
import { EditorProps } from './types';
import { JsonResumeEducationItem } from '../../../../server/src/types/jsonresume';
import ArrayItemControls from './ArrayItemControls';

// Update props to include analysis and onApplyImprovements
interface EducationEditorProps extends EditorProps<JsonResumeEducationItem[] | undefined> {
    analysis?: unknown;
    onApplyImprovements?: () => Promise<void>;
}

const EducationEditor: React.FC<EducationEditorProps> = ({ data = [], onChange, analysis }) => {
    void analysis;

    const handleItemChange = (index: number, field: keyof JsonResumeEducationItem, value: string | string[]) => {
        const newData = [...data];
        if (!newData[index]) {
            // Initialize with default structure if item doesn't exist (e.g., after adding)
            newData[index] = { institution: '', area: '', studyType: '', startDate: '', endDate: '', score: '', courses: [] };
        }
        // Ensure the field exists on the type before assigning
        if (field in newData[index]) {
            newData[index] = { ...newData[index], [field]: value };
        }
        onChange(newData);
    };

    const handleCoursesChange = (eduIndex: number, value: string) => {
        const courses = value.split(',').map(c => c.trim()).filter(c => c);
        handleItemChange(eduIndex, 'courses', courses);
    };

    const handleDelete = (index: number) => {
        onChange(data.filter((_, i) => i !== index));
    };

    const handleAdd = () => {
        const newItem: JsonResumeEducationItem = { institution: '', area: '', studyType: '', startDate: '', endDate: '', score: '', courses: [] };
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
                <p className="text-gray-500 dark:text-gray-400 italic text-xs">No education history added yet.</p>
            ) : (
                <ul className="space-y-2">
                    {data.map((item, index) => (
                        <li key={index} className="p-2 border dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-700 space-y-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                                {/* Institution */}
                                <div>
                                    <label htmlFor={`edu-institution-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Institution</label>
                                    <input
                                        type="text"
                                        id={`edu-institution-${index}`}
                                        value={item.institution || ''}
                                        onChange={(e) => handleItemChange(index, 'institution', e.target.value)}
                                        placeholder="University Name"
                                        className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                                    />
                                </div>
                                {/* Area */}
                                <div>
                                    <label htmlFor={`edu-area-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Area of Study</label>
                                    <input
                                        type="text"
                                        id={`edu-area-${index}`}
                                        value={item.area || ''}
                                        onChange={(e) => handleItemChange(index, 'area', e.target.value)}
                                        placeholder="e.g., Computer Science"
                                        className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                                    />
                                </div>
                                {/* Study Type */}
                                <div>
                                    <label htmlFor={`edu-studyType-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Degree / Study Type</label>
                                    <input
                                        type="text"
                                        id={`edu-studyType-${index}`}
                                        value={item.studyType || ''}
                                        onChange={(e) => handleItemChange(index, 'studyType', e.target.value)}
                                        placeholder="e.g., Bachelor's Degree, PhD"
                                        className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                                    />
                                </div>
                                {/* GPA -> Score */}
                                <div>
                                    <label htmlFor={`edu-score-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Score/GPA (Optional)</label>
                                    <input
                                        type="text"
                                        id={`edu-score-${index}`}
                                        value={item.score || ''}
                                        onChange={(e) => handleItemChange(index, 'score', e.target.value)}
                                        placeholder="e.g., 3.8/4.0 or A"
                                        className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                                    />
                                </div>
                                {/* Start Date */}
                                <div>
                                    <label htmlFor={`edu-startDate-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Start Date</label>
                                    <input
                                        type="text"
                                        id={`edu-startDate-${index}`}
                                        value={item.startDate || ''}
                                        onChange={(e) => handleItemChange(index, 'startDate', e.target.value)}
                                        placeholder="YYYY-MM-DD or YYYY-MM"
                                        className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                                    />
                                </div>
                                {/* End Date */}
                                <div>
                                    <label htmlFor={`edu-endDate-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">End Date (or Expected)</label>
                                    <input
                                        type="text"
                                        id={`edu-endDate-${index}`}
                                        value={item.endDate || ''}
                                        onChange={(e) => handleItemChange(index, 'endDate', e.target.value)}
                                        placeholder="YYYY-MM-DD or Present"
                                        className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs"
                                    />
                                </div>
                                {/* Courses (as textarea) */}
                                <div className="md:col-span-2">
                                    <label htmlFor={`edu-courses-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Relevant Courses (Optional, comma-separated)</label>
                                    <textarea
                                        id={`edu-courses-${index}`}
                                        value={(item.courses || []).join(', ')}
                                        onChange={(e) => handleCoursesChange(index, e.target.value)}
                                        placeholder="e.g., Data Structures, Algorithms, Web Development"
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
                Add Education
            </button>
        </div>
    );
};

export default EducationEditor;