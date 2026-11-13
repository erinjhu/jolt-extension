/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google OAuth client ID, injected at build time. Optional. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
