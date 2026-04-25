import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import { getCoverLetterHtml } from './pdfTemplates';
import { renderAtsCvHtml, AtsTemplateOptions } from './atsTemplate';
import { JsonResumeSchema } from '../types/jsonresume';

// Ensure temp directory exists
const TEMP_PDF_DIR = path.join(__dirname, '..', '..', 'temp_pdfs');

// Font directory for ATS template
const FONTS_DIR = path.join(__dirname, '..', 'assets', 'fonts');

/**
 * Normalize text for ATS compatibility by converting problematic Unicode.
 * Ported from career-ops generate-pdf.mjs
 * Only touches body text — preserves CSS, JS, tag attributes, and URLs.
 */
function normalizeTextForATS(html: string): { html: string; replacements: Record<string, number> } {
    const replacements: Record<string, number> = {};
    const bump = (key: string, n: number) => { replacements[key] = (replacements[key] || 0) + n; };

    const masks: string[] = [];
    const masked = html.replace(
        /<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi,
        (match) => {
            const token = `\u0000MASK${masks.length}\u0000`;
            masks.push(match);
            return token;
        }
    );

    let out = '';
    let i = 0;
    while (i < masked.length) {
        const lt = masked.indexOf('<', i);
        if (lt === -1) { out += sanitizeText(masked.slice(i)); break; }
        out += sanitizeText(masked.slice(i, lt));
        const gt = masked.indexOf('>', lt);
        if (gt === -1) { out += masked.slice(lt); break; }
        out += masked.slice(lt, gt + 1);
        i = gt + 1;
    }

    const restored = out.replace(/\u0000MASK(\d+)\u0000/g, (_, n) => masks[Number(n)]);
    return { html: restored, replacements };

    function sanitizeText(text: string): string {
        if (!text) return text;
        let t = text;
        t = t.replace(/\u2014/g, () => { bump('em-dash', 1); return '-'; });
        t = t.replace(/\u2013/g, () => { bump('en-dash', 1); return '-'; });
        t = t.replace(/[\u201C\u201D\u201E\u201F]/g, () => { bump('smart-double-quote', 1); return '"'; });
        t = t.replace(/[\u2018\u2019\u201A\u201B]/g, () => { bump('smart-single-quote', 1); return "'"; });
        t = t.replace(/\u2026/g, () => { bump('ellipsis', 1); return '...'; });
        t = t.replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, () => { bump('zero-width', 1); return ''; });
        t = t.replace(/\u00A0/g, () => { bump('nbsp', 1); return ' '; });
        return t;
    }
}

/**
 * Resolve font paths in HTML to absolute file:// URIs so Puppeteer can load them.
 */
function resolveFontPaths(html: string, fontsDir: string): string {
    return html.replace(
        /url\(['"]?\.\/fonts\//g,
        `url('file://${fontsDir}/`
    );
}

// --- Function to ensure directory exists ---
const ensureDirExists = async (dirPath: string) => {
    try {
        await fs.access(dirPath);
    } catch (error) {
        // Directory does not exist, create it
        try {
            await fs.mkdir(dirPath, { recursive: true });
            console.log(`Created temporary PDF directory: ${dirPath}`);
        } catch (mkdirError) {
            console.error(`Error creating directory ${dirPath}:`, mkdirError);
            throw new Error(`Could not create temp directory: ${mkdirError}`);
        }
    }
};

// --- Function to generate PDF from HTML content ---
let browserInstance: Browser | null = null;

const KNOWN_CHROME_PATHS = [
    '/app/.chrome-for-testing/chrome-linux64/chrome',
    '/app/.apt/usr/bin/google-chrome-stable',
    '/app/.apt/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
];

const resolveChromeExecutablePath = async (): Promise<string | undefined> => {
    const explicitPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.GOOGLE_CHROME_BIN || process.env.CHROME_BIN;
    if (explicitPath) {
        try {
            await fs.access(explicitPath);
            return explicitPath;
        } catch {
            console.warn(`Configured Chrome path does not exist: ${explicitPath}. Falling back to auto-detection.`);
        }
    }

    for (const candidatePath of KNOWN_CHROME_PATHS) {
        try {
            await fs.access(candidatePath);
            return candidatePath;
        } catch {
            continue;
        }
    }

    try {
        const bundledPath = puppeteer.executablePath();
        if (bundledPath) {
            await fs.access(bundledPath);
            return bundledPath;
        }
    } catch {
        // Bundled Chromium may be unavailable in some production environments.
    }

    return undefined;
};

const getBrowser = async (): Promise<Browser> => {
    if (!browserInstance) {
        console.log('Launching new Puppeteer browser instance...');
        const executablePath = await resolveChromeExecutablePath();
        const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-zygote',
            ],
        };

        if (executablePath) {
            launchOptions.executablePath = executablePath;
            console.log(`Using Chromium executable: ${executablePath}`);
        }

        try {
            browserInstance = await puppeteer.launch(launchOptions);
        } catch (error: any) {
            const message = String(error?.message || error || 'Unknown Puppeteer launch error');
            const guidance = 'Puppeteer could not start Chrome. In production, set PUPPETEER_EXECUTABLE_PATH (or GOOGLE_CHROME_BIN) to a valid Chrome binary, or install Chrome via your platform buildpack.';
            throw new Error(`${message}. ${guidance}`);
        }

        browserInstance.on('disconnected', () => {
            console.log('Puppeteer browser disconnected.');
            browserInstance = null;
        });
    }
    return browserInstance;
};

