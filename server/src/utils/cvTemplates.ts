import { JsonResumeSchema, JsonResumeWorkItem, JsonResumeEducationItem, JsonResumeSkillItem } from '../types/jsonresume';

export enum CVTemplate {
    CLASSIC = 'classic',
    HARVARD = 'harvard',
    MODERN_ATS = 'modern_ats',
    MINIMAL = 'minimal',
    GERMAN_LATEX = 'german_latex'
}

// --- Helper: Date Formatter ---
const formatDate = (dateString?: string): string => {
    if (!dateString) return '';
    // Assuming YYYY-MM-DD or YYYY-MM
    return dateString; // Keep as is for now, or add moment/date-fns if needed
};

// --- Template: Harvard (Classic, Serif, High ATS Score) ---
const getHarvardTemplate = (resume: JsonResumeSchema): string => {
    const basics = resume.basics || { name: "Applicant", profiles: [] };
    const location = basics.location || {};

    const styles = `
        body {
            font-family: "Times New Roman", Times, serif;
            font-size: 11pt;
            line-height: 1.4;
            color: #000;
            margin: 40px;
        }
        h1 {
            font-size: 20pt;
            text-transform: uppercase;
            text-align: center;
            margin-bottom: 5px;
            font-weight: bold;
        }
        .contact-info {
            text-align: center;
            font-size: 10pt;
            margin-bottom: 20px;
        }
        .section-title {
            font-size: 12pt;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
            margin-top: 15px;
            margin-bottom: 10px;
            font-weight: bold;
        }
        .item {
            margin-bottom: 10px;
        }
        .item-header {
            display: flex;
            justify-content: space-between;
            font-weight: bold;
        }
        .item-subheader {
            display: flex;
            justify-content: space-between;
            font-style: italic;
        }
        ul {
            margin: 5px 0;
            padding-left: 20px;
        }
        li {
            margin-bottom: 2px;
        }
        a { color: #000; text-decoration: none; }
    `;

    // Header
    const header = `
        <h1>${basics.name}</h1>
        <div class="contact-info">
            ${location.city ? `${location.city}, ` : ''}${location.region || ''} | 
            ${basics.phone || ''} | 
            <a href="mailto:${basics.email}">${basics.email}</a>
            ${basics.url ? ` | <a href="${basics.url}">${basics.url}</a>` : ''}
            ${basics.profiles?.map(p => ` | <a href="${p.url}">${p.network}</a>`).join('') || ''}
        </div>
    `;

    // Professional Summary
    const summary = basics.summary ? `
        <div class="section">
            <div class="section-title">Professional Summary</div>
            <p>${basics.summary}</p>
        </div>
    ` : '';

    // Education
    const education = resume.education?.length ? `
        <div class="section">
            <div class="section-title">Education</div>
            ${resume.education.map(edu => `
                <div class="item">
                    <div class="item-header">
                        <span>${edu.institution}</span>
                        <span>${formatDate(edu.startDate)} - ${formatDate(edu.endDate) || 'Present'}</span>
                    </div>
                    <div class="item-subheader">
                        <span>${[edu.studyType, edu.area].filter(Boolean).join(' in ')}</span>
                </div>
            `).join('')}
        </div>
    ` : '';

    // Experience
    const work = resume.work?.length ? `
        <div class="section">
            <div class="section-title">Professional Experience</div>
            ${resume.work.map(job => `
                <div class="item">
                    <div class="item-header">
                        <span>${job.name || job.company || ''}</span>
                        <span>${formatDate(job.startDate)} - ${formatDate(job.endDate) || 'Present'}</span>
                    </div>
                    ${job.summary ? `<p>${job.summary}</p>` : ''}
                    ${job.highlights?.length ? `<ul>${job.highlights.map(h => `<li>${h}</li>`).join('')}</ul>` : ''}
                </div>
            `).join('')}
        </div>
    ` : '';

    // Skills
    const skills = resume.skills?.length ? `
        <div class="section">
            <div class="section-title">Skills</div>
            <p>
                ${resume.skills.map(skill => `
                    <strong>${skill.name}:</strong> ${skill.keywords?.join(', ')}
                `).join(' | ')}
            </p>
        </div>
    ` : '';

    // Projects
    const projects = resume.projects?.length ? `
        <div class="section">
            <div class="section-title">Projects</div>
            ${resume.projects.map(project => `
                <div class="item">
                    <div class="item-header">
                        <span>${project.name}</span>
                        <span>${formatDate(project.startDate)} - ${formatDate(project.endDate) || 'Present'}</span>
                    </div>
                    <div class="item-subheader">
                        <span>${project.description || ''}</span>
                        ${project.url ? `<span><a href="${project.url}">${project.url}</a></span>` : ''}
                    </div>
                    ${project.highlights?.length ? `<ul>${project.highlights.map(h => `<li>${h}</li>`).join('')}</ul>` : ''}
                </div>
            `).join('')}
        </div>
    ` : '';

    // Certificates
    const certificates = resume.certificates?.length ? `
        <div class="section">
            <div class="section-title">Certifications</div>
            <ul>
                ${resume.certificates.map(cert => `
                    <li>
                        <strong>${cert.name || ''}</strong>${cert.issuer ? ` - ${cert.issuer}` : ''}${cert.date ? ` (${formatDate(cert.date)})` : ''}
                    </li>
                `).join('')}
            </ul>
        </div>
    ` : '';

    // Languages
    const languages = resume.languages?.length ? `
        <div class="section">
            <div class="section-title">Languages</div>
            <p>
                ${resume.languages.map(lang => `
                    <strong>${lang.language}:</strong> ${lang.fluency}
                `).join(' | ')}
            </p>
        </div>
    ` : '';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>${styles}</style>
        </head>
        <body>
            ${header}
            ${summary}
            ${education}
            ${work}
            ${projects}
            ${skills}
            ${certificates}
            ${languages}
        </body>
        </html>
    `;
};

// --- Template: Modern ATS (Clean Sans-Serif, Subtle Styling) ---
const getModernAtsTemplate = (resume: JsonResumeSchema): string => {
    const basics = resume.basics || { name: "Applicant", profiles: [] };
    const location = basics.location || {};

    const styles = `
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10pt;
            line-height: 1.5;
            color: #333;
            margin: 40px;
        }
        h1 {
            font-size: 24pt;
            text-transform: uppercase;
            margin-bottom: 5px;
            color: #2c3e50;
            letter-spacing: 1px;
        }
        .contact-info {
            font-size: 9pt;
            margin-bottom: 25px;
            color: #666;
        }
        .section-title {
            font-size: 12pt;
            text-transform: uppercase;
            border-bottom: 2px solid #2c3e50;
            color: #2c3e50;
            margin-top: 20px;
            margin-bottom: 15px;
            font-weight: bold;
            padding-bottom: 5px;
        }
        .item {
            margin-bottom: 15px;
        }
        .item-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
        }
        .company-name {
            font-weight: bold;
            font-size: 11pt;
            color: #000;
        }
        .date-range {
            font-size: 9pt;
            color: #666;
        }
        .position-title {
            font-style: italic;
            color: #444;
            margin-bottom: 5px;
        }
        ul {
            margin: 5px 0;
            padding-left: 18px;
        }
        li {
            margin-bottom: 4px;
        }
        a { color: #2980b9; text-decoration: none; }
    `;

    // Header
    const header = `
        <h1>${basics.name}</h1>
        <div class="contact-info">
            ${location.city ? `${location.city}, ` : ''}${location.region || ''} • 
            ${basics.phone || ''} • 
            <a href="mailto:${basics.email}">${basics.email}</a>
            ${basics.url ? ` • <a href="${basics.url}">${basics.url}</a>` : ''}
            ${basics.profiles?.map(p => ` • <a href="${p.url}">${p.network}</a>`).join('') || ''}
        </div>
    `;

    // Professional Summary
    const summary = basics.summary ? `
        <div class="section">
            <div class="section-title">Professional Summary</div>
            <p>${basics.summary}</p>
        </div>
    ` : '';

    // Experience
    const work = resume.work?.length ? `
        <div class="section">
            <div class="section-title">Experience</div>
            ${resume.work.map(job => `
                <div class="item">
                    <div class="item-header">
                        <span class="company-name">${job.name || job.company || ''}</span>
                        <span class="date-range">${formatDate(job.startDate)} - ${formatDate(job.endDate) || 'Present'}</span>
                    </div>
                    <div class="position-title">${job.position}</div>
                    ${job.summary ? `<p>${job.summary}</p>` : ''}
                    ${job.highlights?.length ? `<ul>${job.highlights.map(h => `<li>${h}</li>`).join('')}</ul>` : ''}
                </div>
            `).join('')}
        </div>
    ` : '';

    // Education
    const education = resume.education?.length ? `
        <div class="section">
            <div class="section-title">Education</div>
            ${resume.education.map(edu => `
                <div class="item">
                    <div class="item-header">
                        <span class="company-name">${edu.institution}</span>
                        <span class="date-range">${formatDate(edu.startDate)} - ${formatDate(edu.endDate) || 'Present'}</span>
                    </div>
                    <div class="position-title">${[edu.studyType, edu.area].filter(Boolean).join(' in ')}</div>
                    ${edu.score ? `<div>GPA: ${edu.score}</div>` : ''}
                </div>
            `).join('')}
        </div>
    ` : '';

    // Projects (Modern ATS)
    const projects = resume.projects?.length ? `
        <div class="section">
            <div class="section-title">Projects</div>
            ${resume.projects.map(project => `
                <div class="item">
                    <div class="item-header">
                        <span class="company-name">${project.name}</span>
                        <span class="date-range">${formatDate(project.startDate)} - ${formatDate(project.endDate) || 'Present'}</span>
                    </div>
                    ${project.description ? `<div class="position-title">${project.description}</div>` : ''}
                    ${project.url ? `<div><a href="${project.url}">${project.url}</a></div>` : ''}
                    ${project.highlights?.length ? `<ul>${project.highlights.map(h => `<li>${h}</li>`).join('')}</ul>` : ''}
                </div>
            `).join('')}
        </div>
    ` : '';

    // Certificates
    const certificates = resume.certificates?.length ? `
        <div class="section">
            <div class="section-title">Certifications</div>
            ${resume.certificates.map(cert => `
                <div class="item" style="margin-bottom: 5px;">
                    <span class="company-name">${cert.name || ''}</span>${cert.issuer ? ` - ${cert.issuer}` : ''}${cert.date ? ` <span class="date-range">(${formatDate(cert.date)})</span>` : ''}
                </div>
            `).join('')}
        </div>
    ` : '';

    // Languages
    const languages = resume.languages?.length ? `
        <div class="section">
            <div class="section-title">Languages</div>
            <div style="display: flex; flex-wrap: wrap; gap: 15px;">
                ${resume.languages.map(lang => `
                    <div><strong>${lang.language}</strong>: ${lang.fluency}</div>
                `).join('')}
            </div>
        </div>
    ` : '';

    // Skills
    const skills = resume.skills?.length ? `
        <div class="section">
            <div class="section-title">Skills</div>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                ${resume.skills.map(skill => `
                    <div>
                        <strong>${skill.name}:</strong> ${skill.keywords?.join(', ')}
                    </div>
                `).join('')}
            </div>
        </div>
    ` : '';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>${styles}</style>
        </head>
        <body>
            ${header}
            ${summary}
            ${work}
            ${projects}
            ${education}
            ${skills}
            ${certificates}
            ${languages}
        </body>
        </html>
    `;
};

