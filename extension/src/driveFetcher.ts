/**
 * Google Drive integration: locate the `JoltSync` folder, read
 * `latest_jolt_session.json`, validate it, and cache it in
 * `chrome.storage.local`.
 *
 * All requests hit `https://www.googleapis.com/*`, which is the only Google
 * host the manifest is permitted to reach.
 */

import { getAuthToken, removeCachedToken } from './auth';
import {
  CachedSession,
  JoltSessionPayload,
  STORAGE_KEY,
} from './types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const SYNC_FOLDER_NAME = 'JoltSync';
const SESSION_FILE_NAME = 'latest_jolt_session.json';

/** Escape a value for safe interpolation into a Drive `q` query string. */
function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

interface DriveFileListResponse {
  files?: Array<{ id: string; name: string }>;
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
    await removeCachedToken(token);
    const freshToken = await retryWith();
    return fetch(`${DRIVE_API}${path}`, {
      headers: { Authorization: `Bearer ${freshToken}` },
    });
  }

  return res;
}

/** Find the id of the first non-trashed `JoltSync` folder owned by the user. */
async function findSyncFolderId(token: string): Promise<string> {
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

  const res = await driveFetch(`/files?${params.toString()}`, token);
  if (!res.ok) {
    throw new Error(`Drive folder lookup failed (HTTP ${res.status}).`);
  }

  const body = (await res.json()) as DriveFileListResponse;
  const folder = body.files?.[0];
  if (!folder) {
    throw new Error(
      `Could not find a "${SYNC_FOLDER_NAME}" folder in your Google Drive.`,
    );
  }
  return folder.id;
}

/** Find the id of `latest_jolt_session.json` within the given folder. */
async function findSessionFileId(
  folderId: string,
  token: string,
): Promise<string> {
  const q = [
    `name = '${escapeDriveQuery(SESSION_FILE_NAME)}'`,
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

  const res = await driveFetch(`/files?${params.toString()}`, token);
  if (!res.ok) {
    throw new Error(`Drive file lookup failed (HTTP ${res.status}).`);
  }

  const body = (await res.json()) as DriveFileListResponse;
  const file = body.files?.[0];
  if (!file) {
    throw new Error(
      `"${SESSION_FILE_NAME}" was not found inside the "${SYNC_FOLDER_NAME}" folder.`,
    );
  }
  return file.id;
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

  return {
    title: str('title'),
    description: str('description'),
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

/** Persist the validated payload in `chrome.storage.local`. */
async function cacheSession(
  payload: JoltSessionPayload,
): Promise<CachedSession> {
  const cached: CachedSession = { payload, fetchedAt: Date.now() };
  await chrome.storage.local.set({ [STORAGE_KEY]: cached });
  return cached;
}

/**
 * End-to-end Drive sync: authenticate, locate the folder and file, download,
 * validate, and cache. Returns the cached entry on success.
 */
export async function syncFromDrive(): Promise<CachedSession> {
  const token = await getAuthToken(true);
  const refresh = () => getAuthToken(true);

  const folderId = await findSyncFolderId(token);
  const fileId = await findSessionFileId(folderId, token);
  void refresh; // reserved for future silent-retry wiring

  const raw = await downloadSessionFile(fileId, token);
  const payload = validatePayload(raw);
  return cacheSession(payload);
}

/** Read the cached session, or `null` if nothing has been synced yet. */
export async function getCachedSession(): Promise<CachedSession | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const cached = result[STORAGE_KEY] as CachedSession | undefined;
  return cached ?? null;
}
