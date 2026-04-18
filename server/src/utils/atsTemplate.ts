import { JsonResumeSchema } from '../types/jsonresume';

export interface AtsTemplateOptions {
    lang?: string;
    pageFormat?: 'letter' | 'a4';
}

const SECTION_LABELS: Record<string, Record<string, string>> = {
    en: {
        summary: 'Professional Summary',
        competencies: 'Core Competencies',
        experience: 'Work Experience',
        projects: 'Projects',
        education: 'Education',
        certifications: 'Certifications',
        skills: 'Skills',
    },
    de: {
        summary: 'Berufliches Profil',
        competencies: 'Kernkompetenzen',
        experience: 'Berufserfahrung',
        projects: 'Projekte',
        education: 'Ausbildung',
        certifications: 'Zertifikate',
        skills: 'Kenntnisse',
    },
};

const escapeHtml = (str: string): string =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Present';
    return dateString;
};

const getSectionLabel = (key: string, lang: string): string => {
    const labels = SECTION_LABELS[lang] || SECTION_LABELS.en;
    return labels[key] || key;
};

const renderContactRow = (basics: JsonResumeSchema['basics']): string => {
    const parts: string[] = [];

    if (basics?.phone) {
        parts.push(`<span>${escapeHtml(basics.phone)}</span>`);
        parts.push(`<span class="separator">|</span>`);
    }

    if (basics?.email) {
        parts.push(`<span>${escapeHtml(basics.email)}</span>`);
        parts.push(`<span class="separator">|</span>`);
    }

    const linkedin = basics?.profiles?.find(p => p.network?.toLowerCase().includes('linkedin'));
    if (linkedin?.url) {
        const display = linkedin.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
        parts.push(`<a href="${escapeHtml(linkedin.url)}">${escapeHtml(linkedin.username || display)}</a>`);
        parts.push(`<span class="separator">|</span>`);
    }

    if (basics?.url) {
        const display = basics.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
        parts.push(`<a href="${escapeHtml(basics.url)}">${escapeHtml(display)}</a>`);
        parts.push(`<span class="separator">|</span>`);
    }

    const locationParts = [basics?.location?.city, basics?.location?.region, basics?.location?.countryCode].filter(Boolean);
    if (locationParts.length > 0) {
        parts.push(`<span>${escapeHtml(locationParts.join(', '))}</span>`);
    }

    // Remove trailing separator if present
    if (parts.length >= 2 && parts[parts.length - 1].includes('separator')) {
        parts.pop();
    }

    return parts.join('\n        ');
};

const renderCompetencies = (skills: JsonResumeSchema['skills']): string => {
    if (!skills?.length) return '';
    const allKeywords = skills
        .flatMap(s => s.keywords || [])
        .filter(Boolean)
        .slice(0, 8);
    return allKeywords.map(k => `<span class="competency-tag">${escapeHtml(k)}</span>`).join('\n          ');
};

const renderExperience = (work: JsonResumeSchema['work']): string => {
    if (!work?.length) return '';
    return work.map(job => {
        const highlights = job.highlights?.length
            ? `<ul>${job.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}</ul>`
            : '';
        const summary = job.summary ? `<p>${escapeHtml(job.summary)}</p>` : '';
        return `
        <div class="job">
            <div class="job-header">
                <span class="job-company">${escapeHtml(job.name || job.company || '')}</span>
                <span class="job-period">${formatDate(job.startDate)}${job.endDate ? ` – ${formatDate(job.endDate)}` : ''}</span>
            </div>
            <div class="job-role">${escapeHtml(job.position || '')}</div>
            ${job.location ? `<div class="job-location">${escapeHtml(job.location)}</div>` : ''}
            ${summary}
            ${highlights}
        </div>`;
    }).join('\n');
};

const renderProjects = (projects: JsonResumeSchema['projects']): string => {
    if (!projects?.length) return '';
    return projects.map(project => {
        const tech = project.description ? `<div class="project-tech">${escapeHtml(project.description)}</div>` : '';
        const highlights = project.highlights?.length
            ? `<ul>${project.highlights.map(h => `<li>${escapeHtml(h)}</li>`).join('')}</ul>`
            : '';
        return `
        <div class="project">
            <span class="project-title">${escapeHtml(project.name || '')}</span>
            ${project.url ? `<span class="project-badge"><a href="${escapeHtml(project.url)}">link</a></span>` : ''}
            ${tech}
            ${highlights}
        </div>`;
    }).join('\n');
};

const renderEducation = (education: JsonResumeSchema['education']): string => {
    if (!education?.length) return '';
    return education.map(edu => {
        const degree = [edu.studyType, edu.area].filter((v): v is string => Boolean(v)).map(escapeHtml).join(' in ');
        const score = edu.score ? ` — ${escapeHtml(String(edu.score))}` : '';
        return `
        <div class="edu-item">
            <div class="edu-header">
                <span class="edu-title">${degree}</span>
                <span class="edu-year">${formatDate(edu.startDate)}${edu.endDate ? ` – ${formatDate(edu.endDate)}` : ''}</span>
            </div>
            <div class="edu-desc"><span class="edu-org">${escapeHtml(edu.institution || '')}</span>${score}</div>
        </div>`;
    }).join('\n');
};

