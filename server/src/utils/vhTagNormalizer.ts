type JsonValue = any;

function isPlainObject(value: unknown): value is Record<string, JsonValue> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const CANONICAL_TAGS = new Set([
  'name',
  'email',
  'phone',
  'url',
  'location',
  'address',
  'city',
  'linkedin',
  'github',
  'website',
  'portfolio',
  'contact_block',
  'personal_info',
  'title',
  'subtitle',
  'date',
  'date_range',
  'key_value',
  'paragraph',
  'bullets',
]);

const CONTACT_FIELD_TAGS: Array<[RegExp, string]> = [
  [/^name$/i, 'name'],
  [/(^email$|e[-_\s]?mail)/i, 'email'],
  [/(^phone$|mobile|tel|telephone)/i, 'phone'],
  [/(^location$|city$|address)/i, 'location'],
  [/(^linkedin$|linkedin_url|linkedIn)/i, 'linkedin'],
  [/(^github$|github_url)/i, 'github'],
  [/(^website$|^url$|portfolio|site)/i, 'url'],
];

function normalizeTagValue(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return CANONICAL_TAGS.has(normalized) ? normalized : null;
}

function pathExists(root: JsonValue, segments: string[]): boolean {
  if (segments.length === 0) return true;
  const [head, ...rest] = segments;

  if (head === '*') {
    if (Array.isArray(root)) {
      return root.some((item) => pathExists(item, rest));
    }
    return false;
  }

  if (Array.isArray(root)) {
    const idx = Number(head);
    if (Number.isNaN(idx) || idx < 0 || idx >= root.length) return false;
    return pathExists(root[idx], rest);
  }

  if (!isPlainObject(root)) return false;
  if (!Object.prototype.hasOwnProperty.call(root, head)) return false;
  return pathExists(root[head], rest);
}

function pruneTags(root: JsonValue, tags: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, tag] of Object.entries(tags)) {
    const segments = path.split('.');
    if (pathExists(root, segments)) {
      out[path] = tag;
    }
  }
  return out;
}

function replaceTagPrefix(tags: Record<string, string>, fromKey: string, toKey: string): Record<string, string> {
  const out: Record<string, string> = {};
  const prefix = `${fromKey}.`;
  for (const [path, tag] of Object.entries(tags)) {
    if (path === fromKey) {
      out[toKey] = tag;
    } else if (path.startsWith(prefix)) {
      out[`${toKey}.${path.slice(prefix.length)}`] = tag;
    } else {
      out[path] = tag;
    }
  }
  return out;
}

function ensureTag(tags: Record<string, string>, path: string, tag: string) {
  if (!tags[path]) {
    tags[path] = tag;
  }
}

function tagContactFields(sectionKey: string, value: Record<string, JsonValue>, tags: Record<string, string>) {
  ensureTag(tags, sectionKey, 'contact_block');
  for (const key of Object.keys(value)) {
    const match = CONTACT_FIELD_TAGS.find(([re]) => re.test(key));
    if (match) {
      ensureTag(tags, `${sectionKey}.${key}`, match[1]);
    }
  }
}

function isMetaKey(key: string): boolean {
  return key === '__vh_tags' || key.startsWith('__vh_') || key.startsWith('_ai_');
}

function tagEntryFields(pathPrefix: string, entry: Record<string, JsonValue>, tags: Record<string, string>) {
  const keys = Object.keys(entry);
  const hasCategory = keys.some((k) => /^category$/i.test(k));
  const hasContent = keys.some((k) => /^(content|value)$/i.test(k));

  for (const key of keys) {
    const lower = key.toLowerCase();
    const path = `${pathPrefix}.${key}`;

    if (hasCategory && lower === 'category') {
      ensureTag(tags, path, 'title');
      continue;
    }
    if (hasCategory && hasContent && (lower === 'content' || lower === 'value')) {
      ensureTag(tags, path, 'key_value');
      continue;
    }

    if (/(^title$|^position$|^role$|^degree$|^studytype$)/i.test(lower)) {
      ensureTag(tags, path, 'title');
      continue;
    }
    if (/(^company$|^employer$|^institution$|^organization$|^school$|^university$|^subtitle$)/i.test(lower)) {
      ensureTag(tags, path, 'subtitle');
      continue;
    }
    if (/(^date$|^dates$|^period$|^duration$|^time$)/i.test(lower)) {
      ensureTag(tags, path, 'date_range');
      continue;
    }
  }
}

