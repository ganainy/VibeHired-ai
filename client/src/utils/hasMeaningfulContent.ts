export function hasMeaningfulContent(value: unknown): boolean {
    if (value === null || value === undefined) return false;

    if (typeof value === 'string') {
        return value.trim().length > 0;
    }

    if (Array.isArray(value)) {
        return value.some((item) => hasMeaningfulContent(item));
    }

    if (typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).some((item) => hasMeaningfulContent(item));
    }

    return true;
}
