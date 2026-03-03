// server/src/utils/apiKeyHelpers.ts
import { NotFoundError } from './errors/AppError';

/**
 * Get Apify API token from server environment
 * @param _userId - Unused: User ID (kept for backward compatibility with existing calls)
 * @returns Apify API token
 * @throws NotFoundError if token is not found in environment
 */
export const getApifyToken = async (_userId?: string): Promise<string> => {
  const apifyToken = process.env.APIFY_API_KEY;

  if (!apifyToken) {
    throw new NotFoundError(
      'Apify API key is not configured on the server. Please contact the administrator.'
    );
  }

  return apifyToken;
};
