import { forwardRef, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '../common';
import {
  FreeformJsonObject,
  FreeformJsonValue,
  getUiTagForPath,
  getVisibleEntries,
  isPlainObject,
} from './freeformUtils';

interface FreeformCvRendererProps {
  value: FreeformJsonObject;
  /** Called whenever the rendered page count changes */
  onPageCountChange?: (pages: number) => void;
}

// ─── A4 dimensions at 96 dpi ────────────────────────────────────────────────
const A4_W = 794;   // px
const A4_H = 1123;  // px
const PAGE_GAP = 32; // gap between pages

// ─── Utility helpers ─────────────────────────────────────────────────────────

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

// ─── Primitive components ─────────────────────────────────────────────────────

const Txt = ({
  v,
  className = '',
  path,
  tag,
}: {
  v: FreeformJsonValue;
  className?: string;
  path?: Array<string | number>;
  tag?: string;
}) => {
  if (v === null || v === undefined) return null;

  const props = {
    'data-path': path ? path.join('.') : undefined,
    'data-tag': tag,
    className,
  };

  if (typeof v === 'boolean')
    return <span {...props}>{v ? 'Yes' : 'No'}</span>;

  const text = String(v)
    .replace(/\r?\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const normalized = text.replace(/[^a-z0-9/]+/gi, '').toLowerCase();
  if (!text.trim()) return null;
  if (normalized === 'na' || normalized === 'n/a' || normalized === 'notavailable') return null;
  return (
    <span {...props} className={`whitespace-normal break-words ${className}`}>
      {text}
    </span>
  );
};

const SectionHeading = ({ title, tag }: { title: string; tag?: string }) => (
  <div className="border-b border-gray-800 mb-3 pb-[2px]">
    <h2
      className="text-[11.5px] font-extrabold uppercase tracking-[0.16em] text-gray-900"
      data-path={title}
      data-is-key="true"
      data-tag={tag || ''}
    >
      {lbl(title)}
    </h2>
  </div>
);

// ─── CV entry ────────────────────────────────────────────────────────────────

const CvEntry = ({
  obj,
  root,
  path,
}: {
  obj: FreeformJsonObject;
  root: FreeformJsonObject;
  path: Array<string | number>;
}) => {
  const entries = getVisibleEntries(obj);

  let titleEntry: [string, FreeformJsonValue] | undefined;
  let dateEntry: [string, FreeformJsonValue] | undefined;
  let subtitleEntry: [string, FreeformJsonValue] | undefined;
  let keyValueEntry: [string, FreeformJsonValue] | undefined;
  let locationEntry: [string, FreeformJsonValue] | undefined;

  for (const [k, v] of entries) {
    const tag = getUiTagForPath(root, [...path, k])?.toLowerCase() ?? '';
    if (!titleEntry && tag === 'title' && typeof v === 'string') { titleEntry = [k, v]; continue; }
    if (!dateEntry && (tag === 'date' || tag === 'date_range') && typeof v === 'string') { dateEntry = [k, v]; continue; }
    if (!subtitleEntry && tag === 'subtitle' && typeof v === 'string') { subtitleEntry = [k, v]; continue; }
    if (!locationEntry && tag === 'location' && typeof v === 'string') { locationEntry = [k, v]; continue; }
    if (!keyValueEntry && tag === 'key_value' && !Array.isArray(v) && !isPlainObject(v)) { keyValueEntry = [k, v]; continue; }
  }

  const hasInlineTitleValue = Boolean(titleEntry && keyValueEntry);
  const showRightAlignedDate = Boolean(dateEntry && subtitleEntry);
  const handled = new Set(
    [titleEntry?.[0], dateEntry?.[0], subtitleEntry?.[0], locationEntry?.[0], keyValueEntry?.[0]].filter(Boolean) as string[],
  );
  const rest = entries.filter(([k]) => !handled.has(k));

  return (
    <div className="space-y-[2px]">
      {hasInlineTitleValue && (
        <div className="space-y-[1px]">
          <p className="text-[12.5px] text-gray-800 leading-snug break-words">
            <span
              className="font-bold text-gray-900"
              data-path={[...path, titleEntry![0]].join('.')}
              data-tag="title"
            >
              {String(titleEntry![1]).trim()}:
            </span>{' '}
            <Txt v={keyValueEntry![1]} path={[...path, keyValueEntry![0]]} tag="key_value" />
          </p>
          {showRightAlignedDate && (
            <Txt v={dateEntry![1]} path={[...path, dateEntry![0]]} tag="date" className="text-[12px] text-gray-600" />
          )}
        </div>
      )}
      {!hasInlineTitleValue && (titleEntry || dateEntry) && (
        <div className="flex justify-between items-baseline gap-4">
          {titleEntry && (
            <Txt v={titleEntry[1]} path={[...path, titleEntry[0]]} tag="title" className="font-bold text-[13px] text-gray-900 leading-snug" />
          )}
          {showRightAlignedDate && (
            <Txt v={dateEntry![1]} path={[...path, dateEntry![0]]} tag="date" className="text-[12px] text-gray-600 shrink-0" />
          )}
        </div>
      )}
      {!showRightAlignedDate && dateEntry && (
        <Txt v={dateEntry[1]} path={[...path, dateEntry[0]]} tag="date" className="text-[12px] text-gray-700 leading-snug" />
      )}
      {subtitleEntry && (
        <Txt v={subtitleEntry[1]} path={[...path, subtitleEntry[0]]} tag="subtitle" className="text-[12px] text-gray-700 leading-snug" />
      )}
      {locationEntry && (
        <div className="text-[11.5px] text-gray-500 italic leading-snug">
          <span className="mr-1">—</span>
          <Txt v={locationEntry[1]} path={[...path, locationEntry[0]]} tag="location" />
        </div>
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
                  <li key={i}>
                    <Txt v={normalizeListItemText(item as FreeformJsonValue)} path={[...fp, i]} tag={fieldTag} className="text-[12.5px] text-gray-800" />
                  </li>
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
                  <Txt
                    key={i}
                    v={normalizeListItemText(item as FreeformJsonValue)}
                    path={[...fp, i]}
                    tag={fieldTag}
                    className="text-[12.5px] text-gray-800 block py-[1px]"
                  />
                ),
              )}
            </div>
          );
        }

        if (isPlainObject(v)) {
          return (
            <div key={k} className="mt-1">
              <span
                className="font-bold text-[12px] text-gray-800 block mb-0.5"
                data-path={[...path, k].join('.')}
                data-is-key="true"
                data-tag={fieldTag}
              >
                {lbl(k)}
              </span>
              <CvEntry obj={v} root={root} path={fp} />
            </div>
          );
        }

        if (fieldTag === 'paragraph') {
          return (
            <p key={k} data-path={[...path, k].join('.')} data-tag={fieldTag} className="text-[12.5px] text-gray-800 leading-[1.5] break-words">
              {normalizeParagraphText(v)}
            </p>
          );
        }

        if (fieldTag === 'location') return null;

        const text = String(v ?? '');
        if (!text.trim()) return null;
        return (
          <p key={k} className="text-[12.5px] text-gray-800 leading-snug break-words">
            <span className="font-semibold" data-path={[...path, k].join('.')} data-is-key="true" data-tag={fieldTag}>
              {lbl(k)}:
            </span>{' '}
            <Txt v={v} path={[...path, k]} tag={fieldTag} />
          </p>
        );
      })}
    </div>
  );
};

