import AppHeader from './AppHeader';
import GuestBadge from './GuestBadge';
import type { GoogleUser } from '../services/googleAuth';

/**
 * Chooses the correct sticky top bar: the Guest Demo header in demo mode, or
 * the full account header (profile menu) when signed in. Both expose a
 * clickable logo/name that returns to the mode-selection home screen.
 */
interface AppTopBarProps {
  isGuest: boolean;
  user: GoogleUser;
  isBusy: boolean;
  error: string | null;
  onSignOut: () => void;
  onSwitchAccount: () => Promise<boolean>;
  onExitGuest: () => void;
  onHome: () => void;
}

export default function AppTopBar({
  isGuest,
  user,
  isBusy,
  error,
  onSignOut,
  onSwitchAccount,
  onExitGuest,
  onHome,
}: AppTopBarProps) {
  if (isGuest) {
    return <GuestBadge onExit={onExitGuest} onHome={onHome} />;
  }
  return (
    <AppHeader
      user={user}
      isBusy={isBusy}
      error={error}
      onSignOut={onSignOut}
      onSwitchAccount={onSwitchAccount}
      onHome={onHome}
    />
  );
}