// Helper function to prepare resume data for template
const prepareResumeData = (cvJsonResumeObject: JsonResumeSchema): JsonResumeSchema => {
    const resumeDataForTemplate: JsonResumeSchema = {
        basics: { name: "Applicant", profiles: [], ...cvJsonResumeObject.basics },
        work: Array.isArray(cvJsonResumeObject.work) ? cvJsonResumeObject.work : [],
        education: Array.isArray(cvJsonResumeObject.education) ? cvJsonResumeObject.education : [],
        skills: Array.isArray(cvJsonResumeObject.skills) ? cvJsonResumeObject.skills : [],
        projects: Array.isArray(cvJsonResumeObject.projects) ? cvJsonResumeObject.projects : [],
        languages: Array.isArray(cvJsonResumeObject.languages) ? cvJsonResumeObject.languages : [],
        ...cvJsonResumeObject
    };
    // Ensure basics has minimum content
    if (!resumeDataForTemplate.basics || Object.keys(resumeDataForTemplate.basics).length === 0) {
        resumeDataForTemplate.basics = { name: "Applicant", profiles: [] };
    }
    return resumeDataForTemplate;
};

const prepareHtmlForPuppeteer = (htmlContent: string, useAts: boolean = false): string => {
    let html = htmlContent;

    if (useAts) {
        // Resolve font paths to absolute file:// URIs
        html = resolveFontPaths(html, FONTS_DIR);

        // Normalize text for ATS compatibility
        const normalized = normalizeTextForATS(html);
        html = normalized.html;
        const totalReplacements = Object.values(normalized.replacements).reduce((a, b) => a + b, 0);
        if (totalReplacements > 0) {
            const breakdown = Object.entries(normalized.replacements).map(([k, v]) => `${k}=${v}`).join(', ');
            console.log(`ATS normalization: ${totalReplacements} replacements (${breakdown})`);
        }
    }

    return html;
};

const renderWithPuppeteer = async (
    htmlContent: string,
    pdfOptions: Parameters<Page['pdf']>[0],
    useAts: boolean = false
): Promise<Buffer> => {
    const page = await (await getBrowser()).newPage();
    try {
        const processedHtml = prepareHtmlForPuppeteer(htmlContent, useAts);

        await page.goto('about:blank', { waitUntil: 'networkidle0' });
        await page.setContent(processedHtml, { waitUntil: 'networkidle0' });

        // Wait for fonts to load (important for ATS template)
        if (useAts) {
            await page.evaluate(() => document.fonts.ready);
        }

        const pdfBuffer = await page.pdf(pdfOptions);
        return Buffer.from(pdfBuffer);
    } finally {
        try { await page.close(); } catch { /* ignore */ }
    }
};

