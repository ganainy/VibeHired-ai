/**
 * Safety-net normalizer: canonicalizes field names that slipped through
 * the parsing prompt despite the strict field name contract.
 *
 * Primary fix = prompt contract. This catches stragglers including
 * existing CVs already stored with inconsistent field names.
 */

const FIELD_ALIAS_MAP: Record<string, string> = {
  // → title
  degree: 'title',
  role: 'title',
  position: 'title',

  // → subtitle
  institution: 'subtitle',
  company: 'subtitle',
  employer: 'subtitle',
  school: 'subtitle',
  organization: 'subtitle',

  // → dates
  period: 'dates',
  duration: 'dates',
  date: 'dates',

  // → bullets
  description: 'bullets',
  responsibilities: 'bullets',
  achievements: 'bullets',
  highlights: 'bullets',
  details: 'bullets',
};

/**
 * Maps non-standard section names (including German and other languages)
 * to canonical JSON Resume section names.
 */
const SECTION_NAME_MAP: Record<string, string> = {
  // German sections
  'Header Info': 'basics',
  'HEADER': 'basics',
  'KONTAKT': 'basics',
  'PERSONALIEN': 'basics',
  'PROFIL': 'summary',
  'ZUSAMMENFASSUNG': 'summary',
  'ÜBER MICH': 'summary',
  'AUSBILDUNG': 'education',
  'SCHULBILDUNG': 'education',
  'WEITERBILDUNG': 'education',
  'BERUFSERFAHRUNG': 'work',
  'BERUFLICHER WERDEGANG': 'work',
  'ARBEITSERFAHRUNG': 'work',
  'PRAKTISCHE ERFAHRUNG': 'work',
  'IT-ERFAHRUNG & TECHNISCHE KOMPETENZEN': 'skills',
  'IT-KENNTNISSE': 'skills',
  'TECHNISCHE KENNTNISSE': 'skills',
  'TECHNISCHE FÄHIGKEITEN': 'skills',
  'SOFTWAREKENNTNISSE': 'skills',
  'SPRACHEN': 'languages',
  'SPRACHKENNTNISSE': 'languages',
  'KENNTNISSE': 'skills',
  'FÄHIGKEITEN': 'skills',
  'KOMPETENZEN': 'skills',
  'ZERTIFIZIERUNGEN': 'certifications',
  'ZERTIFIKATE': 'certifications',
  'PROJEKTE': 'projects',
  'INTERESSEN': 'interests',
  'HOBBYS': 'interests',
  'REFERENZEN': 'references',
  'WEITERE ANGABEN': 'additional',
  'SONSTIGES': 'additional',
  'AKTIVITÄTEN': 'additional',
  
  // English alternatives
  'PERSONAL INFO': 'basics',
  'CONTACT': 'basics',
  'PROFILE': 'summary',
  'ABOUT ME': 'summary',
  'EXPERIENCE': 'work',
  'WORK HISTORY': 'work',
  'EMPLOYMENT': 'work',
  'PROFESSIONAL EXPERIENCE': 'work',
  'SCHOOLS': 'education',
  'ACADEMIC BACKGROUND': 'education',
  'QUALIFICATIONS': 'education',
  'COMPETENCIES': 'skills',
  'TECHNICAL SKILLS': 'skills',
  'CORE COMPETENCIES': 'skills',
  'CERTIFICATIONS': 'certifications',
  'PROJECTS': 'projects',
  'INTERESTS': 'interests',
  'REFERENCES': 'references',
  'ADDITIONAL INFORMATION': 'additional',
  'OTHER': 'additional',
};

/**
 * Normalizes top-level section names to canonical JSON Resume format.
 * Handles German, English variations, and other non-standard names.
 */
