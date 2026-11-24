/**
 * Persists the Google auth session (token + expiry + profile) in
 * `localStorage` so a page reload keeps the user signed in. All values stay
 * on the device; nothing is sent to our own server.
 */

const STORAGE_KEY = 'jolt.googleSession';

/** Treat a token as expired this many ms early, to avoid edge-of-expiry 401s. */
export const EXPIRY_SAFETY_MS = 60 * 1000;

/** Basic Google profile shown in the UI. */
export interface GoogleProfile {
  email: string | null;
  name: string | null;
  picture: string | null;
}

/** The full persisted session. */
export interface StoredAuthSession {
  accessToken: string;
  /** Absolute expiry as epoch-ms (`Date.now() + expires_in * 1000`). */
  expiresAt: number;
  profile: GoogleProfile;
  /** False when the user left the Drive permission unchecked. Absent on older sessions. */
  hasDriveScope?: boolean;
}

/** Save the session, overwriting any previous one. */
export function saveSession(session: StoredAuthSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage may be unavailable (private mode); sign-in still works in-memory.
  }
}

/** Read the persisted session, or null when absent or malformed. */
export function readSession(): StoredAuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuthSession;
    if (typeof parsed.accessToken !== 'string' || typeof parsed.expiresAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Remove the persisted session (explicit sign-out / failed refresh). */
export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

/** True when `session` still has more than the safety buffer left to live. */
export function isSessionValid(session: StoredAuthSession | null): session is StoredAuthSession {
  return Boolean(session && session.expiresAt - EXPIRY_SAFETY_MS > Date.now());
}
