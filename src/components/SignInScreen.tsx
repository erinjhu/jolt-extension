import { useState } from 'react';
import { resolveClientId } from '../services/clientIdStore';
import ClientIdConfig from './ClientIdConfig';

interface SignInScreenProps {
  isBusy: boolean;
  error: string | null;
  onSignIn: () => void;
}

/**
 * Full-viewport, monochrome sign-in screen. This is the only thing rendered
 * while the user is unauthenticated: no navigation, document pickers, editor,
 * or session form. White background, #111111 text and borders, 0px radius.
 */
export default function SignInScreen({ isBusy, error, onSignIn }: SignInScreenProps) {
  const [hasClientId, setHasClientId] = useState(() => Boolean(resolveClientId()));

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-[#FFFFFF] px-6 py-10 text-[#111111]">
      <section className="flex w-full max-w-sm flex-col gap-8 rounded-none border border-[#111111] p-8">
        <div className="flex flex-col gap-3 text-center">
          {/* Right padding offsets the trailing letter-space so JOLT looks centered. */}
          <h1 className="pl-[0.35em] text-4xl font-bold tracking-[0.35em]">JOLT</h1>
          <p className="font-mono text-xs leading-relaxed text-gray-600">
            Track your writing from your phone
          </p>
        </div>

        <button
          type="button"
          onClick={onSignIn}
          disabled={isBusy || !hasClientId}
          className="w-full rounded-none bg-[#111111] px-6 py-4 text-sm font-bold uppercase tracking-wide text-[#FFFFFF] transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isBusy ? 'Signing in…' : 'Sign in with Google'}
        </button>

        {error && (
          <p role="alert" className="font-mono text-xs text-red-600">
            {error}
          </p>
        )}

        {/* Fallback only when no client ID is baked into the build. */}
        {!hasClientId && (
          <div className="flex flex-col gap-2 border-t border-gray-300 pt-4">
            <p className="font-mono text-xs text-gray-600">
              No Google client ID is configured for this build.
            </p>
            <ClientIdConfig onClientIdChange={() => setHasClientId(Boolean(resolveClientId()))} />
          </div>
        )}
      </section>
    </main>
  );
}