// Helper function to generate PDF buffer (used for preview)
export const generateCvPdfBuffer = async (
    cvJsonResumeObject: JsonResumeSchema,
    atsOptions?: AtsTemplateOptions
): Promise<Buffer> => {
    console.log(`Attempting to generate CV PDF buffer using ATS template...`);

    const browser = await getBrowser();

    try {
        const resumeDataForTemplate = prepareResumeData(cvJsonResumeObject);

        let htmlContent: string;
        if (atsOptions) {
            htmlContent = renderAtsCvHtml(resumeDataForTemplate, atsOptions);
        } else {
            htmlContent = renderAtsCvHtml(resumeDataForTemplate, { lang: 'en', pageFormat: 'a4' });
        }

        if (!htmlContent || typeof htmlContent !== 'string' || htmlContent.trim().length < 100) {
            throw new Error(`Internal template rendered empty or invalid HTML.`);
        }
        console.log(`HTML rendered successfully`);

        const pdfOptions = {
                format: (atsOptions?.pageFormat === 'letter' ? 'Letter' : 'A4') as 'Letter' | 'A4',
            printBackground: true,
            margin: { top: '0.6in', right: '0.6in', bottom: '0.6in', left: '0.6in' },
        };

        return renderWithPuppeteer(htmlContent, pdfOptions, !!atsOptions);

    } catch (error: any) {
        console.error(`Error generating CV PDF buffer:`, error);
        throw new Error(`CV PDF generation failed: ${error.message || error}`);
    }
};

export const generateCvPdfFromJsonResume = async (
    cvJsonResumeObject: JsonResumeSchema,
    filenamePrefix: string,
    atsOptions?: AtsTemplateOptions
): Promise<string> => {
    await ensureDirExists(TEMP_PDF_DIR);
    console.log(`Attempting to generate CV PDF using ATS template...`);

    const browser = await getBrowser();
    const uniqueFilename = `${filenamePrefix}.pdf`;
    const filePath = path.join(TEMP_PDF_DIR, uniqueFilename);

    try {
        const resumeDataForTemplate = prepareResumeData(cvJsonResumeObject);

        let htmlContent: string;
        if (atsOptions) {
            htmlContent = renderAtsCvHtml(resumeDataForTemplate, atsOptions);
        } else {
            htmlContent = renderAtsCvHtml(resumeDataForTemplate, { lang: 'en', pageFormat: 'a4' });
        }

        if (!htmlContent || typeof htmlContent !== 'string' || htmlContent.trim().length < 100) {
            throw new Error(`Internal template rendered empty or invalid HTML.`);
        }
        console.log(`HTML rendered successfully`);

        const page = await browser.newPage();
        try {
            const processedHtml = prepareHtmlForPuppeteer(htmlContent, !!atsOptions);

            await page.goto('about:blank', { waitUntil: 'networkidle0' });
            await page.setContent(processedHtml, { waitUntil: 'networkidle0' });

            if (atsOptions) {
                await page.evaluate(() => document.fonts.ready);
            }

            const pdfOptions = {
                path: filePath,
            format: (atsOptions?.pageFormat === 'letter' ? 'Letter' : 'A4') as 'Letter' | 'A4',
                printBackground: true,
                margin: { top: '0.6in', right: '0.6in', bottom: '0.6in', left: '0.6in' },
            };
            await page.pdf(pdfOptions);
        } finally {
            try { await page.close(); } catch { /* ignore */ }
        }

        console.log(`CV PDF saved temporarily to: ${filePath}`);
        return uniqueFilename;

    } catch (error: any) {
        console.error(`Error generating CV PDF ${uniqueFilename}:`, error);
        throw new Error(`CV PDF generation failed: ${error.message || error}`);
    }
};

// --- Generate Cover Letter PDF function ---
export const generateCoverLetterPdf = async (
    coverLetterText: string,
    cvJsonResumeObject: JsonResumeSchema | null,
    filenamePrefix: string
): Promise<string> => {
    await ensureDirExists(TEMP_PDF_DIR);

    let page: Page | undefined;
    const browser = await getBrowser();
    const uniqueFilename = `${filenamePrefix}.pdf`;
    const filePath = path.join(TEMP_PDF_DIR, uniqueFilename);

    try {
        console.log(`Generating Cover Letter PDF for: ${uniqueFilename}`);
        page = await browser.newPage();

        const htmlContent = getCoverLetterHtml(coverLetterText, cvJsonResumeObject || {});

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '40px', right: '40px', bottom: '40px', left: '40px' }
        });

        await fs.writeFile(filePath, pdfBuffer);
        console.log(`Cover Letter PDF saved temporarily to: ${filePath}`);

        return uniqueFilename;

    } catch (error: any) {
        console.error(`Error generating Cover Letter PDF ${uniqueFilename}:`, error);
        throw new Error(`Cover Letter PDF generation failed: ${error.message}`);
    } finally {
        if (page) {
            await page.close();
        }
    }
};

export const closeBrowser = async () => {
    if (browserInstance) {
        console.log('Closing Puppeteer browser instance...');
        await browserInstance.close();
        browserInstance = null;
    }
};