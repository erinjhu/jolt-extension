import { useEffect, useRef, useState } from 'react';
import type { GoogleUser } from '../services/googleAuth';
import ProfileAvatar from './ProfileAvatar';
import JoltLogoIcon from './jolt/JoltLogoIcon';

interface AppHeaderProps {
  user: GoogleUser;
  isBusy: boolean;
  error: string | null;
  onSignOut: () => void;
  /** Resolves true when a different account was chosen successfully. */
  onSwitchAccount: () => Promise<boolean>;
}

/**
 * Persistent top bar: JOLT wordmark on the left, profile avatar on the right.
 * The avatar toggles a sharp-cornered popover with the user's name, email,
 * and sign-out / switch-account actions. Clicking outside or pressing Escape
 * closes it.
 */
export default function AppHeader({
  user,
  isBusy,
  error,
  onSignOut,
  onSwitchAccount,
}: AppHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  async function handleSwitch() {
    if (await onSwitchAccount()) setIsOpen(false);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[#111111] bg-[#FFFFFF] text-[#111111]">
      <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
        <span className="flex items-center gap-2">
          <JoltLogoIcon size={24} title="Jolt" />
          <span className="pl-[0.35em] text-lg font-bold tracking-[0.35em]">JOLT</span>
        </span>

        <div ref={containerRef} className="relative">
          <button
            type="button"
            onClick={() => setIsOpen((open) => !open)}
            aria-label="Profile menu"
            aria-haspopup="true"
            aria-expanded={isOpen}
            className="block rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2"
          >
            <ProfileAvatar name={user.name} email={user.email} picture={user.picture} />
          </button>

          {isOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-2 flex w-64 flex-col gap-4 rounded-none border border-[#111111] bg-[#FFFFFF] p-4"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-sm font-bold">{user.name ?? 'Signed in'}</span>
                {user.email && (
                  <span className="truncate font-mono text-xs text-gray-600">{user.email}</span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  role="menuitem"
                  onClick={onSignOut}
                  disabled={isBusy}
                  className="w-full rounded-none bg-[#111111] px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[#FFFFFF] transition hover:bg-black disabled:opacity-50"
                >
                  Sign out
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleSwitch()}
                  disabled={isBusy}
                  className="w-full rounded-none border border-[#111111] bg-[#FFFFFF] px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-[#111111] transition hover:bg-gray-100 disabled:opacity-50"
                >
                  {isBusy ? 'Working…' : 'Switch account'}
                </button>
              </div>

              {error && (
                <p role="alert" className="font-mono text-xs text-red-600">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
