import { forwardRef } from 'react';
import {
  FreeformJsonObject,
  FreeformJsonValue,
  getUiTagForPath,
  getVisibleEntries,
  isPlainObject,
} from './freeformUtils';

interface FreeformCvRendererProps {
  value: FreeformJsonObject;
}

function lbl(k: string) {
  return k.replace(/[_-]+/g, ' ').trim();
}

function normalizeListItemText(v: FreeformJsonValue): FreeformJsonValue {
  if (typeof v !== 'string') return v;
  return v
    .replace(/^\s*(?:[•\-–—]+\s*)+/, '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeParagraphText(v: FreeformJsonValue) {
  return String(v ?? '')
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const Txt = ({ v, className = '' }: { v: FreeformJsonValue; className?: string }) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return <span className={className}>{v ? 'Yes' : 'No'}</span>;
  const text = String(v)
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text.trim()) return null;
  return <span className={`whitespace-normal break-words ${className}`}>{text}</span>;
};

const SectionHeading = ({ title }: { title: string }) => (
  <div className="border-b border-gray-800 mb-3 pb-[2px]">
    <h2 className="text-[11.5px] font-extrabold uppercase tracking-[0.16em] text-gray-900">{lbl(title)}</h2>
  </div>
);

const CvEntry = ({ obj, root, path }: { obj: FreeformJsonObject; root: FreeformJsonObject; path: Array<string | number> }) => {
  const entries = getVisibleEntries(obj);

  let titleEntry: [string, FreeformJsonValue] | undefined;
  let dateEntry: [string, FreeformJsonValue] | undefined;
  let subtitleEntry: [string, FreeformJsonValue] | undefined;
  let keyValueEntry: [string, FreeformJsonValue] | undefined;

  for (const [k, v] of entries) {
    const tag = getUiTagForPath(root, [...path, k])?.toLowerCase() ?? '';
    if (!titleEntry && tag === 'title' && typeof v === 'string') { titleEntry = [k, v]; continue; }
    if (!dateEntry && (tag === 'date' || tag === 'date_range') && typeof v === 'string') { dateEntry = [k, v]; continue; }
    if (!subtitleEntry && tag === 'subtitle' && typeof v === 'string') { subtitleEntry = [k, v]; continue; }
    if (!keyValueEntry && tag === 'key_value' && !Array.isArray(v) && !isPlainObject(v)) { keyValueEntry = [k, v]; continue; }
  }

  const hasInlineTitleValue = Boolean(titleEntry && keyValueEntry);
  const showRightAlignedDate = Boolean(dateEntry && subtitleEntry);
  const handled = new Set([titleEntry?.[0], dateEntry?.[0], subtitleEntry?.[0], keyValueEntry?.[0]].filter(Boolean) as string[]);
  const rest = entries.filter(([k]) => !handled.has(k));

  return (
    <div className="space-y-[2px]">
      {hasInlineTitleValue && (
        <div className="space-y-[1px]">
          <p className="text-[12.5px] text-gray-800 leading-snug break-words">
            <span className="font-bold text-gray-900">{String(titleEntry![1]).trim()}:</span>{' '}
            <Txt v={keyValueEntry![1]} />
          </p>
          {showRightAlignedDate && <Txt v={dateEntry![1]} className="text-[12px] text-gray-600" />}
        </div>
      )}
      {!hasInlineTitleValue && (titleEntry || dateEntry) && (
        <div className="flex justify-between items-baseline gap-4">
          {titleEntry && <Txt v={titleEntry[1]} className="font-bold text-[13px] text-gray-900 leading-snug" />}
          {showRightAlignedDate && <Txt v={dateEntry![1]} className="text-[12px] text-gray-600 shrink-0" />}
        </div>
      )}
      {!showRightAlignedDate && dateEntry && (
        <Txt v={dateEntry[1]} className="text-[12px] text-gray-700 leading-snug" />
      )}
      {subtitleEntry && (
        <Txt v={subtitleEntry[1]} className="text-[12px] text-gray-700 leading-snug" />
      )}
      {rest.map(([k, v]) => {
        const fp = [...path, k];
        const fieldTag = getUiTagForPath(root, fp)?.toLowerCase() ?? '';

        if (Array.isArray(v)) {
          const allPrim = v.every((item) => !Array.isArray(item) && !isPlainObject(item));
          if (allPrim) {
            return (
              <ul key={k} className="list-disc pl-5 mt-1 space-y-[2px]">
                {v.map((item, i) => (
                  <li key={i}><Txt v={normalizeListItemText(item as FreeformJsonValue)} className="text-[12.5px] text-gray-800" /></li>
                ))}
              </ul>
            );
          }
          return (
            <div key={k} className="mt-1 divide-y divide-gray-100">
              {v.map((item, i) =>
                isPlainObject(item) ? (
                  <div key={i} className="pt-2 first:pt-0">
                    <CvEntry obj={item} root={root} path={[...fp, i]} />
                  </div>
                ) : (
                  <Txt key={i} v={normalizeListItemText(item as FreeformJsonValue)} className="text-[12.5px] text-gray-800 block py-[1px]" />
                ),
              )}
            </div>
          );
        }

        if (isPlainObject(v)) {
          return (
            <div key={k} className="mt-1">
              <span className="font-bold text-[12px] text-gray-800 block mb-0.5">{lbl(k)}</span>
              <CvEntry obj={v} root={root} path={fp} />
            </div>
          );
        }

        if (fieldTag === 'paragraph') {
          return <p key={k} className="text-[12.5px] text-gray-800 leading-[1.5] break-words">{normalizeParagraphText(v)}</p>;
        }

        const text = String(v ?? '');
        if (!text.trim()) return null;
        return (
          <p key={k} className="text-[12.5px] text-gray-800 leading-snug break-words">
            <span className="font-semibold">{lbl(k)}:</span>{' '}
            <Txt v={v} />
          </p>
        );
      })}
    </div>
  );
};

