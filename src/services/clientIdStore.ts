/**
 * Resolves and persists the Google OAuth client ID. The build-time value
 * comes from `VITE_GOOGLE_CLIENT_ID`; a user-supplied override is stored in
 * `localStorage` so a client ID can be tested without rebuilding the app.
 */

const STORAGE_KEY = 'jolt.googleClientId';

/** Client ID baked in at build time via Vite env, or empty if unset. */
const envClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();

/** Returns the saved override from localStorage, or empty string. */
export function getStoredClientId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

/** Persists (or clears, when blank) the user-supplied client ID override. */
export function setStoredClientId(clientId: string): void {
  const trimmed = clientId.trim();
  try {
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures (e.g. private mode); env value still applies.
  }
}

/** The effective client ID: a stored override wins over the env value. */
export function resolveClientId(): string {
  return getStoredClientId() || envClientId;
}
