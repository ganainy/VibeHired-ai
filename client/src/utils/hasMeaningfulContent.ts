export function hasMeaningfulContent(value: unknown): boolean {
    return value !== null && value !== undefined && value !== '' &&
        !(Array.isArray(value) && value.length === 0) &&
        !(typeof value === 'object' && Object.keys(value).length === 0);
}
