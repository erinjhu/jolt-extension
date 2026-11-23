/**
 * Popup controller. Renders a chronological list of all Drive sessions
 * (newest first) with per-row sync status, triggers a Drive sync via the
 * background worker, and forwards per-session autofill requests to the
 * content script on the active Jolt tab. No OAuth logic lives here.
 */

import {
  describeAuthError,
  getSignedInSession,
  isAuthCancellation,
  signIn,
  signOut,
  switchAccount,
  type AuthSession,
} from './auth';
import type { AutofillReport } from './content';
import {
  CachedSessions,
  ExtensionMessage,
  JoltSessionPayload,
  MessageResponse,
  SessionSummary,
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
  account: document.getElementById('account-email') as HTMLSpanElement,
  accountRow: document.getElementById('account-row') as HTMLElement,
  signinView: document.getElementById('signin-view') as HTMLElement,
  signinBtn: document.getElementById('signin-btn') as HTMLButtonElement,
  mainView: document.getElementById('main-view') as HTMLElement,
  signOutBtn: document.getElementById('signout-btn') as HTMLButtonElement,
  switchBtn: document.getElementById('switch-btn') as HTMLButtonElement,
  empty: document.getElementById('session-empty') as HTMLParagraphElement,
  list: document.getElementById('session-list') as HTMLUListElement,
  syncBtn: document.getElementById('sync-btn') as HTMLButtonElement,
  status: document.getElementById('status') as HTMLParagraphElement,
  errorBanner: document.getElementById('error-banner') as HTMLParagraphElement,
};

let sessions: SessionSummary[] = [];
let syncedIds = new Set<string>();
/** Stays false until a session has actually been verified. */
let isAuthenticated = false;

/** Show (or clear, with null) the monochrome auth error banner. */
function setAuthError(message: string | null): void {
  els.errorBanner.textContent = message ?? '';
  els.errorBanner.hidden = !message;
}

/** Show a transient status line in one of three tones. */
function setStatus(text: string, tone: 'ok' | 'err' | 'info' = 'info'): void {
  els.status.textContent = text;
  els.status.className = tone;
}

/** Send a typed message to the background worker. */
function sendToBackground<T>(message: ExtensionMessage): Promise<MessageResponse<T>> {
  return chrome.runtime.sendMessage(message) as Promise<MessageResponse<T>>;
}

/** Format a session's date/time and duration for the row subtitle. */
function formatMeta(session: SessionSummary): string {
  const when = new Date(session.createdAt);
  const stamp = Number.isNaN(when.getTime())
    ? session.date || '—'
    : when.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
  return `${stamp} · ${session.durationHours}h ${session.durationMinutes}m`;
}

/** Build the right-side action: a "Synced" badge or a "Sync" button. */
function buildAction(session: SessionSummary): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'session-action';

  if (syncedIds.has(session.id)) {
    const badge = document.createElement('button');
    badge.className = 'synced-badge';
    badge.title = 'Synced — click to autofill again';
    badge.innerHTML = '<span class="check" aria-hidden="true">✓</span>Synced';
    badge.addEventListener('click', () => void onSyncSession(session));
    wrapper.appendChild(badge);
  } else {
    const btn = document.createElement('button');
    btn.className = 'primary';
    btn.textContent = 'Sync';
    btn.addEventListener('click', () => void onSyncSession(session));
    wrapper.appendChild(btn);
  }
  return wrapper;
}

/** Render the full session list (already newest-first from the fetcher). */
function renderList(): void {
  els.list.textContent = '';

  if (sessions.length === 0) {
    els.empty.hidden = false;
    els.list.hidden = true;
    return;
  }
  els.empty.hidden = true;
  els.list.hidden = false;

  for (const session of sessions) {
    const row = document.createElement('li');
    row.className = 'session-row';
    row.dataset.id = session.id;

    const info = document.createElement('div');
    info.className = 'session-info';
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = session.title || '(untitled session)';
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = formatMeta(session);
    info.append(title, meta);

    row.append(info, buildAction(session));
    els.list.appendChild(row);
  }
}

/** Replace a single row's action in place after its sync status changes. */
function refreshRowAction(session: SessionSummary): void {
  const row = els.list.querySelector<HTMLLIElement>(`li[data-id="${CSS.escape(session.id)}"]`);
  const existing = row?.querySelector('.session-action');
  if (row && existing) {
    row.replaceChild(buildAction(session), existing);
  }
}

/** Load the cached sessions + synced ids and render them on open. */
async function loadSessions(): Promise<void> {
  const [listRes, idsRes] = await Promise.all([
    sendToBackground<CachedSessions>({ type: 'GET_CACHED_SESSIONS' }),
    sendToBackground<string[]>({ type: 'GET_SYNCED_IDS' }),
  ]);
  if (idsRes.ok) syncedIds = new Set(idsRes.data);
  if (listRes.ok) {
    sessions = listRes.data.sessions;
    renderList();
  } else {
    setStatus(listRes.error, 'err');
  }
}

/** Handle "Sync from Drive": fetch the full list, then re-render. */
async function onSyncFromDrive(): Promise<void> {
  els.syncBtn.disabled = true;
  setStatus('Syncing from Google Drive…', 'info');
  try {
    const res = await sendToBackground<CachedSessions>({ type: 'SYNC_FROM_DRIVE' });
    if (res.ok) {
      sessions = res.data.sessions;
      renderList();
      setStatus(`Fetched ${sessions.length} session(s).`, 'ok');
    } else {
      setStatus(res.error, 'err');
    }
  } catch (err) {
    setStatus(err instanceof Error ? err.message : 'Sync failed.', 'err');
  } finally {
    els.syncBtn.disabled = false;
  }
}