const renderCertifications = (certificates: JsonResumeSchema['certificates']): string => {
    if (!certificates?.length) return '';
    return certificates.map(cert => `
        <div class="cert-item">
            <span class="cert-title">${escapeHtml(cert.name || '')}</span>
            <span class="cert-org">${escapeHtml(cert.issuer || '')}</span>
            <span class="cert-year">${formatDate(cert.date || '')}</span>
        </div>`).join('\n');
};

const renderSkills = (skills: JsonResumeSchema['skills']): string => {
    if (!skills?.length) return '';
    return skills.map(skill => {
        const keywords = skill.keywords?.length ? escapeHtml(skill.keywords.join(', ')) : '';
        return skill.name
            ? `<span class="skill-item"><span class="skill-category">${escapeHtml(skill.name)}:</span> ${keywords}</span>`
            : `<span class="skill-item">${keywords}</span>`;
    }).join('\n          ');
};

export const renderAtsCvHtml = (resume: JsonResumeSchema, options?: AtsTemplateOptions): string => {
    const lang = options?.lang || 'en';
    const pageWidth = options?.pageFormat === 'letter' ? '8.5in' : '210mm';
    const basics = resume.basics || { name: 'Applicant', profiles: [] };

    const competenciesHtml = renderCompetencies(resume.skills);
    const experienceHtml = renderExperience(resume.work);
    const projectsHtml = renderProjects(resume.projects);
    const educationHtml = renderEducation(resume.education);
    const certificationsHtml = renderCertifications(resume.certificates);
    const skillsHtml = renderSkills(resume.skills);

    return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(basics.name || 'Applicant')} — CV</title>
<style>
  @font-face {
    font-family: 'Space Grotesk';
    src: url('./fonts/space-grotesk-latin.woff2') format('woff2');
    font-weight: 300 700;
    font-style: normal;
    font-display: swap;
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }

  @font-face {
    font-family: 'Space Grotesk';
    src: url('./fonts/space-grotesk-latin-ext.woff2') format('woff2');
    font-weight: 300 700;
    font-style: normal;
    font-display: swap;
    unicode-range: U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
  }

  @font-face {
    font-family: 'DM Sans';
    src: url('./fonts/dm-sans-latin.woff2') format('woff2');
    font-weight: 100 1000;
    font-style: normal;
    font-display: swap;
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }

  @font-face {
    font-family: 'DM Sans';
    src: url('./fonts/dm-sans-latin-ext.woff2') format('woff2');
    font-weight: 100 1000;
    font-style: normal;
    font-display: swap;
    unicode-range: U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body {
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    line-height: 1.5;
    color: #1a1a2e;
    background: #ffffff;
    padding: 0;
    margin: 0;
  }

  .page {
    width: 100%;
    max-width: ${pageWidth};
    margin: 0 auto;
    padding: 2px 0;
  }

  /* === HEADER === */
  .header {
    margin-bottom: 20px;
  }

  .header h1 {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 28px;
    font-weight: 700;
    color: #1a1a2e;
    letter-spacing: -0.02em;
    margin-bottom: 6px;
    line-height: 1.1;
  }

  .header-gradient {
    height: 2px;
    background: linear-gradient(to right, hsl(187, 74%, 32%), hsl(270, 70%, 45%));
    border-radius: 1px;
    margin-bottom: 10px;
  }

  .contact-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    font-family: 'DM Sans', sans-serif;
    font-size: 10.5px;
    line-height: 1.4;
    color: #555;
  }

  .contact-row a {
    color: #555;
    text-decoration: none;
  }

  .contact-row .separator {
    color: #ccc;
  }

  /* === SECTIONS === */
  .section {
    margin-bottom: 18px;
  }

  .section-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: hsl(187, 74%, 32%);
    border-bottom: 1.5px solid #e2e2e2;
    padding-bottom: 4px;
    margin-bottom: 10px;
    line-height: 1.2;
  }

  /* === PROFESSIONAL SUMMARY === */
  .summary-text {
    font-size: 11px;
    line-height: 1.7;
    color: #2f2f2f;
  }

  /* Links must never break across lines */
  a {
    white-space: nowrap;
  }

  /* === CORE COMPETENCIES === */
  .competencies-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .competency-tag {
    font-family: 'DM Sans', sans-serif;
    font-size: 10px;
    font-weight: 500;
    color: hsl(187, 74%, 28%);
    background: hsl(187, 40%, 95%);
    padding: 4px 10px;
    border-radius: 3px;
    border: 1px solid hsl(187, 40%, 88%);
  }

  /* === WORK EXPERIENCE === */
  .job {
    margin-bottom: 14px;
  }

  .job-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 4px;
  }

  .job-company {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 12.5px;
    font-weight: 600;
    color: hsl(270, 70%, 45%);
  }

  .job-period {
    font-size: 10.5px;
    color: #777;
    white-space: nowrap;
  }

  .job-role {
    font-size: 11px;
    font-weight: 600;
    color: #333;
    margin-bottom: 6px;
  }

  .job-location {
    font-size: 10px;
    color: #888;
  }

  .job ul {
    padding-left: 18px;
    margin-top: 6px;
  }

  .job li {
    font-size: 10.5px;
    line-height: 1.6;
    color: #333;
    margin-bottom: 4px;
  }

  .job li strong {
    font-weight: 600;
  }

  /* === PROJECTS === */
  .project {
    margin-bottom: 12px;
  }

  .project-title {
    font-family: 'Space Grotesk', sans-serif;
    font-size: 11.5px;
    font-weight: 600;
    color: hsl(270, 70%, 45%);
  }

  .project-badge {
    font-size: 9px;
    font-weight: 500;
    color: hsl(187, 74%, 32%);
    background: hsl(187, 40%, 95%);
    padding: 1px 6px;
    border-radius: 2px;
    margin-left: 6px;
  }

  .project-badge a {
    color: hsl(187, 74%, 32%);
    text-decoration: none;
  }

  .project-desc {
    font-size: 10.5px;
    color: #444;
    margin-top: 3px;
    line-height: 1.55;
  }

  .project-tech {
    font-size: 9.5px;
    color: #888;
    margin-top: 3px;
  }

  /* === EDUCATION === */
  .edu-item {
    margin-bottom: 8px;
  }

  .edu-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }

  .edu-title {
    font-weight: 600;
    font-size: 11px;
    color: #333;
  }

  .edu-org {
    color: hsl(270, 70%, 45%);
    font-weight: 500;
  }

  .edu-year {
    font-size: 10px;
    color: #777;
    white-space: nowrap;
  }

  .edu-desc {
    font-size: 10px;
    color: #666;
    margin-top: 2px;
    line-height: 1.5;
  }

  /* === CERTIFICATIONS === */
  .cert-item {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 6px;
  }

  .cert-title {
    font-size: 10.5px;
    font-weight: 500;
    color: #333;
  }

  .cert-org {
    color: hsl(270, 70%, 45%);
  }

  .cert-year {
    font-size: 10px;
    color: #777;
    white-space: nowrap;
  }

  /* === SKILLS === */
  .skills-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
  }

  .skill-item {
    font-size: 10.5px;
    color: #444;
  }

  .skill-category {
    font-weight: 600;
    color: #333;
    font-size: 10.5px;
  }

  /* === PRINT === */
  @media print {
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page {
      padding: 0;
    }
  }

  /* === PAGE BREAK CONTROL === */
  .avoid-break,
  .job,
  .project,
  .edu-item,
  .cert-item {
    break-inside: avoid;
    page-break-inside: avoid;
  }
