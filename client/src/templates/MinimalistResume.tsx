import { forwardRef } from "react";
import { Mail, Phone, MapPin, Globe, Star, Github } from "lucide-react";
import { ResumeData } from "../utils/cvDataTransform";

const MinimalistResume = forwardRef<HTMLDivElement, { data: ResumeData }>((props, ref) => {
  const { data } = props;

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString + '-01');
    return date.getFullYear().toString();
  };

  const formatDateRange = (startDate: string, endDate: string, current: boolean) => {
    const start = formatDate(startDate);
    const end = current ? formatDate(new Date().getFullYear().toString() + '-01') : formatDate(endDate);
    return `${start} - ${end}`;
  };

  const renderLanguageRating = (proficiency: string) => {
    let rating: number;
    switch (proficiency) {
      case 'Native': rating = 5; break;
      case 'Fluent': rating = 4; break;
      case 'Conversational': rating = 3; break;
      case 'Basic': rating = 2; break;
      default: rating = 1; break;
    }

    return Array.from({ length: 5 }, (_, i) => {
      const isFilled = i < rating;
      return (
        <div
          key={i}
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: isFilled ? '#000000' : '#e5e7eb',
            display: 'inline-block',
            marginRight: '4px'
          }}
          data-preserve="true"
        ></div>
      );
    });
  };

  return (
    <div
      ref={ref}
      className="p-4"
      style={{
        backgroundColor: '#ffffff',
        fontFamily: "'Arial', sans-serif",
        fontSize: '11px',
        lineHeight: '1.5',
        minHeight: '11in',
        width: '100%'
      }}
    >
      <header className="mb-4">
        <h1 className="font-bold text-black mb-1" style={{ fontSize: '24px', letterSpacing: '2px' }}>
          {data.firstName?.toUpperCase()} {data.lastName?.toUpperCase()}
        </h1>
        {data.experiences && data.experiences.length > 0 && data.experiences.some(exp => exp.company || exp.title || exp.description || exp.startDate || exp.endDate) && (
          <p className="text-gray-600 mb-3" style={{ fontSize: '12px', fontWeight: '500' }}>
            {data.experiences[0].title}
          </p>
        )}

        <div className="flex flex-wrap gap-4 text-gray-700" style={{ fontSize: '11px' }}>
          {data.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3 w-3" />
              <span>{data.phone}</span>
            </div>
          )}
          {data.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3 w-3" />
              <span>{data.email}</span>
            </div>
          )}
          {data.website && (
            <div className="flex items-center gap-2">
              <Globe className="h-3 w-3" />
              <span>{data.website}</span>
            </div>
          )}
          {data.github && (
            <div className="flex items-center gap-2">
              <Github className="h-3 w-3" />
              <span>{data.github}</span>
            </div>
          )}
          {(data.city || data.state) && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3" />
              <span>{[data.city, data.state].filter(Boolean).join(', ')}</span>
            </div>
          )}
        </div>
      </header>

      {data.summary && (
        <section className="mb-6">
          <h2 className="font-bold text-black mb-3" style={{ fontSize: '14px', letterSpacing: '1px' }}>
            SUMMARY
          </h2>
          <p className="text-gray-800 leading-relaxed" style={{ fontSize: '11px', textAlign: 'justify' }}>
            {data.summary}
          </p>
        </section>
      )}



      {data.experiences.length > 0 && data.experiences.some(exp => exp.company || exp.title || exp.description || exp.startDate || exp.endDate) && (
        <section className="mb-8">
          <h2 className="font-bold text-black mb-4" style={{ fontSize: '16px', letterSpacing: '1px' }}>
            EXPERIENCE
          </h2>

          <div className="space-y-6">
            {data.experiences.map((experience, index) => (
              <div key={experience.id} className="flex gap-4">
                <div className="flex flex-col items-center" style={{ minWidth: '120px' }}>
                  <div className="text-gray-700 font-medium mb-2" style={{ fontSize: '12px' }}>
                    {formatDateRange(experience.startDate, experience.endDate, experience.current)}
                  </div>
                  <div className="flex flex-col items-center">
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: '#000000',
                      }}
                      data-preserve="true"
                    ></div>
                    {index < data.experiences.length - 1 && (
                      <div
                        style={{
                          width: '2px',
                          height: '80px',
                          backgroundColor: '#e5e7eb',
                          marginTop: '8px'
                        }}
                        data-preserve="true"
                      ></div>
                    )}
                  </div>
                  <div className="text-center text-gray-600 mt-2" style={{ fontSize: '10px' }}>
                    {experience.location}
                  </div>
                </div>

                <div className="flex-1">
                  <h3 className="font-bold text-black mb-1" style={{ fontSize: '14px' }}>
                    {experience.title}
                  </h3>
                  <p className="text-gray-700 font-medium mb-2" style={{ fontSize: '12px' }}>
                    {experience.company}
                  </p>

                  {experience.description && (
                    <div>
                      <ul className="list-disc ml-4 space-y-1">
                        {experience.description.split('\n').filter(line => line.trim()).map((line, idx) => (
                          <li key={idx} className="text-gray-700" style={{ fontSize: '11px' }}>
                            {line.trim()}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.education.length > 0 && data.education.some(edu => edu.school || edu.degree || edu.field || edu.startDate || edu.endDate) && (
        <section className="mb-8">
          <h2 className="font-bold text-black mb-4" style={{ fontSize: '16px', letterSpacing: '1px' }}>
            EDUCATION
          </h2>

          <div className="space-y-4">
            {data.education.map((education) => (
              <div key={education.id} className="flex gap-4">
                <div className="flex flex-col items-center" style={{ minWidth: '120px' }}>
                  <div className="text-gray-700 font-medium mb-2" style={{ fontSize: '12px' }}>
                    {formatDateRange(education.startDate, education.endDate, education.current)}
                  </div>
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: '#000000',
                    }}
                    data-preserve="true"
                  ></div>
                  <div className="text-center text-gray-600 mt-2" style={{ fontSize: '10px' }}>
                    {education.location}
                  </div>
                </div>

                <div className="flex-1">
                  <h3 className="font-bold text-black mb-1" style={{ fontSize: '14px' }}>
                    {education.degree}
                  </h3>
                  <p className="text-gray-700 font-medium" style={{ fontSize: '12px' }}>
                    {education.school}
                  </p>
                  {education.gpa && (
                    <p className="text-gray-600 mt-1" style={{ fontSize: '10px' }}>
                      GPA: {education.gpa}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.languages.length > 0 && (
        <section className="mb-8">
          <h2 className="font-bold text-black mb-4" style={{ fontSize: '16px', letterSpacing: '1px' }}>
            LANGUAGES
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print-languages-grid">
            {data.languages.map((language) => (
              <div key={language.id} className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-black" style={{ fontSize: '12px' }}>
                    {language.name}
                  </h3>
                  <p className="text-gray-600" style={{ fontSize: '10px' }}>
                    {language.proficiency}
                  </p>
                </div>
                <div className="flex gap-1">
                  {renderLanguageRating(language.proficiency)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.skills.length > 0 && (
        <section className="mb-8">
          <h2 className="font-bold text-black mb-4" style={{ fontSize: '16px', letterSpacing: '1px' }}>
            SKILLS
          </h2>

          <div className="flex flex-wrap gap-3">
            {data.skills.map((skill, index) => (
              <span
                key={index}
                className="px-4 py-2 bg-white text-black font-medium rounded-sm"
                style={{
                  fontSize: '11px',
                  border: '1px solid #000000'
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}

      {data.certifications.length > 0 && (
        <section className="mb-8">
          <h2 className="font-bold text-black mb-4" style={{ fontSize: '16px', letterSpacing: '1px' }}>
            CERTIFICATIONS
          </h2>

          <div className="space-y-3">
            {data.certifications.map((certification) => (
              <div key={certification.id}>
                <h3 className="font-bold text-black" style={{ fontSize: '12px' }}>
                  {certification.name}
                </h3>
                <p className="text-gray-700" style={{ fontSize: '11px' }}>
                  {certification.issuer}
                </p>
                {certification.credentialId && (
                  <p className="text-gray-600" style={{ fontSize: '10px' }}>
                    Credential ID: {certification.credentialId}
                  </p>
                )}
                <p className="text-gray-600" style={{ fontSize: '10px' }}>
                  {formatDate(certification.date)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}


      {data.projects && data.projects.length > 0 && (
        <section className="mb-8">
          <h2 className="font-bold text-black mb-4" style={{ fontSize: '16px', letterSpacing: '1px' }}>
            PROJECTS
          </h2>

          <div className="space-y-6">
            {data.projects.map((project) => (
              <div key={project.id} className="flex gap-4">
                <div className="flex flex-col items-center" style={{ minWidth: '120px' }}>
                  <div className="text-gray-700 font-medium mb-2" style={{ fontSize: '12px' }}>
                    {formatDateRange(project.startDate || '', project.endDate || '', false)}
                  </div>
                  <div className="flex flex-col items-center">
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: '#000000',
                      }}
                      data-preserve="true"
                    ></div>
                    <div
                      style={{
                        width: '2px',
                        height: '100%',
                        backgroundColor: '#e5e7eb',
                        marginTop: '8px',
                        minHeight: '40px'
                      }}
                      data-preserve="true"
                    ></div>
                  </div>
                </div>

                <div className="flex-1">
                  <h3 className="font-bold text-black mb-1" style={{ fontSize: '14px' }}>
                    {project.name}
                  </h3>
                  {project.url && (
                    <a href={project.url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:underline mb-1 block" style={{ fontSize: '11px' }}>
                      {project.url}
                    </a>
                  )}
                  {project.description && (
                    <p className="text-gray-700 font-medium mb-2" style={{ fontSize: '12px' }}>
                      {project.description}
                    </p>
                  )}

                  {project.highlights && project.highlights.length > 0 && (
                    <div>
                      <ul className="list-disc ml-4 space-y-1">
                        {project.highlights.map((highlight, idx) => (
                          <li key={idx} className="text-gray-700" style={{ fontSize: '11px' }}>
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.customSections && data.customSections.length > 0 && (
        <div className="space-y-8">
          {data.customSections
            .filter(section => section.heading?.toLowerCase() !== 'projects')
            .map((section) => (
              <section key={section.id}>
                <h2 className="font-bold text-black mb-4" style={{ fontSize: '16px', letterSpacing: '1px' }}>
                  {section.heading.toUpperCase()}
                </h2>
                <div className="text-gray-800 leading-relaxed whitespace-pre-line" style={{ fontSize: '12px' }}>
                  {section.content.split('\n').map((line, i) => {
                    const parts = line.split(/(\*\*.*?\*\*)/g);
                    return (
                      <div key={i} style={{ minHeight: '1.2em' }}>
                        {parts.map((part, j) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={j}>{part.slice(2, -2)}</strong>;
                          }
                          return <span key={j}>{part}</span>;
                        })}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
});

MinimalistResume.displayName = "MinimalistResume";

export default MinimalistResume;

