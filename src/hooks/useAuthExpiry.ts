import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tracks whether the current Google session was found to be expired.
 *
 * The expiry is remembered against the access token that failed, so it clears
 * itself the moment a different (freshly signed-in) token arrives — no manual
 * reset needed, and the rest of the app state (scanned image/text, selected
 * doc) is never touched.
 *
 * @param token The current access token, or undefined when signed out.
 */
export function useAuthExpiry(token: string | undefined) {
  const tokenRef = useRef(token);
  const [expiredToken, setExpiredToken] = useState<string | null>(null);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  /** Record that the token currently in use was rejected. */
  const markExpired = useCallback(() => {
    setExpiredToken(tokenRef.current ?? '');
  }, []);

  return {
    isExpired: expiredToken !== null && expiredToken === (token ?? ''),
    markExpired,
  };
}