// ─── Section body ────────────────────────────────────────────────────────────

const SectionBody = ({
  value,
  root,
  sectionKey,
}: {
  value: FreeformJsonValue;
  root: FreeformJsonObject;
  sectionKey: string;
}) => {
  const path = [sectionKey];
  const sectionTag = getUiTagForPath(root, [sectionKey])?.toLowerCase() ?? '';

  if (!Array.isArray(value) && !isPlainObject(value)) {
    if (sectionTag === 'paragraph') {
      return (
        <p data-path={path.join('.')} data-tag={sectionTag} className="text-[12.5px] text-gray-800 leading-[1.5] break-words">
          {normalizeParagraphText(value)}
        </p>
      );
    }
    return <Txt v={value} path={path} tag={sectionTag} className="text-[12.5px] text-gray-800 leading-[1.5]" />;
  }

  if (Array.isArray(value) && value.every((item) => !Array.isArray(item) && !isPlainObject(item))) {
    return (
      <ul className="list-disc pl-5 space-y-1">
        {value.map((item, i) => (
          <li key={i}>
            <Txt v={normalizeListItemText(item as FreeformJsonValue)} path={[...path, i]} tag={sectionTag} className="text-[12.5px] text-gray-800" />
          </li>
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
              <Txt v={item as FreeformJsonValue} path={[...path, i]} tag={sectionTag} className="text-[12.5px] text-gray-800" />
            )}
          </div>
        ))}
      </div>
    );
  }

  const entries = getVisibleEntries(value);

  if (sectionTag === 'paragraph') {
    const merged = entries.map(([, v]) => normalizeParagraphText(v)).filter(Boolean).join(' ');
    return (
      <p data-path={path.join('.')} data-tag={sectionTag} className="text-[12.5px] text-gray-800 leading-[1.5] break-words">
        {merged}
      </p>
    );
  }

  const hasSubSections = entries.some(([, v]) => Array.isArray(v) || isPlainObject(v));
  if (hasSubSections) {
    return (
      <div className="space-y-3">
        {entries.map(([k, v]) => {
          if (Array.isArray(v) || isPlainObject(v)) {
            const uiTag = getUiTagForPath(root, [...path, k])?.toLowerCase() || '';
            const shouldHideLabel =
              /^(bullets|highlights|items|content|description|summary|responsibilities|achievements)$/i.test(k) ||
              uiTag === 'bullets';
            return (
              <div key={k}>
                {!shouldHideLabel && (
                  <div
                    className="font-bold text-[12.5px] text-gray-900 mb-1"
                    data-path={[...path, k].join('.')}
                    data-is-key="true"
                    data-tag={uiTag}
                  >
                    {lbl(k)}
                  </div>
                )}
                <SectionBody value={v} root={root} sectionKey={`${sectionKey}.${k}`} />
              </div>
            );
          }
          const text = String(v ?? '');
          if (!text.trim()) return null;
          return (
            <p key={k} className="text-[12.5px] text-gray-800 leading-snug break-words">
              <span
                className="font-bold text-gray-900"
                data-path={[...path, k].join('.')}
                data-is-key="true"
                data-tag={getUiTagForPath(root, [...path, k])?.toLowerCase() || ''}
              >
                {lbl(k)}:
              </span>{' '}
              <Txt
                v={v}
                path={[...path, k]}
                tag={getUiTagForPath(root, [...path, k])?.toLowerCase()}
                className="text-[12.5px] text-gray-800"
              />
            </p>
          );
        })}
      </div>
    );
  }

  return <CvEntry obj={value} root={root} path={path} />;
};

