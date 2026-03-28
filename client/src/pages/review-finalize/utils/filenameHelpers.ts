export const getPdfFilename = (jobApplication: { companyName: string; jobTitle: string; language: string } | null): string => {
    if (!jobApplication) return 'CV_Export';
    const sanitize = (str: string) => str?.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_') || 'Unknown';
    const companyName = sanitize(jobApplication.companyName);
    const jobTitle = sanitize(jobApplication.jobTitle);
    const docType = (jobApplication.language === 'de') ? 'Lebenslauf' : 'Resume';
    return `${docType}_${companyName}_${jobTitle}`;
};
