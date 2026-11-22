/**
 * Orchestrates the "Sync to Jolt" flow: ensure the JoltSync folder exists,
 * then create a Google Doc inside it containing the edited session text.
 */

import type { JoltSessionPayload } from '../types/session';
import { docEditUrl } from '../utils/docUrl';
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

/**
 * Compose the Google Doc body. The OCR-transcribed text is the primary body
 * (it is deliberately NOT placed in the editable Description field). If the
 * user also typed manual notes, append them, followed by any quote.
 */
function composeDocBody(payload: JoltSessionPayload): string {
  const lines: string[] = [];
  if (payload.ocrText.trim()) lines.push(payload.ocrText.trim());
  if (payload.description.trim()) {
    if (lines.length) lines.push('');
    lines.push(payload.description.trim());
  }
  if (payload.quote.trim()) {
    lines.push('', `Quote: ${payload.quote.trim()}`);
  }
  return lines.join('\n');
}

/**
 * Run the full sync and return the document the session belongs to. The caller
 * must pass a valid Google access token (user signed in).
 *
 * When `targetDoc` is given, the session text already lives in that doc (scan
 * text was appended, editor text was saved), so NO second doc is created: only
 * the machine-readable session JSON is written, and the returned doc is the
 * target itself. This keeps every post-sync link on the same document.
 * Without a target, a new doc is created from the session text.
 */
export async function syncSessionToDrive(
  accessToken: string,
  payload: JoltSessionPayload,
  targetDoc: { id: string; name: string } | null = null,
): Promise<CreatedDoc> {
  const folderId = await ensureSyncFolder(accessToken);

  const doc: CreatedDoc = targetDoc
    ? { id: targetDoc.id, name: targetDoc.name, webViewLink: docEditUrl(targetDoc.id) }
    : await createDocInFolder(
        accessToken,
        folderId,
        resolveDocName(payload),
        composeDocBody(payload),
      );
  await writeSessionFile(accessToken, folderId, payload);

  return doc;
}