export function normalizeSectionNames(
  cvJson: Record<string, any>,
): Record<string, any> {
  const vhTags: Record<string, string> = cvJson.__vh_tags ?? {};
  const result: Record<string, any> = {};
  const sectionRenames: Record<string, string> = {};

  for (const [sectionKey, sectionValue] of Object.entries(cvJson)) {
    if (sectionKey === '__vh_tags') {
      result[sectionKey] = sectionValue;
      continue;
    }

    // Try exact match first, then uppercase match
    let canonicalSection = SECTION_NAME_MAP[sectionKey];
    if (!canonicalSection) {
      canonicalSection = SECTION_NAME_MAP[sectionKey.toUpperCase()];
    }
    // If still no match, keep original
    if (!canonicalSection) {
      canonicalSection = sectionKey;
    }
    
    // Track renames for __vh_tags
    if (canonicalSection !== sectionKey) {
      sectionRenames[sectionKey] = canonicalSection;
    }

    // If section already exists, merge arrays
    if (result[canonicalSection] && Array.isArray(result[canonicalSection]) && Array.isArray(sectionValue)) {
      result[canonicalSection] = [...result[canonicalSection], ...sectionValue];
    } else {
      result[canonicalSection] = sectionValue;
    }
  }

  // Rebuild __vh_tags applying section renames
  const finalTags: Record<string, string> = {};
  for (const [path, tag] of Object.entries(vhTags)) {
    let newPath = path;
    for (const [oldSection, newSection] of Object.entries(sectionRenames)) {
      if (path.startsWith(oldSection + '.')) {
        newPath = path.replace(oldSection, newSection);
        break;
      }
    }
    finalTags[newPath] = tag;
  }

  if (Object.keys(finalTags).length > 0) {
    result.__vh_tags = finalTags;
  }

  return result;
}

export function normalizeCvFieldNames(
  cvJson: Record<string, any>,
): Record<string, any> {
  const vhTags: Record<string, string> = cvJson.__vh_tags ?? {};
  const result: Record<string, any> = {};
  const tagRenames: Record<string, string> = {};

  for (const [sectionKey, sectionValue] of Object.entries(cvJson)) {
    if (sectionKey === '__vh_tags') {
      continue;
    }

    if (!Array.isArray(sectionValue)) {
      result[sectionKey] = sectionValue;
      continue;
    }

    result[sectionKey] = sectionValue.map((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return entry;
      }

      const normalized: Record<string, any> = {};
      for (const [fieldName, fieldValue] of Object.entries(entry)) {
        const canonical = FIELD_ALIAS_MAP[fieldName];

        if (!canonical) {
          normalized[fieldName] = fieldValue;
          continue;
        }

        // Track tag path renames
        const oldWildcard = `${sectionKey}.*.${fieldName}`;
        const newWildcard = `${sectionKey}.*.${canonical}`;
        const oldIndexed = `${sectionKey}.${index}.${fieldName}`;
        const newIndexed = `${sectionKey}.${index}.${canonical}`;

        if (vhTags[oldWildcard]) tagRenames[oldWildcard] = newWildcard;
        if (vhTags[oldIndexed]) tagRenames[oldIndexed] = newIndexed;

        // Special case: renamed to 'bullets' but value is a string → split
        if (canonical === 'bullets' && typeof fieldValue === 'string') {
          normalized[canonical] = fieldValue
            .split('\n')
            .map((s: string) => s.replace(/^[-•]\s*/, '').trim())
            .filter(Boolean);
        } else {
          normalized[canonical] = fieldValue;
        }
      }
      return normalized;
    });
  }

  // Rebuild __vh_tags applying renames
  const finalTags: Record<string, string> = {};
  for (const [path, tag] of Object.entries(vhTags)) {
    finalTags[tagRenames[path] ?? path] = tag;
  }

  result.__vh_tags = finalTags;
  return result;
}

/* ================================================================
   compactFreeformToJsonResume
   ================================================================ */

import {
  JsonResumeSchema,
  JsonResumeBasics,
  JsonResumeWorkItem,
  JsonResumeEducationItem,
  JsonResumeSkillItem,
  JsonResumeLanguageItem,
  JsonResumeCertificateItem,
  JsonResumeProjectItem,
  JsonResumeAwardItem,
  JsonResumeVolunteerItem,
  JsonResumeInterestItem,
  JsonResumeReferenceItem,
  JsonResumePublicationItem,
} from '../types/jsonresume';

const JSON_RESUME_TOP_KEYS = new Set([
  'basics', 'work', 'education', 'skills', 'projects',
  'languages', 'certificates', 'awards', 'volunteer',
  'interests', 'references', 'publications', 'meta',
]);

const ARRAY_SECTIONS = new Set([
  'work', 'education', 'skills', 'projects', 'languages',
  'certificates', 'awards', 'volunteer', 'interests',
  'references', 'publications',
]);