const SectionBody = ({ value, root, sectionKey }: { value: FreeformJsonValue; root: FreeformJsonObject; sectionKey: string }) => {
  const path = [sectionKey];
  const sectionTag = getUiTagForPath(root, [sectionKey])?.toLowerCase() ?? '';

  if (!Array.isArray(value) && !isPlainObject(value)) {
    if (sectionTag === 'paragraph') {
      return <p className="text-[12.5px] text-gray-800 leading-[1.5] break-words">{normalizeParagraphText(value)}</p>;
    }
    return <Txt v={value} className="text-[12.5px] text-gray-800 leading-[1.5]" />;
  }

  if (Array.isArray(value) && value.every((item) => !Array.isArray(item) && !isPlainObject(item))) {
    return (
      <ul className="list-disc pl-5 space-y-1">
        {value.map((item, i) => (
          <li key={i}><Txt v={normalizeListItemText(item as FreeformJsonValue)} className="text-[12.5px] text-gray-800" /></li>
        ))}
      </ul>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="divide-y divide-gray-100">
        {value.map((item, i) => (
          <div key={i} className="py-2 first:pt-0 last:pb-0">
            {isPlainObject(item) ? (
              <CvEntry obj={item} root={root} path={[...path, i]} />
            ) : (
              <Txt v={item as FreeformJsonValue} className="text-[12.5px] text-gray-800" />
            )}
          </div>
        ))}
      </div>
    );
  }

  const entries = getVisibleEntries(value);

  if (sectionTag === 'paragraph') {
    const merged = entries.map(([, v]) => normalizeParagraphText(v)).filter(Boolean).join(' ');
    return <p className="text-[12.5px] text-gray-800 leading-[1.5] break-words">{merged}</p>;
  }

  const hasSubSections = entries.some(([, v]) => Array.isArray(v) || isPlainObject(v));
  if (hasSubSections) {
    return (
      <div className="space-y-3">
        {entries.map(([k, v]) => {
          if (Array.isArray(v) || isPlainObject(v)) {
            return (
              <div key={k}>
                <div className="font-bold text-[12.5px] text-gray-900 mb-1">{lbl(k)}</div>
                <SectionBody value={v} root={root} sectionKey={`${sectionKey}.${k}`} />
              </div>
            );
          }
          const text = String(v ?? '');
          if (!text.trim()) return null;
          return (
            <p key={k} className="text-[12.5px] text-gray-800 leading-snug break-words">
              <span className="font-bold text-gray-900">{lbl(k)}:</span>{' '}
              <Txt v={v} className="text-[12.5px] text-gray-800" />
            </p>
          );
        })}
      </div>
    );
  }

  return <CvEntry obj={value} root={root} path={path} />;
};

