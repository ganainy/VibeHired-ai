import React from 'react';
import { JsonResumeSchema, JsonResumeBasics } from '../../../../../server/src/types/jsonresume';
import { FormSection } from '../Form';
import { Input, Textarea } from '../Form/InputGroup';

interface ProfileFormProps {
    data: JsonResumeSchema;
    onChange: (data: JsonResumeSchema) => void;
    onImprove?: (customInstructions?: string) => void;
    isImproving?: boolean;
}

/**
 * ProfileForm handles the basic/header information for the resume
 */
const UserIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
);

export const ProfileForm: React.FC<ProfileFormProps> = ({
    data,
    onChange,
    onImprove,
    isImproving = false,
}) => {
    const basics = data.basics || {};
    const location = basics.location || {};

    const handleBasicsChange = (field: keyof JsonResumeBasics, value: string) => {
        onChange({
            ...data,
            basics: {
                ...basics,
                [field]: value,
            },
        });
    };

    const handleLocationChange = (field: string, value: string) => {
        onChange({
            ...data,
            basics: {
                ...basics,
                location: {
                    ...location,
                    [field]: value,
                },
            },
        });
    };

    return (
        <FormSection title="Personal Details" icon={<UserIcon />} isCollapsible defaultExpanded={false}>
            <div className="grid grid-cols-6 gap-6">
                {/* Name - Half Width */}
                <Input
                    label="Full Name"
                    labelClassName="col-span-3"
                    name="name"
                    placeholder="Jane Smith"
                    value={basics.name || ''}
                    onChange={(v) => handleBasicsChange('name', v)}
                />

                {/* Job Title - Half Width */}
                <Input
                    label="Job Title"
                    labelClassName="col-span-3"
                    name="label"
                    placeholder="Senior UX Designer"
                    value={basics.label || ''}
                    onChange={(v) => handleBasicsChange('label', v)}
                />

                {/* Email - Half Width */}
                <Input
                    label="Email"
                    labelClassName="col-span-3"
                    name="email"
                    type="email"
                    placeholder="jane.smith@example.com"
                    value={basics.email || ''}
                    onChange={(v) => handleBasicsChange('email', v)}
                />

                {/* Phone - Half Width */}
                <Input
                    label="Phone"
                    labelClassName="col-span-3"
                    name="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={basics.phone || ''}
                    onChange={(v) => handleBasicsChange('phone', v)}
                />

                {/* Location - Full Width */}
                <div className="col-span-6">
                    <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-0.5">Location</label>
                    <div className="grid grid-cols-3 gap-2">
                        <input
                            type="text"
                            placeholder="City"
                            className="mt-1 block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700 transition-all"
                            value={location.city || ''}
                            onChange={(e) => handleLocationChange('city', e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="Region/State"
                            className="mt-1 block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700 transition-all"
                            value={location.region || ''}
                            onChange={(e) => handleLocationChange('region', e.target.value)}
                        />
                        <input
                            type="text"
                            placeholder="Country Code"
                            className="mt-1 block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 dark:ring-gray-700 transition-all"
                            value={location.countryCode || ''}
                            onChange={(e) => handleLocationChange('countryCode', e.target.value)}
                        />
                    </div>
                </div>


                {/* Summary/Objective - Full Width */}
                <div className="col-span-6 mt-2">
                    <FormSection
                        title="Professional Summary"
                        icon={
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                            </svg>
                        }
                        className="!p-0 !shadow-none !border-0 !bg-transparent"
                    >
                        <div className="flex items-center justify-between mb-1">
                            {onImprove && (
                                <button
                                    type="button"
                                    onClick={() => onImprove()}
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
                        <Textarea
                            label=""
                            name="summary"
                            placeholder="A brief professional summary highlighting your key skills and experience..."
                            value={basics.summary || ''}
                            onChange={(v) => handleBasicsChange('summary', v)}
                            rows={4}
                        />
                    </FormSection>
                </div>

                {/* Additional Links */}
                <div className="col-span-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Additional Details</h4>
                    <div className="grid grid-cols-6 gap-6">
                        {/* Website */}
                        <Input
                            label="Website"
                            labelClassName="col-span-2"
                            name="url"
                            type="url"
                            placeholder="yourportfolio.com"
                            value={basics.url || ''}
                            onChange={(v) => handleBasicsChange('url', v)}
                        />

                        {/* LinkedIn */}
                        <Input
                            label="LinkedIn"
                            labelClassName="col-span-2"
                            name="linkedin"
                            type="url"
                            placeholder="linkedin.com/in/you"
                            value={basics.profiles?.find(p => p.network?.toLowerCase() === 'linkedin')?.url || ''}
                            onChange={(v) => {
                                const profiles = basics.profiles || [];
                                const otherProfiles = profiles.filter(p => p.network?.toLowerCase() !== 'linkedin');
                                const newProfiles = v ? [...otherProfiles, { network: 'LinkedIn', url: v, username: v.split('/').pop() || '' }] : otherProfiles;
                                onChange({
                                    ...data,
                                    basics: { ...basics, profiles: newProfiles }
                                });
                            }}
                        />

                        {/* GitHub */}
                        <Input
                            label="GitHub"
                            labelClassName="col-span-2"
                            name="github"
                            type="url"
                            placeholder="github.com/you"
                            value={basics.profiles?.find(p => p.network?.toLowerCase() === 'github')?.url || ''}
                            onChange={(v) => {
                                const profiles = basics.profiles || [];
                                const otherProfiles = profiles.filter(p => p.network?.toLowerCase() !== 'github');
                                const otherProfilesFiltered = profiles.filter(p => p.network?.toLowerCase() !== 'github'); // Fix logic
                                const newProfiles = v ? [...otherProfilesFiltered, { network: 'GitHub', url: v, username: v.split('/').pop() || '' }] : otherProfilesFiltered;
                                onChange({
                                    ...data,
                                    basics: { ...basics, profiles: newProfiles }
                                });
                            }}
                        />
                    </div>
                </div>
            </div>
        </FormSection>
    );
};

export default ProfileForm;