/**
 * Check whether the input already looks like a valid JsonResume.
 * We consider it valid when most top-level keys are known JsonResume keys
 * and the internal structures match JsonResume conventions (not freeform
 * title/subtitle/dates/bullets/content/category fields).
 */
function isAlreadyJsonResume(cvJson: Record<string, any>): boolean {
  const nonMetaKeys = Object.keys(cvJson).filter(k => k !== '__vh_tags' && !k.startsWith('__'));
  if (nonMetaKeys.length === 0) return false;
  const knownCount = nonMetaKeys.filter(k => JSON_RESUME_TOP_KEYS.has(k)).length;
  const ratio = knownCount / nonMetaKeys.length;
  if (ratio < 0.6) return false;

  // Validate basics structure — reject freeform keys like Name, Email, Phone
  if (cvJson.basics && typeof cvJson.basics === 'object' && !Array.isArray(cvJson.basics)) {
    const knownBasicsKeys = new Set(['name', 'label', 'image', 'email', 'phone', 'url', 'summary', 'location', 'profiles']);
    const hasUnknownBasics = Object.keys(cvJson.basics).some(k => !knownBasicsKeys.has(k));
    if (hasUnknownBasics) return false;
  }

  // Validate array sections for freeform field names and shapes
  for (const key of nonMetaKeys) {
    if (!ARRAY_SECTIONS.has(key)) continue;
    const entries = cvJson[key];

    // Languages: a single string is freeform
    if (key === 'languages' && typeof cvJson.languages === 'string') {
      return false;
    }

    if (!Array.isArray(entries) || entries.length === 0) continue;

    // If any entry uses freeform AI-parser field names, it's not JsonResume yet
    const hasFreeformFields = entries.some((e: any) => {
      if (!e || typeof e !== 'object') return false;
      const freeformFields = ['title', 'subtitle', 'dates', 'bullets', 'content', 'category'];
      return freeformFields.some(f => e[f] !== undefined);
    });
    if (hasFreeformFields) return false;

    // Skills: strings or {category, content} are freeform
    if (key === 'skills') {
      const hasStringOrCategory = entries.some((e: any) =>
        typeof e === 'string' || (e && e.category !== undefined)
      );
      if (hasStringOrCategory) return false;
    }
  }

  return true;
}

/**
 * Parse a date range string into startDate and endDate.
 * Handles formats like:
 *   "01/2020 – 12/2023"
 *   "2020-2023"
 *   "Jan 2020 - Present"
 *   "06/2017 bis 03/2019"
 * Returns ISO-like strings (YYYY-MM) where possible, otherwise keeps originals.
 */
function parseDateRange(dates: string): { startDate?: string; endDate?: string } {
  if (!dates || typeof dates !== 'string') return {};

  const clean = dates
    .replace(/\s+/g, ' ')
    .trim();

  // Split on common separators: –, -, bis, to, —
  const parts = clean.split(/\s*(?:–|—|bis|to|\s+-\s+|-)\s*/);
  if (parts.length < 2) {
    // Try single year or year-month
    const single = extractIsoDate(clean);
    return single ? { startDate: single } : {};
  }

  const start = extractIsoDate(parts[0].trim());
  const endRaw = parts.slice(1).join('-').trim(); // rejoin if multiple dashes
  const end = extractIsoDate(endRaw);

  const result: { startDate?: string; endDate?: string } = {};
  if (start) result.startDate = start;
  if (end) result.endDate = end;
  // Preserve original for Present/Heute/etc. if parsing failed
  if (!end && /^(present|heute|current|now|jetzt)$/i.test(endRaw)) {
    result.endDate = 'Present';
  }
  return result;
}

const MONTH_NAMES: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
};

