import { env } from './env';

const LOCAL_FRONTEND_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
];

const PRODUCTION_FRONTEND_ORIGINS = [
    'https://vibehired.ganainy.dev',
    'https://vibehired-ai.netlify.app',
];

function normalizeOrigin(origin: string): string {
    return origin.trim().replace(/\/+$/, '');
}

function dedupeOrigins(origins: string[]): string[] {
    return Array.from(new Set(origins.map(normalizeOrigin).filter(Boolean)));
}

export function getConfiguredFrontendOrigins(): string[] {
    return dedupeOrigins((env.FRONTEND_URL ?? '').split(','));
}

export function getAllowedFrontendOrigins(): string[] {
    return dedupeOrigins([
        ...getConfiguredFrontendOrigins(),
        ...PRODUCTION_FRONTEND_ORIGINS,
        ...LOCAL_FRONTEND_ORIGINS,
    ]);
}

export function getPrimaryFrontendUrl(): string {
    return getConfiguredFrontendOrigins()[0] ?? LOCAL_FRONTEND_ORIGINS[0];
}