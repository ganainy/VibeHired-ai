import { env } from './env';

const LOCAL_FRONTEND_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:3000',
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
        ...LOCAL_FRONTEND_ORIGINS,
    ]);
}

export function getPrimaryFrontendUrl(): string {
    return getConfiguredFrontendOrigins()[0] ?? LOCAL_FRONTEND_ORIGINS[0];
}