function extractIsoDate(raw: string): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();

  // Present / Heute / Current
  if (/^(present|heute|current|now|jetzt)$/i.test(lower)) {
    return 'Present';
  }

  // MM/YYYY or M/YYYY
  const mmYYYY = raw.match(/^(\d{1,2})\/(\d{4})$/);
  if (mmYYYY) {
    const month = mmYYYY[1].padStart(2, '0');
    return `${mmYYYY[2]}-${month}`;
  }

  // YYYY-MM or YYYY-M
  const yyyyMM = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (yyyyMM) {
    const month = yyyyMM[2].padStart(2, '0');
    return `${yyyyMM[1]}-${month}`;
  }

  // Month YYYY (e.g. "Jan 2020" or "January 2020")
  const monthYear = raw.match(/^([A-Za-z]{3,})\s+(\d{4})$/);
  if (monthYear) {
    const month = MONTH_NAMES[monthYear[1].toLowerCase()];
    if (month) return `${monthYear[2]}-${month}`;
  }

  // YYYY only
  const yearOnly = raw.match(/^(\d{4})$/);
  if (yearOnly) {
    return yearOnly[1];
  }

  return null;
}

/**
 * Extract basics from freeform header/contact data.
 * Input can be an object, an array of objects, or even a string.
 */
function extractBasics(data: any): JsonResumeBasics | undefined {
  if (!data) return undefined;

  // If it's an array, try to convert to an object first
  let obj: Record<string, any> = {};
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && typeof item === 'object') {
        if (item.category && item.content !== undefined) {
          obj[item.category] = item.content;
        } else {
          Object.assign(obj, item);
        }
      }
    }
  } else if (typeof data === 'object') {
    obj = { ...data };
  } else {
    return undefined;
  }

  const basics: JsonResumeBasics = {};
  const profiles: Array<{ network?: string; url?: string }> = [];

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const strValue = typeof value === 'string' ? value.trim() : String(value ?? '');

    if (/^name$/i.test(key)) {
      basics.name = strValue;
    } else if (/^(label|title|headline)$/i.test(key)) {
      basics.label = strValue;
    } else if (/^email$/i.test(key) || /\S+@\S+\.\S+/.test(strValue)) {
      if (!basics.email && /\S+@\S+\.\S+/.test(strValue)) basics.email = strValue;
    } else if (/^(phone|tel|mobile|handy)$/i.test(key) || (/\+?\d/.test(strValue) && /\d{3,}/.test(strValue))) {
      if (!basics.phone && /\d/.test(strValue)) basics.phone = strValue;
    } else if (/^(url|website|web|homepage)$/i.test(key)) {
      basics.url = strValue;
    } else if (/^(summary|profile|objective|about|über\s*mich)$/i.test(key)) {
      basics.summary = strValue;
    } else if (/^(location|address|city|region|country|postal|zip|plz|ort)$/i.test(key)) {
      if (!basics.location) basics.location = {};
      if (/^address$/i.test(key)) basics.location.address = strValue;
      else if (/^(city|ort)$/i.test(key)) basics.location.city = strValue;
      else if (/^(region|state|bundesland)$/i.test(key)) basics.location.region = strValue;
      else if (/^(country|land)$/i.test(key)) basics.location.countryCode = strValue;
      else if (/^(postal|zip|plz)$/i.test(key)) basics.location.postalCode = strValue;
      else basics.location.city = strValue; // fallback
  } else if (/^(linkedin|xing|github|gitlab|twitter|mastodon|portfolio)$/i.test(key)) {
    const networkMap: Record<string, string> = {
      linkedin: 'LinkedIn',
      xing: 'Xing',
      github: 'GitHub',
      gitlab: 'GitLab',
      twitter: 'Twitter',
      mastodon: 'Mastodon',
      portfolio: 'Portfolio',
    };
    const network = networkMap[key.toLowerCase()] || key;
    profiles.push({ network, url: strValue });
  }
  }

  // If email/phone not found by key, scan values
  if (!basics.email) {
    for (const v of Object.values(obj)) {
      if (typeof v === 'string' && /\S+@\S+\.\S+/.test(v)) {
        basics.email = v.trim();
        break;
      }
    }
  }
  if (!basics.phone) {
    for (const v of Object.values(obj)) {
      if (typeof v === 'string' && /[\+\d]/.test(v) && /\d{3,}/.test(v) && v.length >= 7) {
        basics.phone = v.trim();
        break;
      }
    }
  }

  if (profiles.length > 0) {
    basics.profiles = profiles;
  }

  return Object.keys(basics).length > 0 ? basics : undefined;
}

/**
 * Convert freeform work entries to JsonResume work items.
 */
