/**
 * Classifies Google API responses that mean "the OAuth session is no longer
 * valid", so callers can tell an expired login apart from a generic network or
 * API failure and prompt the user to sign in again.
 */

/** Shown wherever an expired session is surfaced to the user. */
export const SESSION_EXPIRED_MESSAGE =
  'Session expired — please sign in again to access Google Drive.';

/** Thrown when a Google API call fails because the access token is expired/invalid. */
export class AuthExpiredError extends Error {
  constructor(message: string = SESSION_EXPIRED_MESSAGE) {
    super(message);
    this.name = 'AuthExpiredError';
  }
}

/** Shown when the user signed in but left the Google Drive permission unchecked. */
export const MISSING_DRIVE_SCOPE_MESSAGE =
  "Google Drive access is required. Click below and check the Google Drive permission box on Google's sign-in screen.";

/**
 * Thrown when Google rejects a call with a 403 because the token lacks the
 * Drive scope (partial consent). Distinct from an expired token (401) and from
 * ordinary failures: re-signing in with the consent prompt fixes it.
 */
export class MissingDriveScopeError extends Error {
  constructor(message: string = MISSING_DRIVE_SCOPE_MESSAGE) {
    super(message);
    this.name = 'MissingDriveScopeError';
  }
}

/**
 * 403 reasons meaning "this token was not granted the needed scope". The
 * per-file `insufficientFilePermissions` (no access to ONE file) is
 * deliberately not matched.
 */
const SCOPE_REASON =
  /insufficientpermissions|access_token_scope_insufficient|insufficient authentication scopes|insufficient_scope/i;

/** Google error `reason` values / messages that indicate a bad credential. */
const AUTH_REASON = /autherror|invalid_?credentials|invalid_grant|unauthenticated|expired/i;

interface GoogleErrorBody {
  error?: {
    message?: string;
    status?: string;
    errors?: Array<{ reason?: string; message?: string }>;
  };
}

/**
 * Throw a typed error for an auth failure on `res`: `AuthExpiredError` for any
 * 401 or a 403 naming a credential problem, or `MissingDriveScopeError` for a
 * 403 caused by an ungranted scope (a plain 403 such as "API not enabled" or
 * "no permission" is neither). Safe to call on every response; does nothing
 * for success codes.
 */
export async function throwIfAuthExpired(res: Response): Promise<void> {
  if (res.ok) return;
  if (res.status === 401) throw new AuthExpiredError();
  if (res.status !== 403) return;

  try {
    const body = (await res.clone().json()) as GoogleErrorBody;
    const err = body.error;
    const haystack = [
      err?.status,
      err?.message,
      ...(err?.errors ?? []).flatMap((e) => [e.reason, e.message]),
    ].join(' ');
    if (SCOPE_REASON.test(haystack)) throw new MissingDriveScopeError();
    if (AUTH_REASON.test(haystack)) throw new AuthExpiredError();
  } catch (err) {
    if (err instanceof AuthExpiredError || err instanceof MissingDriveScopeError) throw err;
    // Unparseable body: treat as an ordinary 403 and let the caller report it.
  }
}
