/**
 * Google Identity Services (GIS) OAuth for the web app. Requests the
 * `drive.file`, `userinfo.email`, and `userinfo.profile` scopes, exchanges the
 * access token for the signed-in user's profile, and persists the session in
 * localStorage so a reload keeps the user signed in.
 *
 * All token handling stays in the browser; nothing is sent to our own server.
 */

import type {
  GisTokenClient,
  GisTokenRequestOverrides,
  GisTokenResponse,
} from './googleIdentity';
import { resolveClientId } from './clientIdStore';
import {
  clearSession,
  isSessionValid,
  readSession,
  saveSession,
  type GoogleProfile,
} from './authStorage';

/** The OAuth scopes this app requests. */
export const OAUTH_SCOPES = [
  // Per-file Drive access: the app's own docs + any file picked via the
  // Picker (which must be configured with setAppId for the grant to stick).
  'https://www.googleapis.com/auth/drive.file',
  // Read/append picked Google Docs through the Docs API (documents.get /
  // documents.batchUpdate); without this the token is rejected on
  // docs.googleapis.com with 401 CREDENTIALS_MISSING.
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
].join(' ');

const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export interface GoogleUser {
  accessToken: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

/** True once the GIS script has loaded and exposed `google.accounts.oauth2`. */
export function isGisReady(): boolean {
  return Boolean(window.google?.accounts?.oauth2);
}

/**
 * Best-effort fetch of the signed-in user's profile. Returns empty fields
 * instead of throwing, so a granted token still counts as a successful
 * sign-in even if the profile lookup is unavailable.
 */
async function fetchProfile(accessToken: string): Promise<GoogleProfile> {
  try {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { email: null, name: null, picture: null };
    const body = (await res.json()) as { email?: string; name?: string; picture?: string };
    return {
      email: body.email ?? null,
      name: body.name ?? null,
      picture: body.picture ?? null,
    };
  } catch {
    return { email: null, name: null, picture: null };
  }
}

/**
 * Acquire an access token via GIS. `prompt: 'consent'` forces the consent UI
 * (first interactive sign-in); `prompt: ''` attempts a silent grant that only
 * succeeds when the user already has an active Google session + prior grant.
 */
function requestToken(prompt: GisTokenRequestOverrides['prompt']): Promise<GisTokenResponse> {
  return new Promise((resolve, reject) => {
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) {
      reject(new Error('Google sign-in is still loading. Try again shortly.'));
      return;
    }

    const clientId = resolveClientId();
    if (!clientId) {
      reject(new Error('No Google client ID configured.'));
      return;
    }

    const client: GisTokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: OAUTH_SCOPES,
      callback: (response: GisTokenResponse) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description ?? response.error ?? 'Sign-in failed.'));
          return;
        }
        resolve(response);
      },
      error_callback: (error) => {
        // `interaction_required` means the silent path needs the user; the
        // caller decides whether to fall back to an interactive prompt.
        reject(new Error(error.type ?? error.message ?? 'Sign-in was cancelled.'));
      },
    });

    client.requestAccessToken(prompt === undefined ? undefined : { prompt });
  });
}

/** Exchange a token response for a GoogleUser and persist the session. */
async function completeSignIn(response: GisTokenResponse): Promise<GoogleUser> {
  const profile = await fetchProfile(response.access_token);
  saveSession({
    accessToken: response.access_token,
    expiresAt: Date.now() + response.expires_in * 1000,
    profile,
  });
  return { accessToken: response.access_token, ...profile };
}

/** Interactive sign-in: show the consent UI, then persist the session. */
export async function signIn(): Promise<GoogleUser> {
  const response = await requestToken('consent');
  return completeSignIn(response);
}

/**
 * Show Google's account chooser so the user can pick a different account,
 * then persist the new session over the old one. The previous token is
 * deliberately NOT revoked: revoking an access token can revoke the whole
 * grant, which would invalidate the new token if the same account is chosen.
 */
export async function switchAccount(): Promise<GoogleUser> {
  const response = await requestToken('select_account');
  return completeSignIn(response);
}

/**
 * Attempt a silent token refresh (no consent UI). Resolves with a fresh
 * GoogleUser when GIS can renew the grant, or rejects with
 * `interaction_required` when the user must sign in interactively.
 */
export async function silentRefresh(): Promise<GoogleUser> {
  const response = await requestToken('');
  return completeSignIn(response);
}

/** True when a persisted session exists (valid or expired), for restore retries. */
export function hasStoredSession(): boolean {
  return readSession() !== null;
}

/**
 * Restore the signed-in user on app mount / reload:
 *   1. If a stored token is still valid (with a 60s buffer), use it as-is.
 *   2. If it's expired, attempt a silent refresh.
 *   3. Otherwise return null so the UI shows the sign-in button.
 *
 * localStorage is only cleared on explicit sign-out or when a silent refresh
 * fails — never merely because a token expired.
 */
export async function restoreSession(): Promise<GoogleUser | null> {
  const stored = readSession();
  if (isSessionValid(stored)) {
    return { accessToken: stored.accessToken, ...stored.profile };
  }
  if (!stored) return null;

  // Stored but expired: try a silent refresh before giving up.
  try {
    return await silentRefresh();
  } catch {
    return null;
  }
}

/** Revoke the token, clear the persisted session, and forget the user. */
export function signOut(accessToken: string): Promise<void> {
  return new Promise((resolve) => {
    clearSession();
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2 || !accessToken) {
      resolve();
      return;
    }
    oauth2.revoke(accessToken, () => resolve());
  });
}