function extractWork(entries: any[]): JsonResumeWorkItem[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const e = entry as Record<string, any>;
      const item: JsonResumeWorkItem = {};

      // Company / name
      item.name = e.subtitle ?? e.company ?? e.employer ?? e.institution ?? e.organization ?? e.name;
      // Position
      item.position = e.title ?? e.position ?? e.role ?? e.jobTitle;
      // Dates
      const dates = parseDateRange(e.dates ?? e.period ?? e.duration ?? e.date);
      if (dates.startDate) item.startDate = dates.startDate;
      if (dates.endDate) item.endDate = dates.endDate;
      // Summary / description
      item.summary = e.summary ?? e.description ?? e.content;
      if (typeof item.summary !== 'string') item.summary = undefined;
      // Highlights / bullets
      const bullets = e.bullets ?? e.highlights ?? e.responsibilities ?? e.achievements ?? e.details;
      if (Array.isArray(bullets)) {
        item.highlights = bullets.filter((b: any) => typeof b === 'string' && b.trim().length > 0);
      } else if (typeof bullets === 'string') {
        item.highlights = bullets
          .split('\n')
          .map((s: string) => s.replace(/^[-•]\s*/, '').trim())
          .filter(Boolean);
      }
      // Location
      if (e.location) item.location = typeof e.location === 'string' ? e.location : undefined;
      // URL
      if (e.url) item.url = typeof e.url === 'string' ? e.url : undefined;

      return Object.keys(item).length > 0 ? item : null;
    })
    .filter(Boolean) as JsonResumeWorkItem[];
}

/**
 * Convert freeform education entries to JsonResume education items.
 */
function extractEducation(entries: any[]): JsonResumeEducationItem[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const e = entry as Record<string, any>;
      const item: JsonResumeEducationItem = {};

      item.institution = e.subtitle ?? e.institution ?? e.school ?? e.university ?? e.organization;
      item.area = e.area ?? e.field ?? e.subject;
      item.studyType = e.title ?? e.degree ?? e.studyType ?? e.qualification;
      if (!item.area && item.studyType && typeof item.studyType === 'string') {
        // Try to extract area from studyType like "B.Sc. Computer Science"
        const match = item.studyType.match(/(?:in|of)\s+(.+)$/i);
        if (match) item.area = match[1].trim();
      }

      const dates = parseDateRange(e.dates ?? e.period ?? e.duration ?? e.date);
      if (dates.startDate) item.startDate = dates.startDate;
      if (dates.endDate) item.endDate = dates.endDate;

      item.score = e.score ?? e.grade ?? e.gpa;
      if (typeof item.score !== 'string') item.score = undefined;

      const courses = e.courses ?? e.subjects;
      if (Array.isArray(courses)) {
        item.courses = courses.filter((c: any) => typeof c === 'string' && c.trim().length > 0);
      }

      return Object.keys(item).length > 0 ? item : null;
    })
    .filter(Boolean) as JsonResumeEducationItem[];
}

/**
 * Convert freeform skills data to JsonResume skills array.
 */
function extractSkills(data: any): JsonResumeSkillItem[] {
  if (!data) return [];

  // Already proper array
  if (Array.isArray(data)) {
    // Array of objects with name/keywords
    if (data.every((d: any) => d && typeof d === 'object' && (d.name || d.keywords))) {
      return data
        .map((d: any) => ({
          name: d.name,
          level: d.level,
          keywords: Array.isArray(d.keywords) ? d.keywords.filter((k: any) => typeof k === 'string' && k.trim()) : undefined,
        }))
        .filter((d: any) => d.name || (d.keywords && d.keywords.length));
    }

    // Array of category objects with category/content
    if (data.some((d: any) => d && typeof d === 'object' && (d.category || d.content))) {
      return data
        .map((d: any) => {
          if (!d || typeof d !== 'object') return null;
          const keywords = typeof d.content === 'string'
            ? d.content.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean)
            : Array.isArray(d.content)
              ? d.content.filter((k: any) => typeof k === 'string' && k.trim())
              : undefined;
          return {
            name: d.category ?? d.name ?? 'Skills',
            keywords,
          };
        })
        .filter(Boolean) as JsonResumeSkillItem[];
    }

    // Flat array of strings (may include nulls/undefined)
    if (data.every((d: any) => d == null || typeof d === 'string')) {
      const keywords = data.filter((s: any) => typeof s === 'string' && s.trim());
      return keywords.length ? [{ name: 'Skills', keywords }] : [];
    }

    // Mixed — best effort
    return [{ name: 'Skills', keywords: data.map((d: any) => String(d)).filter(Boolean) }];
  }

  // Single string with comma/semicolon separation
  if (typeof data === 'string') {
    const keywords = data.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);
    return keywords.length ? [{ name: 'Skills', keywords }] : [];
  }

  // Object with category keys
  if (typeof data === 'object') {
    return Object.entries(data)
      .map(([name, value]) => {
        const keywords = typeof value === 'string'
          ? value.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean)
          : Array.isArray(value)
            ? value.filter((k: any) => typeof k === 'string' && k.trim())
            : undefined;
        return { name, keywords };
      })
      .filter((d: any) => d.keywords && d.keywords.length);
  }

  return [];
}

