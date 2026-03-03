// server/src/services/scrapers/AIScraper.ts
import axios from 'axios';
import { generateContent } from '../../utils/aiService';
import { cleanHtmlForAi } from '../../utils/htmlCleaner';
import { IScraper } from '../../interfaces/scraper.interface';

/**
 * AI-based scraper that uses Gemini to extract job descriptions from HTML
 */
export class AIScraper implements IScraper {
    /**
     * Fetch HTML content from a URL
     */
    private async fetchHtml(url: string): Promise<string> {
        console.log(`Fetching HTML for: ${url}`);
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml',
                    'Accept-Language': 'en-US,en',
                },
                timeout: 15000
            });
            if (response.status !== 200) {
                throw new Error(`Failed to fetch URL: Status ${response.status}`);
            }
            if (!response.data || typeof response.data !== 'string' || !response.data.toLowerCase().includes('<html')) {
                throw new Error('Response did not appear to be valid HTML content.');
            }
            console.log(`Successfully fetched HTML (length: ${response.data.length})`);
            return response.data;
        } catch (error: any) {
            console.error(`Error fetching URL ${url}:`, error.message);
            throw new Error(`Could not fetch content from URL. ${error.message}`);
        }
    }

    /**
     * Extract job description using the user's configured AI provider
     */
    private async extractDescriptionWithAI(htmlContent: string, url: string, userId: string): Promise<string | null> {
        console.log(`Requesting AI to extract description from HTML (length: ${htmlContent.length}) for URL: ${url}`);

        const maxHtmlLength = 100000;
        htmlContent = cleanHtmlForAi(htmlContent, maxHtmlLength);

        const prompt = `
        Analyze the following HTML source code from the webpage URL "${url}".
        Your task is to extract the main job description text. Ignore navigation menus, sidebars, headers, footers, ads, related job links, and application forms.
        Focus solely on the section detailing the responsibilities, qualifications, requirements, and details about the specific job role being advertised.
        Return ONLY the extracted job description text as plain text. Do not include any introductory phrases like "Here is the job description:". Just return the text itself. If no clear job description is found, return the string "NO_DESCRIPTION_FOUND".

        HTML Source Code:
        ---
        ${htmlContent}
        ---
    `;

        try {
            const result = await generateContent(userId, prompt);
            const extractedText = result.text?.trim();

            if (extractedText && extractedText !== "NO_DESCRIPTION_FOUND" && extractedText.length > 50) {
                console.log(`AI extracted description (length: ${extractedText.length})`);
                return extractedText.replace(/\n\s*\n/g, '\n');
            } else {
                console.warn("AI did not find a suitable job description or returned 'NO_DESCRIPTION_FOUND'.");
                return null;
            }
        } catch (error: any) {
            console.error("Error during AI description extraction:", error);
            // Handle various AI provider errors generically
            if (error.message) {
                if (error.message.includes('blocked') || error.message.includes('content policy')) {
                    throw new Error(`AI content generation blocked during extraction: ${error.message}`);
                }
            }
            throw new Error(`Failed to get valid extraction response from AI service: ${error.message || 'Unknown error'}`);
        }
    }

    /**
     * Scrape job description from a URL using the user's configured AI provider
     */
    async scrapeJobDescription(url: string, userId: string): Promise<string> {
        console.log(`Starting AI-powered scrape for URL: ${url}`);
        if (!url || !url.startsWith('http')) {
            throw new Error("Invalid or missing URL provided for scraping.");
        }

        const html = await this.fetchHtml(url);
        const description = await this.extractDescriptionWithAI(html, url, userId);

        if (!description) {
            throw new Error("AI could not extract a valid job description from the page content.");
        }

        return description;
    }
}

