import type { ReactNode } from 'react';
import { AuthRunnerContext, type AuthRunner } from '../context/AuthRunnerContext';

interface AuthExpiryBoundaryProps {
  /** Token-retrying runner shared with descendants (doc picker, etc.). */
  withTokenRetry: AuthRunner;
  /** True once the Google session was found to be expired. */
  isExpired: boolean;
  /** True while an interactive sign-in is in flight. */
  isBusy: boolean;
  /** Starts the interactive Google sign-in. */
  onSignIn: () => void;
  children: ReactNode;
}

/**
 * Provides the shared auth runner and, when the session has expired, a
 * monochrome "Session expired" modal over the app. The app state underneath
 * (scanned image, text, selected doc) stays mounted, so signing in again drops
 * the user straight back into what they were doing.
 */
export default function AuthExpiryBoundary({
  withTokenRetry,
  isExpired,
  isBusy,
  onSignIn,
  children,
}: AuthExpiryBoundaryProps) {
  return (
    <AuthRunnerContext.Provider value={withTokenRetry}>
      {children}
      {isExpired && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="session-expired-title"
            className="flex w-full max-w-sm flex-col gap-4 rounded-none border border-[#111111] bg-[#FFFFFF] p-6 text-[#111111]"
          >
            <h2 id="session-expired-title" className="text-sm font-bold uppercase tracking-wide">
              Session expired
            </h2>
            <p className="text-sm">
              Session expired — please sign in again to access Google Drive. Your scanned
              note and selected document are kept.
            </p>
            <button
              type="button"
              onClick={onSignIn}
              disabled={isBusy}
              className="rounded-none border border-[#111111] bg-[#111111] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#FFFFFF] transition hover:bg-[#333333] disabled:opacity-50"
            >
              {isBusy ? 'Signing in…' : 'Sign in again'}
            </button>
          </div>
        </div>
      )}
    </AuthRunnerContext.Provider>
  );
}
