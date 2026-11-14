/**
 * Popup controller. Pure UI: it renders the cached session, triggers a Drive
 * sync via the background worker, and forwards an autofill request to the
 * content script on the active Jolt tab. No network or OAuth logic lives here.
 */

import { disconnect, getSignedInSession, signIn, type AuthSession } from './auth';
import type { AutofillReport } from './content';
import {
  CachedSession,
  ExtensionMessage,
  JoltSessionPayload,
  MessageResponse,
} from './types';

/** Hosts the autofill content script is allowed to run on. */
const JOLT_HOSTS = new Set(['writewithjolt.com', 'www.writewithjolt.com']);

/** True when the tab points at a Jolt page we can autofill. */
function isJoltTab(tab: chrome.tabs.Tab | undefined): boolean {
  const raw = tab?.url || tab?.pendingUrl;
  if (!raw) return false;
  try {
    const { protocol, hostname } = new URL(raw);
    return protocol === 'https:' && JOLT_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

const els = {
  badge: document.getElementById('auth-badge') as HTMLSpanElement,
  badgeText: document.getElementById('auth-badge-text') as HTMLSpanElement,
  signinView: document.getElementById('signin-view') as HTMLElement,
  signinBtn: document.getElementById('signin-btn') as HTMLButtonElement,
  mainView: document.getElementById('main-view') as HTMLElement,
  disconnectBtn: document.getElementById('disconnect-btn') as HTMLButtonElement,
  empty: document.getElementById('session-empty') as HTMLParagraphElement,
  title: document.getElementById('session-title') as HTMLParagraphElement,
  meta: document.getElementById('session-meta') as HTMLParagraphElement,
  syncBtn: document.getElementById('sync-btn') as HTMLButtonElement,
  autofillBtn: document.getElementById('autofill-btn') as HTMLButtonElement,
  status: document.getElementById('status') as HTMLParagraphElement,
};

let currentPayload: JoltSessionPayload | null = null;

/** Show a transient status line in one of three tones. */
function setStatus(text: string, tone: 'ok' | 'err' | 'info' = 'info'): void {
  els.status.textContent = text;
  els.status.className = tone;
}

/** Send a typed message to the background worker. */
function sendToBackground<T>(
  message: ExtensionMessage,
): Promise<MessageResponse<T>> {
  return chrome.runtime.sendMessage(message) as Promise<MessageResponse<T>>;
}

/** Render the cached session (or the empty state) into the card. */
function renderSession(cached: CachedSession | null): void {
  currentPayload = cached?.payload ?? null;

  if (!cached) {
    els.empty.hidden = false;
    els.title.hidden = true;
    els.meta.hidden = true;
    els.autofillBtn.disabled = true;
    return;
  }

  const { title, durationHours, durationMinutes, targetDocumentName } =
    cached.payload;

  const hh = String(durationHours).padStart(2, '0');
  const mm = String(durationMinutes).padStart(2, '0');

  els.empty.hidden = true;
  els.title.hidden = false;
  els.meta.hidden = false;
  els.title.textContent = title || '(untitled session)';
  els.meta.textContent = `${hh}h ${mm}m · ${targetDocumentName || 'no document'}`;
  els.autofillBtn.disabled = false;
}

/** Load whatever is cached and render it on popup open. */
async function loadCached(): Promise<void> {
  try {
    const res = await sendToBackground<CachedSession | null>({
      type: 'GET_CACHED_SESSION',
    });
    if (res.ok) {
      renderSession(res.data);
    } else {
      setStatus(res.error, 'err');
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'Failed to load.', 'err');
  }
}

/** Handle "Sync from Drive". */
async function onSync(): Promise<void> {
  els.syncBtn.disabled = true;
  setStatus('Syncing from Google Drive…', 'info');
  try {
    const res = await sendToBackground<CachedSession>({
      type: 'SYNC_FROM_DRIVE',
    });
    if (res.ok) {
      renderSession(res.data);
      setStatus('Synced latest session.', 'ok');
    } else {
      setStatus(res.error, 'err');
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'Sync failed.', 'err');
  } finally {
    els.syncBtn.disabled = false;
  }
}

/** Handle "Autofill Jolt Form" by messaging the content script. */
async function onAutofill(): Promise<void> {
  if (!currentPayload) {
    setStatus('Nothing to autofill — sync first.', 'err');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !isJoltTab(tab)) {
    setStatus('Open a writewithjolt.com tab to autofill.', 'err');
    return;
  }

  els.autofillBtn.disabled = true;
  setStatus('Filling the Jolt form…', 'info');
  try {
    const res = (await chrome.tabs.sendMessage(tab.id, {
      type: 'AUTOFILL_JOLT',
      payload: currentPayload,
    } satisfies ExtensionMessage)) as MessageResponse<AutofillReport>;

    if (res.ok) {
      const filled = Object.entries(res.data)
        .filter(([, status]) => status === 'filled')
        .map(([field]) => field);
      // Fields the modal exposes but we couldn't fill (missing element, or a
      // dropdown option that didn't match) are surfaced as warnings.
      const missing = Object.entries(res.data)
        .filter(([, status]) => status !== 'filled')
        .map(([field]) => field);

      if (missing.length === 0) {
        setStatus(`Filled all fields: ${filled.join(', ')}.`, 'ok');
      } else {
        setStatus(
          `Filled: ${filled.join(', ') || 'nothing'}. Not filled: ${missing.join(', ')}.`,
          'err',
        );
      }
    } else {
      setStatus(res.error, 'err');
    }
  } catch {
    setStatus(
      'Could not reach the Jolt tab. Reload the page and try again.',
      'err',
    );
  } finally {
    els.autofillBtn.disabled = false;
  }
}

/**
 * Toggle between the sign-in view and the main view by auth state. A valid
 * token means "connected" even when the display email is unavailable.
 */
function renderAuth(session: AuthSession | null): void {
  const connected = Boolean(session);
  const label = session?.email ?? (connected ? 'Connected' : null);
  els.badge.className = `badge ${connected ? 'connected' : 'disconnected'}`;
  els.badgeText.textContent = connected
    ? label === 'Connected'
      ? 'Connected'
      : `Connected as ${label}`
    : 'Not Connected';
  els.disconnectBtn.hidden = !connected;
  els.signinView.hidden = connected;
  els.mainView.hidden = !connected;
}

/** Handle "Sign In with Google". */
async function onSignIn(): Promise<void> {
  els.signinBtn.disabled = true;
  setStatus('Opening Google sign-in…', 'info');
  try {
    const session = await signIn();
    renderAuth(session);
    setStatus('', 'info');
    await loadCached();
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'Sign-in failed.', 'err');
  } finally {
    els.signinBtn.disabled = false;
  }
}

/** Handle "Disconnect". */
async function onDisconnect(): Promise<void> {
  els.disconnectBtn.disabled = true;
  try {
    await disconnect();
    currentPayload = null;
    renderAuth(null);
    setStatus('Disconnected.', 'info');
  } finally {
    els.disconnectBtn.disabled = false;
  }
}

/** Resolve the current auth state on open and render the matching view. */
async function initAuth(): Promise<void> {
  const session = await getSignedInSession();
  renderAuth(session);
  if (session) {
    await loadCached();
  }
}

els.signinBtn.addEventListener('click', () => void onSignIn());
els.disconnectBtn.addEventListener('click', () => void onDisconnect());
els.syncBtn.addEventListener('click', () => void onSync());
els.autofillBtn.addEventListener('click', () => void onAutofill());

void initAuth();
