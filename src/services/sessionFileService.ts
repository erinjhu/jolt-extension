/**
 * Writes the machine-readable `latest_jolt_session.json` into the JoltSync
 * folder. This is the contract the Chrome extension reads to autofill Jolt.
 *
 * If a file of that name already exists in the folder, it is overwritten so
 * the extension always sees the most recent session (hence "latest").
 */

import type { JoltSessionPayload } from '../types/session';

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
export const SESSION_FILE_NAME = 'latest_jolt_session.json';

/** Escape a value for safe interpolation into a Drive `q` query string. */
function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** Find an existing `latest_jolt_session.json` in the folder, or null. */
async function findExistingFileId(
  accessToken: string,
  folderId: string,
): Promise<string | null> {
  const q = [
    `name = '${escapeDriveQuery(SESSION_FILE_NAME)}'`,
    `'${escapeDriveQuery(folderId)}' in parents`,
    'trashed = false',
  ].join(' and ');

  const params = new URLSearchParams({ q, fields: 'files(id)', spaces: 'drive', pageSize: '1' });
  const res = await fetch(`${DRIVE_FILES_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Session file lookup failed (HTTP ${res.status}).`);
  }
  const body = (await res.json()) as { files?: Array<{ id: string }> };
  return body.files?.[0]?.id ?? null;
}

/** Multipart create of a new JSON file inside the folder. */
function createFileRequest(accessToken: string, folderId: string, json: string): Promise<Response> {
  const boundary = `jolt-${crypto.randomUUID()}`;
  const metadata = { name: SESSION_FILE_NAME, mimeType: 'application/json', parents: [folderId] };
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

/** Overwrite the content of an existing file via a media upload (PATCH). */
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
 * Write (create or overwrite) `latest_jolt_session.json` in `folderId` with
 * the given payload. Returns the file id.
 */
export async function writeSessionFile(
  accessToken: string,
  folderId: string,
  payload: JoltSessionPayload,
): Promise<string> {
  const json = JSON.stringify(payload, null, 2);
  const existingId = await findExistingFileId(accessToken, folderId);

  const res = existingId
    ? await updateFileRequest(accessToken, existingId, json)
    : await createFileRequest(accessToken, folderId, json);

  if (!res.ok) {
    throw new Error(`Could not write ${SESSION_FILE_NAME} (HTTP ${res.status}).`);
  }
  const body = (await res.json()) as { id?: string };
  return body.id ?? existingId ?? '';
}
