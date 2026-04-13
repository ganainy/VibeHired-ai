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
