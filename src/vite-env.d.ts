/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google OAuth client ID, injected at build time. Optional. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** Google API key (developer key) for the Picker API. Optional. */
  readonly VITE_GOOGLE_API_KEY?: string;
  /** Google Cloud project number for the Picker appId. Optional; falls back
   *  to the numeric prefix of VITE_GOOGLE_CLIENT_ID. */
  readonly VITE_GOOGLE_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