/**
 * Convert freeform languages data to JsonResume languages array.
 */
function extractLanguages(data: any): JsonResumeLanguageItem[] {
  if (!data) return [];

  // Single string like "German (Native), English (Fluent)"
  if (typeof data === 'string') {
    const results: JsonResumeLanguageItem[] = [];
    const regex = /([^(]+)\(([^)]+)\)/g;
    let match;
    while ((match = regex.exec(data)) !== null) {
      results.push({
        language: match[1].replace(/^[\s,;]+|[\s,;]+$/g, ''),
        fluency: match[2].trim(),
      });
    }
    if (results.length) return results;
    // Try splitting by comma
    return data.split(',').map((s: string) => {
      const parts = s.split(/[-:]/);
      if (parts.length >= 2) {
        return { language: parts[0].trim(), fluency: parts[1].trim() };
      }
      return { language: s.trim() };
    }).filter((d: any) => d.language);
  }

  if (!Array.isArray(data)) return [];

  return data
    .map((entry: any) => {
      if (!entry) return null;
      if (typeof entry === 'string') {
        const parts = entry.split(/[-:]/);
        if (parts.length >= 2) {
          return { language: parts[0].trim(), fluency: parts[1].trim() };
        }
        return { language: entry.trim() };
      }
      if (typeof entry === 'object') {
        return {
          language: entry.language ?? entry.category ?? entry.name ?? entry.title,
          fluency: entry.fluency ?? entry.level ?? entry.content ?? entry.proficiency,
        };
      }
      return null;
    })
    .filter((d: any) => d && d.language) as JsonResumeLanguageItem[];
}

/**
 * Generic extractor for certificates, projects, awards, volunteer, interests, references, publications.
 * Maps common aliases to JsonResume field names per section type.
 */
function extractGenericItems(entries: any[], section: string): any[] {
  if (!Array.isArray(entries)) return [];

  const fieldMaps: Record<string, Record<string, string>> = {
    certificates: {
      title: 'name', name: 'name',
      issuer: 'issuer', organization: 'issuer',
      date: 'date', dates: 'date',
      url: 'url',
    },
    projects: {
      title: 'name', name: 'name',
      description: 'description', summary: 'description',
      highlights: 'highlights', bullets: 'highlights',
      keywords: 'keywords',
      dates: 'startDate', date: 'startDate',
      url: 'url',
      roles: 'roles', role: 'roles',
      entity: 'entity', organization: 'entity',
      type: 'type',
    },
    awards: {
      title: 'title', name: 'title',
      date: 'date', dates: 'date',
      awarder: 'awarder', issuer: 'awarder', organization: 'awarder',
      summary: 'summary', description: 'summary',
    },
    volunteer: {
      title: 'position', name: 'position', position: 'position', role: 'position',
      subtitle: 'organization', organization: 'organization', company: 'organization',
      dates: 'startDate', date: 'startDate',
      summary: 'summary', description: 'summary',
      bullets: 'highlights', highlights: 'highlights',
      url: 'url',
    },
    interests: {
      title: 'name', name: 'name', category: 'name',
      keywords: 'keywords', content: 'keywords',
    },
    references: {
      title: 'name', name: 'name',
      content: 'reference', reference: 'reference', description: 'reference',
    },
    publications: {
      title: 'name', name: 'name',
      publisher: 'publisher', organization: 'publisher',
      dates: 'releaseDate', date: 'releaseDate',
      url: 'url',
      summary: 'summary', description: 'summary',
    },
  };

  const map = fieldMaps[section] || {};

  return entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const e = entry as Record<string, any>;
      const item: Record<string, any> = {};

      for (const [key, value] of Object.entries(e)) {
        const canonical = map[key] || key;
        if (canonical === 'highlights' && typeof value === 'string') {
          item[canonical] = value
            .split('\n')
            .map((s: string) => s.replace(/^[-•]\s*/, '').trim())
            .filter(Boolean);
        } else if (canonical === 'keywords' && typeof value === 'string') {
          item[canonical] = value.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean);
        } else if (canonical === 'roles' && typeof value === 'string') {
          item[canonical] = [value];
        } else {
          item[canonical] = value;
        }
      }

      return Object.keys(item).length > 0 ? item : null;
    })
    .filter(Boolean);
}

