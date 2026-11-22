import { useCallback, useEffect, useState } from 'react';
import {
  hasStoredSession,
  restoreSession,
  signIn as requestSignIn,
  signOut as requestSignOut,
  switchAccount as requestSwitchAccount,
  isUserCancellation,
  type GoogleUser,
} from '../services/googleAuth';

/** Max silent-restore attempts while the GIS script may still be loading. */
const MAX_RESTORE_ATTEMPTS = 5;
const RESTORE_RETRY_MS = 400;

export interface GoogleAuthState {
  /** The signed-in user, or null when unauthenticated. */
  user: GoogleUser | null;
  /** True until the initial restore-from-localStorage attempt has settled. */
  isRestoring: boolean;
  /** True while an interactive sign-in or sign-out is in flight. */
  isBusy: boolean;
  /** Last sign-in error, or null. */
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Pick a different Google account. Resolves true on success. */
  switchAccount: () => Promise<boolean>;
  /** Replace the user, e.g. after a silent token refresh. */
  setUser: (user: GoogleUser | null) => void;
}

/**
 * Owns Google auth state for the whole app so the UI can gate on it. On mount
 * it restores a persisted session (valid token, or silent refresh of an
 * expired one) before declaring the user signed out, which keeps the sign-in
 * screen from flashing on reload.
 */
export function useGoogleAuth(): GoogleAuthState {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;

    async function tryRestore() {
      const restored = await restoreSession();
      if (cancelled) return;
      if (restored) {
        setUser(restored);
        setIsRestoring(false);
        return;
      }
      // Retry only when an expired stored session needs a silent refresh but
      // GIS hasn't loaded yet. No stored session means nothing to restore.
      attempts += 1;
      if (hasStoredSession() && attempts < MAX_RESTORE_ATTEMPTS) {
        timer = window.setTimeout(() => void tryRestore(), RESTORE_RETRY_MS);
        return;
      }
      setIsRestoring(false);
    }

    void tryRestore();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const signIn = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      setUser(await requestSignIn());
    } catch (err) {
      // User closed the popup — not a real failure; reset silently.
      if (isUserCancellation(err)) return;
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setIsBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!user) return;
    setIsBusy(true);
    try {
      await requestSignOut(user.accessToken);
    } finally {
      setUser(null);
      setIsBusy(false);
    }
  }, [user]);

  const switchAccount = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      setUser(await requestSwitchAccount());
      return true;
    } catch (err) {
      // User closed the popup — not a real failure; reset silently.
      if (isUserCancellation(err)) return false;
      setError(err instanceof Error ? err.message : 'Could not switch account.');
      return false;
    } finally {
      setIsBusy(false);
    }
  }, []);

  return { user, isRestoring, isBusy, error, signIn, signOut, switchAccount, setUser };
}