// --- Template: Minimalist (Clean, Whitespace, Content Focus) ---
const getMinimalistTemplate = (resume: JsonResumeSchema): string => {
    const basics = resume.basics || { name: "Applicant", profiles: [] };
    const location = basics.location || {};

    const styles = `
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 10pt;
            line-height: 1.6;
            color: #222;
            margin: 50px;
        }
        h1 {
            font-size: 28pt;
            font-weight: 300;
            margin-bottom: 10px;
            letter-spacing: -0.5px;
        }
        .contact-info {
            font-size: 9pt;
            color: #888;
            margin-bottom: 40px;
        }
        .section-title {
            font-size: 10pt;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #888;
            margin-top: 30px;
            margin-bottom: 20px;
            font-weight: 600;
        }
        .item {
            margin-bottom: 25px;
        }
        .item-header {
            margin-bottom: 5px;
        }
        .company-name {
            font-weight: 600;
            font-size: 11pt;
        }
        .date-range {
            color: #888;
            font-size: 9pt;
            float: right;
        }
        .position-title {
            color: #555;
            margin-bottom: 8px;
        }
        ul {
            margin: 0;
            padding-left: 15px;
            color: #444;
        }
        li {
            margin-bottom: 5px;
        }
        a { color: #222; text-decoration: underline; }
    `;

    // Header
    const header = `
        <h1>${basics.name}</h1>
        <div class="contact-info">
            ${location.city ? `${location.city}, ` : ''}${location.region || ''}<br>
            ${basics.phone || ''}<br>
            <a href="mailto:${basics.email}">${basics.email}</a>
        </div>
    `;

    // Professional Summary
    const summary = basics.summary ? `
        <div class="section">
            <div class="section-title">Profile</div>
            <p>${basics.summary}</p>
        </div>
    ` : '';

    // Experience
    const work = resume.work?.length ? `
        <div class="section">
            <div class="section-title">Experience</div>
            ${resume.work.map(job => `
                <div class="item">
                    <div class="item-header">
                        <span class="company-name">${job.name || job.company || ''}</span>
                        <span class="date-range">${formatDate(job.startDate)} - ${formatDate(job.endDate) || 'Present'}</span>
                    </div>
                    <div class="position-title">${job.position}</div>
                    ${job.summary ? `<p>${job.summary}</p>` : ''}
                    ${job.highlights?.length ? `<ul>${job.highlights.map(h => `<li>${h}</li>`).join('')}</ul>` : ''}
                </div>
            `).join('')}
        </div>
    ` : '';

    // Education
    const education = resume.education?.length ? `
        <div class="section">
            <div class="section-title">Education</div>
            ${resume.education.map(edu => `
                <div class="item">
                    <div class="item-header">
                        <span class="company-name">${edu.institution}</span>
                        <span class="date-range">${formatDate(edu.startDate)} - ${formatDate(edu.endDate) || 'Present'}</span>
                    </div>
                    <div class="position-title">${[edu.studyType, edu.area].filter(Boolean).join(' in ')}</div>
                </div>
            `).join('')}
        </div>
    ` : '';

    // Skills
    const skills = resume.skills?.length ? `
        <div class="section">
            <div class="section-title">Skills</div>
            <p>
                ${resume.skills.map(skill => skill.name).join(' • ')}
            </p>
        </div>
    ` : '';

    // Projects (Minimalist)
    const projects = resume.projects?.length ? `
        <div class="section">
            <div class="section-title">Projects</div>
            ${resume.projects.map(project => `
                <div class="item">
                    <div class="item-header">
                        <span class="company-name">${project.name}</span>
                        <span class="date-range">${formatDate(project.startDate)} - ${formatDate(project.endDate) || 'Present'}</span>
                    </div>
                    ${project.description ? `<div class="position-title">${project.description}</div>` : ''}
                    ${project.highlights?.length ? `<ul>${project.highlights.map(h => `<li>${h}</li>`).join('')}</ul>` : ''}
                </div>
            `).join('')}
        </div>
    ` : '';

    // Certificates
    const certificates = resume.certificates?.length ? `
        <div class="section">
            <div class="section-title">Certifications</div>
            <ul>
                ${resume.certificates.map(cert => `
                    <li>${cert.name} — ${cert.issuer}</li>
                `).join('')}
            </ul>
        </div>
    ` : '';

    // Languages
    const languages = resume.languages?.length ? `
        <div class="section">
            <div class="section-title">Languages</div>
            <p>
                ${resume.languages.map(lang => encodeURIComponent(lang.language || '')).join(' • ')}
            </p>
        </div>
    ` : '';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>${styles}</style>
        </head>
        <body>
            ${header}
            ${summary}
            ${work}
            ${projects}
            ${education}
            ${skills}
            ${certificates}
            ${languages}
        </body>
        </html>
    `;
};

// --- Template: German LaTeX (Professional German-style with LaTeX formatting) ---
const getGermanLatexTemplate = (resume: JsonResumeSchema, language: 'en' | 'de' = 'de'): string => {
    const basics = resume.basics || { name: "Applicant", profiles: [] };
    const location = basics.location || {};

    const t = {
        en: {
            professionalProfile: 'Professional Profile',
            relevantExperience: 'Relevant IT Experience',
            education: 'Education',
            projects: 'Projects',
            technicalSkills: 'Technical Skills',
            languages: 'Languages',
            grade: 'Grade',
            motherTongue: 'Mother tongue',
            certificates: 'Certifications',
        },
        de: {
            professionalProfile: 'Berufliches Profil',
            relevantExperience: 'Relevante IT-Erfahrung',
            education: 'Ausbildung',
            projects: 'Projekte',
            technicalSkills: 'Technische Fähigkeiten',
            languages: 'Sprachen',
            grade: 'Note',
            motherTongue: 'Muttersprache',
            certificates: 'Zertifikate',
        },
    };

    const lang = t[language];

    const styles = `
        body {
            font-family: "Times New Roman", Times, serif;
            font-size: 11pt;
            line-height: 1.4;
            color: #000;
            margin: 40px;
            background: white;
        }
        h1 {
            font-size: 18pt;
            font-weight: bold;
            margin: 0 0 2px 0;
        }
        h2 {
            font-size: 11pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border-bottom: 1px solid #000;
            margin-bottom: 8px;
            padding-bottom: 2px;
            margin-top: 15px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            align-items: flex-start;
        }
        .header-left {
            flex: 1;
        }
        .header-right {
            text-align: right;
            font-size: 9pt;
            line-height: 1.4;
        }
        .location, .education-summary {
            font-size: 10pt;
            margin: 2px 0;
        }
        section {
            margin-bottom: 15px;
        }
        ul {
            margin: 0;
            padding-left: 20px;
            list-style-type: disc;
        }
        li {
            margin-bottom: 8px;
        }
        .item-content {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
        }
        .item-right {
            text-align: right;
            font-style: italic;
            font-size: 9pt;
        }
        .company {
            font-style: italic;
            font-size: 9pt;
        }
        .em-dash-list {
            font-size: 10pt;
            margin-top: 4px;
        }
        .em-dash-list div {
            margin-bottom: 2px;
        }
        p {
            margin: 0;
            text-align: justify;
            font-size: 10pt;
        }
        a {
            color: #000;
            text-decoration: none;
        }
    `;

    // Header
    const eduSummary = resume.education && resume.education[0]
        ? `${resume.education[0].studyType || resume.education[0].degree} ${resume.education[0].area ? `in ${resume.education[0].area}` : ''}`
        + (resume.education[1] ? ` und ${resume.education[1].studyType || resume.education[1].degree} ${resume.education[1].area ? `in ${resume.education[1].area}` : ''}` : '')
        : '';

    const header = `
        <div class="header">
            <div class="header-left">
                <h1>${basics.name}</h1>
                <p class="location">${location.city ? `${location.city}, ` : ''}${location.region || ''}</p>
                ${eduSummary ? `<p class="education-summary">${eduSummary}</p>` : ''}
            </div>
            <div class="header-right">
                ${basics.phone ? `<p>${basics.phone}</p>` : ''}
                ${basics.email ? `<p><a href="mailto:${basics.email}">${basics.email}</a></p>` : ''}
                ${basics.url ? `<p><a href="${basics.url}" target="_blank">Portfolio</a></p>` : ''}
                ${basics.profiles?.find(p => p.network?.toLowerCase().includes('linkedin')) ? `<p><a href="${basics.profiles.find(p => p.network?.toLowerCase().includes('linkedin'))?.url}" target="_blank">LinkedIn</a></p>` : ''}
            </div>
        </div>
    `;

    // Professional Profile
    const summary = basics.summary ? `
        <section>
            <h2>${lang.professionalProfile}</h2>
            <p>${basics.summary}</p>
        </section>
    ` : '';

    // Experience
    const work = resume.work?.length ? `
        <section>
            <h2>${lang.relevantExperience}</h2>
            <ul>
                ${resume.work.map(job => `
                    <li>
                        <div class="item-content">
                            <div>
                                <strong>${job.position}</strong>
                                <div class="company">${job.name || job.company || ''}</div>
                            </div>
                            <div class="item-right">
                                <div>${formatDate(job.startDate)} – ${formatDate(job.endDate) || (language === 'de' ? 'heute' : 'present')}</div>
                                ${job.location ? `<div>${job.location}</div>` : ''}
                            </div>
                        </div>
                        ${job.highlights?.length ? `<div class="em-dash-list">${job.highlights.map(h => `<div>– ${h}</div>`).join('')}</div>` : (job.summary ? `<div class="em-dash-list">– ${job.summary}</div>` : '')}
                    </li>
                `).join('')}
            </ul>
        </section>
    ` : '';

    // Education
    const education = resume.education?.length ? `
        <section>
            <h2>${lang.education}</h2>
            <ul>
                ${resume.education.map(edu => `
                    <li>
                        <div class="item-content">
                            <div>
                                <strong>${edu.institution}</strong>
                                <div class="company">${edu.studyType || edu.degree} ${edu.area ? `in ${edu.area}` : ''}${edu.score ? ` (Note ${edu.score})` : ''}</div>
                            </div>
                            <div class="item-right">
                                ${formatDate(edu.startDate)} – ${formatDate(edu.endDate) || (language === 'de' ? 'heute' : 'present')}
                            </div>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </section>
    ` : '';

    // Projects
    const projects = resume.projects?.length ? `
        <section>
            <h2>${lang.projects}</h2>
            <ul>
                ${resume.projects.map(project => `
                    <li>
                        <strong>${project.name}</strong>
                        ${project.description ? `<div class="company" style="margin-top: 2px;">${project.description}</div>` : ''}
                        ${project.highlights?.length ? `<div class="em-dash-list">${project.highlights.map(h => `<div>–${h}</div>`).join('')}</div>` : ''}
                    </li>
                `).join('')}
            </ul>
        </section>
    ` : '';

    // Skills
    const skills = resume.skills?.length ? `
        <section>
            <h2>${lang.technicalSkills}</h2>
            <ul>
                ${resume.skills.map(skill => `
                    <li style="font-size: 10pt;"><strong>${skill.name}:</strong> ${skill.keywords?.join(', ') || ''}</li>
                `).join('')}
            </ul>
        </section>
    ` : '';

    // Languages
    const languages = resume.languages?.length ? `
        <section>
            <h2>${lang.languages}</h2>
            <ul>
                ${resume.languages.map(langItem => `
                    <li style="font-size: 10pt;"><strong>${langItem.language}:</strong> ${langItem.fluency}</li>
                `).join('')}
            </ul>
        </section>
    ` : '';

    // Certificates
    const certificates = resume.certificates?.length ? `
        <section>
            <h2>${lang.certificates}</h2>
            <ul>
                ${resume.certificates.map(cert => `
                    <li>
                        <div class="item-content">
                            <div>
                                <strong>${cert.name}</strong>
                                <div class="company">${cert.issuer}</div>
                            </div>
                            <div class="item-right">
                                ${formatDate(cert.date)}
                            </div>
                        </div>
                    </li>
                `).join('')}
            </ul>
        </section>
    ` : '';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>${styles}</style>
        </head>
        <body>
            ${header}
            ${summary}
            ${work}
            ${projects}
            ${education}
            ${skills}
            ${certificates}
            ${languages}
        </body>
        </html>
    `;
};

// --- Main Export ---
export const getCvTemplateHtml = (resume: JsonResumeSchema, template: CVTemplate = CVTemplate.CLASSIC): string => {
    switch (template) {
        case CVTemplate.HARVARD:
            return getHarvardTemplate(resume);
        case CVTemplate.MODERN_ATS:
            return getModernAtsTemplate(resume);
        case CVTemplate.MINIMAL:
            return getMinimalistTemplate(resume);
        case CVTemplate.GERMAN_LATEX:
            return getGermanLatexTemplate(resume);
        case CVTemplate.CLASSIC:
        default:
            // Fallback to Harvard for now as "Classic" replacement or import original
            return getHarvardTemplate(resume);
    }
};
