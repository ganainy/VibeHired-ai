import { forwardRef, ReactNode } from "react";
import { ResumeData } from "../utils/cvDataTransform";

function safeRenderValue(value: unknown): ReactNode {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map((item, i) => (
      <span key={i}>
        {safeRenderValue(item)}
        {i < value.length - 1 ? ', ' : ''}
      </span>
    ));
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
  }
  return String(value);
}

interface GermanLatexResumeProps {
    data: ResumeData;
    language?: 'en' | 'de';
}

/**
 * Parse text with markdown bold syntax (**text**) and convert to React elements
 */
const parseMarkdownBold = (text: string): ReactNode[] => {
    const parts: ReactNode[] = [];
    const boldRegex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = boldRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }
        parts.push(<strong key={key++}>{match[1]}</strong>);
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    if (parts.length === 0) {
        return [text];
    }

    return parts;
};

const GermanLatexResume = forwardRef<HTMLDivElement, GermanLatexResumeProps>(
    ({ data, language = 'de' }, ref) => {
        const t = {
            en: {
                professionalProfile: 'Professional Profile',
                relevantExperience: 'Relevant IT Experience',
                education: 'Education',
                technicalSkills: 'Technical Skills',
                languages: 'Languages',
                projects: 'Projects',
            },
            de: {
                professionalProfile: 'Kurzprofil',
                relevantExperience: 'Berufserfahrung',
                education: 'Ausbildung',
                technicalSkills: 'IT-Kenntnisse',
                languages: 'Sprachen',
                projects: 'Projekte',
            },
        };

        const lang = t[language];

        /** Shared style for every section heading */
        const sectionHeading: React.CSSProperties = {
            fontSize: '11pt',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderBottom: '1px solid #000',
            marginBottom: '8px',
            marginTop: '0',
            paddingBottom: '2px',
        };

        /** Shared style for entry rows (job/edu header row) */
        const entryRow: React.CSSProperties = {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '1px',
        };

        return (
            <div
                ref={ref}
                style={{
                    fontFamily: 'Arial, Helvetica, sans-serif',
                    fontSize: '11pt',
                    lineHeight: '1.45',
                    color: '#000',
                    margin: '0',
                    padding: '40px',
                    background: 'white',
                    maxWidth: '210mm',
                    width: '100%',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                }}
                data-preserve="true"
            >
                {/* ── Header ─────────────────────────────────────────── */}
                <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                    <h1 style={{
                        fontSize: '18pt',
                        fontWeight: 'bold',
                        margin: '0 0 3px 0',
                    }}>
                        {data.firstName} {data.lastName}
                    </h1>

                    {data.jobTitle && (
                        <div style={{ fontSize: '11pt', fontWeight: 'bold', letterSpacing: '0.08em', marginBottom: '6px' }}>
                            {data.jobTitle.toUpperCase()}
                        </div>
                    )}

                    {/* Single-line contact row — no icons, plain text separators */}
                    <div style={{ fontSize: '10pt', lineHeight: '1.6' }}>
                        {[
                            data.email,
                            data.phone,
                            [data.city, data.state].filter(Boolean).join(', '),
                        ].filter(Boolean).join('  \u2022  ')}
                    </div>

                    {/* Links row */}
                    {(data.linkedIn || data.github || data.website) && (
                        <div style={{ fontSize: '9pt', lineHeight: '1.6' }}>
                            {[
                                data.linkedIn && data.linkedIn.replace(/^https?:\/\/(www\.)?/, ''),
                                data.github && data.github.replace(/^https?:\/\/(www\.)?/, ''),
                                data.website && data.website.replace(/^https?:\/\/(www\.)?/, ''),
                            ].filter(Boolean).join('  |  ')}
                        </div>
                    )}
                </div>

                {/* ── Professional Profile ────────────────────────────── */}
                {data.summary && (
                    <div style={{ marginBottom: '15px' }}>
                        <h2 style={sectionHeading}>{lang.professionalProfile}</h2>
                        <p style={{ textAlign: 'justify', margin: '0', fontSize: '10pt' }}>
                            {parseMarkdownBold(data.summary)}
                        </p>
                    </div>
                )}

                {/* ── Experience ──────────────────────────────────────── */}
                {data.experiences && data.experiences.length > 0 && data.experiences.some(e => e.company || e.title) && (
                    <div style={{ marginBottom: '15px' }}>
                        <h2 style={sectionHeading}>{lang.relevantExperience}</h2>

                        {data.experiences.map((exp) => (
                            <div key={exp.id} style={{ marginBottom: '12px' }}>
                                {/* Title + dates */}
                                <div style={entryRow}>
                                    <strong style={{ fontSize: '10.5pt' }}>{exp.title}</strong>
                                    <span style={{ fontSize: '9.5pt', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                                        {exp.startDate} – {exp.current ? (language === 'de' ? 'heute' : 'Present') : exp.endDate}
                                    </span>
                                </div>

                                {/* Company + location */}
                                {(exp.company || exp.location) && (
                                    <div style={{ fontSize: '9.5pt', marginBottom: '3px' }}>
                                        {[exp.company, exp.location].filter(Boolean).join(' \u00b7 ')}
                                    </div>
                                )}

                                {/* Bullet points */}
                                {exp.description && (
                                    <ul style={{ margin: '3px 0 0 0', paddingLeft: '18px', fontSize: '10pt' }}>
                                        {exp.description
                                            .split('\n')
                                            .filter(line => line.trim())
                                            .map((line, idx) => (
                                                <li key={idx} style={{ marginBottom: '2px' }}>
                                                    {parseMarkdownBold(line.replace(/^[•\-–]\s*/, ''))}
                                                </li>
                                            ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Education ───────────────────────────────────────── */}
                {data.education && data.education.length > 0 && data.education.some(e => e.school || e.degree) && (
                    <div style={{ marginBottom: '15px' }}>
                        <h2 style={sectionHeading}>{lang.education}</h2>

                        {data.education.map((edu) => (
                            <div key={edu.id} style={{ marginBottom: '10px' }}>
                                <div style={entryRow}>
                                    <strong style={{ fontSize: '10.5pt' }}>{edu.degree}{edu.field ? ` – ${edu.field}` : ''}</strong>
                                    <span style={{ fontSize: '9.5pt', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                                        {[edu.startDate, edu.endDate].filter(Boolean).join(' – ')}
                                    </span>
                                </div>
                                {edu.school && (
                                    <div style={{ fontSize: '9.5pt' }}>
                                        {edu.school}
                                        {edu.gpa ? ` (Note ${edu.gpa})` : ''}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Projects ────────────────────────────────────────── */}
                {data.projects && data.projects.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                        <h2 style={sectionHeading}>{lang.projects}</h2>

                        {data.projects.map((project) => (
                            <div key={project.id} style={{ marginBottom: '10px' }}>
                                <div style={entryRow}>
                                    <strong style={{ fontSize: '10.5pt' }}>{project.name}</strong>
                                    {(project.startDate || project.endDate) && (
                                        <span style={{ fontSize: '9.5pt', whiteSpace: 'nowrap', marginLeft: '12px' }}>
                                            {[project.startDate, project.endDate].filter(Boolean).join(' – ')}
                                        </span>
                                    )}
                                </div>

                                {project.url && (
                                    <div style={{ fontSize: '9pt' }}>
                                        {project.url.replace(/^https?:\/\/(www\.)?/, '')}
                                    </div>
                                )}

                                {project.description && (
                                    <div style={{ fontSize: '10pt', marginTop: '2px' }}>
                                        {parseMarkdownBold(project.description)}
                                    </div>
                                )}

                                {project.highlights && project.highlights.length > 0 && (
                                    <ul style={{ margin: '3px 0 0 0', paddingLeft: '18px', fontSize: '10pt' }}>
                                        {project.highlights.map((h, idx) => (
                                            <li key={idx} style={{ marginBottom: '2px' }}>
                                                {parseMarkdownBold(h)}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Custom Sections ─────────────────────────────────── */}
                {data.customSections && data.customSections.length > 0 && (
                    <>
                        {data.customSections
                            .filter(s => {
                                const h = s.heading?.toLowerCase() ?? '';
                                return h !== 'projects' && h !== 'projekte';
                            })
                            .map((section) => (
                                <div key={section.id} style={{ marginBottom: '15px' }}>
                                    <h2 style={sectionHeading}>{section.heading}</h2>
                                    <div style={{ fontSize: '10pt' }}>
                                        {(() => {
                                            const content = section.content;
                                            if (typeof content === 'object') {
                                                return safeRenderValue(content);
                                            }
                                            return content.split('\n').filter(line => line.trim()).map((line, i) => (
                                                <div key={i} style={{ marginBottom: '2px' }}>
                                                    {parseMarkdownBold(line.replace(/^[•\-–]\s*/, ''))}
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            ))}
                    </>
                )}

                {/* ── Technical Skills ────────────────────────────────── */}
                {data.skills && data.skills.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                        <h2 style={sectionHeading}>{lang.technicalSkills}</h2>
                        {/* Comma-separated — ATS reads this reliably */}
                        <p style={{ margin: '0', fontSize: '10pt', lineHeight: '1.6' }}>
                            {data.skills.join(', ')}
                        </p>
                    </div>
                )}

                {/* ── Languages ───────────────────────────────────────── */}
                {data.languages && data.languages.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                        <h2 style={sectionHeading}>{lang.languages}</h2>
                        <p style={{ margin: '0', fontSize: '10pt', lineHeight: '1.6' }}>
                            {data.languages.map(l => `${l.name}${l.proficiency ? ` (${l.proficiency})` : ''}`).join(', ')}
                        </p>
                    </div>
                )}
            </div>
        );
    }
);

GermanLatexResume.displayName = "GermanLatexResume";

export default GermanLatexResume;
