import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Validate a CV file for upload
 */
export function validateCvFile(file: File): { isValid: boolean; errorMessage?: string; extension?: string } {
  const allowedTypes = [
    'application/pdf',
    'application/rtf',
    'text/rtf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain'
  ];

  const allowedExtensions = ['.pdf', '.rtf', '.docx', '.doc', '.txt'];

  const maxFileSize = 10 * 1024 * 1024; // 10MB
  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

  // Check file size
  if (file.size > maxFileSize) {
    return {
      isValid: false,
      errorMessage: `File too large (${formatFileSize(file.size)}). Maximum size is 10MB.`,
    };
  }

  // Check if file is empty
  if (file.size === 0) {
    return {
      isValid: false,
      errorMessage: 'The selected file is empty. Please choose a valid CV file.',
    };
  }

  // Check file type
  if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
    const actualExtension = file.name.split('.').pop()?.toUpperCase() || 'unknown';
    return {
      isValid: false,
      errorMessage: `Invalid file type (.${actualExtension}). Please upload a PDF, DOCX, or RTF file.`,
    };
  }

  return {
    isValid: true,
    extension: fileExtension,
  };
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Parse multiple URLs from a string (separated by newlines or commas)
 * Returns an array of trimmed, validated URLs
 */
export function parseMultipleUrls(urlString: string): string[] {
  if (!urlString || !urlString.trim()) return [];
  
  // Split by newlines and commas
  const urls = urlString
    .split(/[\n,]+/)
    .map(url => url.trim())
    .filter(url => url.length > 0);
  
  return urls;
}

/**
 * Format multiple URLs into a newline-separated string
 */
export function formatMultipleUrls(urls: string[]): string {
  return urls.filter(url => url && url.trim()).join('\n');
}

/**
 * Check if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  try {
    new URL(url);
    return true;
  } catch {
    // Try adding https:// if missing
    try {
      new URL('https://' + url.replace(/^https?:\/\//, ''));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Normalize a URL (add https:// if missing)
 */
export function normalizeUrl(url: string): string {
  if (!url || !url.trim()) return '';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return 'https://' + trimmed;
}

/**
 * Normalize multiple URLs in a string
 */
export function normalizeMultipleUrls(urlString: string): string {
  const urls = parseMultipleUrls(urlString);
  const normalizedUrls = urls.map(normalizeUrl);
  return formatMultipleUrls(normalizedUrls);
}

