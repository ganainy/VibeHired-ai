const JSON_RESUME_KEYS = new Set([
    'basics', 'work', 'education', 'skills', 'projects',
    'languages', 'certificates', 'awards', 'volunteer',
    'interests', 'references', 'publications', 'meta',
]);

export function detectCvFormat(cvJson: Record<string, any>): 'json-resume' | 'freeform' {
    const nonMetaKeys = Object.keys(cvJson).filter(
        k => k !== '__vh_tags' && !k.startsWith('__')
    );

    if (nonMetaKeys.length === 0) return 'json-resume';

    const knownCount = nonMetaKeys.filter(k => JSON_RESUME_KEYS.has(k)).length;
    const ratio = knownCount / nonMetaKeys.length;

    return ratio < 0.5 ? 'freeform' : 'json-resume';
}