import { JsonResumeSchema } from '../types/jsonresume';

export function freeformToJsonResume(cvJson: Record<string, any>): JsonResumeSchema {
    const tags: Record<string, string> = cvJson.__vh_tags || {};
    const result: JsonResumeSchema = {
        basics: { name: '', email: '', phone: '', profiles: [] },
        work: [],
        education: [],
        skills: [],
        languages: [],
        certificates: [],
        projects: [],
    };

    const contactSectionKey = Object.entries(tags)
        .find(([path, tag]) => tag === 'contact_block' && !path.includes('.'))?.[0];

    if (contactSectionKey && typeof cvJson[contactSectionKey] === 'object' && !Array.isArray(cvJson[contactSectionKey])) {
        const contact = cvJson[contactSectionKey] as Record<string, string>;
        for (const [field, value] of Object.entries(contact)) {
            const tagPath = `${contactSectionKey}.${field}`;
            const fieldTag = tags[tagPath];
            if (typeof value !== 'string') continue;

            if (fieldTag === 'name' || /^name$/i.test(field)) result.basics!.name = value;
            else if (fieldTag === 'email' || /email/i.test(field)) result.basics!.email = value;
            else if (fieldTag === 'phone' || /phone|mobile|tel/i.test(field)) result.basics!.phone = value;
            else if (fieldTag === 'location' || /location|city|address|ort|wohnort/i.test(field)) {
                result.basics!.location = { city: value };
            }
            else if (fieldTag === 'linkedin' || /linkedin/i.test(field)) {
                result.basics!.profiles = [...(result.basics!.profiles || []), { network: 'LinkedIn', url: value, username: value }];
            }
            else if (fieldTag === 'github' || /github/i.test(field)) {
                result.basics!.profiles = [...(result.basics!.profiles || []), { network: 'GitHub', url: value, username: value }];
            }
        }
    }

    for (const [sectionKey, sectionValue] of Object.entries(cvJson)) {
        if (sectionKey === '__vh_tags' || sectionKey === contactSectionKey) continue;
        if (!Array.isArray(sectionValue)) {
            if (typeof sectionValue === 'string' && /summary|profil|about|über/i.test(sectionKey)) {
                result.basics!.summary = sectionValue;
            }
            continue;
        }

        const isWorkSection = /erfahrung|work|experience|beschäftigung|tätigkei/i.test(sectionKey);
        const isEducationSection = /ausbildung|education|school|studium|universität/i.test(sectionKey);
        const isSkillSection = /skill|kenntnis|kompetenz|fähigkeit|it-erfahr|technical/i.test(sectionKey);
        const isLanguageSection = /sprach|language/i.test(sectionKey);
        const isCertSection = /certif|zertif|weiterbildung/i.test(sectionKey);
        const isProjectSection = /project|projekt/i.test(sectionKey);

        if (isWorkSection) {
            for (const entry of sectionValue) {
                if (typeof entry !== 'object' || !entry) continue;
                result.work!.push({
                    name: entry.subtitle || entry.company || entry.employer || '',
                    position: entry.title || entry.role || entry.position || '',
                    startDate: extractStartDate(entry.dates),
                    endDate: extractEndDate(entry.dates),
                    highlights: normalizeBullets(entry.bullets),
                    summary: typeof entry.content === 'string' ? entry.content : undefined,
                });
            }
        } else if (isEducationSection) {
            for (const entry of sectionValue) {
                if (typeof entry !== 'object' || !entry) continue;
                result.education!.push({
                    institution: entry.subtitle || entry.institution || entry.school || '',
                    studyType: entry.title || entry.degree || '',
                    startDate: extractStartDate(entry.dates),
                    endDate: extractEndDate(entry.dates),
                });
            }
        } else if (isSkillSection) {
            for (const entry of sectionValue) {
                if (typeof entry !== 'object' || !entry) continue;
                const skillName = entry.category || entry.title || entry.name || '';
                const skillContent = entry.content || entry.value || '';
                if (skillName || skillContent) {
                    result.skills!.push({
                        name: skillName,
                        keywords: typeof skillContent === 'string'
                            ? skillContent.split(/[,;]+/).map((s: string) => s.trim()).filter(Boolean)
                            : Array.isArray(skillContent) ? skillContent : [],
                    });
                }
            }
        } else if (isLanguageSection) {
            for (const entry of sectionValue) {
                if (typeof entry !== 'object' || !entry) continue;
                result.languages!.push({
                    language: entry.category || entry.title || entry.language || '',
                    fluency: entry.content || entry.level || entry.fluency || '',
                });
            }
        } else if (isCertSection) {
            for (const entry of sectionValue) {
                if (typeof entry !== 'object' || !entry) continue;
                result.certificates!.push({
                    name: entry.title || entry.name || '',
                    issuer: entry.subtitle || entry.issuer || '',
                    date: entry.dates || entry.date || '',
                });
            }
        } else if (isProjectSection) {
            for (const entry of sectionValue) {
                if (typeof entry !== 'object' || !entry) continue;
                result.projects!.push({
                    name: entry.title || entry.name || '',
                    description: entry.subtitle || entry.content || '',
                    highlights: normalizeBullets(entry.bullets),
                });
            }
        }
    }

    return result;
}

function normalizeBullets(bullets: unknown): string[] {
    if (Array.isArray(bullets)) return bullets.filter((b): b is string => typeof b === 'string');
    if (typeof bullets === 'string') return bullets.split('\n').map(s => s.trim()).filter(Boolean);
    return [];
}

function extractStartDate(dates: unknown): string | undefined {
    if (typeof dates !== 'string') return undefined;
    const match = dates.match(/(\d{1,2}\/\d{4}|\d{4})/);
    return match ? match[1] : undefined;
}

function extractEndDate(dates: unknown): string | undefined {
    if (typeof dates !== 'string') return undefined;
    const isPresent = /heute|present|current|now|aktuell/i.test(dates);
    if (isPresent) return undefined;
    const matches = [...dates.matchAll(/(\d{1,2}\/\d{4}|\d{4})/g)];
    return matches.length >= 2 ? matches[matches.length - 1][1] : undefined;
}