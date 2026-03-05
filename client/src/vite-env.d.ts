/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_BACKEND_URL: string;
    /** Set to "false" to disable Stripe payment flows (e.g. before launch). Default: enabled. */
    readonly VITE_PAYMENTS_ENABLED: string;
    readonly VITE_COMPANION_DOWNLOAD_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
