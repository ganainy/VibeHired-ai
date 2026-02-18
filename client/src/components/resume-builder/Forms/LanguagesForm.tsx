import React from 'react';
import { JsonResumeSchema, JsonResumeLanguageItem } from '../../../../../server/src/types/jsonresume';
import { FormSection, FormItem } from '../Form';
import { Input } from '../Form/InputGroup';

interface LanguagesFormProps {
    data: JsonResumeSchema;
    onChange: (data: JsonResumeSchema) => void;
}

const LanguagesIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
    </svg>
);

const FLUENCY_OPTIONS = [
    'Native speaker',
    'Fluent',
    'Professional working proficiency',
    'Advanced (C1)',
    'Upper Intermediate (B2)',
    'Intermediate (B1)',
    'Elementary (A2)',
    'Beginner (A1)',
];

const initialLanguageItem: JsonResumeLanguageItem = {
    language: '',
    fluency: '',
};

export const LanguagesForm: React.FC<LanguagesFormProps> = ({
    data,
    onChange,
}) => {
    const languages = data.languages || [];

    const handleLanguageChange = (index: number, field: keyof JsonResumeLanguageItem, value: string) => {
        const updatedLanguages = [...languages];
        updatedLanguages[index] = { ...updatedLanguages[index], [field]: value };
        onChange({ ...data, languages: updatedLanguages });
    };

    const addLanguage = () => {
        onChange({
            ...data,
            languages: [...languages, { ...initialLanguageItem }],
        });
    };

    const deleteLanguage = (index: number) => {
        const updatedLanguages = languages.filter((_, i) => i !== index);
        onChange({ ...data, languages: updatedLanguages });
    };

    const moveLanguage = (index: number, direction: 'up' | 'down') => {
        const updatedLanguages = [...languages];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= updatedLanguages.length) return;

        [updatedLanguages[index], updatedLanguages[newIndex]] = [updatedLanguages[newIndex], updatedLanguages[index]];
        onChange({ ...data, languages: updatedLanguages });
    };

    return (
        <FormSection
            title="Languages"
            icon={<LanguagesIcon />}
            onAdd={addLanguage}
            addButtonText="Add Language"
            isCollapsible
            defaultExpanded={false}
        >
            {languages.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic py-4">
                    No languages added yet. Click "Add Language" to list your language skills.
                </p>
            ) : (
                languages.map((item, index) => (
                    <FormItem
                        key={index}
                        index={index}
                        total={languages.length}
                        onMoveUp={() => moveLanguage(index, 'up')}
                        onMoveDown={() => moveLanguage(index, 'down')}
                        onDelete={() => deleteLanguage(index)}
                    >
                        {/* Language Name */}
                        <Input
                            label="Language"
                            labelClassName="col-span-3"
                            name={`language-${index}`}
                            placeholder="English, German, Spanish"
                            value={item.language || ''}
                            onChange={(v) => handleLanguageChange(index, 'language', v)}
                        />

                        {/* Fluency Level */}
                        <div className="col-span-3">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Proficiency
                            </label>
                            <select
                                value={item.fluency || ''}
                                onChange={(e) => handleLanguageChange(index, 'fluency', e.target.value)}
                                className="mt-1 px-3 py-2 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            >
                                <option value="">Select level</option>
                                {/* Show current value as option if it doesn't match preset options */}
                                {item.fluency && !FLUENCY_OPTIONS.includes(item.fluency) && (
                                    <option value={item.fluency}>{item.fluency} (imported)</option>
                                )}
                                {FLUENCY_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </FormItem>
                ))
            )}
        </FormSection>
    );
};

export default LanguagesForm;
