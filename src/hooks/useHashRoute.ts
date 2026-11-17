import { useEffect, useState } from 'react';

/**
 * Minimal hash-based router. The app is a single-page Vite build hosted on
 * GitHub Pages, where clean paths like `/privacy` 404 on reload, so legal
 * pages live behind the hash (`#/privacy`, `#/terms`). This hook returns the
 * current hash path (without the leading `#`, defaulting to `/`) and keeps it
 * in sync with the browser's `hashchange` event.
 */
export function useHashRoute(): string {
  const [route, setRoute] = useState<string>(() => normalizeHash(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(normalizeHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return route;
}

/** Turn `#/privacy` (or an empty hash) into a normalized path like `/privacy`. */
function normalizeHash(hash: string): string {
  const path = hash.replace(/^#/, '');
  return path.length > 0 ? path : '/';
}

/** Navigate to a hash route, e.g. `navigateHash('/terms')`. */
export function navigateHash(path: string): void {
  window.location.hash = path;
}