// ─── Contact header ──────────────────────────────────────────────────────────

const CONTACT_FIELD_PATTERNS = [/^email$/i, /^phone$/i, /^mobile$/i, /^tel$/i, /^linkedin/i, /^github/i, /^website$/i, /^url$/i, /^portfolio/i];

function isContactSection(key: string, value: FreeformJsonValue, root: FreeformJsonObject): boolean {
  const tag = getUiTagForPath(root, [key])?.toLowerCase();
  if (tag === 'contact_block' || tag === 'personal_info') return true;

  // Fallback: detect by content — a plain object with a 'name' field + at least one contact field.
  // This handles 'basics' keys generated by AI tailoring when __vh_tags contact_block tag is missing.
  if (!isPlainObject(value)) return false;
  const fieldKeys = Object.keys(value as Record<string, unknown>);
  const hasName = fieldKeys.some(k => /^name$/i.test(k));
  const hasContact = fieldKeys.some(k => CONTACT_FIELD_PATTERNS.some(re => re.test(k)));
  return hasName && hasContact;
}

const RIGHT_CONTACT_TAGS = new Set(['phone', 'email', 'url', 'linkedin', 'github', 'xing', 'twitter', 'website', 'portfolio']);
const LEFT_CONTACT_TAGS = new Set(['location', 'address', 'city', 'status', 'headline']);

