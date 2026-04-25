import { JsonResumeSchema } from '../../../server/src/types/jsonresume';

const KNOWN_JSON_RESUME_KEYS = new Set([
  'basics',
  'work',
  'education',
  'skills',
  'projects',
  'languages',
  'certificates',
  'volunteer',
  'awards',
  'publications',
  'interests',
  'references',
]);

const META_KEY_PATTERNS = [/^_ai_/, /^meta$/];

function isMetaLikeKey(key: string): boolean {
  return META_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export type CvEditorMode = 'structured' | 'pdf-only';

/**
 * Lenient check: does the object look like a JsonResume?
 * Returns true if the object has at least 2 known JsonResume top-level keys,
 * OR if it has a `basics` key that is an object.
 * Ignores meta keys like _ai_*, and meta.
 */
export function isJsonResumeLike(data: unknown): data is JsonResumeSchema {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }

  const keys = Object.keys(data);
  let knownCount = 0;
  let hasBasicsObject = false;

  for (const key of keys) {
    if (isMetaLikeKey(key)) {
      continue;
    }
    if (!KNOWN_JSON_RESUME_KEYS.has(key)) {
      continue;
    }

    knownCount++;

    if (key === 'basics') {
      const basics = (data as Record<string, unknown>)[key];
      if (basics && typeof basics === 'object' && !Array.isArray(basics)) {
        hasBasicsObject = true;
      }
    }

    if (key === 'work') {
      const work = (data as Record<string, unknown>)[key];
      if (!Array.isArray(work)) {
        return false;
      }
    }

    if (key === 'education') {
      const education = (data as Record<string, unknown>)[key];
      if (!Array.isArray(education)) {
        return false;
      }
    }
  }

  return hasBasicsObject || knownCount >= 2;
}

/**
 * Stricter validation: all array sections must contain objects,
 * and basics must be an object if present.
 */
export function isValidJsonResume(data: unknown): data is JsonResumeSchema {
  if (!isJsonResumeLike(data)) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  const arraySections = ['work', 'volunteer', 'education', 'awards', 'certificates', 'publications', 'skills', 'languages', 'interests', 'references', 'projects'];

  for (const section of arraySections) {
    const value = obj[section];
    if (value === undefined || value === null) {
      continue;
    }
    if (!Array.isArray(value)) {
      return false;
    }
    if (!value.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
      return false;
    }
  }

  if (obj.basics !== undefined && obj.basics !== null) {
    if (typeof obj.basics !== 'object' || Array.isArray(obj.basics)) {
      return false;
    }
  }

  return true;
}

/**
 * Determine the best editor mode for a given CV document.
 *
 * - 'pdf-only': The CV has an original PDF but no parseable JSON data
 * - 'structured': The CV has valid JsonResume data — use CvDocumentRenderer
 */
export function getCvEditorMode(cv: { cvJson?: any; originalPdf?: boolean; hasOriginalCvJson?: boolean }): CvEditorMode {
  if (!cv.cvJson || Object.keys(cv.cvJson).length === 0) {
    // No JSON data — if PDF exists, show PDF editor
    if (cv.originalPdf || cv.hasOriginalCvJson) {
      return 'pdf-only';
    }
    return 'structured';
  }

  return 'structured';
}
