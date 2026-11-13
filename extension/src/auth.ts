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

/** Fetch the signed-in user's email to confirm identity, given a token. */
export async function fetchUserEmail(token: string): Promise<string> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${token}` },
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
 * Interactive sign-in: acquire a token (showing consent if needed) and
 * resolve with the user's email and the token used to confirm it.
 */
export async function signIn(): Promise<{ email: string; token: string }> {
  const token = await getAuthToken(true);
  const email = await fetchUserEmail(token);
  return { email, token };
}

/**
 * Silently check for an existing grant without prompting. Returns the
 * connected email, or null when the user is not yet signed in.
 */
export async function getSignedInEmail(): Promise<string | null> {
  try {
    const token = await getAuthToken(false);
    return await fetchUserEmail(token);
  } catch {
    return null;
  }
}

/** Disconnect: drop the cached token so the user is signed out locally. */
export async function disconnect(): Promise<void> {
  try {
    const token = await getAuthToken(false);
    await removeCachedToken(token);
  } catch {
    // No cached token to remove — already disconnected.
  }
}
