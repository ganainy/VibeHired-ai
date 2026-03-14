export type FreeformJsonValue = string | number | boolean | null | FreeformJsonObject | FreeformJsonValue[];

export interface FreeformJsonObject {
  [key: string]: FreeformJsonValue;
}

export type JsonPath = Array<string | number>;
export const VIBEHIRED_TAGS_KEY = '__vh_tags';

export function isPlainObject(value: unknown): value is FreeformJsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function isMetaKey(key: string): boolean {
  return key === VIBEHIRED_TAGS_KEY || key.startsWith('__vh_') || key.startsWith('_ai_');
}

function asTagMap(value: FreeformJsonValue | undefined): Record<string, string> {
  if (!isPlainObject(value)) return {};

  return Object.entries(value).reduce<Record<string, string>>((acc, [key, mapValue]) => {
    if (typeof mapValue === 'string' && mapValue.trim()) {
      acc[key] = mapValue.trim();
    }
    return acc;
  }, {});
}

function buildPathCandidates(path: JsonPath): string[] {
  const normalized = path.map((segment) => String(segment));
  const candidates = new Set<string>();

  const total = 1 << normalized.length;
  for (let mask = 0; mask < total; mask += 1) {
    const candidate = normalized
      .map((segment, index) => {
        const isNumberSegment = /^\d+$/.test(segment);
        if (!isNumberSegment) return segment;
        return (mask & (1 << index)) !== 0 ? '*' : segment;
      })
      .join('.');

    candidates.add(candidate);
  }

  return Array.from(candidates);
}

export function getUiTagForPath(root: FreeformJsonObject, path: JsonPath): string | undefined {
  const tagsMap = asTagMap(root[VIBEHIRED_TAGS_KEY]);
  if (Object.keys(tagsMap).length === 0 || path.length === 0) {
    return undefined;
  }

  const candidates = buildPathCandidates(path);
  for (const candidate of candidates) {
    if (tagsMap[candidate]) {
      return tagsMap[candidate];
    }
  }

  return undefined;
}

export function getVisibleEntries(value: FreeformJsonObject): Array<[string, FreeformJsonValue]> {
  return Object.entries(value).filter(([key]) => !isMetaKey(key));
}

export function formatKeyLabel(key: string): string {
  if (!key) return 'Untitled';
  return key.replace(/[_-]+/g, ' ').trim();
}

export function setValueAtPath<T>(root: T, path: JsonPath, nextValue: any): T {
  if (path.length === 0) return nextValue as T;

  const [head, ...rest] = path;
  const clone: any = Array.isArray(root) ? [...(root as any)] : { ...(root as any) };

  if (rest.length === 0) {
    clone[head] = nextValue;
    return clone;
  }

  clone[head] = setValueAtPath(clone[head], rest, nextValue);
  return clone;
}

export function removeValueAtPath<T>(root: T, path: JsonPath): T {
  if (path.length === 0) return root;

  const [head, ...rest] = path;
  const clone: any = Array.isArray(root) ? [...(root as any)] : { ...(root as any) };

  if (rest.length === 0) {
    if (Array.isArray(clone)) {
      clone.splice(Number(head), 1);
    } else {
      delete clone[head];
    }
    return clone;
  }

  clone[head] = removeValueAtPath(clone[head], rest);
  return clone;
}

export function renameObjectKeyAtPath<T>(root: T, pathToObject: JsonPath, oldKey: string, newKey: string): T {
  const trimmedKey = newKey.trim();
  if (!trimmedKey || trimmedKey === oldKey) return root;

  const target = getValueAtPath(root, pathToObject);
  if (!isPlainObject(target) || Object.prototype.hasOwnProperty.call(target, trimmedKey)) {
    return root;
  }

  const renamed: FreeformJsonObject = {};
  Object.entries(target).forEach(([entryKey, value]) => {
    renamed[entryKey === oldKey ? trimmedKey : entryKey] = value;
  });

  return setValueAtPath(root, pathToObject, renamed);
}

export function getValueAtPath<T>(root: T, path: JsonPath): any {
  return path.reduce<any>((current, segment) => current?.[segment], root);
}

export function appendArrayItem<T>(root: T, path: JsonPath, value: FreeformJsonValue): T {
  const target = getValueAtPath(root, path);
  const next = Array.isArray(target) ? [...target, value] : [value];
  return setValueAtPath(root, path, next);
}

export function addObjectField<T>(root: T, path: JsonPath, keyPrefix: string = 'new_field'): T {
  const target = getValueAtPath(root, path);
  if (!isPlainObject(target)) return root;

  let nextKey = keyPrefix;
  let suffix = 1;
  while (Object.prototype.hasOwnProperty.call(target, nextKey)) {
    nextKey = `${keyPrefix}_${suffix}`;
    suffix += 1;
  }

  return setValueAtPath(root, path, { ...target, [nextKey]: '' });
}

export function createDefaultArrayItem(arrayValue: FreeformJsonValue[]): FreeformJsonValue {
  if (arrayValue.length === 0) return '';

  const sample = arrayValue[0];
  if (Array.isArray(sample)) return [];
  if (isPlainObject(sample)) {
    const nextObject: FreeformJsonObject = {};
    Object.keys(sample).forEach((key) => {
      nextObject[key] = '';
    });
    return nextObject;
  }
  if (typeof sample === 'number') return 0;
  if (typeof sample === 'boolean') return false;
  return '';
}