function isContactSection(key: string, _value: FreeformJsonValue, root: FreeformJsonObject): boolean {
  const tag = getUiTagForPath(root, [key])?.toLowerCase();
  return tag === 'contact_block' || tag === 'personal_info';
}

const RIGHT_CONTACT_TAGS = new Set(['phone', 'email', 'url', 'linkedin', 'github', 'xing', 'twitter', 'website', 'portfolio']);
const LEFT_CONTACT_TAGS = new Set(['location', 'address', 'city', 'status', 'headline']);

const ContactHeader = ({ value, root, sectionKey }: { value: FreeformJsonObject; root: FreeformJsonObject; sectionKey: string }) => {
  const entries = getVisibleEntries(value);
  const nameEntry = entries.find(([k]) => getUiTagForPath(root, [sectionKey, k])?.toLowerCase() === 'name');

  const leftEntries = entries.filter(([k]) => {
    if (k === nameEntry?.[0]) return false;
    const tag = getUiTagForPath(root, [sectionKey, k])?.toLowerCase() ?? '';
    return LEFT_CONTACT_TAGS.has(tag);
  });

  const rightEntries = entries.filter(([k]) => {
    if (k === nameEntry?.[0]) return false;
    const tag = getUiTagForPath(root, [sectionKey, k])?.toLowerCase() ?? '';
    return RIGHT_CONTACT_TAGS.has(tag);
  });

  const handledKeys = new Set([
    nameEntry?.[0],
    ...leftEntries.map(([k]) => k),
    ...rightEntries.map(([k]) => k),
  ].filter(Boolean) as string[]);
  const extras = entries.filter(([k]) => !handledKeys.has(k));
  const allRight = [...rightEntries, ...extras];

  return (
    <div className="mb-5 pb-1">
      {nameEntry && (
        <h1 className="text-[22px] font-bold text-gray-900 text-center tracking-tight leading-tight mb-3">
          {String(nameEntry[1])}
        </h1>
      )}
      <div className="flex justify-between items-start gap-4 text-[12px] text-gray-800 leading-[1.55]">
        <div>
          {leftEntries.map(([, v]) => v && String(v).trim() ? <div key={String(v)}><Txt v={v} /></div> : null)}
        </div>
        <div className="text-right">
          {allRight.map(([, v]) => v && String(v).trim() ? <div key={String(v)}><Txt v={v} /></div> : null)}
        </div>
      </div>
    </div>
  );
};

const FreeformCvRenderer = forwardRef<HTMLDivElement, FreeformCvRendererProps>(({ value }, ref) => {
  const sections = getVisibleEntries(value);
  const contactIdx = sections.findIndex(([k, v]) => isContactSection(k, v, value));
  const contact = contactIdx !== -1 ? sections[contactIdx] : null;
  const bodySections = contact ? sections.filter((_, i) => i !== contactIdx) : sections;

  return (
    <div
      ref={ref}
      className="mx-auto bg-white text-gray-900 w-full max-w-[794px] min-h-[1123px] px-10 py-10"
      style={{ fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif" }}
    >
      {contact && isPlainObject(contact[1]) && (
        <ContactHeader value={contact[1]} root={value} sectionKey={contact[0]} />
      )}
      {bodySections.map(([sectionKey, sectionValue]) => (
        <section key={sectionKey} className="mb-5">
          <SectionHeading title={sectionKey} />
          <SectionBody value={sectionValue} root={value} sectionKey={sectionKey} />
        </section>
      ))}
    </div>
  );
});

FreeformCvRenderer.displayName = 'FreeformCvRenderer';

export default FreeformCvRenderer;
