import { useCallback, useRef, useState } from 'react';
import { useDriveAccess } from '../context/DriveAccessContext';
import { MissingDriveScopeError } from '../services/authErrors';

/** Re-runs the action that was blocked, using the freshly granted token. */
export type DriveRetry = (token: string) => Promise<void>;

/**
 * Gates Drive actions on the Drive permission being granted.
 *
 * - `guard(retry)` — call before a Drive action. Returns true to proceed; when
 *   Drive isn't granted it remembers `retry` and flags the access card instead.
 * - `handleScopeError(err, retry)` — call in a catch block; true when `err` was
 *   a 403 missing-scope error (now surfaced as the access card).
 * - `grantAndRetry()` — re-runs Google consent and, on success, retries the
 *   blocked action automatically.
 */
export function useDriveScopeGate() {
  const { hasDriveScope, grant } = useDriveAccess();
  // A Drive call was rejected for a missing scope even though sign-in looked fine.
  const [blocked, setBlocked] = useState(false);
  // The user actually tried to use Drive (vs. just seeing the proactive prompt).
  const [attempted, setAttempted] = useState(false);
  const [isGranting, setIsGranting] = useState(false);
  const retryRef = useRef<DriveRetry | null>(null);

  const needsAccess = !hasDriveScope || blocked;

  const guard = useCallback(
    (retry: DriveRetry): boolean => {
      if (hasDriveScope && !blocked) return true;
      retryRef.current = retry;
      setAttempted(true);
      return false;
    },
    [hasDriveScope, blocked],
  );

  const handleScopeError = useCallback((err: unknown, retry: DriveRetry): boolean => {
    if (!(err instanceof MissingDriveScopeError)) return false;
    retryRef.current = retry;
    setBlocked(true);
    setAttempted(true);
    return true;
  }, []);

  const grantAndRetry = useCallback(async () => {
    setIsGranting(true);
    try {
      const token = await grant();
      if (!token) return; // cancelled, or the box was left unchecked again
      setBlocked(false);
      setAttempted(false);
      const retry = retryRef.current;
      retryRef.current = null;
      if (retry) await retry(token);
    } finally {
      setIsGranting(false);
    }
  }, [grant]);

  return { needsAccess, attempted, isGranting, guard, handleScopeError, grantAndRetry };
}
