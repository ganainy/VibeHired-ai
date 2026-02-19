import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// 1. Load environment variables
// Try current folder (for when running from server root) then scripts folder
const envPath = fs.existsSync(path.join(process.cwd(), '.env')) 
    ? path.join(process.cwd(), '.env')
    : path.resolve(__dirname, '../.env');

dotenv.config({ path: envPath });

const API_KEY = process.env.GEMINI_API_KEY;
// Updated to use Gemini 3 Flash
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-2.0-flash'; 

if (!API_KEY) {
    console.error('Error: GEMINI_API_KEY not found in .env');
    console.log('Checked path:', envPath);
    process.exit(1);
}

// 2. Extraction Prompt - EXACT COPY from server/src/routes/cvs.ts (as of Feb 2026)
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

**basics.profiles**
- ONLY extract profile URLs that contain a real, specific path (e.g. "https://linkedin.com/in/username" or "https://github.com/username").
- NEVER include generic placeholder URLs (e.g. "https://linkedin.com/", "https://github.com/", "https://www.portfolio.com/").
- If the CV shows a platform icon or label but no real URL, omit that profile entirely.

**General rules**
- Parse the ENTIRE document — do not skip any section.
- NEVER include section heading labels (e.g. "Skills & Technologies", "Berufserfahrung") as field values.
- Format all dates as YYYY-MM or YYYY. Use "Present" for ongoing. Omit date fields that are not found.
- If an entire section is absent from the CV, omit that top-level key entirely.
- If a specific field is not found, omit it (do not set to null or empty string unless required).
- **DO NOT include any JavaScript/JSON comments (// or /* */) anywhere in the output.**

=== OUTPUT FORMAT ===
Return ONLY a single valid JSON object enclosed in triple backticks (\`\`\`json ... \`\`\`).
No text, explanation, or commentary before or after the JSON block.
`;

// Helper: Convert file to Gemini Part
function fileToGenerativePart(filePath: string, mimeType: string): Part {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(filePath)).toString('base64'),
            mimeType,
        },
    };
}

// Helper: Map extension to MIME type
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

// Helper: Parse JSON from AI response
function parseJsonResponse(responseText: string): any {
    const jsonRegex = /```json\s*([\s\S]*?)\s*```/;
    const jsonMatch = responseText.match(jsonRegex);
    if (jsonMatch && jsonMatch[1]) {
        return JSON.parse(jsonMatch[1].trim());
    }
    throw new Error('AI failed to return valid JSON block.');
}

async function runTest() {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('\nUsage: npx ts-node scripts/test-cv-extraction.ts <path/to/cv.pdf>');
        console.error('Example: npx ts-node scripts/test-cv-extraction.ts ../temp_uploads/my_cv.pdf\n');
        process.exit(1);
    }

    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    
    if (!fs.existsSync(absolutePath)) {
        console.error(`File not found: ${absolutePath}`);
        process.exit(1);
    }

    const filename = path.basename(absolutePath);
    const mimeType = getMimeType(absolutePath);

    console.log(`\n📄 Processing: ${filename}`);
    console.log(`🛠️ MIME Type: ${mimeType}`);
    console.log(`🧠 AI Model: ${MODEL_NAME}`);
    
    try {
        const genAI = new GoogleGenerativeAI(API_KEY!);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        const parts: Part[] = [
            { text: getPrompt(filename) },
            fileToGenerativePart(absolutePath, mimeType)
        ];

        console.log('🤖 Sending request to Gemini... (please wait)');
        const startTime = Date.now();
        const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
        const response = result.response;
        const text = response.text();
        const endTime = Date.now();
        
        console.log(`✅ Received response in ${((endTime - startTime) / 1000).toFixed(1)}s`);

        try {
            const cvJson = parseJsonResponse(text);
            console.log('\n--- EXTRACTED JSON RESUME ---\n');
            console.log(JSON.stringify(cvJson, null, 2));
            console.log('\n-----------------------------\n');
            
            // Save to file automatically
            const outPath = absolutePath + '.json';
            fs.writeFileSync(outPath, JSON.stringify(cvJson, null, 2));
            console.log(`📁 Saved JSON output to: ${outPath}\n`);

        } catch (parseErr: any) {
            console.error('❌ Failed to parse JSON from AI response.');
            console.log('\n--- RAW AI RESPONSE ---\n');
            console.log(text);
            console.log('\n-----------------------\n');
        }
        
    } catch (error: any) {
        console.error('\n❌ Extraction Failed:', error.message);
    }
}

runTest();