/**
 * Recursively remove empty values, empty arrays, empty objects,
 * null/undefined, and meta keys starting with __.
 */
function cleanup<T>(value: T): T | undefined {
  if (value === null || value === undefined) return undefined;

  if (typeof value === 'string') {
    return value.trim().length > 0 ? (value.trim() as unknown as T) : undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    const cleaned = value
      .map(cleanup)
      .filter((v) => v !== undefined) as unknown as T;
    return (cleaned as any).length > 0 ? cleaned : undefined;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, any>;
    const cleaned: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key.startsWith('__')) continue;
      const c = cleanup(val);
      if (c !== undefined) {
        cleaned[key] = c;
      }
    }
    return Object.keys(cleaned).length > 0 ? (cleaned as unknown as T) : undefined;
  }

  return value;
}

/**
 * Takes freeform AI-parsed CV data and compacts it into a clean JsonResumeSchema.
 *
 * 1. Detects if input is already valid JsonResume → returns with minimal cleanup.
 * 2. Runs existing normalization (normalizeSectionNames + normalizeCvFieldNames).
 * 3. Maps each known section to its JsonResume shape using heuristics.
 * 4. Drops unknown top-level sections.
 * 5. Cleans up empty values and meta keys.
 */
export function compactFreeformToJsonResume(freeformCv: Record<string, any>): JsonResumeSchema {
  if (!freeformCv || typeof freeformCv !== 'object') {
    return {};
  }

  // Step 1: idempotency check on RAW input (before normalization)
  if (isAlreadyJsonResume(freeformCv)) {
    return cleanup(freeformCv) as JsonResumeSchema ?? {};
  }

  // Step 2: run existing normalizations
  let cv = normalizeSectionNames(freeformCv);
  cv = normalizeCvFieldNames(cv);

  const result: JsonResumeSchema = {};

  // Step 3: map each section
  for (const [key, value] of Object.entries(cv)) {
    if (key.startsWith('__')) continue;

    switch (key) {
      case 'basics':
        result.basics = extractBasics(value);
        break;
      case 'work':
        result.work = extractWork(value);
        break;
      case 'education':
        result.education = extractEducation(value);
        break;
      case 'skills':
        result.skills = extractSkills(value);
        break;
      case 'languages':
        result.languages = extractLanguages(value);
        break;
      case 'certificates':
        result.certificates = extractGenericItems(value, 'certificates') as JsonResumeCertificateItem[];
        break;
      case 'projects':
        result.projects = extractGenericItems(value, 'projects') as JsonResumeProjectItem[];
        break;
      case 'awards':
        result.awards = extractGenericItems(value, 'awards') as JsonResumeAwardItem[];
        break;
      case 'volunteer':
        result.volunteer = extractGenericItems(value, 'volunteer') as JsonResumeVolunteerItem[];
        break;
      case 'interests':
        result.interests = extractGenericItems(value, 'interests') as JsonResumeInterestItem[];
        break;
      case 'references':
        result.references = extractGenericItems(value, 'references') as JsonResumeReferenceItem[];
        break;
      case 'publications':
        result.publications = extractGenericItems(value, 'publications') as JsonResumePublicationItem[];
        break;
      case 'meta':
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          result.meta = value;
        }
        break;
      // Unknown sections are intentionally dropped
    }
  }

  // Step 4: final cleanup
  const cleaned = cleanup(result) as JsonResumeSchema;
  return cleaned ?? {};
}
