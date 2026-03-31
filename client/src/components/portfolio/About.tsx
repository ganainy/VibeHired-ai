// client/src/components/portfolio/About.tsx
import React from 'react';
import { Badge } from '../common';
import { AggregatedProfile } from '../../services/portfolioApi';

// Helper: country code from language name (for language badge labels)
const getCountryCode = (language: string): string => {
  const languageMap: { [key: string]: string } = {
    'english': 'GB', 'german': 'DE', 'french': 'FR', 'spanish': 'ES',
    'italian': 'IT', 'portuguese': 'PT', 'dutch': 'NL', 'russian': 'RU',
    'chinese': 'CN', 'japanese': 'JP', 'korean': 'KR', 'arabic': 'SA',
    'hindi': 'IN', 'polish': 'PL', 'turkish': 'TR', 'swedish': 'SE',
    'norwegian': 'NO', 'danish': 'DK', 'finnish': 'FI', 'greek': 'GR',
    'czech': 'CZ', 'hungarian': 'HU', 'romanian': 'RO', 'ukrainian': 'UA',
    'vietnamese': 'VN', 'thai': 'TH', 'indonesian': 'ID', 'malay': 'MY',
    'hebrew': 'IL', 'persian': 'IR', 'urdu': 'PK',
  };
  return languageMap[language.toLowerCase().trim()] || '';
};

interface AboutProps {
  profile: AggregatedProfile;
  username: string;
}

const About: React.FC<AboutProps> = ({ profile }) => {
  const { skills, linkedinData } = profile;

  const linkedInExperience = linkedinData?.experience;
  const linkedInSkills = linkedinData?.skills;
  const linkedInLanguages = linkedinData?.languages;

  return (
    <>
      {/* Skills Section */}
      {skills && (skills.programmingLanguages?.length > 0 || skills.otherSkills?.length > 0) && (
        <section className="py-16 md:py-24 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8" id="skills" style={{ background: 'var(--bg-surface)' }}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-10" style={{ fontFamily: 'var(--font-display)' }}>Technical Skills</h2>
            <div className="space-y-8">
              {skills.programmingLanguages && skills.programmingLanguages.length > 0 && (
                <div>
                  <p className="label-overline mb-4">Programming Languages</p>
                  <div className="flex flex-wrap gap-2">
                    {skills.programmingLanguages.map((lang: string, index: number) => (
                      <Badge
                        key={`lang-${index}`}
                        variant="gold"
                        className="transition-all duration-200 hover:scale-105 cursor-default"
                      >
                        {lang}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {skills.otherSkills && skills.otherSkills.length > 0 && (() => {
                const frameworks = skills.otherSkills.filter((skill: string) =>
                  /react|vue|angular|next|express|django|flask|spring|laravel|rails|flutter|react-native/i.test(skill)
                );
                const tools = skills.otherSkills.filter((skill: string) =>
                  !/react|vue|angular|next|express|django|flask|spring|laravel|rails|flutter|react-native/i.test(skill)
                );
                return (
                  <>
                    {frameworks.length > 0 && (
                      <div>
                        <p className="label-overline mb-4">Frameworks & Libraries</p>
                        <div className="flex flex-wrap gap-2">
                          {frameworks.map((skill: string, index: number) => (
                            <Badge
                              key={`framework-${index}`}
                              variant="ink"
                              className="transition-all duration-200 hover:scale-105 cursor-default"
                            >
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {tools.length > 0 && (
                      <div>
                        <p className="label-overline mb-4">Tools & Technologies</p>
                        <div className="flex flex-wrap gap-2">
                          {tools.map((skill: string, index: number) => (
                            <Badge
                              key={`tool-${index}`}
                              variant="ink"
                              className="transition-all duration-200 hover:scale-105 cursor-default"
                            >
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </section>
      )}

      {/* LinkedIn Experience Section */}
      {linkedInExperience && linkedInExperience.length > 0 && (
        <section className="py-16 md:py-24" id="experience">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12" style={{ fontFamily: 'var(--font-display)' }}>Work Experience</h2>
            <div className="relative space-y-12" style={{ borderLeft: '2px solid var(--border)' }}>
              {linkedInExperience.map((exp: any, index: number) => (
                <div key={`exp-${index}`} className="relative pl-8 transition-all duration-300 hover:translate-x-1 group">
                  <div
                    className="absolute left-0 -translate-x-1/2 top-1 h-4 w-4 rounded-full transition-all duration-300 group-hover:scale-125"
                    style={{ background: 'var(--accent)', boxShadow: '0 0 0 4px var(--bg-base)' }}
                  />
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                    {exp.startDate?.month && exp.startDate?.year ? `${exp.startDate.month} ${exp.startDate.year}` : ''}
                    {exp.startDate && (exp.endDate || exp.isCurrent) ? ' – ' : ''}
                    {exp.isCurrent ? 'Present' : exp.endDate?.month && exp.endDate?.year ? `${exp.endDate.month} ${exp.endDate.year}` : ''}
                  </p>
                  <h3 className="text-xl font-semibold mt-1">{exp.title || 'Position'}</h3>
                  <p className="font-medium mb-1" style={{ color: 'var(--accent)' }}>{exp.company || 'Company'}</p>
                  {exp.location && <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>{exp.location}</p>}
                  {exp.description && <p style={{ color: 'var(--text-secondary)' }}>{exp.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* LinkedIn Skills Section */}
      {linkedInSkills && linkedInSkills.length > 0 && (
        <section className="py-16 md:py-24 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--bg-surface)' }}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-10" style={{ fontFamily: 'var(--font-display)' }}>LinkedIn Skills</h2>
            <div className="flex flex-wrap gap-2 justify-center">
              {linkedInSkills.map((skill: string, index: number) => (
                <Badge
                  key={`linkedin-skill-${index}`}
                  variant="ink"
                  className="transition-all duration-200 hover:scale-105 cursor-default"
                >
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* LinkedIn Languages Section */}
      {linkedInLanguages && linkedInLanguages.length > 0 && (
        <section className="py-16 md:py-24 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--bg-surface)' }}>
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-10" style={{ fontFamily: 'var(--font-display)' }}>Languages</h2>
            <div className="flex flex-wrap gap-3 justify-center">
              {linkedInLanguages.map((lang: any, index: number) => {
                const languageName = lang.language || lang;
                const countryCode = getCountryCode(languageName);
                return (
                  <Badge
                    key={`linkedin-lang-${index}`}
                    variant="jade"
                    className="flex items-center gap-2 transition-all duration-200 hover:scale-105 cursor-default"
                  >
                    {countryCode && (
                      <span
                        className="text-xs font-bold flex items-center justify-center rounded-full w-5 h-5"
                        style={{ background: 'var(--bg-raised)', color: 'var(--text-secondary)' }}
                      >
                        {countryCode}
                      </span>
                    )}
                    <span>
                      {languageName}
                      {lang.proficiency && ` (${lang.proficiency})`}
                    </span>
                  </Badge>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </>
  );
};

export default About;