import { useCallback, useEffect, useState } from 'react';
import { resolveClientId } from '../services/clientIdStore';
import {
  hasStoredSession,
  restoreSession,
  signIn,
  signOut,
  type GoogleUser,
} from '../services/googleAuth';
import ClientIdConfig from './ClientIdConfig';

/**
 * Google connection panel: shows a "Not Connected" badge with a sign-in
 * button, or "Connected as [email]" with a sign-out button. Reports the
 * active user up to the parent so the rest of the app can gate on auth.
 */
interface GoogleAuthPanelProps {
  /** Fires with the user on sign-in, or null on sign-out. */
  onAuthChange?: (user: GoogleUser | null) => void;
}

export default function GoogleAuthPanel({ onAuthChange }: GoogleAuthPanelProps) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasClientId, setHasClientId] = useState(() => Boolean(resolveClientId()));

  useEffect(() => {
    onAuthChange?.(user);
  }, [user, onAuthChange]);

  // On mount / reload, restore a persisted session. A still-valid token is
  // used immediately; an expired one triggers a silent refresh inside
  // restoreSession. We retry briefly so the silent-refresh path works even if
  // the GIS script hasn't finished loading on the first tick.
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function tryRestore() {
      const restored = await restoreSession();
      if (cancelled) return;
      if (restored) {
        setUser(restored);
        return;
      }
      // Only retry when a stored (expired) session needs a silent refresh but
      // GIS hasn't loaded yet. No stored session means nothing to restore.
      attempts += 1;
      if (hasStoredSession() && attempts < 5) {
        window.setTimeout(() => void tryRestore(), 400);
      }
    }

    void tryRestore();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshClientId = useCallback(() => {
    setHasClientId(Boolean(resolveClientId()));
  }, []);

  async function handleSignIn() {
    setIsBusy(true);
    setError(null);
    try {
      setUser(await signIn());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSignOut() {
    if (!user) return;
    setIsBusy(true);
    try {
      await signOut(user.accessToken);
    } finally {
      setUser(null);
      setIsBusy(false);
    }
  }

  const isConnected = Boolean(user);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-gray-700 bg-gray-800/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
            isConnected ? 'bg-emerald-500/15 text-emerald-300' : 'bg-gray-700 text-gray-300'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-gray-500'}`}
            aria-hidden
          />
          {isConnected ? (user?.email ? `Connected as ${user.email}` : 'Connected') : 'Not Connected'}
        </span>

        {isConnected ? (
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={isBusy}
            className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-100 hover:bg-gray-600 disabled:opacity-50"
          >
            Sign Out
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleSignIn()}
            disabled={isBusy || !hasClientId}
            className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBusy ? 'Connecting…' : 'Sign in with Google'}
          </button>
        )}
      </div>

      {!hasClientId && (
        <p className="text-xs text-amber-300">
          No client ID configured. Add one below to enable sign-in.
        </p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <ClientIdConfig onClientIdChange={refreshClientId} />
    </section>
  );
}
