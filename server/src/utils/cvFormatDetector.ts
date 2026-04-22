const JSON_RESUME_KEYS = new Set([
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
 * Validates that a known JsonResume section has the expected structure.
 * - 'basics' must be an object (not array/string)
 * - Array sections must be arrays if present
 * Returns true if the section is valid, false otherwise.
 */
function isValidSectionStructure(key: string, value: any): boolean {
    if (key === 'basics') {
        return value != null && typeof value === 'object' && !Array.isArray(value);
    }
    if (ARRAY_SECTIONS.has(key)) {
        return value == null || Array.isArray(value);
    }
    // Unknown keys don't fail structure validation
    return true;
}

/**
 * Detects whether a CV object follows the JsonResume schema.
 *
 * @param cvJson       The parsed CV object to inspect.
 * @param strict       When true, requires at least 3 valid known sections
 *                     AND a valid 'basics' object. Use in the upload pipeline
 *                     to ensure only well-formed CVs are tagged json-resume.
 * @returns 'json-resume' if the object matches the schema, 'freeform' otherwise.
 */
export function detectCvFormat(
    cvJson: Record<string, any>,
    strict: boolean = false,
): 'json-resume' | 'freeform' {
    if (!cvJson || typeof cvJson !== 'object' || Array.isArray(cvJson)) {
        return 'freeform';
    }

    const nonMetaKeys = Object.keys(cvJson).filter(
        k => k !== '__vh_tags' && !k.startsWith('__')
    );

    // Empty or all-meta objects are considered freeform (need normalization)
    if (nonMetaKeys.length === 0) {
        return 'freeform';
    }

    // Count known keys that also have valid structure
    let validKnownCount = 0;
    for (const key of nonMetaKeys) {
        if (JSON_RESUME_KEYS.has(key) && isValidSectionStructure(key, cvJson[key])) {
            validKnownCount++;
        }
    }

    const ratio = validKnownCount / nonMetaKeys.length;

    // Lenient mode: at least 60% known keys with valid structure
    if (ratio < 0.6) {
        return 'freeform';
    }

    // Strict mode: require basics + at least 2 other valid known sections
    if (strict) {
        const hasValidBasics =
            cvJson.basics != null &&
            typeof cvJson.basics === 'object' &&
            !Array.isArray(cvJson.basics);
        const otherValidSections = nonMetaKeys.filter(
            k => k !== 'basics' && k !== 'meta' && JSON_RESUME_KEYS.has(k) && isValidSectionStructure(k, cvJson[k])
        );
        if (!hasValidBasics || otherValidSections.length < 2) {
            return 'freeform';
        }
    }

    return 'json-resume';
}
