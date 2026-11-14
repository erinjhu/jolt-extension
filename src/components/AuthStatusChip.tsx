interface AuthStatusChipProps {
  /** Whether the user is signed in to Google. */
  isSignedIn: boolean;
  /** Signed-in account email, if known. May be null even when signed in. */
  email?: string | null;
}

/**
 * Compact, always-visible chip in the header that reflects Google sign-in
 * state at a glance, independent of the fuller GoogleAuthPanel below.
 */
export default function AuthStatusChip({ isSignedIn, email }: AuthStatusChipProps) {
  const label = isSignedIn ? 'Signed in to Google' : 'Not signed in';
  const tooltip = isSignedIn
    ? email
      ? `Signed in to Google as ${email}`
      : 'Signed in to Google'
    : 'Not signed in to Google';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        isSignedIn ? 'bg-emerald-500/15 text-emerald-300' : 'bg-gray-700 text-gray-400'
      }`}
      title={tooltip}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isSignedIn ? 'bg-emerald-400' : 'bg-gray-500'}`}
        aria-hidden
      />
      {label}
    </span>
  );
}
