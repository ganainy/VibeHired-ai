import { forwardRef } from "react";
import { Mail, Phone, MapPin, Globe, Linkedin } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { ResumeData } from "../utils/cvDataTransform";
import { formatDate, formatDateRange } from "../utils/dateUtils";

const ModernCleanResume = forwardRef<HTMLDivElement, { data: ResumeData }>((props, ref) => {
  const { data } = props;

  return (
    <div ref={ref} className="bg-white text-black p-4 w-full max-w-[210mm] mx-auto" style={{ minHeight: '11in' }}>
      <header className="mb-3 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-1">
          {data.firstName} {data.lastName}
        </h1>
        {data.jobTitle && (
          <div className="text-sm font-semibold text-blue-600 mb-2 uppercase tracking-wide">
            {data.jobTitle}
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-2 text-xs text-gray-600 mb-3">
          {data.email && (
            <div className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              <span>{data.email}</span>
            </div>
          )}
          {data.phone && (
            <div className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              <span>{data.phone}</span>
            </div>
          )}
          {(data.city || data.state) && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span>{[data.city, data.state].filter(Boolean).join(', ')}</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-3 text-xs text-gray-600">
          {data.linkedIn && (
            <div className="flex items-center gap-1">
              <Linkedin className="h-3 w-3" />
              <a href={data.linkedIn.startsWith('http') ? data.linkedIn : `https://${data.linkedIn}`} className="hover:underline">
                {data.linkedIn.replace(/^https?:\/\//, '').replace(/^www\./, '')}
              </a>
            </div>
          )}
          {data.github && (
            <div className="flex items-center gap-1">
              <img src="https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/github.svg" alt="GitHub" className="h-3 w-3" />
              <a href={data.github.startsWith('http') ? data.github : `https://${data.github}`} className="hover:underline">
                {data.github.replace(/^https?:\/\//, '').replace(/^www\./, '')}
              </a>
            </div>
          )}
          {data.website && (
            <div className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              <a href={data.website.startsWith('http') ? data.website : `https://${data.website}`} className="hover:underline">
                {data.website.replace(/^https?:\/\//, '').replace(/^www\./, '')}
              </a>
            </div>
          )}
        </div>
      </header >

      {
        data.summary && (
          <section className="mb-4">
            <h2 className="text-base font-bold text-gray-900 mb-2 pb-1 border-b-2 border-blue-600">
              {data.sectionLabels?.summary || 'Professional Summary'}
            </h2>
            <p className="text-gray-700 leading-relaxed text-xs">{data.summary}</p>
          </section>
        )
      }

      {
        data.experiences.length > 0 && data.experiences.some(exp => exp.company || exp.title || exp.description || exp.startDate || exp.endDate) && (
          <section className="mb-4">
            <h2 className="text-base font-bold text-gray-900 mb-3 pb-1 border-b-2 border-blue-600">
              {data.sectionLabels?.work || 'Professional Experience'}
            </h2>
            <div className="space-y-3">
              {data.experiences.map((experience) => (
                <div key={experience.id}>
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {experience.title}
                      </h3>
                      <p className="text-blue-600 font-medium text-xs">
                        {experience.company}
                        {experience.location && ` \u2022 ${experience.location}`}
                      </p>
                    </div>
                    <div className="text-xs text-gray-600 text-right flex-shrink-0">
                      {formatDateRange(experience.startDate, experience.endDate, experience.current)}
                    </div>
                  </div>
                  {experience.description && (
                    <div className="text-gray-700 text-xs leading-relaxed whitespace-pre-line ml-0 md:ml-4">
                      {experience.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )
      }

      {
        data.education.length > 0 && data.education.some(edu => edu.school || edu.degree || edu.field || edu.startDate || edu.endDate) && (
          <section className="mb-4">
            <h2 className="text-base font-bold text-gray-900 mb-3 pb-1 border-b-2 border-blue-600">
              {data.sectionLabels?.education || 'Education'}
            </h2>
            <div className="space-y-3">
              {data.education.map((education) => (
                <div key={education.id}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {education.degree}
                      </h3>
                      <p className="text-blue-600 font-medium text-xs">
                        {education.school}
                        {education.location && ` \u2022 ${education.location}`}
                      </p>
                      {education.gpa && (
                        <p className="text-xs text-gray-600">GPA: {education.gpa}</p>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 text-right flex-shrink-0">
                      {formatDateRange(education.startDate, education.endDate, education.current)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      }

      {
        data.skills.length > 0 && (
          <section className="mb-4">
            <h2 className="text-base font-bold text-gray-900 mb-3 pb-1 border-b-2 border-blue-600">
              {data.sectionLabels?.skills || 'Skills & Technologies'}
            </h2>
            <div className="text-gray-700 text-xs leading-relaxed">
              {data.skills.join(" • ")}
            </div>
          </section>
        )
      }

      {
        data.certifications.length > 0 && (
          <section className="mb-4">
            <h2 className="text-base font-bold text-gray-900 mb-3 pb-1 border-b-2 border-blue-600">
              {data.sectionLabels?.certificates || 'Certifications'}
            </h2>
            <div className="space-y-2">
              {data.certifications.map((certification) => (
                <div key={certification.id} className="flex justify-between items-start">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {certification.name}
                    </h3>
                    <p className="text-blue-600 font-medium text-xs">{certification.issuer}</p>
                    {certification.credentialId && (
                      <p className="text-xs text-gray-600">
                        Credential ID: {certification.credentialId}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 text-right flex-shrink-0">
                    {certification.date && formatDate(certification.date)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      }

      {
        data.languages.length > 0 && (
          <section className="mb-4">
            <h2 className="text-base font-bold text-gray-900 mb-3 pb-1 border-b-2 border-blue-600">
              {data.sectionLabels?.languages || 'Languages'}
            </h2>
            <div className="space-y-2">
              {data.languages.map((language) => (
                <div key={language.id} className="flex justify-between items-center">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">
                      {language.name}
                    </span>
                    <span className="text-xs text-gray-600 ml-2">
                      {language.proficiency}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      }

      {
        data.customSections.map((section) => (
          <section key={section.id} className="mb-4">
            <h2 className="text-base font-bold text-gray-900 mb-3 pb-1 border-b-2 border-blue-600">
              {section.heading}
            </h2>
            <div className="text-gray-700 text-xs leading-relaxed whitespace-pre-line">
              {section.content.split('\n').map((line, i) => {
                // Simple bold parsing for **text**
                const parts = line.split(/(\*\*.*?\*\*)/g);
                return (
                  <div key={i} className="min-h-[1.2em]">
                    {parts.map((part, j) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={j} className="text-gray-900 font-semibold">{part.slice(2, -2)}</strong>;
                      }
                      return <span key={j}>{part}</span>;
                    })}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      }
    </div >
  );
});

ModernCleanResume.displayName = "ModernCleanResume";

export default ModernCleanResume;

