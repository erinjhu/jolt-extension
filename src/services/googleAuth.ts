/**
 * Google Identity Services (GIS) OAuth for the web app. Requests ONLY the
 * `drive.file` and `userinfo.email` scopes, exchanges the access token for the
 * signed-in user's email, and exposes sign-in / sign-out helpers.
 *
 * All token handling stays in the browser; nothing is sent to our own server.
 */

import type { GisTokenClient, GisTokenResponse } from './googleIdentity';
import { resolveClientId } from './clientIdStore';

/** The only OAuth scopes this app ever requests. */
export const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export interface GoogleUser {
  email: string;
  accessToken: string;
}

/** True once the GIS script has loaded and exposed `google.accounts.oauth2`. */
export function isGisReady(): boolean {
  return Boolean(window.google?.accounts?.oauth2);
}

/** Fetch the signed-in user's email using the granted access token. */
async function fetchUserEmail(accessToken: string): Promise<string> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Could not read Google profile (HTTP ${res.status}).`);
  }
  const body = (await res.json()) as { email?: string };
  if (!body.email) {
    throw new Error('Google profile did not include an email address.');
  }
  return body.email;
}

/**
 * Launch the Google consent flow and resolve with the user's email + token.
 * Rejects when GIS is unavailable, no client ID is configured, or the user
 * dismisses or denies the consent screen.
 */
export function signIn(): Promise<GoogleUser> {
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
        fetchUserEmail(response.access_token)
          .then((email) => resolve({ email, accessToken: response.access_token }))
          .catch(reject);
      },
      error_callback: (error) => {
        reject(new Error(error.message ?? 'Sign-in was cancelled.'));
      },
    });

    client.requestAccessToken({ prompt: 'consent' });
  });
}

/** Revoke the access token so the next sign-in starts fresh. */
export function signOut(accessToken: string): Promise<void> {
  return new Promise((resolve) => {
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2 || !accessToken) {
      resolve();
      return;
    }
    oauth2.revoke(accessToken, () => resolve());
  });
}
