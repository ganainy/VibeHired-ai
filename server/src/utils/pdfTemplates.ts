import { JsonResumeSchema, JsonResumeWorkItem, JsonResumeEducationItem, JsonResumeSkillItem } from '../types/jsonresume'; // Use our types

// --- Improved CSS Styles for Readability and ATS Compatibility ---
const basicStyles = `
    body {
        font-family: Arial, Helvetica, sans-serif; /* Standard, readable font */
        line-height: 1.5;
        margin: 40px;
        color: #333; /* Default text color */
        font-size: 11pt; /* Base font size */
    }
    h1, h2, h3, h4 {
        color: #111; /* Darker headings */
        margin-bottom: 0.5em;
        margin-top: 0;
        line-height: 1.3;
    }
    h1 {
        font-size: 18pt;
        border-bottom: 1px solid #ccc;
        padding-bottom: 8px;
        margin-bottom: 15px;
    }
    h2 {
        font-size: 14pt;
        margin-top: 20px; /* Space above sections */
        border-bottom: 1px solid #eee;
        padding-bottom: 4px;
        margin-bottom: 10px;
    }
    h3 {
        font-size: 12pt;
        font-weight: bold;
        margin-bottom: 5px;
        margin-top: 10px;
    }
     h4 { /* For skill categories */
        font-size: 11pt;
        font-weight: bold;
        margin-bottom: 5px;
        margin-top: 8px;
        color: #444;
    }
    p {
        font-size: 11pt;
        color: #333;
        margin-bottom: 0.8em;
        margin-top: 0;
    }
    ul {
        padding-left: 20px; /* Standard indentation */
        margin-top: 0.5em;
        margin-bottom: 1em;
    }
    li {
        font-size: 11pt;
        color: #333;
        margin-bottom: 0.5em;
    }
    a {
        color: #0066cc; /* Standard link color */
        text-decoration: none; /* Cleaner look */
    }
    a:hover {
        text-decoration: underline;
    }
    .section {
        margin-bottom: 20px; /* Consistent spacing between sections */
    }
    .header {
        text-align: center; /* Center header info */
        margin-bottom: 25px;
    }
    .header h1 {
        border-bottom: none; /* Remove border for centered header */
        margin-bottom: 5px;
    }
    .contact-info {
        font-size: 10pt;
        color: #555;
        margin-top: 5px;
    }
    .contact-info span {
        margin: 0 5px; /* Spacing between contact items */
    }
    .contact-info a {
        color: #555; /* Keep contact links subtle */
    }

    /* Styling for individual items (Work, Education, Projects, Certificates) */
    .item {
        margin-bottom: 15px; /* Space between items */
        padding-left: 5px; /* Slight indent for structure */
    }
    .item-header {
        display: flex; /* Use flexbox for alignment */
        justify-content: space-between; /* Title left, dates right */
        margin-bottom: 3px;
    }
    .item-title {
        font-size: 12pt;
        font-weight: bold;
        color: #222;
    }
    .item-dates {
        font-size: 10pt;
        color: #666;
        white-space: nowrap; /* Prevent dates from wrapping */
        padding-left: 15px; /* Ensure space between title and date */
    }
    .item-subtitle {
        font-size: 11pt;
        font-style: italic;
        color: #555;
        margin-bottom: 5px;
    }
    .item-summary, .item-description { /* Consistent naming */
        font-size: 11pt;
        margin-top: 5px;
        margin-bottom: 5px;
    }
     .item-highlights ul {
        margin-top: 5px;
        margin-bottom: 5px;
        padding-left: 18px; /* Indent highlights */
        list-style-type: disc; /* Standard bullets */
    }
    .item-highlights li {
        font-size: 11pt;
        margin-bottom: 3px;
    }

    /* Skills */
    .skills-list {
        list-style: none;
        padding-left: 0;
        margin-top: 5px;
    }
    .skills-list li {
        display: inline-block; /* Keep tags inline */
        background-color: #f0f0f0; /* Subtle background */
        padding: 4px 8px;
        margin-right: 6px;
        margin-bottom: 6px;
        border-radius: 4px;
        font-size: 10pt; /* Slightly smaller for tags */
        color: #444;
    }

    /* Languages */
    .languages ul {
        list-style: none;
        padding: 0;
    }
    .languages li {
        font-size: 11pt;
        margin-bottom: 5px;
    }
    .languages strong {
        font-weight: bold;
    }

    /* Certificates */
    /* Uses .item styling */

    /* Cover Letter Specific */
    .cover-letter-body p {
        margin-bottom: 1em; /* Paragraph spacing for letter */
    }
`;

