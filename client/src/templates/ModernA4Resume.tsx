import { forwardRef } from "react";
import { Mail, Phone, MapPin, Globe, Linkedin, Star } from "lucide-react";
import { ResumeData } from "../utils/cvDataTransform";

const ModernA4Resume = forwardRef<HTMLDivElement, { data: ResumeData }>(({ data }, ref) => {
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

  const renderStars = (proficiency: string) => {
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
        <Star
          key={i}
          className="h-3 w-3"
          style={{
            fill: isFilled ? '#1f2937' : 'none',
            stroke: isFilled ? '#1f2937' : '#d1d5db',
          }}
        />
      );
    });
  };

  return (
    <div ref={ref} className="bg-white text-gray-900 p-4 w-full text-sm leading-tight" style={{ minHeight: '11in' }}>
      <header className="mb-4 relative">
        <div
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '8px',
            padding: '16px',
            color: 'white',
            position: 'relative',
            overflow: 'hidden'
          }}
          data-preserve="true"
        >
          <div
            style={{
              position: 'absolute',
              top: '-15px',
              right: '-15px',
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '2px solid rgba(255, 255, 255, 0.2)'
            }}
            data-preserve="true"
          ></div>

          <h1 className="text-xl font-bold mb-1 relative z-10">
            {data.firstName} {data.lastName}
          </h1>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm relative z-10 print-contact-grid">
            {data.email && (
              <div className="flex items-center gap-2">
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  data-preserve="true"
                >
                  <Mail className="h-3 w-3" />
                </div>
                <span>{data.email}</span>
              </div>
            )}
            {data.phone && (
              <div className="flex items-center gap-2">
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  data-preserve="true"
                >
                  <Phone className="h-3 w-3" />
                </div>
                <span>{data.phone}</span>
              </div>
            )}
            {(data.city || data.state) && (
              <div className="flex items-center gap-2">
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  data-preserve="true"
                >
                  <MapPin className="h-3 w-3" />
                </div>
                <span>{[data.city, data.state].filter(Boolean).join(', ')}</span>
              </div>
            )}
            {data.linkedIn && (
              <div className="flex items-center gap-2">
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  data-preserve="true"
                >
                  <Linkedin className="h-3 w-3" />
                </div>
                <span>{data.linkedIn}</span>
              </div>
            )}
            {data.github && (
              <div className="flex items-center gap-2">
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  data-preserve="true"
                >
                  <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/github.svg" alt="GitHub" className="h-3 w-3 invert" />
                </div>
                <span>{data.github}</span>
              </div>
            )}
            {data.website && (
              <div className="flex items-center gap-2">
                <div
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  data-preserve="true"
                >
                  <Globe className="h-3 w-3" />
                </div>
                <span>{data.website}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {data.summary && (
        <section className="mb-5">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-lg font-bold text-gray-900">PROFESSIONAL SUMMARY</h2>
            <div
              style={{
                flex: '1',
                height: '3px',
                background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                borderRadius: '2px'
              }}
              data-preserve="true"
            ></div>
          </div>
          <div
            style={{
              backgroundColor: '#f8fafc',
              borderLeft: '4px solid #3b82f6',
              borderRadius: '0 8px 8px 0',
              padding: '16px'
            }}
            data-preserve="true"
          >
            <p className="text-gray-700 leading-relaxed text-sm">{data.summary}</p>
          </div>
        </section>
      )}

      {data.experiences.length > 0 && data.experiences.some(exp => exp.company || exp.title || exp.description || exp.startDate || exp.endDate) && (
        <section className="mb-5">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-lg font-bold text-gray-900">PROFESSIONAL EXPERIENCE</h2>
            <div
              style={{
                flex: '1',
                height: '3px',
                background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                borderRadius: '2px'
              }}
              data-preserve="true"
            ></div>
          </div>
          <div className="space-y-4">
            {data.experiences.map((experience, index) => (
              <div key={experience.id} className="relative">
                <div
                  style={{
                    position: 'absolute',
                    left: '-8px',
                    top: '8px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: 'linear-gradient(45deg, #3b82f6, #8b5cf6)',
                    border: '3px solid white',
                    boxShadow: '0 0 0 2px #e5e7eb'
                  }}
                  data-preserve="true"
                ></div>

                <div
                  style={{
                    marginLeft: '16px',
                    backgroundColor: index % 2 === 0 ? '#fafbff' : '#f0fdf4',
                    borderRadius: '8px',
                    padding: '16px',
                    border: '1px solid #e5e7eb'
                  }}
                  data-preserve="true"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 text-sm">
                        {experience.title}
                      </h3>
                      <p className="text-blue-600 font-semibold text-sm">
                        {experience.company}
                        {experience.location && ` • ${experience.location}`}
                      </p>
                    </div>
                    <div
                      className="text-xs text-white px-2 py-1 rounded-full font-medium ml-4"
                      style={{
                        background: 'linear-gradient(135deg, #667eea, #764ba2)'
                      }}
                      data-preserve="true"
                    >
                      {formatDateRange(experience.startDate, experience.endDate, experience.current)}
                    </div>
                  </div>
                  {experience.description && (
                    <div className="text-gray-700 text-xs leading-relaxed whitespace-pre-line">
                      {experience.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.education.length > 0 && data.education.some(edu => edu.school || edu.degree || edu.field || edu.startDate || edu.endDate) && (
        <section className="mb-5">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-lg font-bold text-gray-900">EDUCATION</h2>
            <div
              style={{
                flex: '1',
                height: '3px',
                background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                borderRadius: '2px'
              }}
              data-preserve="true"
            ></div>
          </div>
          <div className="space-y-3">
            {data.education.map((education) => (
              <div
                key={education.id}
                style={{
                  backgroundColor: '#fefefe',
                  borderRadius: '8px',
                  padding: '14px',
                  border: '1px solid #e5e7eb',
                  borderLeft: '4px solid #10b981'
                }}
                data-preserve="true"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-sm">
                      {education.degree}
                    </h3>
                    <p className="text-emerald-600 font-semibold text-sm">
                      {education.school}
                      {education.location && ` • ${education.location}`}
                    </p>
                    {education.gpa && (
                      <p className="text-xs text-gray-600 mt-1">GPA: {education.gpa}</p>
                    )}
                  </div>
                  <div
                    className="text-xs text-white px-2 py-1 rounded-full font-medium ml-4"
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)'
                    }}
                    data-preserve="true"
                  >
                    {formatDateRange(education.startDate, education.endDate, education.current)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.skills.length > 0 && (
        <section className="mb-5">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-lg font-bold text-gray-900">CORE COMPETENCIES</h2>
            <div
              style={{
                flex: '1',
                height: '3px',
                background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                borderRadius: '2px'
              }}
              data-preserve="true"
            ></div>
          </div>
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))'
            }}
          >
            {data.skills.map((skill, index) => (
              <div
                key={index}
                className="text-xs text-center py-1 px-2 font-medium"
                style={{
                  background: index % 3 === 0
                    ? 'linear-gradient(135deg, #ddd6fe, #c4b5fd)'
                    : index % 3 === 1
                      ? 'linear-gradient(135deg, #bfdbfe, #93c5fd)'
                      : 'linear-gradient(135deg, #bbf7d0, #86efac)',
                  borderRadius: '12px',
                  color: '#374151',
                  border: '1px solid rgba(255, 255, 255, 0.5)'
                }}
                data-preserve="true"
              >
                {skill}
              </div>
            ))}
          </div>
        </section>
      )}

      {data.certifications.length > 0 && (
        <section className="mb-5">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-lg font-bold text-gray-900">CERTIFICATIONS</h2>
            <div
              style={{
                flex: '1',
                height: '3px',
                background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                borderRadius: '2px'
              }}
              data-preserve="true"
            ></div>
          </div>
          <div className="space-y-3">
            {data.certifications.map((certification) => (
              <div
                key={certification.id}
                className="flex justify-between items-start"
                style={{
                  backgroundColor: '#fffbeb',
                  borderRadius: '8px',
                  padding: '12px',
                  border: '1px solid #fed7aa',
                  borderLeft: '4px solid #f59e0b'
                }}
                data-preserve="true"
              >
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-sm">
                    {certification.name}
                  </h3>
                  <p className="text-amber-600 font-semibold text-sm">{certification.issuer}</p>
                  {certification.credentialId && (
                    <p className="text-xs text-gray-600 mt-1">
                      Credential ID: {certification.credentialId}
                    </p>
                  )}
                </div>
                <div
                  className="text-xs text-white px-2 py-1 rounded-full font-medium ml-4"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)'
                  }}
                  data-preserve="true"
                >
                  {formatDate(certification.date)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.languages.length > 0 && (
        <section className="mb-5">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-lg font-bold text-gray-900">LANGUAGES</h2>
            <div
              style={{
                flex: '1',
                height: '3px',
                background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                borderRadius: '2px'
              }}
              data-preserve="true"
            ></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {data.languages.map((language) => (
              <div
                key={language.id}
                style={{
                  backgroundColor: '#f1f5f9',
                  borderRadius: '8px',
                  padding: '12px',
                  border: '1px solid #cbd5e1'
                }}
                data-preserve="true"
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-xs">{language.name}</h3>
                    <p className="text-xs text-gray-600">{language.proficiency}</p>
                  </div>
                  <div className="flex gap-1 ml-2">
                    {renderStars(language.proficiency)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.customSections && data.customSections.length > 0 && (
        <div className="space-y-5">
          {data.customSections.map((section) => (
            <section key={section.id} className="mb-5">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-lg font-bold text-gray-900">{section.heading.toUpperCase()}</h2>
                <div
                  style={{
                    flex: '1',
                    height: '3px',
                    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                    borderRadius: '2px'
                  }}
                  data-preserve="true"
                ></div>
              </div>
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  padding: '16px',
                  border: '1px solid #e5e7eb'
                }}
                data-preserve="true"
              >
                <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                  {section.content.split('\n').map((line, i) => {
                    const parts = line.split(/(\*\*.*?\*\*)/g);
                    return (
                      <div key={i} style={{ minHeight: '1.2em' }}>
                        {parts.map((part, j) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return <strong key={j} className="text-gray-900 font-bold">{part.slice(2, -2)}</strong>;
                          }
                          return <span key={j}>{part}</span>;
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
});

ModernA4Resume.displayName = "ModernA4Resume";

export default ModernA4Resume;