const ContactHeader = ({
  value,
  root,
  sectionKey,
}: {
  value: FreeformJsonObject;
  root: FreeformJsonObject;
  sectionKey: string;
}) => {
  const entries = getVisibleEntries(value);

  // Resolve tag for a field — fall back to key-name matching when tags are absent.
  const resolveTag = (k: string): string => {
    const explicit = getUiTagForPath(root, [sectionKey, k])?.toLowerCase() ?? '';
    if (explicit) return explicit;
    // Fallback by key name
    if (/^name$/i.test(k)) return 'name';
    if (/^(location|city|address)$/i.test(k)) return 'location';
    if (/^(phone|mobile|tel)$/i.test(k)) return 'phone';
    if (/^email$/i.test(k)) return 'email';
    if (/^linkedin/i.test(k)) return 'linkedin';
    if (/^github/i.test(k)) return 'github';
    if (/^(website|url|portfolio|site)$/i.test(k)) return 'url';
    if (/^(title|headline|summary|profile)$/i.test(k)) return 'paragraph';
    return '';
  };

  const nameEntry = entries.find(([k]) => resolveTag(k) === 'name');

  const leftEntries = entries.filter(([k]) => {
    if (k === nameEntry?.[0]) return false;
    return LEFT_CONTACT_TAGS.has(resolveTag(k));
  });

  const rightEntries = entries.filter(([k]) => {
    if (k === nameEntry?.[0]) return false;
    return RIGHT_CONTACT_TAGS.has(resolveTag(k));
  });

  const handledKeys = new Set(
    [nameEntry?.[0], ...leftEntries.map(([k]) => k), ...rightEntries.map(([k]) => k)].filter(Boolean) as string[],
  );
  const extras = entries.filter(([k]) => !handledKeys.has(k));
  const allRight = [...rightEntries, ...extras];

  return (
    <div className="mb-5 pb-1 px-10">
      {nameEntry && (
        <h1
          data-path={[sectionKey, nameEntry[0]].join('.')}
          data-tag="name"
          className="text-[22px] font-bold text-gray-900 text-center tracking-tight leading-tight mb-3"
        >
          {String(nameEntry[1])}
        </h1>
      )}
      <div className="flex justify-between items-start gap-4 text-[12px] text-gray-800 leading-[1.55]">
        <div>
          {leftEntries.map(([k, v]) =>
            v && String(v).trim() ? (
              <div key={String(v)}>
                <Txt v={v} path={[sectionKey, k]} tag={resolveTag(k)} />
              </div>
            ) : null,
          )}
        </div>
        <div className="text-right">
          {allRight.map(([k, v]) =>
            v && String(v).trim() ? (
              <div key={String(v)}>
                <Txt v={v} path={[sectionKey, k]} tag={resolveTag(k)} />
              </div>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Hidden measurement pass ──────────────────────────────────────────────────

interface MeasureProps {
  contact: [string, FreeformJsonValue] | null;
  bodySections: Array<[string, FreeformJsonValue]>;
  root: FreeformJsonObject;
  onMeasured: (totalHeight: number) => void;
}

const MeasureContainer = ({ contact, bodySections, root, onMeasured }: MeasureProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (ref.current) {
      onMeasured(ref.current.scrollHeight);
    }
  });

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: '-9999px',
        width: `${A4_W}px`,
        fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
        background: 'white',
        padding: '40px 0',
        boxSizing: 'border-box',
      }}
    >
      {contact && isPlainObject(contact[1]) && (
        <ContactHeader value={contact[1]} root={root} sectionKey={contact[0]} />
      )}
      {bodySections.map(([sectionKey, sectionValue]) => (
        <section key={sectionKey} className="mb-5 px-10">
          <SectionHeading title={sectionKey} tag={getUiTagForPath(root, [sectionKey])?.toLowerCase()} />
          <SectionBody value={sectionValue} root={root} sectionKey={sectionKey} />
        </section>
      ))}
    </div>
  );
};

