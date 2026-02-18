import React from 'react';
import { JsonResumeSchema, JsonResumeSkillItem } from '../../../../../server/src/types/jsonresume';
import { FormSection, FormItem } from '../Form';
import { Input } from '../Form/InputGroup';

interface SkillsFormProps {
    data: JsonResumeSchema;
    onChange: (data: JsonResumeSchema) => void;
}

const SkillsIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const initialSkillItem: JsonResumeSkillItem = {
    name: '',
    level: '',
    keywords: [],
};

export const SkillsForm: React.FC<SkillsFormProps> = ({
    data,
    onChange,
}) => {
    const skills = data.skills || [];

    const handleSkillChange = (index: number, field: keyof JsonResumeSkillItem, value: string | string[]) => {
        const updatedSkills = [...skills];
        updatedSkills[index] = { ...updatedSkills[index], [field]: value };
        onChange({ ...data, skills: updatedSkills });
    };

    const handleKeywordChange = (skillIndex: number, keywordIndex: number, value: string) => {
        const updatedSkills = [...skills];
        const keywords = [...(updatedSkills[skillIndex].keywords || [])];

        if (value.trim() === '') {
            // Remove empty keyword
            keywords.splice(keywordIndex, 1);
        } else {
            keywords[keywordIndex] = value;
        }

        updatedSkills[skillIndex] = { ...updatedSkills[skillIndex], keywords };
        onChange({ ...data, skills: updatedSkills });
    };

    const addKeyword = (skillIndex: number) => {
        const updatedSkills = [...skills];
        const keywords = [...(updatedSkills[skillIndex].keywords || []), ''];
        updatedSkills[skillIndex] = { ...updatedSkills[skillIndex], keywords };
        onChange({ ...data, skills: updatedSkills });
    };

    const addSkillCategory = () => {
        onChange({
            ...data,
            skills: [...skills, { ...initialSkillItem }],
        });
    };

    const deleteSkillCategory = (index: number) => {
        const updatedSkills = skills.filter((_, i) => i !== index);
        onChange({ ...data, skills: updatedSkills });
    };

    const moveSkillCategory = (index: number, direction: 'up' | 'down') => {
        const updatedSkills = [...skills];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= updatedSkills.length) return;

        [updatedSkills[index], updatedSkills[newIndex]] = [updatedSkills[newIndex], updatedSkills[index]];
        onChange({ ...data, skills: updatedSkills });
    };

    return (
        <FormSection
            title="Skills"
            icon={<SkillsIcon />}
            onAdd={addSkillCategory}
            addButtonText="Add Skill Category"
            isCollapsible
            defaultExpanded={false}
            variant="row"
        >
            {skills.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic py-4">
                    No skills added yet. Click "Add Skill Category" to organize your skills.
                </p>
            ) : (
                skills.map((skillCategory, index) => (
                    <FormItem
                        key={index}
                        index={index}
                        total={skills.length}
                        onMoveUp={() => moveSkillCategory(index, 'up')}
                        onMoveDown={() => moveSkillCategory(index, 'down')}
                        onDelete={() => deleteSkillCategory(index)}
                    >
                        {/* Category Name */}
                        <Input
                            label="Category"
                            labelClassName="col-span-4"
                            name={`skillCategory-${index}`}
                            placeholder="e.g., Programming Languages, Frameworks, Tools"
                            value={skillCategory.name || ''}
                            onChange={(v) => handleSkillChange(index, 'name', v)}
                        />
                        <Input
                            label="Level (optional)"
                            labelClassName="col-span-2"
                            name={`skillLevel-${index}`}
                            placeholder="Expert, Advanced"
                            value={skillCategory.level || ''}
                            onChange={(v) => handleSkillChange(index, 'level', v)}
                        />

                        {/* Keywords/Skills */}
                        <div className="col-span-6">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                                Skills
                            </label>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {(skillCategory.keywords || []).map((keyword, kIndex) => (
                                    <div
                                        key={kIndex}
                                        className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1"
                                    >
                                        <input
                                            type="text"
                                            value={keyword}
                                            onChange={(e) => handleKeywordChange(index, kIndex, e.target.value)}
                                            placeholder="Skill"
                                            className="bg-transparent border-none outline-none text-sm text-gray-800 dark:text-gray-200 w-auto min-w-[60px]"
                                            style={{ width: `${Math.max(60, keyword.length * 8 + 16)}px` }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleKeywordChange(index, kIndex, '')}
                                            className="ml-1 text-gray-400 hover:text-red-500 transition-colors"
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
                                    className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 dark:text-blue-400 border border-dashed border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add Skill
                                </button>
                            </div>
                        </div>
                    </FormItem>
                ))
            )}
        </FormSection>
    );
};

export default SkillsForm;
