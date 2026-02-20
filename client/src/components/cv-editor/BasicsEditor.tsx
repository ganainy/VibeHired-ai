import React, { useState } from 'react';
import { EditorProps } from './types';
import { JsonResumeBasics, JsonResumeProfile } from '../../../../server/src/types/jsonresume';
import { SectionScore } from '../../services/analysisApi'; // Import SectionScore
import SectionAnalysisPanel from './SectionAnalysisPanel'; // Import the panel
import ArrayItemControls from './ArrayItemControls'; // Import ArrayItemControls

// Update props to include analysis and onApplyImprovements
interface BasicsEditorProps extends EditorProps<JsonResumeBasics | undefined> {
    analysis?: SectionScore | null;
    onApplyImprovements?: () => Promise<void>;
}

const BasicsEditor: React.FC<BasicsEditorProps> = ({ data = {}, onChange, analysis }) => {
    const [showAnalysis, setShowAnalysis] = useState(false);

    const handleChange = (field: keyof JsonResumeBasics, value: string) => {
        onChange({ ...data, [field]: value });
    };

    const handleLocationChange = (field: keyof NonNullable<JsonResumeBasics['location']>, value: string) => {
        onChange({
            ...data,
            location: {
                ...(data?.location || {}),
                [field]: value,
            },
        });
    };

    // Handlers for profiles array
    const handleProfileChange = (index: number, field: keyof JsonResumeProfile, value: string) => {
        const profiles = [...(data?.profiles || [])];
        if (!profiles[index]) {
            profiles[index] = { network: '', username: '', url: '' };
        }
        profiles[index] = { ...profiles[index], [field]: value };
        onChange({ ...data, profiles });
    };

    const handleAddProfile = () => {
        const profiles = [...(data?.profiles || []), { network: '', username: '', url: '' }];
        onChange({ ...data, profiles });
    };

    const handleDeleteProfile = (index: number) => {
        const profiles = (data?.profiles || []).filter((_, i) => i !== index);
        onChange({ ...data, profiles });
    };

    return (
        <div>
            {/* Conditionally render the analysis panel */}
            {/* TODO: Fix SectionAnalysisPanel props to match interface */}
            {/* {showAnalysis && analysis && (
                <div className="mb-2">
                    <SectionAnalysisPanel issues={analysis.issues} suggestions={analysis.suggestions} />
                </div>
            )} */}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {/* Name */}
                    <div>
                        <label htmlFor="basics-name" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Full Name</label>
                        <input
                            type="text"
                            id="basics-name"
                            value={data.name || ''}
                            onChange={(e) => handleChange('name', e.target.value)}
                            placeholder="Your Full Name"
                            className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-xs"
                        />
                    </div>

                    {/* Label/Title */}
                    <div>
                        <label htmlFor="basics-label" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Label / Job Title</label>
                        <input
                            type="text"
                            id="basics-label"
                            value={data.label || ''}
                            onChange={(e) => handleChange('label', e.target.value)}
                            placeholder="e.g., Software Engineer"
                            className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-xs"
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label htmlFor="basics-email" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Email</label>
                        <input
                            type="email"
                            id="basics-email"
                            value={data.email || ''}
                            onChange={(e) => handleChange('email', e.target.value)}
                            placeholder="your.email@example.com"
                            className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-xs"
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <label htmlFor="basics-phone" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Phone</label>
                        <input
                            type="tel"
                            id="basics-phone"
                            value={data.phone || ''}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            placeholder="+1 123-456-7890"
                            className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-xs"
                        />
                    </div>

                    {/* Website URL */}
                    <div>
                        <label htmlFor="basics-url" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Website/Portfolio URL</label>
                        <input
                            type="url"
                            id="basics-url"
                            value={data.url || ''}
                            onChange={(e) => handleChange('url', e.target.value)}
                            placeholder="https://your-portfolio.com"
                            className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-xs"
                        />
                    </div>

                    {/* Location: Address */}
                    <div>
                        <label htmlFor="basics-location-address" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Address</label>
                        <input
                            type="text"
                            id="basics-location-address"
                            value={data.location?.address || ''}
                            onChange={(e) => handleLocationChange('address', e.target.value)}
                            placeholder="123 Main St"
                            className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-xs"
                        />
                    </div>

                    {/* Location: Postal Code */}
                    <div>
                        <label htmlFor="basics-location-postalCode" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Postal Code</label>
                        <input
                            type="text"
                            id="basics-location-postalCode"
                            value={data.location?.postalCode || ''}
                            onChange={(e) => handleLocationChange('postalCode', e.target.value)}
                            placeholder="90210"
                            className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-xs"
                        />
                    </div>

                    {/* Location: City */}
                    <div>
                        <label htmlFor="basics-location-city" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">City</label>
                        <input
                            type="text"
                            id="basics-location-city"
                            value={data.location?.city || ''}
                            onChange={(e) => handleLocationChange('city', e.target.value)}
                            placeholder="Beverly Hills"
                            className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-xs"
                        />
                    </div>

                    {/* Location: Country Code */}
                    <div>
                        <label htmlFor="basics-location-countryCode" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Country Code</label>
                        <input
                            type="text"
                            id="basics-location-countryCode"
                            value={data.location?.countryCode || ''}
                            onChange={(e) => handleLocationChange('countryCode', e.target.value)}
                            placeholder="US"
                            className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-xs"
                        />
                    </div>

                    {/* Location: Region/State */}
                    <div>
                        <label htmlFor="basics-location-region" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Region/State</label>
                        <input
                            type="text"
                            id="basics-location-region"
                            value={data.location?.region || ''}
                            onChange={(e) => handleLocationChange('region', e.target.value)}
                            placeholder="California"
                            className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-xs"
                        />
                    </div>

                    {/* Summary */}
                    <div className="md:col-span-2">
                        <label htmlFor="basics-summary" className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Summary / Professional Profile</label>
                        <textarea
                            id="basics-summary"
                            value={data.summary || ''}
                            onChange={(e) => handleChange('summary', e.target.value)}
                            placeholder="A brief summary about yourself..."
                            className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-xs"
                            rows={3}
                        />
                    </div>

                    {/* Profiles - Rendered separately below */}
                    <div className="md:col-span-2">
                        <h4 className="text-xs font-semibold mb-1 mt-2 dark:text-gray-200">Profiles (e.g., LinkedIn, GitHub)</h4>
                        {data.profiles && data.profiles.length > 0 ? (
                            <ul className="space-y-2">
                                {data.profiles.map((profile: JsonResumeProfile, index: number) => (
                                    <li key={index} className="p-2 border dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-600 space-y-1">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                                            <div>
                                                <label htmlFor={`profile-network-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Network</label>
                                                <input
                                                    type="text"
                                                    id={`profile-network-${index}`}
                                                    value={profile.network || ''}
                                                    onChange={(e) => handleProfileChange(index, 'network', e.target.value)}
                                                    placeholder="e.g., LinkedIn, GitHub"
                                                    className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-xs"
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor={`profile-username-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">Username</label>
                                                <input
                                                    type="text"
                                                    id={`profile-username-${index}`}
                                                    value={profile.username || ''}
                                                    onChange={(e) => handleProfileChange(index, 'username', e.target.value)}
                                                    placeholder="Your username"
                                                    className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-xs"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label htmlFor={`profile-url-${index}`} className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">URL</label>
                                                <input
                                                    type="url"
                                                    id={`profile-url-${index}`}
                                                    value={profile.url || ''}
                                                    onChange={(e) => handleProfileChange(index, 'url', e.target.value)}
                                                    placeholder="https://linkedin.com/in/yourprofile"
                                                    className="w-full px-1.5 py-0.5 border dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-xs"
                                                />
                                            </div>
                                        </div>
                                        <ArrayItemControls index={index} onDelete={() => handleDeleteProfile(index)} />
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 italic text-xs">No profiles added yet.</p>
                        )}
                        <button
                            type="button"
                            onClick={handleAddProfile}
                            className="mt-2 px-2 py-1 bg-blue-500 dark:bg-blue-700 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-800 text-xs"
                        >
                            Add Profile
                        </button>
                    </div>
                </div>
        </div>
    );
};

export default BasicsEditor;
