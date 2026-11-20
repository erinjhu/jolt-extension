import { useCallback, useEffect, useRef } from 'react';
import { silentRefresh, type GoogleUser } from '../services/googleAuth';

/**
 * True when an error looks like a missing/expired/invalid OAuth token. Covers
 * Drive REST ("HTTP 401") and the Docs API's gRPC-style phrasing
 * ("UNAUTHENTICATED" / "CREDENTIALS_MISSING").
 */
function isAuthError(err: unknown): boolean {
  return (
    err instanceof Error &&
    /\b401\b|unauthorized|unauthenticated|credentials_missing/i.test(err.message)
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
 * @param user     The active Google user (or null when signed out).
 * @param setUser  Stores a refreshed user after a silent token refresh.
 */
export function useTokenRetry(
  user: GoogleUser | null,
  setUser: (user: GoogleUser) => void,
) {
  const userRef = useRef(user);
  const setUserRef = useRef(setUser);
  useEffect(() => {
    userRef.current = user;
    setUserRef.current = setUser;
  }, [user, setUser]);

  return useCallback(async <T>(run: (token: string) => Promise<T>): Promise<T> => {
    const current = userRef.current;
    const token = current?.accessToken?.trim();
    // No usable token yet (signed out, or restore not settled): refresh first
    // so we never fire an unauthenticated documents.get / drive request.
    if (!token) {
      const refreshed = await silentRefresh();
      setUserRef.current(refreshed);
      return run(refreshed.accessToken);
    }
    try {
      return await run(token);
    } catch (err) {
      if (!isAuthError(err)) throw err;
      const refreshed = await silentRefresh();
      setUserRef.current(refreshed);
      return run(refreshed.accessToken);
    }
  }, []);
}