// --- CV Template Function ---
// Takes the tailored CV JSON and returns an HTML string
export const getCvHtml = (resume: JsonResumeSchema): string => {
    const basics = resume.basics || { name: "Applicant", profiles: [] };
    const location = basics.location || {};
    const profiles = basics.profiles || [];

    // --- Header & Contact ---
    const headerHtml = `
        <div class="header section">
            <h1>${basics.name || 'Name Not Found'}</h1>
            ${basics.label ? `<p style="font-size: 14pt; color: #555; margin-top: 0; margin-bottom: 10px;">${basics.label}</p>` : ''}
            <div class="contact-info">
                ${location.address ? `<span>${location.address}</span><br>` : ''}
                ${location.city ? `<span>${location.city}${location.postalCode ? ` ${location.postalCode}` : ''}${location.region ? `, ${location.region}` : ''}</span>` : ''}
                ${basics.phone ? `<span> | ${basics.phone}</span>` : ''}
                ${basics.email ? `<span> | <a href="mailto:${basics.email}">${basics.email}</a></span>` : ''}
                ${basics.url ? `<span> | <a href="${basics.url}" target="_blank">${basics.url}</a></span>` : ''}
                ${profiles.map(p => p.url ? `<span> | <a href="${p.url}" target="_blank">${p.network || 'Profile'}</a></span>` : '').join('')}
            </div>
        </div>
    `;

    // --- Summary ---
    const summaryHtml = basics.summary ? `
        <div class="section summary">
            <h2>Professional Summary</h2>
            <p>${basics.summary}</p>
        </div>
    ` : '';

    // --- Work Experience ---
    const workHtml = resume.work && resume.work.length > 0 ? `
        <div class="section work">
            <h2>Work Experience</h2>
            ${resume.work.map((item: JsonResumeWorkItem) => `
                <div class="item">
                    <div class="item-header">
                        <span class="item-title">${item.position || item.jobTitle || ''}</span> 
                        <span class="item-dates">${item.startDate || ''}${item.endDate ? ` - ${item.endDate}` : ' - Present'}</span>
                    </div>
                    ${item.name || item.company ? `<div class="item-subtitle">${item.name || item.company}${item.location ? ` | ${item.location}` : ''}</div>` : ''}
                    ${item.summary ? `<p class="item-summary">${item.summary}</p>` : ''}
                    ${item.highlights && item.highlights.length > 0 ? `<div class="item-highlights"><ul>${item.highlights.map(h => `<li>${h}</li>`).join('')}</ul></div>` : ''}
                    ${!item.highlights && item.description ? `<p class="item-description">${item.description}</p>` : ''} 
                </div>
            `).join('')}
        </div>
    ` : '';

    // --- Projects ---
    const projectsHtml = resume.projects && resume.projects.length > 0 ? `
        <div class="section projects">
            <h2>Projects</h2>
            ${resume.projects.map((item) => `
                <div class="item">
                    <div class="item-header">
                        <span class="item-title">${item.name || ''}</span> 
                        <span class="item-dates">${item.startDate || ''}${item.endDate ? ` - ${item.endDate}` : ''}</span>
                    </div>
                    ${item.description ? `<p class="item-description">${item.description}</p>` : ''} 
                    ${item.highlights && item.highlights.length > 0 ? `<div class="item-highlights"><ul>${item.highlights.map(h => `<li>${h}</li>`).join('')}</ul></div>` : ''}
                    ${item.keywords && item.keywords.length > 0 ? `<p style="font-size:10pt; margin-top: 4px; color: #555;"><em>Keywords: ${item.keywords.join(', ')}</em></p>` : ''}
                    ${item.url ? `<p style="font-size:10pt;"><a href="${item.url}" target="_blank">Project Link</a></p>` : ''}
                </div>
            `).join('')}
        </div>
    ` : '';


    // --- Education ---
    const educationHtml = resume.education && resume.education.length > 0 ? `
         <div class="section education">
            <h2>Education</h2>
             ${resume.education.map((item: JsonResumeEducationItem) => `
                <div class="item">
                     <div class="item-header">
                        <span class="item-title">${item.institution || ''}</span> 
                        <span class="item-dates">${item.startDate || ''}${item.endDate ? ` - ${item.endDate}` : ''}</span>
                    </div>
                     <div class="item-subtitle">
                        ${item.studyType || item.degree || ''}${item.area ? ` in ${item.area}` : ''} 
                        ${item.score ? ` (Score: ${item.score})` : ''}
                     </div>
                    ${item.courses && item.courses.length > 0 ? `<p style="font-size:10pt; margin-top: 4px; color: #555;"><em>Relevant Courses: ${item.courses.join(', ')}</em></p>` : ''}
                </div>
            `).join('')}
        </div>
    ` : '';

    // --- Skills ---
    const skillsHtml = resume.skills && resume.skills.length > 0 ? `
        <div class="section skills">
            <h2>Skills</h2>
            ${resume.skills.map((skillCat: JsonResumeSkillItem) => skillCat.keywords && skillCat.keywords.length > 0 ? `
                <div class="skills-category">
                    ${skillCat.name ? `<h4>${skillCat.name}</h4>` : ''}
                    <ul class="skills-list">
                        ${skillCat.keywords.map(keyword => `<li>${keyword}</li>`).join('')}
                    </ul>
                </div>
            ` : '').join('')}
        </div>
    ` : '';

    // --- Languages ---
    const languagesHtml = resume.languages && resume.languages.length > 0 ? `
         <div class="section languages">
             <h2>Languages</h2>
             <ul>
                 ${resume.languages.map(lang => `
                     <li>
                         <strong>${lang.language || ''}</strong>${lang.fluency ? `: ${lang.fluency}` : ''}
                     </li>
                 `).join('')}
             </ul>
         </div>
     ` : '';

    // --- Certificates ---
    const certificatesHtml = resume.certificates && resume.certificates.length > 0 ? `
        <div class="section certificates">
            <h2>Certificates</h2>
            ${resume.certificates.map(cert => `
                <div class="item">
                    <div class="item-header">
                        <span class="item-title">${cert.name || ''}</span> 
                        <span class="item-dates">${cert.date || ''}</span>
                    </div>
                    ${cert.issuer ? `<div class="item-subtitle">${cert.issuer}</div>` : ''}
                    ${cert.url ? `<p style="font-size:10pt;"><a href="${cert.url}" target="_blank">Certificate Link</a></p>` : ''}
                </div>
            `).join('')}
        </div>
    ` : '';


    // Combine all sections into the final HTML
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>CV - ${basics.name || 'Applicant'}</title>
            <style>${basicStyles}</style>
        </head>
        <body>
            ${headerHtml}
            ${summaryHtml}
            ${workHtml}
            ${projectsHtml}
            ${educationHtml}
            ${skillsHtml}
            ${languagesHtml}
            ${certificatesHtml}
        </body>
        </html>
    `;
};

// --- Cover Letter Template Function ---
// Takes the cover letter text and returns an HTML string
// Note: The cover letter text already includes sender contact info, so we don't add it again
export const getCoverLetterHtml = (letterText: string, cvData: JsonResumeSchema): string => {
    const basics = cvData.basics || {};
    const name = basics.name || 'Applicant';

    const normalized = letterText
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
    const formattedText = normalized.replace(/\n/g, '<br>');

    return `
         <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Cover Letter - ${name}</title>
             <style>
                ${basicStyles} /* Reuse CV styles */
                /* Add specific cover letter styles if needed */
                body { font-size: 11pt; } /* Ensure consistent base size */
                .cover-letter-body { 
                    line-height: 1.6;
                    margin-top: 20px;
                }
             </style>
        </head>
        <body>
            <div class="cover-letter-body">
             <p>${formattedText}</p>
            </div>
        </body>
        </html>
    `;
};