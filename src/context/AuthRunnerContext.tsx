import { createContext, useContext } from 'react';

/** Runs a Drive/Docs call with a valid token (silent refresh + expiry handling). */
export type AuthRunner = <T>(run: (token: string) => Promise<T>) => Promise<T>;

export const AuthRunnerContext = createContext<AuthRunner | null>(null);

/**
 * The shared token-retrying runner provided by `AuthExpiryBoundary`. Falls
 * back to calling straight through with `fallbackToken` when rendered outside
 * the boundary (e.g. guest demo), so components never need to special-case it.
 */
export function useAuthRunner(fallbackToken: string): AuthRunner {
  const runner = useContext(AuthRunnerContext);
  return runner ?? (<T,>(run: (token: string) => Promise<T>) => run(fallbackToken));
}
