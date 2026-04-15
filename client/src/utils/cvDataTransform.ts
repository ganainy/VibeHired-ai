import { JsonResumeSchema } from '../../../server/src/types/jsonresume';

export interface Experience {
  id: string;
  company: string;
  title: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  description: string;
}

export interface Education {
  id: string;
  school: string;
  degree: string;
  field: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  gpa: string;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  date: string;
  credentialId?: string;
  url?: string;
}

export interface Language {
  id: string;
  name: string;
  proficiency: "Native" | "Fluent" | "Conversational" | "Basic";
  rating: number;
}

export interface CustomSection {
  id: string;
  heading: string;
  content: string;
}

export interface SectionLabels {
  summary?: string;
  work?: string;
  education?: string;
  skills?: string;
  languages?: string;
  projects?: string;
  certificates?: string;
  awards?: string;
  volunteer?: string;
  interests?: string;
  references?: string;
}

const GERMAN_SECTION_LABELS: SectionLabels = {
  summary: 'Zusammenfassung',
  work: 'Berufserfahrung',
  education: 'Ausbildung',
  skills: 'Fähigkeiten & Technologien',
  languages: 'Sprachen',
  projects: 'Projekte',
  certificates: 'Zertifikate',
  awards: 'Auszeichnungen',
  volunteer: 'Ehrenamt',
  interests: 'Interessen',
  references: 'Referenzen',
};

/** Detect German-language content via umlauts/ß or common German stopwords */
function detectGermanContent(jsonResume: JsonResumeSchema): boolean {
  const texts: string[] = [
    jsonResume.basics?.summary ?? '',
    jsonResume.basics?.label ?? '',
    ...(jsonResume.work ?? []).map(w => [w.summary ?? '', ...(w.highlights ?? [])].join(' ')),
    ...(jsonResume.education ?? []).map(e => [e.area ?? '', e.studyType ?? ''].join(' ')),
    ...(jsonResume.projects ?? []).map(p => [p.name ?? '', p.description ?? ''].join(' ')),
  ];
  const combined = texts.join(' ');
  // Unique German characters or high-frequency German stopwords
  return /[äöüßÄÖÜ]/.test(combined) ||
    /\b(und|oder|mit|von|für|auf|der|die|das|im|ist|sein|habe|haben|durch|sowie|bei|nach|als|werden|wurde)\b/i.test(combined);
}

export interface ResumeData {
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  linkedIn: string;
  github: string;
  website: string;
  summary: string;
  experiences: Experience[];
  education: Education[];
  skills: string[];
  projects: Project[];
  certifications: Certification[];
  languages: Language[];
  customSections: CustomSection[];
  selectedTemplate: string;
  sectionLabels?: SectionLabels;
}

