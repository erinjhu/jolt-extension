/**
 * Minimal ambient types for the Google Identity Services (GIS) token client,
 * covering only the OAuth surface this app uses. Loaded from the GIS script
 * tag in `index.html`, so no npm dependency is required.
 */

export interface GisTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

export interface GisTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GisTokenResponse) => void;
  error_callback?: (error: { type: string; message?: string }) => void;
}

export interface GisTokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}

interface GoogleOauth2 {
  initTokenClient: (config: GisTokenClientConfig) => GisTokenClient;
  revoke: (accessToken: string, done?: () => void) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: GoogleOauth2;
      };
    };
  }
}