/**
 * Ensure the autofill content script is actually running in the tab before we
 * message it. A tab opened before the extension was installed/reloaded has no
 * content script, so `sendMessage` would fail with "receiving end does not
 * exist".
 *
 * We must NOT inject unconditionally: the bundle declares top-level
 * `const`s, so loading it a second time into the same page throws
 * "Identifier has already been declared". Instead we PING first and only
 * inject when no listener answers, so the script loads at most once per tab.
 */
async function ensureContentScript(tabId: number): Promise<void> {
  // 1. Is a content script already listening in this tab?
  try {
    const pong = (await chrome.tabs.sendMessage(tabId, {
      type: 'PING',
    } satisfies ExtensionMessage)) as MessageResponse<'pong'>;
    if (pong?.ok) return; // already present — do not inject again
  } catch {
    // No listener yet; fall through to inject.
  }

  // 2. Inject exactly once.
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  } catch {
    // Injection can fail on restricted pages; the send below will surface a
    // clearer error if the script truly isn't reachable.
  }
}

/** Autofill one specific session into the active Jolt tab. */
async function onSyncSession(session: SessionSummary): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !isJoltTab(tab)) {
    setStatus('Open a writewithjolt.com tab to autofill.', 'err');
    return;
  }

  setStatus(`Filling “${session.title || 'session'}”…`, 'info');
  try {
    // The cached summary omits the image to stay within the storage quota;
    // fetch the full payload (with imageBase64) from Drive just before filling.
    const payloadRes = await sendToBackground<JoltSessionPayload>({
      type: 'GET_SESSION_PAYLOAD',
      sessionId: session.id,
    });
    if (!payloadRes.ok) {
      setStatus(payloadRes.error, 'err');
      return;
    }

    await ensureContentScript(tab.id);
    const res = (await chrome.tabs.sendMessage(tab.id, {
      type: 'AUTOFILL_JOLT',
      payload: payloadRes.data,
    } satisfies ExtensionMessage)) as MessageResponse<AutofillReport>;

    if (!res.ok) {
      setStatus(res.error, 'err');
      return;
    }

    // Success: record the id, flip the row to the "Synced" badge.
    const idsRes = await sendToBackground<string[]>({
      type: 'MARK_SESSION_SYNCED',
      sessionId: session.id,
    });
    if (idsRes.ok) syncedIds = new Set(idsRes.data);
    refreshRowAction(session);
    setStatus(`Synced “${session.title || 'session'}”.`, 'ok');
  } catch (err) {
    const reason = err instanceof Error ? err.message : '';
    setStatus(
      `Could not reach the Jolt tab${reason ? ` (${reason})` : ''}. ` +
        'Make sure the Add Manual Session modal is open, then try again.',
      'err',
    );
  }
}

/** Toggle between the sign-in view and the main view by auth state. */
function renderAuth(session: AuthSession | null): void {
  isAuthenticated = session !== null;
  els.account.textContent = session ? (session.email ?? 'Google account connected') : '';
  els.accountRow.hidden = !isAuthenticated;
  els.signOutBtn.hidden = !isAuthenticated;
  els.switchBtn.hidden = !isAuthenticated;
  els.mainView.hidden = !isAuthenticated;
  els.signinView.hidden = isAuthenticated;
}

/** Return the popup to its signed-out state and drop any loaded sessions. */
function resetToSignedOut(): void {
  sessions = [];
  syncedIds = new Set();
  renderList();
  renderAuth(null);
}

/** Handle "Sign In with Google". */
async function onSignIn(): Promise<void> {
  els.signinBtn.disabled = true;
  setAuthError(null);
  setStatus('Opening Google sign-in…', 'info');
  try {
    renderAuth(await signIn());
    setStatus('', 'info');
    await loadSessions();
  } catch (err) {
    // Closing the Google window is not an error — reset quietly.
    setStatus('', 'info');
    if (!isAuthCancellation(err)) setAuthError(describeAuthError(err));
  } finally {
    els.signinBtn.disabled = false;
  }
}

/** Handle "Sign Out": revoke, clear caches, reset the UI immediately. */
async function onSignOut(): Promise<void> {
  setAuthButtonsDisabled(true);
  resetToSignedOut();
  setAuthError(null);
  setStatus('', 'info');
  try {
    await signOut();
  } finally {
    setAuthButtonsDisabled(false);
  }
}

/** Handle "Switch Account": full sign-out, then a fresh account chooser. */
async function onSwitchAccount(): Promise<void> {
  setAuthButtonsDisabled(true);
  resetToSignedOut();
  setAuthError(null);
  setStatus('Opening Google account chooser…', 'info');
  try {
    renderAuth(await switchAccount());
    setStatus('', 'info');
    await loadSessions();
  } catch (err) {
    setStatus('', 'info');
    if (!isAuthCancellation(err)) setAuthError(describeAuthError(err));
  } finally {
    setAuthButtonsDisabled(false);
  }
}

function setAuthButtonsDisabled(disabled: boolean): void {
  els.signOutBtn.disabled = disabled;
  els.switchBtn.disabled = disabled;
}

/** Resolve the current auth state on open and render the matching view. */
async function initAuth(): Promise<void> {
  renderAuth(null); // signed-out until verified
  try {
    const session = await getSignedInSession();
    renderAuth(session);
    if (session) await loadSessions();
  } catch (err) {
    renderAuth(null);
    if (!isAuthCancellation(err)) setAuthError(describeAuthError(err));
  }
}

els.signinBtn.addEventListener('click', () => void onSignIn());
els.signOutBtn.addEventListener('click', () => void onSignOut());
els.switchBtn.addEventListener('click', () => void onSwitchAccount());
els.syncBtn.addEventListener('click', () => void onSyncFromDrive());

void initAuth();
