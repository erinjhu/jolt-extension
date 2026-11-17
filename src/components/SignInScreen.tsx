import { hasClientId } from '../services/clientIdStore';
import JoltLogoIcon from './jolt/JoltLogoIcon';

interface SignInScreenProps {
  isBusy: boolean;
  error: string | null;
  onSignIn: () => void;
  /** Enter the no-account local demo sandbox. */
  onGuestMode: () => void;
}

/**
 * Full-viewport, monochrome sign-in screen. This is the only thing rendered
 * while the user is unauthenticated: no navigation, document pickers, editor,
 * or session form. White background, #111111 text and borders, 0px radius.
 *
 * The Google OAuth client ID comes from the deployment environment
 * (`VITE_GOOGLE_CLIENT_ID`); the user never enters it. A clean notice appears
 * only during development if that env var is missing.
 */
export default function SignInScreen({ isBusy, error, onSignIn, onGuestMode }: SignInScreenProps) {
  // Dev-only hint when the build has no client ID configured.
  const showMissingConfigNotice = import.meta.env.DEV && !hasClientId();

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-[#FFFFFF] px-6 py-10 text-[#111111]">
      <section className="flex w-full max-w-sm flex-col gap-8 rounded-none border border-[#111111] p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <JoltLogoIcon size={48} title="Jolt" />
          {/* Right padding offsets the trailing letter-space so JOLT looks centered. */}
          <h1 className="pl-[0.35em] text-4xl font-bold tracking-[0.35em]">JOLT</h1>
          <p className="font-mono text-xs leading-relaxed text-gray-600">
            Track your writing from your phone
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onSignIn}
            disabled={isBusy}
            className="w-full rounded-none bg-[#111111] px-6 py-4 text-sm font-bold uppercase tracking-wide text-[#FFFFFF] transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBusy ? 'Signing in…' : 'Sign in with Google'}
          </button>

          <button
            type="button"
            onClick={onGuestMode}
            disabled={isBusy}
            className="w-full rounded-none border border-[#111111] bg-[#FFFFFF] px-6 py-4 text-sm font-bold uppercase tracking-wide text-[#111111] transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Try Demo as Guest
          </button>
        </div>

        {error && (
          <p role="alert" className="font-mono text-xs text-red-600">
            {error}
          </p>
        )}

        {showMissingConfigNotice && (
          <p className="font-mono text-xs text-gray-600">
            Google sign-in isn’t configured for this environment yet.
          </p>
        )}

        <footer className="flex items-center justify-center gap-4 border-t border-[#111111] pt-6 font-mono text-xs text-gray-600">
          <a
            href={`${import.meta.env.BASE_URL}privacy.html`}
            className="underline underline-offset-4 transition hover:text-[#111111]"
          >
            Privacy Policy
          </a>
          <span aria-hidden="true">·</span>
          <a
            href={`${import.meta.env.BASE_URL}terms.html`}
            className="underline underline-offset-4 transition hover:text-[#111111]"
          >
            Terms of Use
          </a>
        </footer>
      </section>
    </main>
  );
}
