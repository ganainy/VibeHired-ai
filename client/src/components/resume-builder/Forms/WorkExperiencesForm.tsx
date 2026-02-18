import React from 'react';
import { JsonResumeSchema, JsonResumeWorkItem } from '../../../../../server/src/types/jsonresume';
import { FormSection, FormItem } from '../Form';
import { Input, BulletListTextarea } from '../Form/InputGroup';

interface WorkExperiencesFormProps {
    data: JsonResumeSchema;
    onChange: (data: JsonResumeSchema) => void;
    onImprove?: (index: number, customInstructions?: string) => void;
    improvingSections?: Record<string, boolean>;
}

const WorkIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
);

const initialWorkItem: JsonResumeWorkItem = {
    name: '',
    position: '',
    location: '',
    startDate: '',
    endDate: '',
    summary: '',
    highlights: [],
};

export const WorkExperiencesForm: React.FC<WorkExperiencesFormProps> = ({
    data,
    onChange,
    onImprove,
    improvingSections = {},
}) => {
    const workExperiences = data.work || [];

    const handleWorkChange = (index: number, field: keyof JsonResumeWorkItem, value: string | string[]) => {
        const work = [...workExperiences];
        work[index] = { ...work[index], [field]: value };
        onChange({ ...data, work });
    };

    const addWorkExperience = () => {
        onChange({
            ...data,
            work: [...workExperiences, { ...initialWorkItem }],
        });
    };

    const deleteWorkExperience = (index: number) => {
        const work = workExperiences.filter((_, i) => i !== index);
        onChange({ ...data, work });
    };

    const moveWorkExperience = (index: number, direction: 'up' | 'down') => {
        const work = [...workExperiences];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= work.length) return;

        [work[index], work[newIndex]] = [work[newIndex], work[index]];
        onChange({ ...data, work });
    };

    return (
        <FormSection
            title="Work Experience"
            icon={<WorkIcon />}
            onAdd={addWorkExperience}
            addButtonText="Add Work Experience"
            isCollapsible
            defaultExpanded={false}
        >
            {workExperiences.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic py-4">
                    No work experience added yet. Click "Add Work Experience" to add your first job.
                </p>
            ) : (
                workExperiences.map((item, index) => {
                    const isImproving = improvingSections[`work-${index}`] || false;

                    return (
                        <FormItem
                            key={index}
                            index={index}
                            total={workExperiences.length}
                            onMoveUp={() => moveWorkExperience(index, 'up')}
                            onMoveDown={() => moveWorkExperience(index, 'down')}
                            onDelete={() => deleteWorkExperience(index)}
                        >
                            {/* Job Title - Half Width */}
                            <Input
                                label="Job Title"
                                labelClassName="col-span-3"
                                name={`position-${index}`}
                                placeholder="Software Engineer"
                                value={item.position || item.jobTitle || ''}
                                onChange={(v) => handleWorkChange(index, 'position', v)}
                            />

                            {/* Company Name - Half Width */}
                            <Input
                                label="Company"
                                labelClassName="col-span-3"
                                name={`company-${index}`}
                                placeholder="Company Name"
                                value={item.name || item.company || ''}
                                onChange={(v) => handleWorkChange(index, 'name', v)}
                            />

                            {/* Start Date - Half Width */}
                            <Input
                                label="Start Date"
                                labelClassName="col-span-3"
                                name={`startDate-${index}`}
                                placeholder="Jan 2020"
                                value={item.startDate || ''}
                                onChange={(v) => handleWorkChange(index, 'startDate', v)}
                            />

                            {/* End Date - Half Width */}
                            <Input
                                label="End Date"
                                labelClassName="col-span-3"
                                name={`endDate-${index}`}
                                placeholder="Present"
                                value={item.endDate || ''}
                                onChange={(v) => handleWorkChange(index, 'endDate', v)}
                            />

                            {/* Location - Full Width */}
                            <Input
                                label="Location"
                                labelClassName="col-span-6"
                                name={`location-${index}`}
                                placeholder="New York, NY"
                                value={item.location || ''}
                                onChange={(v) => handleWorkChange(index, 'location', v)}
                            />

                            {/* Description/Highlights */}
                            <div className="col-span-6">
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider ml-0.5">
                                        DESCRIPTION
                                    </label>
                                    {onImprove && (
                                        <button
                                            type="button"
                                            onClick={() => onImprove(index)}
                                            disabled={isImproving}
                                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {isImproving ? (
                                                <>
                                                    <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                    </svg>
                                                    Improving...
                                                </>
                                            ) : (
                                                <>
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                    </svg>
                                                    AI Improve
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                                <BulletListTextarea
                                    label=""
                                    name={`highlights-${index}`}
                                    value={item.highlights || []}
                                    placeholder="• Describe your key achievements and responsibilities"
                                    onChange={(v) => handleWorkChange(index, 'highlights', v)}
                                />
                            </div>
                        </FormItem>
                    );
                })
            )}
        </FormSection>
    );
};

export default WorkExperiencesForm;
