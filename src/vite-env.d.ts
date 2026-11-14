/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google OAuth client ID, injected at build time. Optional. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Google API key (developer key) for the Picker API. Optional. */
  readonly VITE_GOOGLE_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
