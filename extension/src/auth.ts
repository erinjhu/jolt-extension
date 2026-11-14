/**
 * Thin, promise-based wrapper around `chrome.identity.getAuthToken`.
 * Keeps OAuth concerns isolated from the Drive query logic.
 */

/**
 * Acquire an OAuth access token for the scopes declared in the manifest
 * (`drive.file`). Set `interactive` to surface the Google consent UI the
 * first time; keep it `false` for silent background refreshes.
 */
export function getAuthToken(interactive: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (result: unknown) => {
      const err = chrome.runtime.lastError;
      // Chrome has returned a bare string historically and an object
      // (`{ token }`) in newer typings — accept either shape defensively.
      const token =
        typeof result === 'string'
          ? result
          : (result as { token?: string } | null)?.token ?? '';

      if (err || !token) {
        reject(new Error(err?.message ?? 'Failed to obtain Google auth token.'));
        return;
      }
      resolve(token);
    });
  });
}

/**
 * Drop a cached token so the next request forces a fresh grant. Used when
 * Drive returns 401, which usually means the token expired or was revoked.
 */
export function removeCachedToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * Fetch the signed-in user's email to confirm identity, given a token.
 * Returns null instead of throwing when the profile can't be read, so a
 * valid token still counts as "signed in" even if the display email is
 * unavailable (e.g. the userinfo scope was not granted on this token).
 */
export async function fetchUserEmail(token: string): Promise<string | null> {
  try {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { email?: string };
    return body.email ?? null;
  } catch {
    return null;
  }
}

/** Result of a successful sign-in / session check. */
export interface AuthSession {
  token: string;
  /** Display email, or null when the profile lookup was unavailable. */
  email: string | null;
}

/**
 * Keys persisted in `chrome.storage.local` so the popup remembers that the
 * user signed in across popup reopens. The popup is a fresh document every
 * time it opens, so without this flag a momentary hiccup in the silent token
 * refresh would wrongly bounce the user back to the sign-in screen.
 */
const AUTH_FLAG_KEY = 'joltAuthConnected';
const AUTH_EMAIL_KEY = 'joltAuthEmail';

/** Persist the "connected" flag and last-known email. */
async function rememberAuth(email: string | null): Promise<void> {
  await chrome.storage.local.set({
    [AUTH_FLAG_KEY]: true,
    [AUTH_EMAIL_KEY]: email,
  });
}

/** Clear the persisted auth hint on disconnect. */
async function forgetAuth(): Promise<void> {
  await chrome.storage.local.remove([AUTH_FLAG_KEY, AUTH_EMAIL_KEY]);
}

/** Read the persisted auth hint (flag + last-known email). */
async function readAuthHint(): Promise<{ connected: boolean; email: string | null }> {
  const stored = await chrome.storage.local.get([AUTH_FLAG_KEY, AUTH_EMAIL_KEY]);
  return {
    connected: stored[AUTH_FLAG_KEY] === true,
    email: (stored[AUTH_EMAIL_KEY] as string | null | undefined) ?? null,
  };
}

/**
 * Interactive sign-in: acquire a token (showing consent if needed), resolve
 * with the token plus a best-effort email, and persist the connected flag.
 */
export async function signIn(): Promise<AuthSession> {
  const token = await getAuthToken(true);
  const email = await fetchUserEmail(token);
  await rememberAuth(email);
  return { email, token };
}

/**
 * Silently check for an existing grant without prompting. Returns the active
 * session when a cached token exists.
 *
 * If the silent token call fails but we previously recorded a successful
 * sign-in, we still report "connected" (with the last-known email and an
 * empty token) so the UI doesn't flip back to the sign-in screen on a
 * transient hiccup. The token is refreshed lazily when an action needs it.
 * A failed email lookup never invalidates an otherwise-valid token.
 */
export async function getSignedInSession(): Promise<AuthSession | null> {
  try {
    const token = await getAuthToken(false);
    const email = await fetchUserEmail(token);
    await rememberAuth(email);
    return { token, email };
  } catch {
    const hint = await readAuthHint();
    if (hint.connected) {
      return { token: '', email: hint.email };
    }
    return null;
  }
}

/** Disconnect: drop the cached token and clear the persisted auth hint. */
export async function disconnect(): Promise<void> {
  try {
    const token = await getAuthToken(false);
    await removeCachedToken(token);
  } catch {
    // No cached token to remove — already disconnected.
  } finally {
    await forgetAuth();
  }
}
