// server/src/providers/enums.ts
export enum AIProvider {
  GEMINI = 'gemini',
}

export class AIProviderHelper {
  /**
   * Convert a string to an AIProvider enum value
   */
  static fromString(value: string): AIProvider {
    const normalized = value.toLowerCase();
    if (normalized === 'gemini') return AIProvider.GEMINI;

    const validProviders = Object.values(AIProvider).join(', ');
    throw new Error(
      `Invalid provider: ${value}. Valid providers are: ${validProviders}`
    );
  }

  /**
   * Check if a string is a valid provider name
   */
  static isValid(value: string): boolean {
    try {
      this.fromString(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all provider names as strings
   */
  static getAllNames(): string[] {
    return Object.values(AIProvider);
  }
}

