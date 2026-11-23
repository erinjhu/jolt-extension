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
 * Throw `AuthExpiredError` when `res` is an expired/invalid-credentials
 * response: any 401, or a 403 whose error payload names a credential problem
 * (a plain 403 such as "API not enabled" or "no permission" is NOT an auth
 * expiry). Safe to call on every response; does nothing for success codes.
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
    if (AUTH_REASON.test(haystack)) throw new AuthExpiredError();
  } catch (err) {
    if (err instanceof AuthExpiredError) throw err;
    // Unparseable body: treat as an ordinary 403 and let the caller report it.
  }
}
