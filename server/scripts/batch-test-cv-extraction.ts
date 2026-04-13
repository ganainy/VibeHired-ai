import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';

// Load environment variables
const envPath = fs.existsSync(path.join(process.cwd(), '.env'))
    ? path.join(process.cwd(), '.env')
    : path.resolve(__dirname, '../.env');

dotenv.config({ path: envPath });

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

if (!API_KEY) {
    console.error('Error: GEMINI_API_KEY not found in .env');
    process.exit(1);
}

// Import the prompt from test-cv-extraction
const getPrompt = (filename: string) => `
You are a precise CV/resume data extractor. Analyze the attached CV file (${filename}) and extract ALL information into a strictly valid JSON Resume Schema object.

=== CRITICAL FIELD-BY-FIELD RULES ===

**basics.name**
- Extract the candidate's full name EXACTLY as it appears, preserving proper word spacing.
- If the name appears as a concatenated string (e.g. "JohnDoe" due to PDF rendering), reconstruct the correct spacing by inserting a space at the camelCase boundary (e.g. "John Doe").
- NEVER output the name without a space between first and last name.

**basics.summary**
- Extract ONLY the body/paragraph text of the professional summary or profile section.
- NEVER include the section heading (e.g. "Professional Summary", "Berufsprofil", "Über mich") as part of the value.
- The value must be plain prose text only.

**basics.location**
- Map city → "city", state/region → "region", country → "countryCode" (ISO 2-letter code, e.g. "DE", "EG").

**work[].name / work[].position**
- "name" = the employer/company name only.
- "position" = the job title only.
- "highlights" = array of individual bullet point strings (each bullet is one separate array element, NOT a single concatenated paragraph).
- "startDate" / "endDate" = YYYY-MM or YYYY. Use "Present" for current roles.

**education[].studyType / education[].area / education[].institution**
- "studyType" = the degree type (e.g. "Bachelor of Science", "Master of Science", "Ausbildung").
- "area" = the field of study (e.g. "Computer Science", "Internet Security").
- "institution" = the university or school name only.

**skills[]**
- Group skills into meaningful categories. Each element MUST be an object: { "name": "<Category>", "keywords": ["skill1", "skill2", ...] }
- "keywords" MUST be an array of individual short skill/technology names — NEVER a single long paragraph string.
- Each keyword is ONE skill (e.g. "Windows 10/11", "Active Directory", "TCP/IP") — not a sentence.
- Example of CORRECT skills entry:
  { "name": "Networking", "keywords": ["TCP/IP", "DNS", "DHCP", "HTTP/HTTPS", "WLAN"] }
- Example of INCORRECT skills entry (DO NOT do this):
  { "name": "Skills", "keywords": ["Kenntnisse in TCP/IP, DNS, DHCP, HTTP/HTTPS sowie grundlegender Netzwerkdiagnose"] }
- If the CV lists skills as a long paragraph, split each individual skill/term into its own keyword string.
- **DEDUPLICATION**: If the CV has both a compact skills list (e.g. a tag cloud or comma-separated bar) AND a detailed skills section with bullet-point descriptions, extract skills ONLY ONCE. Prefer the detailed version. Do NOT create two separate skill groups containing the same technologies.

**projects[] vs skills[] — CRITICAL DISTINCTION**
- A "Project" is a named block of work the candidate has done, described with bullet points explaining WHAT they did (actions, outcomes, responsibilities). These go into projects[].
- A "Skill" is a technology name, tool, or competency area. These go into skills[].
- If the CV has a section with titled blocks (e.g. "Technische Fehleranalyse & 1st-Level-Support", "Windows-Administration") each containing descriptive bullet points about what was done — those are PROJECTS, not skills. Extract them into projects[].
- Do NOT convert project titles into skill category names.
- Example: A block titled "Microsoft 365 & Benutzerverwaltung" with bullets like "Kenntnisse in Microsoft 365 (Outlook, Teams...)" is a PROJECT entry demonstrating that skill area — add it to projects[], and separately add "Microsoft 365", "Outlook", "Teams" etc. as keywords in skills[].

**projects[]**
- "name" = project title only.
- "description" = brief one-line description (plain text, no heading labels).
- "highlights" = array of individual bullet strings describing what was done.
- "url" = GitHub or live URL if present — ONLY if the URL contains a real path beyond the domain (e.g. "https://github.com/username/repo" is valid, "https://github.com/" is NOT). Omit the field entirely if no real URL is present.

**languages[]**
- EACH language entry MUST have exactly two separate fields:
  - "language": the language name ONLY (e.g. "Deutsch", "English", "Arabic", "Arabisch") — NO proficiency level here
  - "fluency": the proficiency level ONLY (e.g. "C1", "B2", "Native", "Fluent", "Conversational", "Basic") — NO language name here
- NEVER merge language name and proficiency into a single string (e.g. "DeutschC1" or "ArabischNative" are WRONG).
- Example of CORRECT entry: { "language": "Deutsch", "fluency": "C1" }
- Example of INCORRECT entry: { "language": "DeutschC1", "fluency": "" }

**basics.profiles & basics.url**
- Extract common social/professional profiles like LinkedIn, GitHub, and Portfolio.
- **IMPORTANT**: Extract the FULL URL for each profile.
- **NEVER GUESS HANDLES**: DO NOT construct URLs based on the candidate's name. Only extract a profile if a specific username or link is explicitly written next to the icon/label.
- If the CV contains a specific handle (e.g. "@amrelg") next to an icon, construct the full URL (e.g. "github.com/amrelg").
- **STRICT NO PLACEHOLDERS**: NEVER extract generic URLs like "https://linkedin.com/", "https://github.com/", or URLs that obviously lacks a unique handle.
- If no specific profile info is present, omit the field entirely.
- Map LinkedIn to "network": "LinkedIn", GitHub to "network": "GitHub", and Portfolio sites to "network": "Portfolio" or "Website".

**General rules**
- Parse the ENTIRE document — do not skip any section.
- NEVER include section heading labels (e.g. "Skills & Technologies", "Berufserfahrung") as field values.
- NEVER use generic placeholders for any field. If the information isn't in the CV, leave the field out.
- Format all dates as YYYY-MM or YYYY. Use "Present" for ongoing. Omit date fields that are not found.
- If an entire section is absent from the CV, omit that top-level key entirely.
- If a specific field is not found, omit it (do not set to null or empty string unless required).
- **DO NOT include any JavaScript/JSON comments (// or /* */) anywhere in the output.**

=== OUTPUT FORMAT ===
Return ONLY a single valid JSON object enclosed in triple backticks (\`\`\`json ... \`\`\`).
No text, explanation, or commentary before or after the JSON block.
`;

