// server/src/providers/enums.ts
export enum AIProvider {
  GEMINI = 'gemini',
  OPENAI_COMPATIBLE = 'openai_compatible',
}

export class AIProviderHelper {
  /**
   * Convert a string to an AIProvider enum value
   */
  static fromString(value: string): AIProvider {
    const normalized = value.toLowerCase();
    if (normalized === 'gemini') return AIProvider.GEMINI;
    if (normalized === 'openai_compatible' || normalized === 'openai' || normalized === 'glm') return AIProvider.OPENAI_COMPATIBLE;

    const validProviders = Object.values(AIProvider).join(', ');
    throw new Error(
      `Invalid provider: ${value}. Valid providers are: ${validProviders} (aliases: openai, glm)`
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