export function normalizeFreeformCvTags(
  cvJson: Record<string, JsonValue>,
  options?: { headerKey?: string },
): Record<string, JsonValue> {
  if (!isPlainObject(cvJson)) return cvJson;

  const headerKey = options?.headerKey ?? 'Header Info';
  const hasTagMap = isPlainObject(cvJson.__vh_tags);
  const hasHeaderKey = Object.prototype.hasOwnProperty.call(cvJson, headerKey);
  const hasUnsectioned = Object.prototype.hasOwnProperty.call(cvJson, 'unsectioned');

  // if (!hasTagMap && !hasHeaderKey && !hasUnsectioned) {
  //   return cvJson;
  // }

  let tags: Record<string, string> = {};
  if (hasTagMap) {
    for (const [path, raw] of Object.entries(cvJson.__vh_tags as Record<string, JsonValue>)) {
      const normalized = normalizeTagValue(raw);
      if (normalized) tags[path] = normalized;
    }
  }

  if (hasUnsectioned && !hasHeaderKey) {
    cvJson[headerKey] = cvJson.unsectioned;
    delete cvJson.unsectioned;
    tags = replaceTagPrefix(tags, 'unsectioned', headerKey);
  }

  if (isPlainObject(cvJson[headerKey])) {
    tagContactFields(headerKey, cvJson[headerKey] as Record<string, JsonValue>, tags);
  }

  // Also auto-detect contact sections by content — handles cases where the AI renamed
  // "Header Info" to "basics" or another key. A section is a contact block if it is a
  // plain object with a name field + at least one other contact field (email/phone/url).
  for (const [sectionKey, sectionValue] of Object.entries(cvJson)) {
    if (isMetaKey(sectionKey) || sectionKey === headerKey) continue;
    if (!isPlainObject(sectionValue)) continue;
    if (tags[sectionKey]) continue; // already tagged — skip

    const fieldKeys = Object.keys(sectionValue as Record<string, unknown>);
    const hasName = fieldKeys.some(k => /^name$/i.test(k));
    const hasContact = fieldKeys.some(k =>
      CONTACT_FIELD_TAGS.some(([re]) => re.test(k)) && !/^name$/i.test(k),
    );
    if (hasName && hasContact) {
      tagContactFields(sectionKey, sectionValue as Record<string, JsonValue>, tags);
    }
  }

  for (const [sectionKey, sectionValue] of Object.entries(cvJson)) {
    if (isMetaKey(sectionKey)) continue;

    if (Array.isArray(sectionValue)) {
      sectionValue.forEach((item, index) => {
        if (isPlainObject(item)) {
          tagEntryFields(`${sectionKey}.${index}`, item, tags);
        }
      });
    } else if (isPlainObject(sectionValue)) {
      if (sectionKey !== headerKey && tags[sectionKey] !== 'contact_block' && tags[sectionKey] !== 'personal_info') {
        tagEntryFields(sectionKey, sectionValue, tags);
      }
    }
  }

  function ensureFallbackTags(node: any, pathParts: string[]) {
    const pathStr = pathParts.join('.');
    
    // Simple wildcard matcher checking if current explicit tags dictionary contains this path
    let hasTag = Object.keys(tags).some(tagPath => {
        const regexStr = '^' + tagPath.replace(/\*/g, '[^.]+') + '$';
        return new RegExp(regexStr).test(pathStr);
    });

    if (!hasTag) {
        if (Array.isArray(node)) {
            const allPrim = node.every(i => typeof i !== 'object' || i === null);
            if (allPrim && node.length > 0) {
               tags[pathStr] = 'bullets';
            } else {
               node.forEach((item, index) => {
                  ensureFallbackTags(item, [...pathParts, String(index)]);
               });
            }
        } else if (isPlainObject(node)) {
            for (const [k, v] of Object.entries(node)) {
               ensureFallbackTags(v, [...pathParts, k]);
            }
        } else if (node !== null && node !== undefined && String(node).trim().length > 0) {
            tags[pathStr] = 'paragraph';
        }
    } else {
        if (isPlainObject(node)) {
            for (const [k, v] of Object.entries(node)) {
               ensureFallbackTags(v, [...pathParts, k]);
            }
        } else if (Array.isArray(node) && tags[pathStr] !== 'bullets') {
            node.forEach((item, index) => {
                ensureFallbackTags(item, [...pathParts, String(index)]);
            });
        }
    }
  }

  for (const [k, v] of Object.entries(cvJson)) {
     if (isMetaKey(k)) continue;
     ensureFallbackTags(v, [k]);
  }

  cvJson.__vh_tags = pruneTags(cvJson, tags);
  return cvJson;
}