import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import { getCvHtml, getCoverLetterHtml } from './pdfTemplates';
import { getCvTemplateHtml, CVTemplate } from './cvTemplates';
import { JsonResumeSchema } from '../types/jsonresume';

// Ensure temp directory exists
const TEMP_PDF_DIR = path.join(__dirname, '..', '..', 'temp_pdfs');

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

const getBrowser = async (): Promise<Browser> => {
    if (!browserInstance) {
        console.log('Launching new Puppeteer browser instance...');
        browserInstance = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
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

// Helper function to generate PDF buffer (used for preview)
export const generateCvPdfBuffer = async (
    cvJsonResumeObject: JsonResumeSchema,
    template: CVTemplate = CVTemplate.HARVARD
): Promise<Buffer> => {
    console.log(`Attempting to generate CV PDF buffer using template: ${template}...`);

    let page: Page | undefined;
    const browser = await getBrowser();

    try {
        const resumeDataForTemplate = prepareResumeData(cvJsonResumeObject);

        // 1. Generate HTML using our new template function
        console.log(`Rendering HTML using template: ${template}...`);
        const htmlContent = getCvTemplateHtml(resumeDataForTemplate, template);

        if (!htmlContent || typeof htmlContent !== 'string' || htmlContent.trim().length < 100) {
            throw new Error(`Internal template rendered empty or invalid HTML.`);
        }
        console.log(`HTML rendered successfully`);

        // 2. Generate PDF using Puppeteer and return buffer
        console.log(`Generating PDF buffer...`);
        page = await browser.newPage();
        await page.goto('about:blank', { waitUntil: 'networkidle0' });
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfOptions = {
            format: 'A4' as const,
            printBackground: true,
            margin: { top: '25px', right: '25px', bottom: '25px', left: '25px' },
        };
        const pdfUint8Array = await page.pdf(pdfOptions);
        // Convert Uint8Array to Buffer
        const pdfBuffer = Buffer.from(pdfUint8Array);
        console.log(`CV PDF buffer generated successfully`);
        return pdfBuffer;

    } catch (error: any) {
        console.error(`Error generating CV PDF buffer:`, error);
        throw new Error(`CV PDF generation failed: ${error.message || error}`);
    } finally {
        if (page) {
            try { await page.close(); } catch (closeError) { console.error(`Error closing page:`, closeError); }
        }
    }
};

export const generateCvPdfFromJsonResume = async (
    cvJsonResumeObject: JsonResumeSchema,
    filenamePrefix: string,
    template: CVTemplate = CVTemplate.HARVARD
): Promise<string> => {
    await ensureDirExists(TEMP_PDF_DIR);
    console.log(`Attempting to generate CV PDF using template: ${template}...`);

    const browser = await getBrowser();
    const uniqueFilename = `${filenamePrefix}.pdf`;
    const filePath = path.join(TEMP_PDF_DIR, uniqueFilename);

    try {
        const resumeDataForTemplate = prepareResumeData(cvJsonResumeObject);

        // 1. Generate HTML using our new template function
        console.log(`Rendering HTML using template: ${template}...`);
        const htmlContent = getCvTemplateHtml(resumeDataForTemplate, template);

        if (!htmlContent || typeof htmlContent !== 'string' || htmlContent.trim().length < 100) {
            throw new Error(`Internal template rendered empty or invalid HTML.`);
        }
        console.log(`HTML rendered successfully`);

        // 2. Generate PDF using Puppeteer
        console.log(`Generating PDF for: ${uniqueFilename}`);
        const page = await browser.newPage();
        await page.goto('about:blank', { waitUntil: 'networkidle0' });
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfOptions = {
            path: filePath,
            format: 'A4' as const,
            printBackground: true,
            margin: { top: '25px', right: '25px', bottom: '25px', left: '25px' },
        };
        await page.pdf(pdfOptions);
        await page.close();
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