export const getStoredValue = (key: string, jobId: string | undefined): string => {
    if (!jobId) return '';
    try {
        return localStorage.getItem(`${key}_${jobId}`) || '';
    } catch (e) {
        console.error(`Error reading ${key} from localStorage`, e);
        return '';
    }
};

export const setStoredValue = (key: string, jobId: string | undefined, value: string): void => {
    if (!jobId) return;
    try {
        localStorage.setItem(`${key}_${jobId}`, value);
    } catch (e) {
        console.error(`Error saving ${key} to localStorage`, e);
    }
};
