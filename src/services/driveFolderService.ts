/**
 * Ensures the `JoltSync` folder exists in the user's Google Drive, creating
 * it when missing. Uses only the `drive.file` scope, so lookups see folders
 * this app created — which is exactly the folder we create here.
 */

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
export const SYNC_FOLDER_NAME = 'JoltSync';

/** Escape a value for safe interpolation into a Drive `q` query string. */
function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

interface DriveFileListResponse {
  files?: Array<{ id: string; name: string }>;
}

/** Look up the first non-trashed `JoltSync` folder, or null when absent. */
async function findSyncFolderId(accessToken: string): Promise<string | null> {
  const q = [
    `name = '${escapeDriveQuery(SYNC_FOLDER_NAME)}'`,
    `mimeType = '${FOLDER_MIME}'`,
    'trashed = false',
  ].join(' and ');

  const params = new URLSearchParams({
    q,
    fields: 'files(id,name)',
    spaces: 'drive',
    pageSize: '1',
  });

  const res = await fetch(`${DRIVE_FILES_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Drive folder lookup failed (HTTP ${res.status}).`);
  }

  const body = (await res.json()) as DriveFileListResponse;
  return body.files?.[0]?.id ?? null;
}

/** Create `JoltSync` in the user's root Drive and return the new folder id. */
async function createSyncFolder(accessToken: string): Promise<string> {
  const res = await fetch(DRIVE_FILES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: SYNC_FOLDER_NAME, mimeType: FOLDER_MIME }),
  });
  if (!res.ok) {
    throw new Error(`Could not create the "${SYNC_FOLDER_NAME}" folder (HTTP ${res.status}).`);
  }
  const body = (await res.json()) as { id?: string };
  if (!body.id) {
    throw new Error('Drive did not return an id for the new folder.');
  }
  return body.id;
}

/**
 * Return the id of the `JoltSync` folder, creating it first if it does not
 * already exist. This is the single entry point callers should use.
 */
export async function ensureSyncFolder(accessToken: string): Promise<string> {
  const existingId = await findSyncFolderId(accessToken);
  return existingId ?? createSyncFolder(accessToken);
}
