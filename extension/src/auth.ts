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

/** Shown above "Sign In with Google" when the saved session can't be used. */
export const AUTH_EXPIRED_MESSAGE =
  'Your Google session expired or access was revoked. Please sign in again to sync your sessions.';

/**
 * Thrown when Google no longer honours our grant: the token was revoked or
 * expired (`OAuth2 not granted or revoked`, `invalid_grant`, HTTP 401). This
 * is NOT a timeout or a user cancel — the fix is to sign in again.
 */
export class AuthRevokedOrExpiredError extends Error {
  constructor(message: string = AUTH_EXPIRED_MESSAGE) {
    super(message);
    this.name = 'AuthRevokedOrExpiredError';
  }
}

/** Shown when sign-in succeeded but the Google Drive permission box was left unchecked. */
export const MISSING_DRIVE_MESSAGE =
  "Google Drive access wasn't granted during sign-in. Click below and check the Google Drive permission box on Google's sign-in screen to sync your sessions.";

/**
 * Thrown when the token lacks the Drive scope (Google's granular consent let
 * the user sign in without ticking Drive), or Drive answers 403
 * `insufficientPermissions` / `ACCESS_TOKEN_SCOPE_INSUFFICIENT`. The user is
 * still signed in; the fix is to grant Drive access again.
 */
export class MissingDrivePermissionError extends Error {
  constructor(message: string = MISSING_DRIVE_MESSAGE) {
    super(message);
    this.name = 'MissingDrivePermissionError';
  }
}

/** True for revoked/expired-credential failures (typed error or Chrome/Google text). */
export function isAuthRevokedOrExpired(err: unknown): boolean {
  if (err instanceof AuthRevokedOrExpiredError) return true;
  const text = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  return (
    text.includes('oauth2 not granted or revoked') ||
    text.includes('did not approve access') ||
    text.includes('invalid_grant') ||
    /\b401\b/.test(text)
  );
}

/**
 * Turn a raw `chrome.identity` failure into a short plain-language message.
 * Covers a bad/mismatched OAuth client id, blocked sign-in and network drops.
 */
export function describeAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const text = raw.toLowerCase();
  if (
    text.includes('invalid_client') ||
    text.includes('bad client id') ||
    text.includes('invalid client') ||
    text.includes('oauth2 request failed') ||
    text.includes('bad request')
  ) {
    return 'Google sign-in is not set up correctly for this version of the extension. Please update it and try again.';
  }
  if (text.includes('network') || text.includes('failed to fetch')) {
    return 'Could not reach Google. Check your connection and try again.';
  }
  if (text.includes('not signed in') || text.includes('user is not signed in')) {
    return 'Sign in to Chrome with a Google account, then try again.';
  }
  return 'Google sign-in failed. Please try again.';
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
 *
 * It NEVER goes interactive: this runs in the background worker, which cannot
 * show Google's consent window, so an interactive attempt would just hang
 * until the popup's timer fired. When no silent token is available the saved
 * session is cleared and `AuthRevokedOrExpiredError` is thrown so the popup
 * can ask the user to sign in again.
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
    await clearAuthState();
    throw new AuthRevokedOrExpiredError();
  }
}

/**
 * Forget a dead session: evict stale tokens from Chrome's identity cache and
 * clear the persisted token, connected flag and email, so the popup stops
 * showing the old account. Cached sessions are kept for when the user returns.
 */
export async function clearAuthState(): Promise<void> {
  const stored = await readStoredToken();
  try {
    if (stored) await removeCachedToken(stored.token);
    await clearChromeTokenCache();
  } finally {
    await chrome.storage.local.remove([
      AUTH_TOKEN_KEY,
      AUTH_TOKEN_EXPIRY_KEY,
      AUTH_FLAG_KEY,
      AUTH_EMAIL_KEY,
    ]);
  }
}

const TOKENINFO_URL = 'https://www.googleapis.com/oauth2/v3/tokeninfo';

/** Scopes that let the extension read `jolt_sessions.json` written by the web app. */
const DRIVE_READ_SCOPES = new Set([
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive',
]);

/**
 * Ask Google which scopes `token` actually carries. Returns true/false for
 * "has Drive read access", or null when that can't be determined (offline,
 * invalid token) — an unknown result never blocks a sync; Drive's own 401/403
 * responses are still handled.
 */
async function tokenHasDriveScope(token: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${TOKENINFO_URL}?access_token=${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { scope?: string };
    if (typeof body.scope !== 'string') return null;
    return body.scope.split(/\s+/).some((s) => DRIVE_READ_SCOPES.has(s));
  } catch {
    return null;
  }
}

/** Throw `MissingDrivePermissionError` when `token` is known to lack Drive access. */
export async function assertDriveScope(token: string): Promise<void> {
  if ((await tokenHasDriveScope(token)) === false) throw new MissingDrivePermissionError();
}

/**
 * Re-run Google consent so the Drive checkbox is shown again. The scope-less
 * token is removed from Chrome's cache (and revoked, since Chrome would
 * otherwise reuse the existing partial grant instead of asking), then an
 * interactive `getAuthToken` runs. Throws `AuthCancelledError` if the user
 * backs out, or `MissingDrivePermissionError` if Drive is still unchecked.
 */
export async function grantDriveAccess(): Promise<AuthSession> {
  let stale: string | null = (await readStoredToken())?.token ?? null;
  if (!stale) {
    try {
      stale = await getAuthToken(false);
    } catch {
      stale = null;
    }
  }
  if (stale) {
    await revokeToken(stale);
    await removeCachedToken(stale);
  }
  await clearStoredToken();
  await clearChromeTokenCache();

  const session = await signIn();
  await assertDriveScope(session.token);
  return session;
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
 *
 * Exception: a user who WAS connected and now gets `OAuth2 not granted or
 * revoked` has lost their grant. That is not transient, so the stale state is
 * cleared and `AuthRevokedOrExpiredError` is thrown. (A user who never signed
 * in gets the same Chrome message and is simply reported as signed out.)
 */
export async function getSignedInSession(): Promise<AuthSession | null> {
  try {
    const token = await getAuthToken(false);
    await storeToken(token);
    const email = await fetchUserEmail(token);
    await rememberAuth(email);
    return { token, email };
  } catch (err) {
    const hint = await readAuthHint();
    if (!hint.connected) return null;
    if (isAuthRevokedOrExpired(err)) {
      await clearAuthState();
      throw new AuthRevokedOrExpiredError();
    }
    return { token: '', email: hint.email };
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
