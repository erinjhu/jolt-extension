interface AuthStatusChipProps {
  /** Signed-in Google account email, or null when not connected. */
  email: string | null;
}

/**
 * Compact, always-visible chip in the header that reflects Google sign-in
 * state at a glance, independent of the fuller GoogleAuthPanel below.
 */
export default function AuthStatusChip({ email }: AuthStatusChipProps) {
  const isSignedIn = Boolean(email);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        isSignedIn ? 'bg-emerald-500/15 text-emerald-300' : 'bg-gray-700 text-gray-400'
      }`}
      title={isSignedIn ? `Signed in to Google as ${email}` : 'Not signed in to Google'}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isSignedIn ? 'bg-emerald-400' : 'bg-gray-500'}`}
        aria-hidden
      />
      {isSignedIn ? 'Signed in to Google' : 'Not signed in'}
    </span>
  );
}
