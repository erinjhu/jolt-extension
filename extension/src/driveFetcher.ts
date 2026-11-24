/**
 * Google Drive integration: locate the `JoltSync` folder, read
 * `jolt_sessions.json`, validate every session, and cache the newest-first
 * list in `chrome.storage.local`.
 *
 * All requests hit `https://www.googleapis.com/*`, which is the only Google
 * host the manifest is permitted to reach.
 */

import {
  AuthRevokedOrExpiredError,
  clearAuthState,
  getValidToken,
  invalidateToken,
} from './auth';
import {
  CachedSessions,
  JoltSessionPayload,
  SessionSummary,
  SESSIONS_KEY,
  SYNCED_IDS_KEY,
} from './types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const SYNC_FOLDER_NAME = 'JoltSync';
const SESSIONS_FILE_NAME = 'jolt_sessions.json';

/** Escape a value for safe interpolation into a Drive `q` query string. */
function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

interface DriveFileListResponse {
  files?: Array<{ id: string; name: string }>;
}

/** Drive still says 401: the grant is dead. Clear it and surface a typed error. */
async function failAsRevoked(): Promise<never> {
  await clearAuthState();
  throw new AuthRevokedOrExpiredError();
}

/**
 * Issue an authenticated Drive request. On a 401 the token is purged and the
 * call is retried once with a freshly minted token.
 */
async function driveFetch(
  path: string,
  token: string,
  retryWith?: () => Promise<string>,
): Promise<Response> {
  const res = await fetch(`${DRIVE_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 && retryWith) {
    // The token Google rejected is stale/revoked — drop it everywhere, then
    // retry once with a freshly resolved (silent) token. If none exists,
    // `retryWith` throws AuthRevokedOrExpiredError.
    await invalidateToken(token);
    const freshToken = await retryWith();
    const retried = await fetch(`${DRIVE_API}${path}`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    });
    if (retried.status === 401) await failAsRevoked();
    return retried;
  }
  if (res.status === 401) await failAsRevoked();

  return res;
}

/**
 * Find the id of the first non-trashed `JoltSync` folder, or null when it has
 * not been created yet (a normal first-run state, not an error).
 */
async function findSyncFolderId(token: string): Promise<string | null> {
  const q = [
    `name = '${escapeDriveQuery(SYNC_FOLDER_NAME)}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    'trashed = false',
  ].join(' and ');

  const params = new URLSearchParams({
    q,
    fields: 'files(id,name)',
    spaces: 'drive',
    pageSize: '1',
  });

  const res = await driveFetch(`/files?${params.toString()}`, token, getValidToken);
  if (!res.ok) {
    throw new Error(`Drive folder lookup failed (HTTP ${res.status}).`);
  }

  const body = (await res.json()) as DriveFileListResponse;
  return body.files?.[0]?.id ?? null;
}

/** Find the id of `jolt_sessions.json` in the folder, or null when absent. */
async function findSessionsFileId(
  folderId: string,
  token: string,
): Promise<string | null> {
  const q = [
    `name = '${escapeDriveQuery(SESSIONS_FILE_NAME)}'`,
    `'${escapeDriveQuery(folderId)}' in parents`,
    'trashed = false',
  ].join(' and ');

  const params = new URLSearchParams({
    q,
    fields: 'files(id,name)',
    spaces: 'drive',
    pageSize: '1',
    orderBy: 'modifiedTime desc',
  });

  const res = await driveFetch(`/files?${params.toString()}`, token, getValidToken);
  if (!res.ok) {
    throw new Error(`Drive file lookup failed (HTTP ${res.status}).`);
  }

  const body = (await res.json()) as DriveFileListResponse;
  return body.files?.[0]?.id ?? null;
}

/** Download and parse the JSON content of a Drive file. */
async function downloadSessionFile(
  fileId: string,
  token: string,
): Promise<unknown> {
  const params = new URLSearchParams({ alt: 'media' });
  const res = await driveFetch(
    `/files/${encodeURIComponent(fileId)}?${params.toString()}`,
    token,
    getValidToken,
  );
  if (!res.ok) {
    throw new Error(`Failed to download session file (HTTP ${res.status}).`);
  }
  return res.json();
}

/**
 * Narrow unknown JSON into a `JoltSessionPayload`, throwing a readable error
 * if a required field is missing or the wrong type. Guards against malformed
 * or tampered files before they reach the autofill path.
 */