function generateId(): string {
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function mapFluencyToProficiency(fluency?: string): "Native" | "Fluent" | "Conversational" | "Basic" {
  if (!fluency) return "Basic";
  const lower = fluency.toLowerCase();
  if (lower.includes("native")) return "Native";
  if (lower.includes("fluent") || lower.includes("c2") || lower.includes("c1")) return "Fluent";
  if (lower.includes("conversational") || lower.includes("b2") || lower.includes("b1")) return "Conversational";
  return "Basic";
}

function mapProficiencyToRating(proficiency: "Native" | "Fluent" | "Conversational" | "Basic"): number {
  switch (proficiency) {
    case "Native": return 5;
    case "Fluent": return 4;
    case "Conversational": return 3;
    case "Basic": return 2;
    default: return 2;
  }
}

function splitName(name?: string): { firstName: string; lastName: string } {
  if (!name) return { firstName: '', lastName: '' };
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(' ');
  return { firstName, lastName };
}

function extractLinkedIn(profiles?: Array<{ network?: string; url?: string }>): string {
  if (!profiles || !Array.isArray(profiles)) return '';
  const linkedInProfile = profiles.find(p =>
    p.network && p.network.toLowerCase().includes('linkedin')
  );
  return linkedInProfile?.url || '';
}

function extractWebsite(basics?: { url?: string; profiles?: Array<{ network?: string; url?: string }> }): string {
  if (basics?.url && !basics.url.toLowerCase().includes('linkedin.com') && !basics.url.toLowerCase().includes('github.com')) {
    return basics.url;
  }
  
  if (basics?.profiles && Array.isArray(basics.profiles)) {
    // 1. Try to find portfolio or personal website first
    const portfolioProfile = basics.profiles.find(p =>
      p.network && (
        p.network.toLowerCase().includes('portfolio') || 
        p.network.toLowerCase().includes('personal') ||
        p.network.toLowerCase().includes('website')
      )
    );
    if (portfolioProfile?.url) return portfolioProfile.url;

    // 2. Fallback to any network that isn't LinkedIn or GitHub
    const websiteProfile = basics.profiles.find(p =>
      p.network && 
      !p.network.toLowerCase().includes('linkedin') && 
      !p.network.toLowerCase().includes('github')
    );
    return websiteProfile?.url || (basics?.url || '');
  }
  return basics?.url || '';
}

function formatDescription(workItem: { summary?: string; highlights?: string[] }): string {
  const parts: string[] = [];
  if (workItem.summary) {
    parts.push(workItem.summary);
  }
  if (workItem.highlights && Array.isArray(workItem.highlights) && workItem.highlights.length > 0) {
    // Check if highlights already have bullets, otherwise add them
    const formattedHighlights = workItem.highlights.map(h => h.trim().startsWith('•') || h.trim().startsWith('-') ? h : `• ${h}`).join('\n');
    parts.push(formattedHighlights);
  }
  return parts.join('\n\n');
}


function extractGitHub(profiles?: Array<{ network?: string; url?: string }>): string {
  if (!profiles || !Array.isArray(profiles)) return '';
  const githubProfile = profiles.find(p =>
    p.network && p.network.toLowerCase().includes('github')
  );
  return githubProfile?.url || '';
}

export interface Project {
  id: string;
  name: string;
  description: string;
  highlights: string[];
  url?: string;
  startDate?: string;
  endDate?: string;
}

export function transformJsonResumeToResumeData(jsonResume: JsonResumeSchema, selectedTemplate: string = 'german-latex'): ResumeData {
  const basics = jsonResume.basics || {};
  const location = basics.location || {};
  const { firstName, lastName } = splitName(basics.name);

  // Debug logging to help diagnose empty CV issues
  if (Object.keys(basics).length === 0) {
    console.warn('⚠️ CV Transform: basics section is empty. Available top-level keys:', Object.keys(jsonResume).join(', '));
  }

  const experiences: Experience[] = (jsonResume.work || []).map((workItem, index) => {
    const company = workItem.name || workItem.company || '';
    const position = workItem.position || workItem.jobTitle || '';
    const endDate = workItem.endDate || '';
    const isCurrent = endDate === '' || endDate.toLowerCase() === 'present' || !endDate;

    return {
      id: generateId(),
      company,
      title: position,
      location: workItem.location || '',
      startDate: workItem.startDate || '',
      endDate: isCurrent ? '' : endDate,
      current: isCurrent,
      description: formatDescription(workItem),
    };
  });

  if (experiences.length === 0) {
    console.warn('⚠️ CV Transform: No work experience data found');
  }

  const education: Education[] = (jsonResume.education || []).map((eduItem) => {
    const endDate = eduItem.endDate || '';
    const isCurrent = endDate === '' || endDate.toLowerCase() === 'present' || !endDate;

    return {
      id: generateId(),
      school: eduItem.institution || '',
      degree: eduItem.studyType || eduItem.degree || '',
      field: eduItem.area || '',
      location: '',
      startDate: eduItem.startDate || '',
      endDate: isCurrent ? '' : endDate,
      current: isCurrent,
      gpa: eduItem.score || '',
    };
  });

  const skills: string[] = [];
  if (jsonResume.skills && Array.isArray(jsonResume.skills)) {
    jsonResume.skills.forEach(skill => {
      if (skill.keywords && Array.isArray(skill.keywords)) {
        skills.push(...skill.keywords.filter(k => k && k.trim()));
      }
    });
  }

  const certifications: Certification[] = (jsonResume.certificates || []).map((cert) => ({
    id: generateId(),
    name: cert.name || '',
    issuer: cert.issuer || '',
    date: cert.date || '',
    url: cert.url,
  }));

  const languages: Language[] = (jsonResume.languages || []).map((lang) => {
    const proficiency = mapFluencyToProficiency(lang.fluency);
    return {
      id: generateId(),
      name: lang.language || '',
      proficiency,
      rating: mapProficiencyToRating(proficiency),
    };
  });

  // Extract section labels from meta if available; fall back to German defaults when content is detected as German
  const metaSectionLabels: SectionLabels | undefined = (jsonResume as any).meta?.sectionLabels;
  const sectionLabels: SectionLabels | undefined =
    metaSectionLabels ?? (detectGermanContent(jsonResume) ? GERMAN_SECTION_LABELS : undefined);

  // Parse projects into structured data
  const projects: Project[] = (jsonResume.projects || []).map(project => ({
    id: generateId(),
    name: project.name || '',
    description: project.description || '',
    highlights: project.highlights || [],
    url: project.url,
    startDate: project.startDate,
    endDate: project.endDate
  }));

  const customSections: CustomSection[] = [];
  // Only add projects to custom sections if NOT using a template that handles them natively
  // But for backward compatibility we might want to keep it or handle it in the template.
  // The 'GermanLatexResume' will use 'projects' array.
  // Other templates might still rely on 'customSections'.
  // Ideally, we update all templates to use 'projects' and remove this fallback,
  // but to avoid breaking changes, we can selectively add it or just duplicate it 
  // (templates that prioritize 'projects' prop will use that).

  // However, simpler approach: Always provide 'projects'. 
  // If a template uses 'customSections' for projects, it will still work if we keep the logic below.
  // BUT the user reported "Projekte" and "PROJECTS" appearing. 
  // If we pass 'projects' property, 'GermanLatexResume' should use it and IGNORE the 'projects' in customSections (if we filter it out there).

  // Strategy: Pass structured 'projects'. 
  // DO NOT add 'projects' to 'customSections' if we are passing it as a top-level prop?
  // Or let the template decide?
  // If I keep the code below, 'customSections' will contain a "Projects" section which is a blob.
  // 'GermanLatexResume' renders `customSections` at the bottom.
  // If `GermanLatexResume` ALSO renders `data.projects` explicitly, we might get duplicates
  // if we don't filter it out from `customSections`.
  // Let's REMOVE projects from `customSections` generation here.
  // Why? Because we want to treat Projects as a first-class citizen now.
  // Caveat: If other templates DO NOT support `data.projects` yet, they will lose the Projects section.
  // Checking `ModernCleanResume` (step 347): it renders `customSections` at the end. It doesn't seem to have a dedicated Projects section block.
  // So if I allow `projects` to NOT be in `customSections`, `ModernCleanResume` will lose it.
  // Solution: I must check if I should update ALL templates or just keep it in text blob for others.
  // Better: Keep it in `customSections` for NOW, but in `GermanLatexResume` specifically, explicitely FILTER OUT the "Projects" section from `customSections` loop if `data.projects` is present? 
  // Or just modify `GermanLatexResume` to NOT render the "Projects" custom section?
  // Actually, standardizing `projects` is better.

  // Let's keep the `customSections` logic for now for backward compat, 
  // but maybe rename the heading to something else if we want to distinguish? No.

  if (jsonResume.projects && Array.isArray(jsonResume.projects) && jsonResume.projects.length > 0) {
    // We will NOT add to customSections if we want strict control, but for safety of other templates
    // let's KEEP IT for now. 
    // Wait, if `GermanLatexResume` iterates `customSections`, it will show double.
    // I will modify `GermanLatexResume` to EXCLUDE "Projects" from its custom section loop.

    const projectContent = jsonResume.projects.map(project => {
      let content = project.name ? `**${project.name}**\n` : '';
      content += project.description ? `${project.description}\n` : '';
      if (project.highlights && project.highlights.length > 0) {
        content += project.highlights.join('\n');
      }
      return content;
    }).join('\n\n');

    if (projectContent.trim()) {
      customSections.push({
        id: generateId(),
        heading: sectionLabels?.projects || 'Projects',
        content: projectContent.trim(),
      });
    }
  }

  return {
    firstName,
    lastName,
    jobTitle: basics.label || '',
    email: basics.email || '',
    phone: basics.phone || '',
    address: location.address || '',
    city: location.city || '',
    state: location.region || '',
    zipCode: location.postalCode || '',
    linkedIn: extractLinkedIn(basics.profiles),
    github: extractGitHub(basics.profiles),
    website: extractWebsite(basics),
    summary: basics.summary || '',
    experiences,
    education,
    skills,
    projects, // ADDED
    certifications,
    languages,
    customSections,
    selectedTemplate,
    sectionLabels,
  };
}

