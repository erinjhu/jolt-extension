/**
 * Orchestrates the "Sync to Jolt" flow: ensure the JoltSync folder exists,
 * then create a Google Doc inside it containing the edited session text.
 */

import type { JoltSessionPayload } from '../types/session';
import { ensureSyncFolder } from './driveFolderService';
import { createDocInFolder, type CreatedDoc } from './googleDocsService';
import { writeSessionFile } from './sessionFileService';

/** Build a `Jolt Session - YYYY-MM-DD HH:MM` fallback name from a date. */
function timestampedName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `Jolt Session - ${date} ${time}`;
}

/** Choose the document name: the session title, or a timestamped fallback. */
function resolveDocName(payload: JoltSessionPayload): string {
  const title = payload.title.trim();
  return title || timestampedName(new Date());
}

/** Compose the document body from the editable session fields. */
function composeDocBody(payload: JoltSessionPayload): string {
  const lines = [payload.description.trim()];
  if (payload.quote.trim()) {
    lines.push('', `Quote: ${payload.quote.trim()}`);
  }
  return lines.join('\n');
}

/**
 * Run the full sync and return the created document's metadata. The caller
 * must pass a valid Google access token (user signed in).
 */
export async function syncSessionToDrive(
  accessToken: string,
  payload: JoltSessionPayload,
): Promise<CreatedDoc> {
  const folderId = await ensureSyncFolder(accessToken);

  // Human-readable Google Doc (for verifying the synced note), plus the
  // machine-readable JSON the Chrome extension reads to autofill Jolt.
  const doc = await createDocInFolder(
    accessToken,
    folderId,
    resolveDocName(payload),
    composeDocBody(payload),
  );
  await writeSessionFile(accessToken, folderId, payload);

  return doc;
}
