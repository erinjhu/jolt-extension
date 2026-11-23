/**
 * Maintains the machine-readable `jolt_sessions.json` inside the JoltSync
 * folder. This is the contract the Chrome extension reads to list and
 * autofill Jolt sessions.
 *
 * The file holds a `{ sessions: JoltSessionPayload[] }` array. Writing a
 * session upserts it by `id` (newest kept) and keeps the list sorted with
 * the most recent `createdAt` first.
 */

import { throwIfAuthExpired } from './authErrors';
import type { JoltSessionPayload } from '../types/session';

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
export const SESSIONS_FILE_NAME = 'jolt_sessions.json';

/** On-disk shape of the sessions file. */
interface SessionsFile {
  sessions: JoltSessionPayload[];
}

/** Escape a value for safe interpolation into a Drive `q` query string. */
function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Find an existing `jolt_sessions.json` in the folder, or null. */
async function findExistingFileId(
  accessToken: string,
  folderId: string,
): Promise<string | null> {
  const q = [
    `name = '${escapeDriveQuery(SESSIONS_FILE_NAME)}'`,
    `'${escapeDriveQuery(folderId)}' in parents`,
    'trashed = false',
  ].join(' and ');

  const params = new URLSearchParams({ q, fields: 'files(id)', spaces: 'drive', pageSize: '1' });
  const res = await fetch(`${DRIVE_FILES_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await throwIfAuthExpired(res);
  if (!res.ok) {
    throw new Error(`Sessions file lookup failed (HTTP ${res.status}).`);
  }
  const body = (await res.json()) as { files?: Array<{ id: string }> };
  return body.files?.[0]?.id ?? null;
}

/** Download and parse the existing sessions file, or return an empty list. */
async function readExistingSessions(
  accessToken: string,
  fileId: string,
): Promise<JoltSessionPayload[]> {
  const res = await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  try {
    const body = (await res.json()) as Partial<SessionsFile>;
    return Array.isArray(body.sessions) ? body.sessions : [];
  } catch {
    return [];
  }
}

/** Upsert a session by id and sort newest-first by `createdAt`. */
function mergeSessions(
  existing: JoltSessionPayload[],
  incoming: JoltSessionPayload,
): JoltSessionPayload[] {
  const withoutDup = existing.filter((s) => s.id !== incoming.id);
  withoutDup.push(incoming);
  return withoutDup.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Multipart create of the sessions file inside the folder. */
function createFileRequest(accessToken: string, folderId: string, json: string): Promise<Response> {
  const boundary = `jolt-${crypto.randomUUID()}`;
  const metadata = { name: SESSIONS_FILE_NAME, mimeType: 'application/json', parents: [folderId] };
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${json}\r\n` +
    `--${boundary}--`;

  return fetch(`${UPLOAD_URL}?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
}

/** Overwrite the content of the existing file via a media upload (PATCH). */
function updateFileRequest(accessToken: string, fileId: string, json: string): Promise<Response> {
  return fetch(`${UPLOAD_URL}/${encodeURIComponent(fileId)}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: json,
  });
}

/**
 * Append `payload` to `jolt_sessions.json` in `folderId` (creating the file
 * if needed), upserting by id and keeping the list newest-first. Returns the
 * file id.
 */
export async function writeSessionFile(
  accessToken: string,
  folderId: string,
  payload: JoltSessionPayload,
): Promise<string> {
  const existingId = await findExistingFileId(accessToken, folderId);
  const existing = existingId ? await readExistingSessions(accessToken, existingId) : [];
  const merged = mergeSessions(existing, payload);
  const json = JSON.stringify({ sessions: merged } satisfies SessionsFile, null, 2);

  const res = existingId
    ? await updateFileRequest(accessToken, existingId, json)
    : await createFileRequest(accessToken, folderId, json);

  await throwIfAuthExpired(res);

  if (!res.ok) {
    throw new Error(`Could not write ${SESSIONS_FILE_NAME} (HTTP ${res.status}).`);
  }
  const body = (await res.json()) as { id?: string };
  return body.id ?? existingId ?? '';
}
