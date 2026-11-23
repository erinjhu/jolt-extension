import { useCallback, useEffect, useRef } from 'react';
import { AuthExpiredError } from '../services/authErrors';
import { clearSession } from '../services/authStorage';
import { silentRefresh, type GoogleUser } from '../services/googleAuth';

/**
 * True when an error looks like a missing/expired/invalid OAuth token. Covers
 * Drive REST ("HTTP 401") and the Docs API's gRPC-style phrasing
 * ("UNAUTHENTICATED" / "CREDENTIALS_MISSING").
 */
function isAuthError(err: unknown): boolean {
  return (
    err instanceof AuthExpiredError ||
    (err instanceof Error &&
      /\b401\b|unauthorized|unauthenticated|credentials_missing/i.test(err.message))
  );
}

/**
 * Returns a STABLE `withTokenRetry` runner that supplies a valid access token
 * to a Drive/Docs call.
 *
 * The user is read through a ref (kept current every render) rather than a
 * captured closure value, so a call made during a transient render — e.g. the
 * StrictMode double-mount window in dev where `user` is briefly null before
 * the session restore settles — always sees the latest token instead of a
 * stale/empty one. If the token is still missing, or a call fails with a
 * 401-style auth error, it silently refreshes once and (re)tries, so an
 * unauthenticated request is never sent and the user stays signed in.
 *
 * Because the returned runner has a stable identity, consumers memoized on it
 * (useDocumentSync) don't churn their callbacks when `user` changes, which
 * avoids mid-flight effect re-fires in the editor.
 *
 * If the silent refresh fails, or the refreshed token is rejected too, the
 * stale stored session is cleared, `onAuthExpired` fires (so the UI can ask
 * the user to sign in again) and a typed `AuthExpiredError` is thrown.
 *
 * @param user          The active Google user (or null when signed out).
 * @param setUser       Stores a refreshed user after a silent token refresh.
 * @param onAuthExpired Called once the session is confirmed expired.
 */
export function useTokenRetry(
  user: GoogleUser | null,
  setUser: (user: GoogleUser) => void,
  onAuthExpired?: () => void,
) {
  const userRef = useRef(user);
  const setUserRef = useRef(setUser);
  const expiredRef = useRef(onAuthExpired);
  useEffect(() => {
    userRef.current = user;
    setUserRef.current = setUser;
    expiredRef.current = onAuthExpired;
  }, [user, setUser, onAuthExpired]);

  /** Drop the stale stored session, notify the UI, and abort with a typed error. */
  const expire = (): never => {
    clearSession();
    expiredRef.current?.();
    throw new AuthExpiredError();
  };

  /** Silent refresh that converts any failure into an expired-session error. */
  const refresh = async (): Promise<GoogleUser> => {
    try {
      const refreshed = await silentRefresh();
      setUserRef.current(refreshed);
      return refreshed;
    } catch {
      return expire();
    }
  };

  /** Run with the refreshed token; a second rejection means the session is dead. */
  const retryWithFresh = async <T,>(run: (token: string) => Promise<T>): Promise<T> => {
    const refreshed = await refresh();
    try {
      return await run(refreshed.accessToken);
    } catch (err) {
      if (isAuthError(err)) return expire();
      throw err;
    }
  };

  return useCallback(async <T,>(run: (token: string) => Promise<T>): Promise<T> => {
    const token = userRef.current?.accessToken?.trim();
    // No usable token yet (signed out, or restore not settled): refresh first
    // so we never fire an unauthenticated documents.get / drive request.
    if (!token) return retryWithFresh(run);
    try {
      return await run(token);
    } catch (err) {
      if (!isAuthError(err)) throw err;
      return retryWithFresh(run);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
