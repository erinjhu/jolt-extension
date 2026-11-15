/**
 * Lists and creates target Google Docs inside the `JoltSync` folder, for the
 * landing screen's document selector. Uses the `drive.file` scope, so listing
 * returns the Docs this app created (plus any the user grants via the Picker).
 */

import { ensureSyncFolder } from './driveFolderService';
import { createDocInFolder, type CreatedDoc } from './googleDocsService';

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DOC_MIME = 'application/vnd.google-apps.document';

/** A selectable target document. */
export interface TargetDoc {
  id: string;
  name: string;
}

/** Escape a value for safe interpolation into a Drive `q` query string. */
function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * List Google Docs in the JoltSync folder, most recently modified first.
 * Returns an empty list when the folder has no docs yet.
 */
export async function listRecentDocs(accessToken: string): Promise<TargetDoc[]> {
  const folderId = await ensureSyncFolder(accessToken);
  const q = [
    `'${escapeDriveQuery(folderId)}' in parents`,
    `mimeType = '${DOC_MIME}'`,
    'trashed = false',
  ].join(' and ');

  const params = new URLSearchParams({
    q,
    fields: 'files(id,name)',
    orderBy: 'modifiedTime desc',
    spaces: 'drive',
    pageSize: '25',
  });

  const res = await fetch(`${DRIVE_FILES_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Could not list documents (HTTP ${res.status}).`);
  }
  const body = (await res.json()) as { files?: TargetDoc[] };
  return body.files ?? [];
}

/**
 * Create a new, empty Google Doc named `title`. Saved in `folderId` when
 * given, otherwise in the JoltSync folder. Returns it as the active target.
 */
export async function createTargetDoc(
  accessToken: string,
  title: string,
  folderId?: string,
): Promise<CreatedDoc> {
  const parentId = folderId ?? (await ensureSyncFolder(accessToken));
  return createDocInFolder(accessToken, parentId, title.trim() || 'Untitled Session', '');
}

/** Resolve the default JoltSync folder as a selectable target. */
export async function getDefaultFolder(accessToken: string): Promise<TargetDoc> {
  return { id: await ensureSyncFolder(accessToken), name: 'JoltSync' };
}
