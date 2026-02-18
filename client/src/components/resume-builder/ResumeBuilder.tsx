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
        <div className="resume-builder flex flex-col gap-8 max-w-3xl mx-auto p-4">
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

            <div className="border-t border-slate-200 dark:border-slate-800" />

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

            <div className="border-t border-slate-200 dark:border-slate-800" />

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

            <div className="border-t border-slate-200 dark:border-slate-800" />

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

            <div className="border-t border-slate-200 dark:border-slate-800" />

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

            <div className="border-t border-slate-200 dark:border-slate-800" />

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

            <div className="border-t border-slate-200 dark:border-slate-800" />

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
    );
};

export default ResumeBuilder;
