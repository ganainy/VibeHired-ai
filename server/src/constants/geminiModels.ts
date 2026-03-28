/**
 * Centralised Gemini model identifiers.
 * ─────────────────────────────────────
 * When Google releases a new model, update the constants here and the
 * change propagates everywhere in the codebase automatically.
 *
 * Usage:
 *   import { GEMINI_FLASH, GEMINI_PRO } from '../constants/geminiModels';
 */

/** Primary fast model — used for most tasks (email classification, schedule parsing,CV analysis, etc.) */
export const GEMINI_FLASH = 'gemini-3-flash-preview';

/** Higher-quality model—used for complex generation tasks (cover letters,detailedCVwriting,etc.) */
export const GEMINI_PRO = 'gemini-1.5-pro';

/** Lightweight 1.5-generation flashmodel—kept for high-volume/cost-sensitivebatch operations */
export const GEMINI_FLASH_LITE = 'gemini-1.5-flash';

/** 8-billion parameter ultra-lightmodel—for the most cost-sensitive tasks */
export const GEMINI_FLASH_8B = 'gemini-1.5-flash-8b';
