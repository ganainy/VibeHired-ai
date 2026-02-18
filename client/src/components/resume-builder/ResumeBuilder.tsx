import React from 'react';
import { JsonResumeSchema } from '../../../../server/src/types/jsonresume';
import { getSectionAnchorId } from '../../constants/cvSections';
import {
    ProfileForm,
    WorkExperiencesForm,
    EducationsForm,
    SkillsForm,
    ProjectsForm,
    LanguagesForm,
    CertificatesForm,
} from './Forms';

interface ResumeBuilderProps {
    data: JsonResumeSchema;
    onChange: (data: JsonResumeSchema) => void;
    onImproveSection?: (sectionName: string, sectionIndex: number, originalData: any, customInstructions?: string) => void;
    improvingSections?: Record<string, boolean>;
}

/**
 * ResumeBuilder is the main container that combines all resume section forms
 * into a cohesive resume building experience.
 */
export const ResumeBuilder: React.FC<ResumeBuilderProps> = ({
    data,
    onChange,
    onImproveSection,
    improvingSections = {},
}) => {
    // Handler for improving the summary/profile section
    const handleImproveProfile = (customInstructions?: string) => {
        if (onImproveSection && data.basics) {
            onImproveSection('basics', 0, data.basics, customInstructions);
        }
    };

    // Handler for improving work experience entries
    const handleImproveWork = (index: number, customInstructions?: string) => {
        if (onImproveSection && data.work?.[index]) {
            onImproveSection('work', index, data.work[index], customInstructions);
        }
    };

    return (
        <div className="resume-builder w-full">
            {/* Header */}
            <div className="pb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Resume Sections</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage and organize your professional details for this version.</p>
            </div>

            {/* Sections List */}
            <div className="divide-y divide-gray-100 dark:divide-gray-700 border-t border-gray-100 dark:border-gray-700">
                <section
                    id={getSectionAnchorId('basics')}
                    data-section-key="profile"
                    className="scroll-mt-28"
                >
                    <ProfileForm
                        data={data}
                        onChange={onChange}
                        onImprove={handleImproveProfile}
                        isImproving={improvingSections['basics-0'] || false}
                    />
                </section>

                <section
                    id={getSectionAnchorId('work')}
                    data-section-key="work"
                    className="scroll-mt-28"
                >
                    <WorkExperiencesForm
                        data={data}
                        onChange={onChange}
                        onImprove={handleImproveWork}
                        improvingSections={improvingSections}
                    />
                </section>

                <section
                    id={getSectionAnchorId('projects')}
                    data-section-key="projects"
                    className="scroll-mt-28"
                >
                    <ProjectsForm
                        data={data}
                        onChange={onChange}
                    />
                </section>

                <section
                    id={getSectionAnchorId('education')}
                    data-section-key="education"
                    className="scroll-mt-28"
                >
                    <EducationsForm
                        data={data}
                        onChange={onChange}
                    />
                </section>

                <section
                    id={getSectionAnchorId('skills')}
                    data-section-key="skills"
                    className="scroll-mt-28"
                >
                    <SkillsForm
                        data={data}
                        onChange={onChange}
                    />
                </section>

                <section
                    id={getSectionAnchorId('languages')}
                    data-section-key="languages"
                    className="scroll-mt-28"
                >
                    <LanguagesForm
                        data={data}
                        onChange={onChange}
                    />
                </section>

                <section
                    id={getSectionAnchorId('certificates')}
                    data-section-key="certifications"
                    className="scroll-mt-28"
                >
                    <CertificatesForm
                        data={data}
                        onChange={onChange}
                    />
                </section>
            </div>
        </div>
    );
};

export default ResumeBuilder;
