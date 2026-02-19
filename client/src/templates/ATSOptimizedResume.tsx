import { forwardRef } from "react";
import { ResumeData } from "../utils/cvDataTransform";

const ATSOptimizedResume = forwardRef<HTMLDivElement, { data: ResumeData }>(({ data }, ref) => {
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString + '-01');
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const formatDateRange = (startDate: string, endDate: string, current: boolean) => {
    const start = formatDate(startDate);
    const end = current ? 'Present' : formatDate(endDate);
    return `${start} - ${end}`;
  };

  return (
    <div
      ref={ref}
      style={{
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '11pt',
        lineHeight: '1.4',
        color: '#000000',
        margin: '0',
        padding: '0.5in',
        background: 'white',
        maxWidth: '8.5in',
        width: '100%',
        marginLeft: 'auto',
        marginRight: 'auto'
      }}
      data-preserve="true"
    >
      {/* Header - Name and Contact */}
      <div style={{ textAlign: 'center', marginBottom: '15px' }} data-preserve="true">
        <h1 style={{
          fontSize: '18pt',
          fontWeight: 'bold',
          margin: '0 0 5px 0',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }} data-preserve="true">
          {data.firstName} {data.lastName}
        </h1>

        {data.jobTitle && (
          <div style={{ fontSize: '12pt', fontWeight: 'normal', marginBottom: '8px' }} data-preserve="true">
            {data.jobTitle}
          </div>
        )}

        <div style={{ fontSize: '10pt' }} data-preserve="true">
          {[data.city, data.state].filter(Boolean).join(', ')}
          {data.zipCode && ` ${data.zipCode}`}
          {data.phone && ` | ${data.phone}`}
          {data.email && ` | ${data.email}`}
        </div>

        {(data.linkedIn || data.website || data.github) && (
          <div style={{ fontSize: '10pt', marginTop: '3px' }} data-preserve="true">
            {data.linkedIn && <span>LinkedIn: {data.linkedIn.replace(/^https?:\/\//, '').replace(/^www\./, '')}</span>}
            {data.github && <span>{data.linkedIn ? ' | ' : ''}GitHub: {data.github.replace(/^https?:\/\//, '').replace(/^www\./, '')}</span>}
            {data.website && <span>{(data.linkedIn || data.github) ? ' | ' : ''}Portfolio: {data.website.replace(/^https?:\/\//, '').replace(/^www\./, '')}</span>}
          </div>
        )}
      </div>

      {/* Horizontal Line */}
      <hr style={{ border: 'none', borderTop: '1px solid #000000', margin: '10px 0' }} data-preserve="true" />

      {/* Professional Summary */}
      {data.summary && (
        <div style={{ marginBottom: '12px' }} data-preserve="true">
          <h2 style={{
            fontSize: '12pt',
            fontWeight: 'bold',
            margin: '0 0 8px 0',
            textTransform: 'uppercase',
            borderBottom: '1px solid #000000',
            paddingBottom: '3px'
          }} data-preserve="true">
            Professional Summary
          </h2>
          <p style={{ margin: '0', textAlign: 'justify' }} data-preserve="true">
            {data.summary}
          </p>
        </div>
      )}

      {/* Work Experience */}
      {data.experiences.length > 0 && data.experiences.some(exp => exp.company || exp.title || exp.description) && (
        <div style={{ marginBottom: '12px' }} data-preserve="true">
          <h2 style={{
            fontSize: '12pt',
            fontWeight: 'bold',
            margin: '0 0 8px 0',
            textTransform: 'uppercase',
            borderBottom: '1px solid #000000',
            paddingBottom: '3px'
          }} data-preserve="true">
            Professional Experience
          </h2>

          {data.experiences.map((experience) => (
            <div key={experience.id} style={{ marginBottom: '10px' }} data-preserve="true">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }} data-preserve="true">
                <strong data-preserve="true">{experience.title}</strong>
                <span style={{ fontSize: '10pt' }} data-preserve="true">
                  {formatDateRange(experience.startDate, experience.endDate, experience.current)}
                </span>
              </div>
              <div data-preserve="true">
                {experience.company}{experience.location && `, ${experience.location}`}
              </div>
              {experience.description && (
                <ul style={{ margin: '5px 0 0 0', paddingLeft: '20px' }} data-preserve="true">
                  {experience.description.split('\n').filter(line => line.trim()).map((line, lineIndex) => (
                    <li key={lineIndex} style={{ marginBottom: '3px' }} data-preserve="true">
                      {line.replace(/^[•-]\s*/, '')}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Education */}
      {data.education.length > 0 && data.education.some(edu => edu.school || edu.degree || edu.field) && (
        <div style={{ marginBottom: '12px' }} data-preserve="true">
          <h2 style={{
            fontSize: '12pt',
            fontWeight: 'bold',
            margin: '0 0 8px 0',
            textTransform: 'uppercase',
            borderBottom: '1px solid #000000',
            paddingBottom: '3px'
          }} data-preserve="true">
            Education
          </h2>

          {data.education.map((education) => (
            <div key={education.id} style={{ marginBottom: '8px' }} data-preserve="true">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }} data-preserve="true">
                <strong data-preserve="true">
                  {education.degree}{education.field && ` in ${education.field}`}
                </strong>
                {education.endDate && (
                  <span style={{ fontSize: '10pt' }} data-preserve="true">
                    {formatDate(education.endDate)}
                  </span>
                )}
              </div>
              <div data-preserve="true">
                {education.school}{education.location && ` - ${education.location}`}
              </div>
              {education.gpa && (
                <div style={{ fontSize: '10pt' }} data-preserve="true">
                  GPA: {education.gpa}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Skills */}
      {data.skills.length > 0 && (
        <div style={{ marginBottom: '12px' }} data-preserve="true">
          <h2 style={{
            fontSize: '12pt',
            fontWeight: 'bold',
            margin: '0 0 8px 0',
            textTransform: 'uppercase',
            borderBottom: '1px solid #000000',
            paddingBottom: '3px'
          }} data-preserve="true">
            Skills
          </h2>
          <p style={{ margin: '0' }} data-preserve="true">
            {data.skills.join(' • ')}
          </p>
        </div>
      )}

      {/* Certifications */}
      {data.certifications.length > 0 && (
        <div style={{ marginBottom: '12px' }} data-preserve="true">
          <h2 style={{
            fontSize: '12pt',
            fontWeight: 'bold',
            margin: '0 0 8px 0',
            textTransform: 'uppercase',
            borderBottom: '1px solid #000000',
            paddingBottom: '3px'
          }} data-preserve="true">
            Certifications
          </h2>
          <ul style={{ margin: '0', paddingLeft: '20px' }} data-preserve="true">
            {data.certifications.map((certification) => (
              <li key={certification.id} style={{ marginBottom: '3px' }} data-preserve="true">
                <strong data-preserve="true">{certification.name}</strong>
                {certification.issuer && ` - ${certification.issuer}`}
                {certification.date && ` (${formatDate(certification.date)})`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Languages */}
      {data.languages.length > 0 && (
        <div style={{ marginBottom: '12px' }} data-preserve="true">
          <h2 style={{
            fontSize: '12pt',
            fontWeight: 'bold',
            margin: '0 0 8px 0',
            textTransform: 'uppercase',
            borderBottom: '1px solid #000000',
            paddingBottom: '3px'
          }} data-preserve="true">
            Languages
          </h2>
          <p style={{ margin: '0' }} data-preserve="true">
            {data.languages.map(lang => `${lang.name} (${lang.proficiency})`).join(' • ')}
          </p>
        </div>
      )}

      {/* Projects */}
      {data.projects && data.projects.length > 0 && data.projects.some(proj => proj.name || proj.description) && (
        <div style={{ marginBottom: '12px' }} data-preserve="true">
          <h2 style={{
            fontSize: '12pt',
            fontWeight: 'bold',
            margin: '0 0 8px 0',
            textTransform: 'uppercase',
            borderBottom: '1px solid #000000',
            paddingBottom: '3px'
          }} data-preserve="true">
            Projects
          </h2>
          {data.projects.map((project) => (
            <div key={project.id} style={{ marginBottom: '8px' }} data-preserve="true">
              <strong data-preserve="true">{project.name}</strong>
              {project.description && (
                <p style={{ margin: '3px 0 0 0' }} data-preserve="true">
                  {project.description}
                </p>
              )}
              {project.highlights && project.highlights.length > 0 && (
                <ul style={{ margin: '3px 0 0 0', paddingLeft: '20px' }} data-preserve="true">
                  {project.highlights.map((highlight, idx) => (
                    <li key={idx} style={{ marginBottom: '2px' }} data-preserve="true">
                      {highlight}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Custom Sections */}
      {data.customSections && data.customSections.length > 0 && (
        <>
          {data.customSections.map((section) => (
            <div key={section.id} style={{ marginBottom: '12px' }} data-preserve="true">
              <h2 style={{
                fontSize: '12pt',
                fontWeight: 'bold',
                margin: '0 0 8px 0',
                textTransform: 'uppercase',
                borderBottom: '1px solid #000000',
                paddingBottom: '3px'
              }} data-preserve="true">
                {section.heading}
              </h2>
              <div style={{ whiteSpace: 'pre-wrap' }} data-preserve="true">
                {section.content}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
});

ATSOptimizedResume.displayName = "ATSOptimizedResume";

export default ATSOptimizedResume;
