import { forwardRef, ReactNode } from "react";
import { ResumeData } from "../utils/cvDataTransform";

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
        // Add text before the match
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
        }
        // Add the bold text
        parts.push(<strong key={key++}>{match[1]}</strong>);
        lastIndex = match.index + match[0].length;
    }

    // Add remaining text after the last match
    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    // If no matches found, return the original text
    if (parts.length === 0) {
        return [text];
    }

    return parts;
};

const GermanLatexResume = forwardRef<HTMLDivElement, GermanLatexResumeProps>(
    ({ data, language = 'de' }, ref) => {
        // Debugging logs
        console.log('--- TEMPLATE RENDER DEBUG ---');
        console.log('Template Data Props:', {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            linkedIn: data.linkedIn,
            github: data.github,
            website: data.website
        });
        console.log('-----------------------------');

        const t = {
            en: {
                professionalProfile: 'Professional Profile',
                relevantExperience: 'Relevant IT Experience',
                education: 'Education',
                technicalSkills: 'Technical Skills',
                languages: 'Languages',
            },
            de: {
                professionalProfile: 'Berufliches Profil',
                relevantExperience: 'Relevante IT-Erfahrung',
                education: 'Ausbildung',
                technicalSkills: 'Technische Fähigkeiten',
                languages: 'Sprachen',
            },
        };

        const lang = t[language];

        return (
            <div
                ref={ref}
                style={{
                    fontFamily: '"Times New Roman", Times, serif',
                    fontSize: '11pt',
                    lineHeight: '1.4',
                    color: '#000',
                    margin: '0',
                    padding: '40px',
                    background: 'white',
                    maxWidth: '210mm',
                    width: '100%',
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    position: 'relative',
                }}
                data-preserve="true"
            >
                {/* Temporary Debug Overlay - will be removed after fixing */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    fontSize: '8px',
                    color: 'red',
                    background: 'rgba(255,255,255,0.8)',
                    padding: '2px',
                    border: '1px solid red',
                    zIndex: 100,
                    display: 'none', // Toggle to 'block' to see on screen
                }}>
                    L: {data.linkedIn ? 'Y' : 'N'} | 
                    G: {data.github ? 'Y' : 'N'} | 
                    W: {data.website ? 'Y' : 'N'} |
                    T: {data.jobTitle ? 'Y' : 'N'}
                </div>

                {/* Header */}
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                            <h1 style={{
                                fontSize: '18pt',
                                fontWeight: 'bold',
                                margin: '0 0 2px 0',
                            }}>
                                {data.firstName} {data.lastName}
                            </h1>
                            {data.jobTitle && (
                                <div style={{ fontSize: '11pt', fontWeight: 'bold', fontStyle: 'italic', marginBottom: '2px' }}>
                                    {data.jobTitle}
                                </div>
                            )}
                            <div style={{ fontSize: '10pt', marginBottom: '2px' }}>
                                {[data.city, data.state].filter(Boolean).join(', ')}
                            </div>
                            {data.education && data.education[0] && (
                                <div style={{ fontSize: '10pt', lineHeight: '1.3' }}>
                                    {data.education[0].degree} {data.education[0].field && `in ${data.education[0].field}`}
                                    {data.education[1] && ` und ${data.education[1].degree} ${data.education[1].field && `in ${data.education[1].field}`}`}
                                </div>
                            )}
                        </div>
                        <div style={{ textAlign: 'right', fontSize: '9pt', lineHeight: '1.4', color: '#000' }}>
                            {data.phone && <div>☎ {data.phone}</div>}
                            {data.email && <div>✉ {data.email}</div>}
                            {data.website && (
                                <div>
                                    <a href={data.website.startsWith('http') ? data.website : `https://${data.website}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                                        {data.website.replace(/^https?:\/\//, '').replace(/^www\./, '')}
                                    </a>
                                </div>
                            )}
                            {data.linkedIn && (
                                <div>
                                    <a href={data.linkedIn.startsWith('http') ? data.linkedIn : `https://${data.linkedIn}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                                        {data.linkedIn.replace(/^https?:\/\//, '').replace(/^www\./, '')}
                                    </a>
                                </div>
                            )}
                            {data.github && (
                                <div>
                                    <a href={data.github.startsWith('http') ? data.github : `https://${data.github}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                                        {data.github.replace(/^https?:\/\//, '').replace(/^www\./, '')}
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Professional Profile */}
                {data.summary && (
                    <div style={{ marginBottom: '15px' }}>
                        <h2 style={{
                            fontSize: '11pt',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: '1px solid #000',
                            marginBottom: '8px',
                            paddingBottom: '2px',
                        }}>
                            {lang.professionalProfile}
                        </h2>
                        <p style={{ textAlign: 'justify', margin: '0', fontSize: '10pt' }}>
                            {parseMarkdownBold(data.summary || '')}
                        </p>
                    </div>
                )}

                {/* Experience */}
                {data.experiences && data.experiences.length > 0 && data.experiences.some(exp => exp.company || exp.title) && (
                    <div style={{ marginBottom: '15px' }}>
                        <h2 style={{
                            fontSize: '11pt',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: '1px solid #000',
                            marginBottom: '8px',
                            paddingBottom: '2px',
                        }}>
                            {lang.relevantExperience}
                        </h2>
                        <ul style={{ margin: '0', paddingLeft: '20px', listStyleType: 'disc' }}>
                            {data.experiences.map((experience) => (
                                <li key={experience.id} style={{ marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                        <div>
                                            <strong>{experience.title}</strong>
                                            <div style={{ fontStyle: 'italic', fontSize: '9pt' }}>
                                                {experience.company}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', fontStyle: 'italic', fontSize: '9pt' }}>
                                            <div>{experience.startDate} - {experience.current ? (language === 'de' ? 'heute' : 'present') : experience.endDate}</div>
                                            {experience.location && <div>{experience.location}</div>}
                                        </div>
                                    </div>
                                    {experience.description && (
                                        <div style={{ fontSize: '10pt', marginTop: '4px' }}>
                                            {experience.description.split('\n').filter(line => line.trim()).map((line, idx) => (
                                                <div key={idx} style={{ marginBottom: '2px' }}>
                                                    – {parseMarkdownBold(line.replace(/^[•-]\s*/, ''))}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Education */}
                {data.education && data.education.length > 0 && data.education.some(edu => edu.school || edu.degree) && (
                    <div style={{ marginBottom: '15px' }}>
                        <h2 style={{
                            fontSize: '11pt',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: '1px solid #000',
                            marginBottom: '8px',
                            paddingBottom: '2px',
                        }}>
                            {lang.education}
                        </h2>
                        <ul style={{ margin: '0', paddingLeft: '20px', listStyleType: 'disc' }}>
                            {data.education.map((education) => (
                                <li key={education.id} style={{ marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <div>
                                            <strong>{education.school}</strong>
                                            <div style={{ fontStyle: 'italic', fontSize: '9pt' }}>
                                                {education.degree} {education.field && `in ${education.field}`}
                                                {education.gpa && ` (Note ${education.gpa})`}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', fontStyle: 'italic', fontSize: '9pt' }}>
                                            {education.startDate} - {education.endDate}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Projects - Structured */}
                {data.projects && data.projects.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                        <h2 style={{
                            fontSize: '11pt',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: '1px solid #000',
                            marginBottom: '8px',
                            paddingBottom: '2px',
                        }}>
                            {language === 'de' ? 'Projekte' : 'Projects'}
                        </h2>
                        <ul style={{ margin: '0', paddingLeft: '20px', listStyleType: 'disc' }}>
                            {data.projects.map((project) => (
                                <li key={project.id} style={{ marginBottom: '10px' }}>
                                    <div style={{ marginBottom: '2px' }}>
                                        <strong>{project.name}</strong>
                                        {project.url && <span style={{ fontSize: '9pt', marginLeft: '6px' }}><a href={project.url} style={{ color: 'inherit', textDecoration: 'none' }}>🔗</a></span>}
                                        {((project.startDate && project.endDate) || project.description) && (
                                            <div style={{ display: 'inline', marginLeft: '10px', fontSize: '9pt', fontStyle: 'italic' }}>
                                                {project.startDate && project.endDate && `${project.startDate} - ${project.endDate}`}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '10pt' }}>
                                        {parseMarkdownBold(project.description || '')}
                                    </div>
                                    {project.highlights && project.highlights.length > 0 && (
                                        <ul style={{ marginTop: '2px', marginBottom: '0', paddingLeft: '15px' }}>
                                            {project.highlights.map((highlight, idx) => (
                                                <li key={idx} style={{ fontSize: '10pt' }}>{parseMarkdownBold(highlight)}</li>
                                            ))}
                                        </ul>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Custom Sections - Filter out 'Projects' to avoid duplication */}
                {data.customSections && data.customSections.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                        {data.customSections
                            .filter(section => section.heading?.toLowerCase() !== 'projects' && section.heading?.toLowerCase() !== 'projekte')
                            .map((section) => (
                                <div key={section.id} style={{ marginBottom: '10px' }}>
                                    <h2 style={{
                                        fontSize: '11pt',
                                        fontWeight: 'bold',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        borderBottom: '1px solid #000',
                                        marginBottom: '8px',
                                        paddingBottom: '2px',
                                    }}>
                                        {section.heading}
                                    </h2>
                                    <div style={{ fontSize: '10pt' }}>
                                        {section.content.split('\n').filter(line => line.trim()).map((line, lineIdx) => (
                                            <div key={lineIdx} style={{ marginBottom: '2px' }}>
                                                {parseMarkdownBold(line.replace(/^[•-]\s*/, ''))}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                    </div>
                )}

                {/* Technical Skills - Multi-column layout to reduce height */}
                {data.skills && data.skills.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                        <h2 style={{
                            fontSize: '11pt',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: '1px solid #000',
                            marginBottom: '8px',
                            paddingBottom: '2px',
                        }}>
                            {lang.technicalSkills}
                        </h2>
                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '4px 12px',
                            fontSize: '10pt',
                        }}>
                            {data.skills.map((skill, index) => (
                                <span key={index} style={{
                                    whiteSpace: 'nowrap',
                                }}>
                                    • {skill}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Languages */}
                {data.languages && data.languages.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                        <h2 style={{
                            fontSize: '11pt',
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            borderBottom: '1px solid #000',
                            marginBottom: '8px',
                            paddingBottom: '2px',
                        }}>
                            {lang.languages}
                        </h2>
                        <ul style={{ margin: '0', paddingLeft: '20px', listStyleType: 'disc' }}>
                            {data.languages.map((language) => (
                                <li key={language.id} style={{ marginBottom: '3px', fontSize: '10pt' }}>
                                    <strong>{language.name}:</strong> {language.proficiency}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        );
    }
);

GermanLatexResume.displayName = "GermanLatexResume";

export default GermanLatexResume;
