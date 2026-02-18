import React from 'react';
import { JsonResumeSchema, JsonResumeProjectItem } from '../../../../../server/src/types/jsonresume';
import { FormSection, FormItem } from '../Form';
import { Input, BulletListTextarea, Textarea } from '../Form/InputGroup';

interface ProjectsFormProps {
    data: JsonResumeSchema;
    onChange: (data: JsonResumeSchema) => void;
}

const ProjectsIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
);

const initialProjectItem: JsonResumeProjectItem = {
    name: '',
    description: '',
    highlights: [],
    keywords: [],
    startDate: '',
    endDate: '',
    url: '',
};

export const ProjectsForm: React.FC<ProjectsFormProps> = ({
    data,
    onChange,
}) => {
    const projects = data.projects || [];

    const handleProjectChange = (index: number, field: keyof JsonResumeProjectItem, value: string | string[]) => {
        const updatedProjects = [...projects];
        updatedProjects[index] = { ...updatedProjects[index], [field]: value };
        onChange({ ...data, projects: updatedProjects });
    };

    const addProject = () => {
        onChange({
            ...data,
            projects: [...projects, { ...initialProjectItem }],
        });
    };

    const deleteProject = (index: number) => {
        const updatedProjects = projects.filter((_, i) => i !== index);
        onChange({ ...data, projects: updatedProjects });
    };

    const moveProject = (index: number, direction: 'up' | 'down') => {
        const updatedProjects = [...projects];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= updatedProjects.length) return;

        [updatedProjects[index], updatedProjects[newIndex]] = [updatedProjects[newIndex], updatedProjects[index]];
        onChange({ ...data, projects: updatedProjects });
    };

    const handleKeywordChange = (projectIndex: number, keywordIndex: number, value: string) => {
        const updatedProjects = [...projects];
        const keywords = [...(updatedProjects[projectIndex].keywords || [])];

        if (value.trim() === '') {
            keywords.splice(keywordIndex, 1);
        } else {
            keywords[keywordIndex] = value;
        }

        updatedProjects[projectIndex] = { ...updatedProjects[projectIndex], keywords };
        onChange({ ...data, projects: updatedProjects });
    };

    const addKeyword = (projectIndex: number) => {
        const updatedProjects = [...projects];
        const keywords = [...(updatedProjects[projectIndex].keywords || []), ''];
        updatedProjects[projectIndex] = { ...updatedProjects[projectIndex], keywords };
        onChange({ ...data, projects: updatedProjects });
    };

    return (
        <FormSection
            title="Projects"
            icon={<ProjectsIcon />}
            onAdd={addProject}
            addButtonText="Add Project"
            isCollapsible
            defaultExpanded={false}
        >
            {projects.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic py-4">
                    No projects added yet. Click "Add Project" to showcase your work.
                </p>
            ) : (
                projects.map((item, index) => (
                    <FormItem
                        key={index}
                        index={index}
                        total={projects.length}
                        onMoveUp={() => moveProject(index, 'up')}
                        onMoveDown={() => moveProject(index, 'down')}
                        onDelete={() => deleteProject(index)}
                    >
                        {/* Project Name */}
                        <Input
                            label="Project Name"
                            labelClassName="col-span-4"
                            name={`projectName-${index}`}
                            placeholder="My Awesome Project"
                            value={item.name || ''}
                            onChange={(v) => handleProjectChange(index, 'name', v)}
                        />
                        <Input
                            label="URL (optional)"
                            labelClassName="col-span-2"
                            name={`projectUrl-${index}`}
                            placeholder="github.com/..."
                            value={item.url || ''}
                            onChange={(v) => handleProjectChange(index, 'url', v)}
                        />

                        {/* Dates */}
                        <Input
                            label="Start Date"
                            labelClassName="col-span-3"
                            name={`projectStartDate-${index}`}
                            placeholder="Jan 2023"
                            value={item.startDate || ''}
                            onChange={(v) => handleProjectChange(index, 'startDate', v)}
                        />
                        <Input
                            label="End Date"
                            labelClassName="col-span-3"
                            name={`projectEndDate-${index}`}
                            placeholder="Mar 2023"
                            value={item.endDate || ''}
                            onChange={(v) => handleProjectChange(index, 'endDate', v)}
                        />

                        {/* Description */}
                        <Textarea
                            label="Description"
                            labelClassName="col-span-6"
                            name={`projectDescription-${index}`}
                            placeholder="Brief description of the project..."
                            value={item.description || ''}
                            onChange={(v) => handleProjectChange(index, 'description', v)}
                            rows={2}
                        />

                        {/* Highlights */}
                        <BulletListTextarea
                            label="Key Features & Achievements"
                            labelClassName="col-span-6"
                            name={`projectHighlights-${index}`}
                            value={item.highlights || []}
                            placeholder="• Notable features or achievements"
                            onChange={(v) => handleProjectChange(index, 'highlights', v)}
                        />

                        {/* Technologies/Keywords */}
                        <div className="col-span-6">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                                Technologies Used
                            </label>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {(item.keywords || []).map((keyword, kIndex) => (
                                    <div
                                        key={kIndex}
                                        className="flex items-center bg-green-50 dark:bg-green-900/30 rounded-lg px-2 py-1"
                                    >
                                        <input
                                            type="text"
                                            value={keyword}
                                            onChange={(e) => handleKeywordChange(index, kIndex, e.target.value)}
                                            placeholder="Tech"
                                            className="bg-transparent border-none outline-none text-sm text-green-800 dark:text-green-200 w-auto min-w-[40px]"
                                            style={{ width: `${Math.max(40, keyword.length * 8 + 16)}px` }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleKeywordChange(index, kIndex, '')}
                                            className="ml-1 text-green-400 hover:text-red-500 transition-colors"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => addKeyword(index)}
                                    className="flex items-center gap-1 px-3 py-1 text-sm text-green-600 dark:text-green-400 border border-dashed border-green-300 dark:border-green-600 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Tech
                                </button>
                            </div>
                        </div>
                    </FormItem>
                ))
            )}
        </FormSection>
    );
};

export default ProjectsForm;