// ─── Main renderer ────────────────────────────────────────────────────────────

const FreeformCvRenderer = forwardRef<HTMLDivElement, FreeformCvRendererProps>(({ value, onPageCountChange }, ref) => {
  const sections = getVisibleEntries(value);
  const contactIdx = sections.findIndex(([k, v]) => isContactSection(k, v, value));
  const contact = contactIdx !== -1 ? sections[contactIdx] : null;
  const bodySections = contact ? sections.filter((_, i) => i !== contactIdx) : sections;

  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);

  const handleMeasured = (totalHeight: number) => {
    const contentHeight = Math.max(totalHeight - 80, 1);
    const pageContentH = A4_H - 80;
    const pages = Math.max(1, Math.ceil(contentHeight / pageContentH));
    if (pages !== pageCount) {
      setPageCount(pages);
      onPageCountChange?.(pages);
      setCurrentPage(0);
    }
  };

  const totalWidth = pageCount * A4_W + (pageCount - 1) * PAGE_GAP;

  return (
    <div id="cv-print-root" className="flex flex-col items-center w-full pt-10 pb-4">
      {/* Print styles: remove pagination constraints so all content flows vertically */}
      <style>{`
        @page {
          size: A4;
          margin: 0;
        }
        @media print {
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #cv-print-root {
            padding: 0 !important;
            background: white !important;
            align-items: flex-start !important;
          }
          #cv-viewport {
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            box-shadow: none !important;
            background: white !important;
          }
          #cv-content-track {
            transform: none !important;
            width: 100% !important;
            height: auto !important;
            columns: unset !important;
            column-width: unset !important;
            column-gap: unset !important;
            column-fill: unset !important;
            padding: 0 !important;
          }
          #cv-nav-controls {
            display: none !important;
          }
          #cv-measure-container {
            display: none !important;
          }
        }
      `}</style>

      {/* Off-screen measurement */}
      <MeasureContainer
        contact={contact}
        bodySections={bodySections}
        root={value}
        onMeasured={handleMeasured}
      />

      {/* Viewport: Shows only one page at a time, hides horizontal scrollbar */}
      <div
        id="cv-viewport"
        className="overflow-hidden shadow-2xl bg-white"
        style={{ width: `${A4_W}px`, height: `${A4_H}px` }}
      >
        {/* Sliding Content Track */}
        <div
          id="cv-content-track"
          ref={ref}
          style={{
            fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
            boxSizing: 'border-box',
            width: `${totalWidth}px`,
            height: `${A4_H}px`,
            padding: '40px 0',
            columnWidth: `${A4_W}px`,
            columnGap: `${PAGE_GAP}px`,
            columnFill: 'auto',
            transition: 'transform 0.3s ease-in-out',
            transform: `translateX(-${currentPage * (A4_W + PAGE_GAP)}px)`,
          }}
          className="text-gray-900"
        >
          {contact && isPlainObject(contact[1]) && (
            <ContactHeader value={contact[1]} root={value} sectionKey={contact[0]} />
          )}
          {bodySections.map(([sectionKey, sectionValue]) => (
            <section key={sectionKey} className="mb-5 px-10">
              <SectionHeading title={sectionKey} tag={getUiTagForPath(value, [sectionKey])?.toLowerCase()} />
              <SectionBody value={sectionValue} root={value} sectionKey={sectionKey} />
            </section>
          ))}
        </div>
      </div>

      {/* Navigation Controls at the Bottom */}
      {pageCount > 1 && (
        <div id="cv-nav-controls" className="flex items-center gap-6 mt-8 mb-0">
          <Button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            variant="primary"
            className="px-6 font-bold uppercase tracking-wider"
          >
            Previous
          </Button>

          <span className="text-sm font-bold text-gray-500 tabular-nums">
            {currentPage + 1} / {pageCount}
          </span>

          <Button
            onClick={() => setCurrentPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={currentPage === pageCount - 1}
            variant="primary"
            className="px-6 font-bold uppercase tracking-wider"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
});

FreeformCvRenderer.displayName = 'FreeformCvRenderer';

export default FreeformCvRenderer;