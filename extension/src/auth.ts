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

/** Thrown when the user dismisses the Google sign-in / consent window. */
export class AuthCancelledError extends Error {
  constructor() {
    super('Sign-in cancelled by user.');
    this.name = 'AuthCancelledError';
  }
}

/** True when a chrome.identity error means the user backed out on purpose. */
export function isAuthCancellation(err: unknown): boolean {
  if (err instanceof AuthCancelledError) return true;
  const text = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return (
    text.includes('did not approve') ||
    text.includes('not granted or revoked') ||
    text.includes('popup closed') ||
    text.includes('window was closed') ||
    text.includes('canceled') ||
    text.includes('cancelled')
  );
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
const AUTH_TOKEN_KEY = 'joltAuthToken';
const AUTH_TOKEN_EXPIRY_KEY = 'joltAuthTokenExpiry';

/** Assume a Google OAuth token is good for ~1 hour; refresh a bit early. */
const TOKEN_TTL_MS = 55 * 60 * 1000;

interface StoredToken {
  token: string;
  /** Epoch-ms time after which the token should be treated as expired. */
  expiresAt: number;
}

/** Persist a freshly acquired token with a conservative expiry. */
async function storeToken(token: string): Promise<void> {
  await chrome.storage.local.set({
    [AUTH_TOKEN_KEY]: token,
    [AUTH_TOKEN_EXPIRY_KEY]: Date.now() + TOKEN_TTL_MS,
  });
}

/** Read the stored token and its expiry, if present. */
async function readStoredToken(): Promise<StoredToken | null> {
  const stored = await chrome.storage.local.get([AUTH_TOKEN_KEY, AUTH_TOKEN_EXPIRY_KEY]);
  const token = stored[AUTH_TOKEN_KEY] as string | undefined;
  const expiresAt = stored[AUTH_TOKEN_EXPIRY_KEY] as number | undefined;
  if (!token || typeof expiresAt !== 'number') return null;
  return { token, expiresAt };
}

/** Forget the stored token (e.g. after a 401 or on disconnect). */
async function clearStoredToken(): Promise<void> {
  await chrome.storage.local.remove([AUTH_TOKEN_KEY, AUTH_TOKEN_EXPIRY_KEY]);
}

/** Persist the "connected" flag and last-known email. */
async function rememberAuth(email: string | null): Promise<void> {
  await chrome.storage.local.set({
    [AUTH_FLAG_KEY]: true,
    [AUTH_EMAIL_KEY]: email,
  });
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
  let token: string;
  try {
    token = await getAuthToken(true);
  } catch (err) {
    if (isAuthCancellation(err)) throw new AuthCancelledError();
    throw err;
  }
  await storeToken(token);
  const email = await fetchUserEmail(token);
  await rememberAuth(email);
  return { email, token };
}

/**
 * Return a usable access token WITHOUT prompting the user when avoidable.
 * Resolution order:
 *   1. A non-expired token we stored ourselves (survives SW restarts).
 *   2. A silent `getAuthToken(false)` — Chrome renews from an existing grant.
 *   3. (only as a last resort) an interactive prompt.
 *
 * This is the single entry point network code should use, so a user who has
 * signed in once is not asked to sign in again for routine actions.
 */
export async function getValidToken(): Promise<string> {
  const stored = await readStoredToken();
  if (stored && stored.expiresAt > Date.now()) {
    return stored.token;
  }

  try {
    const token = await getAuthToken(false);
    await storeToken(token);
    return token;
  } catch {
    const token = await getAuthToken(true);
    await storeToken(token);
    return token;
  }
}

/**
 * Invalidate a token that a Google API just rejected (401): drop it from both
 * Chrome's cache and our own store so the next `getValidToken` re-acquires.
 */
export async function invalidateToken(token: string): Promise<void> {
  await removeCachedToken(token);
  await clearStoredToken();
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
    await storeToken(token);
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

const REVOKE_URL = 'https://accounts.google.com/o/oauth2/revoke';

/** Best-effort server-side revocation; a network failure never blocks sign-out. */
async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`);
  } catch {
    // Offline or blocked — local sign-out still proceeds.
  }
}

/** Clear every token Chrome's identity cache holds, when the API exists. */
async function clearChromeTokenCache(): Promise<void> {
  const identity = chrome.identity as typeof chrome.identity & {
    clearAllCachedAuthTokens?: () => Promise<void>;
  };
  try {
    await identity.clearAllCachedAuthTokens?.();
  } catch {
    // Unsupported on this Chrome build — the per-token removal covers it.
  }
}

/**
 * Full sign-out: revoke the active token with Google, evict it from Chrome's
 * identity cache (so Chrome cannot silently re-authenticate the old account),
 * and wipe all persisted profile data, session caches and folder ids.
 */
export async function signOut(): Promise<void> {
  let token: string | null = null;
  const stored = await readStoredToken();
  if (stored) {
    token = stored.token;
  } else {
    try {
      token = await getAuthToken(false);
    } catch {
      token = null;
    }
  }

  try {
    if (token) {
      await revokeToken(token);
      await removeCachedToken(token);
    }
    await clearChromeTokenCache();
  } finally {
    await chrome.storage.local.clear();
    await chrome.storage.sync.clear();
  }
}

/**
 * Switch accounts: sign out completely first so no cached grant can
 * auto-select the previous account, then run a fresh interactive sign-in so
 * Google presents its account chooser.
 */
export async function switchAccount(): Promise<AuthSession> {
  await signOut();
  return signIn();
}