function validatePayload(raw: unknown): JoltSessionPayload {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Session file is not a JSON object.');
  }
  const o = raw as Record<string, unknown>;

  const str = (key: keyof JoltSessionPayload): string => {
    const v = o[key];
    if (typeof v !== 'string') {
      throw new Error(`Session file field "${String(key)}" must be a string.`);
    }
    return v;
  };
  const num = (key: keyof JoltSessionPayload): number => {
    const v = o[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(`Session file field "${String(key)}" must be a number.`);
    }
    return v;
  };

  // Tolerant readers for fields added after the first schema version, so
  // older session files still validate and autofill what they do have.
  const optionalStr = (key: keyof JoltSessionPayload): string => {
    const v = o[key];
    return typeof v === 'string' ? v : '';
  };
  const optionalNum = (key: keyof JoltSessionPayload): number => {
    const v = o[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  };

  // `id` is required going forward, but tolerate legacy files by deriving a
  // stable fallback from createdAt so older sessions still list and sync.
  const id =
    typeof o.id === 'string' && o.id
      ? o.id
      : `legacy-${typeof o.createdAt === 'string' ? o.createdAt : String(Date.now())}`;

  return {
    id,
    title: str('title'),
    description: str('description'),
    ocrText: optionalStr('ocrText'),
    quote: optionalStr('quote'),
    date: optionalStr('date'),
    startTime: str('startTime'),
    stopTime: str('stopTime'),
    durationHours: num('durationHours'),
    durationMinutes: num('durationMinutes'),
    wordCount: optionalNum('wordCount'),
    visibility: o.visibility === 'public' ? 'public' : 'private',
    targetDocumentName: str('targetDocumentName'),
    imageBase64: str('imageBase64'),
    createdAt: str('createdAt'),
  };
}

/**
 * Parse the downloaded file into a validated, newest-first session list.
 * Accepts both the new `{ sessions: [...] }` array format and a legacy
 * single-object file, so older syncs keep working.
 */
function parseSessions(raw: unknown): JoltSessionPayload[] {
  // A blank file, empty array or empty object just means no sessions yet.
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw) && raw.length === 0) return [];
  if (typeof raw === 'object' && Object.keys(raw).length === 0) return [];

  const items: unknown[] =
    raw && typeof raw === 'object' && Array.isArray((raw as { sessions?: unknown[] }).sessions)
      ? (raw as { sessions: unknown[] }).sessions
      : [raw];

  const sessions = items.map(validatePayload);
  // Most recent first (createdAt is an ISO 8601 string, lexicographically sortable).
  return sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Drop the heavy `imageBase64` so the cache stays within the storage quota. */
function toSummary(session: JoltSessionPayload): SessionSummary {
  const { imageBase64: _omit, ...summary } = session;
  return summary;
}

/**
 * Persist lightweight session summaries in `chrome.storage.local`. Images are
 * intentionally excluded here — storing base64 photos for every session would
 * exceed `chrome.storage.local`'s quota (Resource::kQuotaBytes).
 */
async function cacheSessions(
  sessions: JoltSessionPayload[],
): Promise<CachedSessions> {
  const cached: CachedSessions = {
    sessions: sessions.map(toSummary),
    fetchedAt: Date.now(),
  };
  await chrome.storage.local.set({ [SESSIONS_KEY]: cached });
  return cached;
}

/** Download + validate the full (image-bearing) session list from Drive. */
async function fetchAllSessions(): Promise<JoltSessionPayload[]> {
  const token = await getValidToken();
  const folderId = await findSyncFolderId(token);
  if (!folderId) return [];
  const fileId = await findSessionsFileId(folderId, token);
  if (!fileId) return [];
  const raw = await downloadSessionFile(fileId, token);
  return parseSessions(raw);
}

/**
 * End-to-end Drive sync: fetch all sessions, then cache only lightweight
 * summaries (no images) so the popup can list them without hitting the
 * storage quota. Full payloads are re-fetched on demand for autofill.
 */
export async function syncFromDrive(): Promise<CachedSessions> {
  return cacheSessions(await fetchAllSessions());
}

/**
 * Fetch one session's FULL payload (including `imageBase64`) from Drive by id.
 * Used at autofill time so the large image is loaded only when needed, never
 * cached. Returns null if the id is no longer present.
 */
export async function getSessionPayload(
  sessionId: string,
): Promise<JoltSessionPayload | null> {
  const all = await fetchAllSessions();
  return all.find((s) => s.id === sessionId) ?? null;
}

/** Read the cached session list, or an empty list if nothing is cached. */
export async function getCachedSessions(): Promise<CachedSessions> {
  const result = await chrome.storage.local.get(SESSIONS_KEY);
  const cached = result[SESSIONS_KEY] as CachedSessions | undefined;
  return cached ?? { sessions: [], fetchedAt: 0 };
}

/** Read the ids of sessions the user has already autofilled. */
export async function getSyncedSessionIds(): Promise<string[]> {
  const result = await chrome.storage.local.get(SYNCED_IDS_KEY);
  const ids = result[SYNCED_IDS_KEY] as string[] | undefined;
  return Array.isArray(ids) ? ids : [];
}

/** Record `sessionId` as synced; returns the updated id list. */
export async function markSessionSynced(sessionId: string): Promise<string[]> {
  const current = await getSyncedSessionIds();
  if (current.includes(sessionId)) return current;
  const updated = [...current, sessionId];
  await chrome.storage.local.set({ [SYNCED_IDS_KEY]: updated });
  return updated;
}
