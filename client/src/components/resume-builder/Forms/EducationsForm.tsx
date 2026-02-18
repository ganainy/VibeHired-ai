import React from 'react';
import { JsonResumeSchema, JsonResumeEducationItem } from '../../../../../server/src/types/jsonresume';
import { FormSection, FormItem } from '../Form';
import { Input, BulletListTextarea } from '../Form/InputGroup';

interface EducationsFormProps {
    data: JsonResumeSchema;
    onChange: (data: JsonResumeSchema) => void;
}

const EducationIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M12 14l9-5-9-5-9 5 9 5z" />
        <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
    </svg>
);

const initialEducationItem: JsonResumeEducationItem = {
    institution: '',
    area: '',
    studyType: '',
    startDate: '',
    endDate: '',
    score: '',
    courses: [],
};

export const EducationsForm: React.FC<EducationsFormProps> = ({
    data,
    onChange,
}) => {
    const educations = data.education || [];

    const handleEducationChange = (index: number, field: keyof JsonResumeEducationItem, value: string | string[]) => {
        const education = [...educations];
        education[index] = { ...education[index], [field]: value };
        onChange({ ...data, education });
    };

    const addEducation = () => {
        onChange({
            ...data,
            education: [...educations, { ...initialEducationItem }],
        });
    };

    const deleteEducation = (index: number) => {
        const education = educations.filter((_, i) => i !== index);
        onChange({ ...data, education });
    };

    const moveEducation = (index: number, direction: 'up' | 'down') => {
        const education = [...educations];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= education.length) return;

        [education[index], education[newIndex]] = [education[newIndex], education[index]];
        onChange({ ...data, education });
    };

    return (
        <FormSection
            title="Education"
            icon={<EducationIcon />}
            onAdd={addEducation}
            addButtonText="Add Education"
            isCollapsible
            defaultExpanded={false}
            variant="row"
        >
            {educations.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic py-4">
                    No education added yet. Click "Add Education" to add your academic background.
                </p>
            ) : (
                educations.map((item, index) => (
                    <FormItem
                        key={index}
                        index={index}
                        total={educations.length}
                        onMoveUp={() => moveEducation(index, 'up')}
                        onMoveDown={() => moveEducation(index, 'down')}
                        onDelete={() => deleteEducation(index)}
                    >
                        {/* Institution */}
                        <Input
                            label="Institution"
                            labelClassName="col-span-6"
                            name={`institution-${index}`}
                            placeholder="University Name"
                            value={item.institution || ''}
                            onChange={(v) => handleEducationChange(index, 'institution', v)}
                        />

                        {/* Degree Type and Field */}
                        <Input
                            label="Degree"
                            labelClassName="col-span-3"
                            name={`studyType-${index}`}
                            placeholder="Bachelor's, Master's, PhD"
                            value={item.studyType || item.degree || ''}
                            onChange={(v) => handleEducationChange(index, 'studyType', v)}
                        />
                        <Input
                            label="Field of Study"
                            labelClassName="col-span-3"
                            name={`area-${index}`}
                            placeholder="Computer Science"
                            value={item.area || ''}
                            onChange={(v) => handleEducationChange(index, 'area', v)}
                        />

                        {/* Dates and GPA */}
                        <Input
                            label="Start Date"
                            labelClassName="col-span-2"
                            name={`startDate-${index}`}
                            placeholder="Sep 2016"
                            value={item.startDate || ''}
                            onChange={(v) => handleEducationChange(index, 'startDate', v)}
                        />
                        <Input
                            label="End Date"
                            labelClassName="col-span-2"
                            name={`endDate-${index}`}
                            placeholder="May 2020"
                            value={item.endDate || ''}
                            onChange={(v) => handleEducationChange(index, 'endDate', v)}
                        />
                        <Input
                            label="GPA/Score"
                            labelClassName="col-span-2"
                            name={`score-${index}`}
                            placeholder="3.8/4.0"
                            value={item.score || ''}
                            onChange={(v) => handleEducationChange(index, 'score', v)}
                        />

                        {/* Relevant Courses */}
                        <BulletListTextarea
                            label="Relevant Courses (optional)"
                            labelClassName="col-span-6"
                            name={`courses-${index}`}
                            value={item.courses || []}
                            placeholder="• Add relevant courses"
                            onChange={(v) => handleEducationChange(index, 'courses', v)}
                        />
                    </FormItem>
                ))
            )}
        </FormSection>
    );
};

export default EducationsForm;