function fileToGenerativePart(filePath: string, mimeType: string): Part {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(filePath)).toString('base64'),
            mimeType,
        },
    };
}

function getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.txt': 'text/plain',
        '.rtf': 'application/rtf'
    };
    return map[ext] || 'application/octet-stream';
}

function parseJsonResponse(responseText: string): any {
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const jsonMatch = responseText.match(jsonRegex);
    if (jsonMatch && jsonMatch[1]) {
        return JSON.parse(jsonMatch[1].trim());
    }
    throw new Error('AI failed to return valid JSON block.');
}

// Generate PDF from JSON using Harvard template
async function generatePdfFromJson(cvJson: any, outputPath: string): Promise<void> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    try {
        const page = await browser.newPage();
        const html = buildHarvardHtml(cvJson);
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.pdf({
            path: outputPath,
            format: 'A4',
            printBackground: true,
            margin: { top: '25px', right: '25px', bottom: '25px', left: '25px' },
        });
        await page.close();
    } finally {
        await browser.close();
    }
}

// Harvard-style HTML template for CV
function buildHarvardHtml(cvJson: any): string {
    const basics = cvJson.basics || {};
    const work = cvJson.work || [];
    const education = cvJson.education || [];
    const skills = cvJson.skills || [];
    const projects = cvJson.projects || [];
    const languages = cvJson.languages || [];

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page { size: A4; margin: 25px; }
        body { font-family: 'Georgia', serif; font-size: 11pt; line-height: 1.4; margin: 0; padding: 0; color: #000; }
        h1 { font-size: 18pt; font-weight: bold; margin: 0 0 5px 0; border-bottom: 2px solid #000; padding-bottom: 5px; }
        h2 { font-size: 13pt; font-weight: bold; margin: 15px 0 8px 0; border-bottom: 1px solid #ccc; padding-bottom: 3px; text-transform: uppercase; }
        .contact { font-size: 10pt; margin-bottom: 15px; color: #333; }
        .entry { margin-bottom: 12px; }
        .entry-header { display: flex; justify-content: space-between; font-weight: bold; }
        .entry-sub { font-style: italic; }
        .entry-dates { font-weight: normal; }
        ul { margin: 5px 0 0 20px; padding: 0; }
        li { margin-bottom: 3px; }
        .skills-grid { display: flex; flex-wrap: wrap; gap: 10px; }
        .skill-category { font-weight: bold; }
        .skill-list { display: inline; }
    </style>
</head>
<body>
    <h1>${basics.name || 'Applicant'}</h1>
    ${basics.summary ? `<p>${basics.summary}</p>` : ''}
    <div class="contact">
        ${basics.email || ''} ${basics.phone ? '| ' + basics.phone : ''} ${basics.location ? '| ' + (basics.location.city || '') + (basics.location.countryCode ? ', ' + basics.location.countryCode : '') : ''}
        ${basics.profiles && basics.profiles.length > 0 ? '| ' + basics.profiles.map((p: any) => p.network + ': ' + p.url).join(', ') : ''}
    </div>

    ${work.length > 0 ? `
    <h2>Experience</h2>
    ${work.map((w: any) => `
        <div class="entry">
            <div class="entry-header">
                <span>${w.position || ''}</span>
                <span class="entry-dates">${w.startDate || ''} – ${w.endDate === 'Present' ? 'Present' : w.endDate || ''}</span>
            </div>
            <div class="entry-sub">${w.name || ''}</div>
            ${w.highlights && w.highlights.length > 0 ? `<ul>${w.highlights.map((h: string) => `<li>${h}</li>`).join('')}</ul>` : ''}
        </div>
    `).join('')}` : ''}

    ${education.length > 0 ? `
    <h2>Education</h2>
    ${education.map((e: any) => `
        <div class="entry">
            <div class="entry-header">
                <span>${e.studyType || ''}${e.area ? ' in ' + e.area : ''}</span>
                <span class="entry-dates">${e.startDate || ''} – ${e.endDate || ''}</span>
            </div>
            <div class="entry-sub">${e.institution || ''}</div>
        </div>
    `).join('')}` : ''}

    ${skills.length > 0 ? `
    <h2>Skills</h2>
    <div class="skills-grid">
    ${skills.map((s: any) => `
        <div>
            <span class="skill-category">${s.name || ''}:</span>
            <span class="skill-list">${(s.keywords || []).join(', ')}</span>
        </div>
    `).join('')}
    </div>` : ''}

    ${projects.length > 0 ? `
    <h2>Projects</h2>
    ${projects.map((p: any) => `
        <div class="entry">
            <div class="entry-header">
                <span>${p.name || ''}</span>
            </div>
            ${p.description ? `<div>${p.description}</div>` : ''}
            ${p.highlights && p.highlights.length > 0 ? `<ul>${p.highlights.map((h: string) => `<li>${h}</li>`).join('')}</ul>` : ''}
        </div>
    `).join('')}` : ''}

    ${languages.length > 0 ? `
    <h2>Languages</h2>
    <div>
    ${languages.map((l: any) => `${l.language || ''} – ${l.fluency || ''}`).join(', ')}
    </div>` : ''}
</body>
</html>`;
}

async function processCv(filePath: string, outputDir: string) {
    const filename = path.basename(filePath);
    const mimeType = getMimeType(filePath);
    const outPath = path.join(outputDir, `${path.parse(filename).name}.json`);
    const pdfPath = path.join(outputDir, `${path.parse(filename).name}.pdf`);
    const errorPath = path.join(outputDir, `${path.parse(filename).name}.error.txt`);

    console.log(`\n[${new Date().toISOString()}] 📄 Processing: ${filename}`);

    try {
        const genAI = new GoogleGenerativeAI(API_KEY!);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        const parts: Part[] = [
            { text: getPrompt(filename) },
            fileToGenerativePart(filePath, mimeType)
        ];

        console.log(`   🤖 Sending request to Gemini (${MODEL_NAME})...`);
        const startTime = Date.now();
        const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
        const response = result.response;
        const text = response.text();
        const endTime = Date.now();

        console.log(`   ✅ Received response in ${((endTime - startTime) / 1000).toFixed(1)}s`);

        const cvJson = parseJsonResponse(text);
        
        // Save JSON
        fs.writeFileSync(outPath, JSON.stringify(cvJson, null, 2));
        console.log(`   📁 Saved JSON: ${outPath}`);

        // Generate PDF
        console.log(`   🖨️  Generating PDF...`);
        await generatePdfFromJson(cvJson, pdfPath);
        console.log(`   📄 Saved PDF: ${pdfPath}`);

        return { filename, status: 'success', time: ((endTime - startTime) / 1000).toFixed(1) };
    } catch (error: any) {
        const errorMsg = `${filename}: ${error.message}\n`;
        fs.writeFileSync(errorPath, errorMsg);
        console.error(`   ❌ Error: ${error.message}`);
        return { filename, status: 'error', error: error.message };
    }
}

async function main() {
    const inputDir = process.argv[2] || 'C:\\Users\\amrmo\\Downloads\\sample-cvs';
    const outputDir = process.argv[3] || 'C:\\Users\\amrmo\\Downloads\\sample-cvs-results';

    console.log(`📂 Input directory: ${inputDir}`);
    console.log(`📁 Output directory: ${outputDir}`);

    if (!fs.existsSync(inputDir)) {
        console.error(`❌ Input directory not found: ${inputDir}`);
        process.exit(1);
    }

    fs.mkdirSync(outputDir, { recursive: true });

    const files = fs.readdirSync(inputDir)
        .filter(f => /\.(pdf|docx|png|jpg|jpeg|txt|rtf)$/i.test(f))
        .map(f => path.join(inputDir, f));

    if (files.length === 0) {
        console.error('❌ No CV files found in input directory');
        process.exit(1);
    }

    console.log(`\n📊 Found ${files.length} files to process\n`);

    const results: any[] = [];
    for (const file of files) {
        const result = await processCv(file, outputDir);
        results.push(result);
        
        // Add delay between requests to avoid rate limiting
        if (files.indexOf(file) < files.length - 1) {
            console.log('   ⏳ Waiting 3 seconds...');
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    // Summary
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    console.log('\n' + '='.repeat(50));
    console.log('📊 PROCESSING SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total files: ${results.length}`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📁 Results saved to: ${outputDir}`);
    console.log('='.repeat(50));

    if (errorCount > 0) {
        console.log('\n❌ Failed files:');
        results.filter(r => r.status === 'error').forEach(r => {
            console.log(`   - ${r.filename}: ${r.error}`);
        });
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
