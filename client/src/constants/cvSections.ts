export type CvSectionKey =
  | 'basics'
  | 'work'
  | 'projects'
  | 'education'
  | 'skills'
  | 'languages'
  | 'certificates'
  | 'volunteer'
  | 'awards'
  | 'publications'
  | 'interests'
  | 'references';

export interface CvSectionConfig {
  key: CvSectionKey;
  label: string;
  anchorId: string;
}

export const CV_SECTIONS: CvSectionConfig[] = [
  { key: 'basics', label: 'Profile', anchorId: 'cv-section-basics' },
  { key: 'work', label: 'Experience', anchorId: 'cv-section-work' },
  { key: 'projects', label: 'Projects', anchorId: 'cv-section-projects' },
  { key: 'education', label: 'Education', anchorId: 'cv-section-education' },
  { key: 'skills', label: 'Skills', anchorId: 'cv-section-skills' },
  { key: 'languages', label: 'Languages', anchorId: 'cv-section-languages' },
  { key: 'certificates', label: 'Certificates', anchorId: 'cv-section-certificates' },
  { key: 'volunteer', label: 'Volunteer', anchorId: 'cv-section-volunteer' },
  { key: 'awards', label: 'Awards', anchorId: 'cv-section-awards' },
  { key: 'publications', label: 'Publications', anchorId: 'cv-section-publications' },
  { key: 'interests', label: 'Interests', anchorId: 'cv-section-interests' },
  { key: 'references', label: 'References', anchorId: 'cv-section-references' },
];

export const getSectionAnchorId = (key: CvSectionKey): string => {
  const match = CV_SECTIONS.find((section) => section.key === key);
  return match ? match.anchorId : key;
};
