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
