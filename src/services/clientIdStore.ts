/**
 * Resolves the Google OAuth client ID from the deployment environment. The
 * value is baked in at build time via `VITE_GOOGLE_CLIENT_ID`; users never
 * enter or configure it. An optional hardcoded fallback can be set below for
 * deployments that don't inject the env var.
 */

/** Optional hardcoded fallback for deployments without an injected env var. */
const FALLBACK_CLIENT_ID = '';

/** Client ID from the build-time Vite env, trimmed. */
const envClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();

/** The effective Google OAuth client ID for this build. */
export function resolveClientId(): string {
  return envClientId || FALLBACK_CLIENT_ID;
}

/** True when a client ID is available (env or fallback). */
export function hasClientId(): boolean {
  return Boolean(resolveClientId());
}