</style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <div class="header avoid-break">
    <h1>${escapeHtml(basics.name || 'Applicant')}</h1>
    <div class="header-gradient"></div>
    <div class="contact-row">
        ${renderContactRow(basics)}
    </div>
  </div>

  <!-- PROFESSIONAL SUMMARY -->
  ${basics?.summary ? `
  <div class="section avoid-break">
    <div class="section-title">${getSectionLabel('summary', lang)}</div>
    <div class="summary-text">${escapeHtml(basics.summary)}</div>
  </div>` : ''}

  <!-- CORE COMPETENCIES -->
  ${competenciesHtml ? `
  <div class="section">
    <div class="section-title">${getSectionLabel('competencies', lang)}</div>
    <div class="competencies-grid">
      ${competenciesHtml}
    </div>
  </div>` : ''}

  <!-- WORK EXPERIENCE -->
  ${experienceHtml ? `
  <div class="section">
    <div class="section-title">${getSectionLabel('experience', lang)}</div>
    ${experienceHtml}
  </div>` : ''}

  <!-- PROJECTS -->
  ${projectsHtml ? `
  <div class="section avoid-break">
    <div class="section-title">${getSectionLabel('projects', lang)}</div>
    ${projectsHtml}
  </div>` : ''}

  <!-- EDUCATION -->
  ${educationHtml ? `
  <div class="section avoid-break">
    <div class="section-title">${getSectionLabel('education', lang)}</div>
    ${educationHtml}
  </div>` : ''}

  <!-- CERTIFICATIONS -->
  ${certificationsHtml ? `
  <div class="section avoid-break">
    <div class="section-title">${getSectionLabel('certifications', lang)}</div>
    ${certificationsHtml}
  </div>` : ''}

  <!-- SKILLS -->
  ${skillsHtml ? `
  <div class="section avoid-break">
    <div class="section-title">${getSectionLabel('skills', lang)}</div>
    <div class="skills-grid">
      ${skillsHtml}
    </div>
  </div>` : ''}

</div>
</body>
</html>`;
};
