import { forwardRef } from 'react';
import { CvDynamicPayload, CvSectionDescriptor, DisplayStyle } from '../types/cvDescriptor';

interface DynamicTemplateProps {
  payload: CvDynamicPayload;
  templateId?: string;
  diffChanges?: Array<{ section: string; before?: string; after?: string; reason?: string }>;
  showDiffOverlay?: boolean;
}

function normalizeSectionId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function compactForDiff(value?: string): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, 260);
}

// ─── Per-template accent themes ───────────────────────────────────────────────
interface Theme { hex: string; light: string; border: string; text: string; bg: string; }
const THEMES: Record<string, Theme> = {
  'german-latex': { hex: '#475569', light: '#f8fafc', border: '#475569', text: '#334155', bg: '#f1f5f9' },
};
const DEFAULT_THEME = THEMES['german-latex'];

function getTheme(templateId?: string): Theme {
  return (templateId ? THEMES[templateId] : undefined) ?? DEFAULT_THEME;
}

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

/** Format YYYY-MM or YYYY strings for display */
function fmt(date?: string): string {
  if (!date) return '';
  if (date.toLowerCase() === 'present') return 'Present';
  const parts = date.split('-');
  if (parts.length === 2) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const m = parseInt(parts[1], 10);
    return `${months[m - 1] ?? parts[1]} ${parts[0]}`;
  }
  return parts[0]; // year only
}

function dateRange(entry: Record<string, any>): string {
  const start = fmt(entry.startDate || entry.date);
  const end = fmt(entry.endDate);
  if (!start && !end) return '';
  if (!end || entry.endDate?.toLowerCase() === 'present') return start ? `${start} – Present` : 'Present';
  if (!start) return end;
  return `${start} – ${end}`;
}

/** Extract bullets from an entry (highlights or keywords) */
function stringifyBullet(item: any): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    return item.content || item.title || item.text || item.value || JSON.stringify(item);
  }
  return String(item ?? '');
}

function bullets(entry: Record<string, any>): string[] {
  const h = entry.highlights ?? entry.bullets ?? entry.details ?? [];
  if (Array.isArray(h)) return h.filter(Boolean).map(stringifyBullet);
  if (typeof h === 'string' && h) return [h];
  return [];
}

// ─── Section renderers ─────────────────────────────────────────────────────

function SectionHeading({ label, theme }: { label: string; theme: Theme }) {
  return (
    <h2
      className="text-[11pt] font-bold text-gray-900 mb-2 pb-0.5 border-b-2 uppercase tracking-wide"
      style={{ borderColor: theme.border }}
    >
      {label}
    </h2>
  );
}

