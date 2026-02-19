// server/src/utils/htmlCleaner.ts
import * as cheerio from 'cheerio';

/**
 * Cleans and optimizes HTML content for AI processing by:
 * 1. Removing noise (scripts, styles, navigation, ads, etc.)
 * 2. Extracting main content areas
 * 3. Preserving important semantic structure
 * 4. Intelligently truncating if still too large
 */
export function cleanHtmlForAi(htmlContent: string, maxLength: number = 100000): string {
    try {
        const $ = cheerio.load(htmlContent);

        // Remove completely unnecessary elements
        $('script, style, noscript, iframe, embed, object, svg, canvas').remove();
        
        // Remove comments
        $.root().find('*').contents().filter(function(this: any) {
            // Check if this is a comment node by accessing the type property
            return this.type === 'comment';
        }).remove();

        // Remove common navigation and non-content elements
        $('nav, header, footer, aside, .nav, .navigation, .navbar, .header, .footer, .sidebar, .side-bar').remove();
        
        // Remove common ad containers and tracking elements
        $('.ad, .ads, .advertisement, .advert, [class*="ad-"], [id*="ad-"], .tracking, .analytics, .cookie-banner, .cookie-consent').remove();
        
        // Remove social media widgets and share buttons
        $('.social, .social-media, .share, .share-buttons, [class*="social"], [class*="share"]').remove();
        
        // Remove forms (application forms, newsletter signups, etc.) - but keep their text content if needed
        // We'll be more selective - remove forms that are likely not job description content
        $('form').each(function(this: any) {
            const form = $(this);
            // Keep forms that might contain job description, remove others
            const formText = form.text().toLowerCase();
            if (!formText.includes('apply') && !formText.includes('application') && 
                !formText.includes('job') && !formText.includes('position')) {
                form.remove();
            }
        });

        // Try to find and prioritize main content areas
        // Common selectors for main content
        const mainContentSelectors = [
            'main',
            'article',
            '[role="main"]',
            '.main-content',
            '.content',
            '.job-description',
            '.job-details',
            '.job-posting',
            '[class*="job"]',
            '[id*="job"]',
            '.description',
            '.post-content',
            '.entry-content'
        ];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let mainContent: any = $('body');
        let foundMainContent = false;

        // Try to find a main content container
        for (const selector of mainContentSelectors) {
            const candidate = $(selector).first();
            if (candidate.length > 0 && candidate.text().trim().length > 200) {
                mainContent = candidate;
                foundMainContent = true;
                console.log(`Found main content using selector: ${selector}`);
                break;
            }
        }

        // If we found main content, extract just that; otherwise use cleaned body
        let cleanedHtml: string;
        if (foundMainContent) {
            // Extract just the main content area
            cleanedHtml = mainContent.html() || '';
        } else {
            // Clean up the body content
            cleanedHtml = $('body').html() || '';
        }

        // If cleaned HTML is still too large, intelligently truncate
        if (cleanedHtml.length > maxLength) {
            console.warn(`HTML content still large (${cleanedHtml.length} chars) after cleaning. Intelligently truncating to ${maxLength} characters.`);
            
            // Parse again to truncate more intelligently
            const $truncated = cheerio.load(cleanedHtml);
            const elements = $truncated('body').find('*').toArray();
            
            // Try to keep the beginning content (usually most important)
            // Remove elements from the end until we're under the limit
            let truncatedHtml = cleanedHtml;
            let removedCount = 0;
            
            // Remove elements from the end, but keep at least the first 80% of content
            const minKeepLength = Math.floor(maxLength * 0.8);
            
            for (let i = elements.length - 1; i >= 0 && truncatedHtml.length > maxLength; i--) {
                const element = elements[i];
                const $el = $truncated(element);
                
                // Don't remove if we're already below minimum keep length
                if (truncatedHtml.length <= minKeepLength) {
                    break;
                }
                
                // Skip if this element is likely important (has job-related keywords)
                const elementText = $el.text().toLowerCase();
                const hasJobKeywords = /job|position|role|responsibilit|qualification|requirement|skill|experience|education/i.test(elementText);
                
                if (!hasJobKeywords && $el.text().trim().length < 100) {
                    $el.remove();
                    truncatedHtml = $truncated('body').html() || '';
                    removedCount++;
                }
            }
            
            // If still too large, do a simple truncation but keep the beginning
            if (truncatedHtml.length > maxLength) {
                console.warn(`Still too large after intelligent removal. Truncating from end, keeping first ${maxLength} characters.`);
                truncatedHtml = truncatedHtml.substring(0, maxLength);
                // Try to end at a reasonable point (not mid-tag)
                const lastTagEnd = truncatedHtml.lastIndexOf('>');
                if (lastTagEnd > maxLength * 0.95) {
                    truncatedHtml = truncatedHtml.substring(0, lastTagEnd + 1);
                }
            }
            
            cleanedHtml = truncatedHtml;
            console.log(`Removed ${removedCount} elements during intelligent truncation. Final length: ${cleanedHtml.length}`);
        }

        const originalLength = htmlContent.length;
        const cleanedLength = cleanedHtml.length;
        const reductionPercent = ((originalLength - cleanedLength) / originalLength * 100).toFixed(1);
        
        console.log(`HTML cleaned: ${originalLength} → ${cleanedLength} chars (${reductionPercent}% reduction)`);
        
        return cleanedHtml;
    } catch (error: any) {
        console.error('Error cleaning HTML, falling back to simple truncation:', error.message);
        // Fallback to simple truncation if cleaning fails
        if (htmlContent.length > maxLength) {
            return htmlContent.substring(0, maxLength);
        }
        return htmlContent;
    }
}