function ContactBlock({ descriptor, data, theme }: { descriptor: CvSectionDescriptor; data: any; theme: Theme }) {
  const obj: Record<string, any> = data || {};
  const name = obj.name || [obj.firstName, obj.lastName].filter(Boolean).join(' ') || '';
  const label = obj.label || obj.role || obj.jobTitle || obj.title || '';
  const email = obj.email || '';
  const phone = obj.phone || '';
  const url = obj.url || obj.website || '';
  const city = obj.location?.city || obj.city || (typeof obj.location === 'string' ? obj.location : '');
  const profiles: Array<{ network?: string; url?: string; username?: string }> =
    obj.profiles || [];

  const linkedin = profiles.find(p => /linkedin/i.test(p.network || '')) || (obj.linkedIn || obj.linkedin ? { network: 'LinkedIn', url: obj.linkedIn || obj.linkedin, username: '' } : null);
  const github = profiles.find(p => /github/i.test(p.network || '')) || (obj.gitHub || obj.github ? { network: 'GitHub', url: obj.gitHub || obj.github, username: '' } : null);
  const portfolio = obj.portfolio || '';

  const contactItems: Array<React.ReactNode> = [];
  if (email) contactItems.push(<span key="email">✉ {email}</span>);
  if (phone) contactItems.push(<span key="phone">☎ {phone}</span>);
  if (city) contactItems.push(<span key="city">📍 {city}</span>);
  if (url) contactItems.push(<a key="url" href={url} className="hover:underline break-normal" style={{ color: theme.hex }}>{url.replace(/^https?:\/\//, '')}</a>);
  if (portfolio) contactItems.push(<a key="portfolio" href={portfolio.startsWith('http') ? portfolio : `https://${portfolio}`} className="hover:underline break-normal" style={{ color: theme.hex }}>Portfolio: {portfolio.replace(/^https?:\/\//, '')}</a>);
  if (linkedin?.url) contactItems.push(<a key="linkedin" href={linkedin.url.startsWith('http') ? linkedin.url : `https://${linkedin.url}`} className="hover:underline break-normal" style={{ color: theme.hex }}>LinkedIn: {(linkedin.username || linkedin.url).replace(/^https?:\/\/(www\.)?/, '')}</a>);
  if (github?.url) contactItems.push(<a key="github" href={github.url.startsWith('http') ? github.url : `https://${github.url}`} className="hover:underline break-normal" style={{ color: theme.hex }}>GitHub: {(github.username || github.url).replace(/^https?:\/\/(www\.)?/, '')}</a>);

  // Collect any remaining unknown string fields
  const knownKeys = new Set(['name', 'firstName', 'lastName', 'label', 'role', 'jobTitle', 'title', 'email', 'phone', 'url', 'website', 'city', 'location', 'profiles', 'linkedIn', 'linkedin', 'gitHub', 'github', 'portfolio']);
  const extraEntries = Object.entries(obj).filter(([k, v]) => !knownKeys.has(k) && typeof v === 'string' && v.trim() !== '');
  extraEntries.forEach(([k, v]) => {
    contactItems.push(<span key={k}>{k.replace(/_/g, ' ')}: {v.startsWith('http') ? <a href={v} className="hover:underline" style={{ color: theme.hex }}>{v.replace(/^https?:\/\//, '')}</a> : v}</span>);
  });

  return (
    <header className="mb-4 text-center">
      {name && <h1 className="text-[16pt] font-bold text-gray-900 mb-0.5">{name}</h1>}
      {label && <div className="text-[10pt] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: theme.hex }}>{label}</div>}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[8.5pt] text-gray-600 break-all">
        {contactItems}
      </div>
    </header>
  );
}

function TextBlock({ descriptor, data, theme }: { descriptor: CvSectionDescriptor; data: any; theme: Theme }) {
  const text = typeof data === 'string' ? data : '';
  if (!text) return null;
  return (
    <section className="mb-4">
      <SectionHeading label={descriptor.label} theme={theme} />
      <p className="text-[9pt] text-gray-700 leading-relaxed">{text}</p>
    </section>
  );
}

// Known keys used by structured timeline/list entries — anything not in this set is a custom field
const KNOWN_ENTRY_KEYS = new Set([
  'position','degree','studyType','name','title','company','institution','organization','publisher',
  'location','startDate','endDate','date','summary','description','highlights','bullets','details',
  'url','website','fluency','keywords','network','username','issuer','awarder','reference','content','category',
]);

function TimelineSection({ descriptor, data, theme }: { descriptor: CvSectionDescriptor; data: any; theme: Theme }) {
  const items: Record<string, any>[] = Array.isArray(data) ? data : [];
  if (!items.length) return null;
  return (
    <section className="mb-4">
      <SectionHeading label={descriptor.label} theme={theme} />
      <div className="space-y-3">
        {items.map((entry, idx) => {
          const title = entry.position || entry.degree || entry.studyType || entry.name || entry.title || entry.category || '';
          const org = entry.name || entry.company || entry.institution || entry.organization || entry.publisher || '';
          const loc = entry.location || '';
          const range = dateRange(entry);
          const desc = entry.summary || entry.description || entry.content || '';
          const bs = bullets(entry);
          const entryUrl = entry.url || '';
          // Custom fields: keys not in the known set
          const customEntries = Object.entries(entry).filter(([k]) => !KNOWN_ENTRY_KEYS.has(k) && entry[k] !== '' && entry[k] != null);

          return (
            <div key={idx}>
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-2">
                  <span className="text-[9.5pt] font-semibold text-gray-900">{title || org}</span>
                  {title && org && (
                    <span className="block text-[8.5pt] font-medium" style={{ color: theme.hex }}>
                      {org}{loc ? ` · ${loc}` : ''}
                    </span>
                  )}
                  {entryUrl && (
                    <a href={entryUrl} className="text-[8pt] hover:underline" style={{ color: theme.hex }}>
                      {entryUrl.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
                {range && (
                  <span className="text-[8pt] text-gray-500 flex-shrink-0">{range}</span>
                )}
              </div>
              {desc && (
                <p className="text-[8.5pt] text-gray-700 leading-snug mt-0.5 whitespace-pre-line">{desc}</p>
              )}
              {bs.length > 0 && (
                <ul className="mt-0.5 space-y-0.5 ml-3">
                  {bs.map((b, bi) => (
                    <li key={bi} className="text-[8.5pt] text-gray-700 leading-snug flex gap-1.5">
                      <span className="flex-shrink-0 mt-0.5" style={{ color: theme.hex }}>•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              {/* Generic custom fields */}
              {customEntries.length > 0 && (
                <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {customEntries.map(([k, v]) => (
                    <div key={k} className="flex gap-1 text-[8.5pt] text-gray-700">
                      <span className="font-semibold flex-shrink-0 capitalize">{k.replace(/_/g, ' ')}:</span>
                      <span>{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* If no known fields at all, show all fields generically */}
              {!title && !org && !range && !desc && !bs.length && customEntries.length === 0 && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {Object.entries(entry).filter(([, v]) => v !== '' && v != null).map(([k, v]) => (
                    <div key={k} className="flex gap-1 text-[8.5pt] text-gray-700">
                      <span className="font-semibold flex-shrink-0 capitalize">{k.replace(/_/g, ' ')}:</span>
                      <span>{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function KeyValueSection({ descriptor, data, theme }: { descriptor: CvSectionDescriptor; data: any; theme: Theme }) {
  const obj: Record<string, any> = (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
  const entries = Object.entries(obj).filter(([, v]) => v !== '' && v != null);
  if (!entries.length) return null;
  return (
    <section className="mb-4">
      <SectionHeading label={descriptor.label} theme={theme} />
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-1.5 text-[8.5pt]">
            <span className="font-semibold text-gray-700 flex-shrink-0 capitalize">{k.replace(/_/g, ' ')}:</span>
            <span className="text-gray-700">{String(v)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TagCloudSection({ descriptor, data, theme }: { descriptor: CvSectionDescriptor; data: any; theme: Theme }) {
  const items: Record<string, any>[] = Array.isArray(data) ? data : [];
  if (!items.length) return null;
  return (
    <section className="mb-4">
      <SectionHeading label={descriptor.label} theme={theme} />
      <div className="space-y-0.5">
        {items.map((item, idx) => {
          const groupName = item.name || item.language || item.category || '';
          const keywords: string[] = Array.isArray(item.keywords) ? item.keywords
            : item.fluency ? [item.fluency] : [];
          const allWords = keywords.join(', ') || item.fluency || item.content || item.value || '';
          return (
            <div key={idx} className="text-[8.5pt] text-gray-700 leading-snug">
              {groupName && (
                <span className="font-semibold">{groupName}{allWords ? ': ' : ''}</span>
              )}
              {allWords && <span>{allWords}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PlainListSection({ descriptor, data, theme }: { descriptor: CvSectionDescriptor; data: any; theme: Theme }) {
  const items: Record<string, any>[] = Array.isArray(data) ? data : [];
  if (!items.length) return null;
  return (
    <section className="mb-4">
      <SectionHeading label={descriptor.label} theme={theme} />
      <div className="space-y-1.5">
        {items.map((item, idx) => {
          const title = item.name || item.title || item.organization || '';
          const sub = item.issuer || item.awarder || item.date || '';
          const url = item.url || '';
          const desc = item.summary || item.description || item.reference || item.content || '';
          return (
            <div key={idx} className="flex justify-between items-start">
              <div className="flex-1 min-w-0 pr-2">
                {url ? (
                  <a href={url} className="text-[9pt] font-semibold hover:underline" style={{ color: theme.text }}>{title}</a>
                ) : (
                  <span className="text-[9pt] font-semibold text-gray-900">{title}</span>
                )}
                {sub && <span className="block text-[8pt] text-gray-600">{sub}</span>}
                {desc && <p className="text-[8pt] text-gray-600 leading-snug mt-0.5">{desc}</p>}
              </div>
              {item.date && (
                <span className="text-[8pt] text-gray-500 flex-shrink-0">{fmt(item.date)}</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TwoColumnListSection({ descriptor, data, theme }: { descriptor: CvSectionDescriptor; data: any; theme: Theme }) {
  const items: string[] = Array.isArray(data) ? data.map(String) :
    typeof data === 'object' && data !== null
      ? Object.values(data).flat().map(String)
      : [];
  if (!items.length) return null;
  return (
    <section className="mb-4">
      <SectionHeading label={descriptor.label} theme={theme} />
      <p className="text-[8.5pt] text-gray-700 leading-snug">
        {items.join(', ')}
      </p>
    </section>
  );
}

// ─── Dispatch by displayStyle ──────────────────────────────────────────────

function renderSection(descriptor: CvSectionDescriptor, data: any, theme: Theme) {
  const style: DisplayStyle = descriptor.displayStyle;
  switch (style) {
    case 'contact-block':
      return <ContactBlock key={descriptor.key} descriptor={descriptor} data={data} theme={theme} />;
    case 'text-block':
      // single-object sections store an object, not a string
      if (data && typeof data === 'object' && !Array.isArray(data))
        return <KeyValueSection key={descriptor.key} descriptor={descriptor} data={data} theme={theme} />;
      return <TextBlock key={descriptor.key} descriptor={descriptor} data={data} theme={theme} />;
    case 'timeline':
      return <TimelineSection key={descriptor.key} descriptor={descriptor} data={data} theme={theme} />;
    case 'tag-cloud':
      // custom string-list sections produce string[], not Record[]
      if (Array.isArray(data) && data.every((d) => typeof d === 'string'))
        return <TwoColumnListSection key={descriptor.key} descriptor={descriptor} data={data} theme={theme} />;
      return <TagCloudSection key={descriptor.key} descriptor={descriptor} data={data} theme={theme} />;
    case 'plain-list':
      return <PlainListSection key={descriptor.key} descriptor={descriptor} data={data} theme={theme} />;
    case 'two-column-list':
      return <TwoColumnListSection key={descriptor.key} descriptor={descriptor} data={data} theme={theme} />;
    default:
      if (typeof data === 'string') return <TextBlock key={descriptor.key} descriptor={descriptor} data={data} theme={theme} />;
      if (data && typeof data === 'object' && !Array.isArray(data))
        return <KeyValueSection key={descriptor.key} descriptor={descriptor} data={data} theme={theme} />;
      if (Array.isArray(data) && data.every((d) => typeof d === 'string'))
        return <TwoColumnListSection key={descriptor.key} descriptor={descriptor} data={data} theme={theme} />;
      return <TimelineSection key={descriptor.key} descriptor={descriptor} data={data} theme={theme} />;
  }
}

// ─── Main template component ───────────────────────────────────────────────

/**
 * DynamicTemplate renders a complete CV from a CvDynamicPayload.
 * It replaces all hardcoded JsonResume-bound templates when cvDescriptor is present.
 */
const DynamicTemplate = forwardRef<HTMLDivElement, DynamicTemplateProps>(({ payload, templateId, diffChanges = [], showDiffOverlay = false }, ref) => {
  const { descriptor, data } = payload;
  const theme = getTheme(templateId);

  const diffMap = new Map<string, { before?: string; after?: string; reason?: string }>();
  diffChanges.forEach((item) => {
    if (!item?.section) return;
    diffMap.set(normalizeSectionId(item.section), { before: item.before, after: item.after, reason: item.reason });
  });
  const overallDiff = diffMap.get('overall');

  const sections = [...descriptor]
    .filter((s) => s.visible !== false)
    .sort((a, b) => a.order - b.order);

  return (
    <div
      ref={ref}
      className="bg-white text-black p-6 w-full max-w-[210mm] mx-auto font-sans"
      style={{
        minHeight: '297mm',
        fontSize: '10pt',
        lineHeight: 1.4,
      }}
    >
      {showDiffOverlay && overallDiff && (
        <div className="mb-2 text-[7.5pt] leading-snug">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {overallDiff.before && (
                <div style={{ color: '#b91c1c' }}>
                  - {compactForDiff(overallDiff.before)}
                </div>
              )}
              {overallDiff.after && (
                <div style={{ color: '#166534' }}>
                  + {compactForDiff(overallDiff.after)}
                </div>
              )}
            </div>
            {overallDiff.reason && (
              <details className="flex-shrink-0">
                <summary
                  title="Show change reason"
                  className="list-none cursor-pointer inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-300 text-[10px] text-gray-600"
                >
                  i
                </summary>
                <div className="mt-1 max-w-[260px] p-1.5 rounded border border-gray-200 text-[7.5pt] text-gray-600 bg-white shadow-sm">
                  {overallDiff.reason}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {sections.map((s) => {
        const diff = diffMap.get(normalizeSectionId(s.label)) || diffMap.get(normalizeSectionId(s.key));
        const showDiff = showDiffOverlay && Boolean(diff);
        return (
          <div key={s.key}>
            {showDiff && (
              <div className="mb-1 text-[7.5pt] leading-snug">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {diff?.before && (
                      <div style={{ color: '#b91c1c' }}>
                        - {compactForDiff(diff.before)}
                      </div>
                    )}
                    {diff?.after && (
                      <div style={{ color: '#166534' }}>
                        + {compactForDiff(diff.after)}
                      </div>
                    )}
                  </div>
                  {diff?.reason && (
                    <details className="flex-shrink-0">
                      <summary
                        title="Show change reason"
                        className="list-none cursor-pointer inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-300 text-[10px] text-gray-600"
                      >
                        i
                      </summary>
                      <div className="mt-1 max-w-[260px] p-1.5 rounded border border-gray-200 text-[7.5pt] text-gray-600 bg-white shadow-sm">
                        {diff.reason}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            )}
            {renderSection(s, data[s.key], theme)}
          </div>
        );
      })}
    </div>
  );
});

DynamicTemplate.displayName = 'DynamicTemplate';
export default DynamicTemplate;
