/**
 * Creates a Google Doc from plain text inside a given Drive folder using the
 * Drive multipart upload endpoint. The `text/plain` body is converted to a
 * native Google Doc by setting the target mimeType to google-apps.document.
 *
 * Works under the `drive.file` scope because the app both creates and then
 * owns the resulting document.
 */

import { throwIfAuthExpired } from './authErrors';

const UPLOAD_URL =
  'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';
const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_FILES_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const DOC_MIME = 'application/vnd.google-apps.document';

/** Metadata returned for a freshly created Google Doc. */
export interface CreatedDoc {
  id: string;
  name: string;
  /** Shareable link that opens the document in the Drive UI. */
  webViewLink: string;
}

/** Result of transcribing an image via Drive's native server-side OCR. */
export interface DriveTranscription {
  docId: string;
  /** Shareable link that opens the generated Google Doc. */
  webViewLink: string;
  /** Text extracted by Google's server-side OCR, trimmed of artifacts. */
  extractedText: string;
}

/**
 * Create a Google Doc named `name` inside `folderId`, seeded with `text`.
 * Returns the id, name, and webViewLink of the new document.
 */
export async function createDocInFolder(
  accessToken: string,
  folderId: string,
  name: string,
  text: string,
): Promise<CreatedDoc> {
  const boundary = `jolt-${crypto.randomUUID()}`;
  const metadata = {
    name,
    mimeType: DOC_MIME,
    parents: [folderId],
  };

  // Multipart body: JSON metadata part, then the plain-text content part.
  const body =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: text/plain; charset=UTF-8\r\n\r\n' +
    `${text}\r\n` +
    `--${boundary}--`;

  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  await throwIfAuthExpired(res);

  if (!res.ok) {
    throw new Error(`Could not create the Google Doc (HTTP ${res.status}).`);
  }

  const doc = (await res.json()) as Partial<CreatedDoc>;
  if (!doc.id || !doc.webViewLink) {
    throw new Error('Drive did not return the new document link.');
  }
  return { id: doc.id, name: doc.name ?? name, webViewLink: doc.webViewLink };
}

/**
 * Strip leading/trailing whitespace and common export artifacts (BOM, stray
 * carriage returns) from Drive's exported plain text.
 */
function cleanExportedText(raw: string): string {
  return raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

/** Minimal shape of the Docs API `documents.get` body we read text from. */
interface DocsApiStructuralElement {
  paragraph?: {
    elements?: { textRun?: { content?: string } }[];
  };
}
interface DocsApiDocument {
  body?: { content?: DocsApiStructuralElement[] };
}

/** Flatten a Docs API document body into plain text (paragraph text runs). */
function extractPlainText(doc: DocsApiDocument): string {
  const parts: string[] = [];
  for (const el of doc.body?.content ?? []) {
    for (const run of el.paragraph?.elements ?? []) {
      if (run.textRun?.content) parts.push(run.textRun.content);
    }
  }
  return cleanExportedText(parts.join(''));
}

/**
 * Fetch the current plain text of an existing Google Doc.
 *
 * Primary path: the Google Docs API (`GET /v1/documents/{id}`), reading text
 * from `body.content[].paragraph.elements[].textRun.content`. Falls back to
 * the Drive export endpoint (`/files/{id}/export?mimeType=text/plain`) only if
 * the Docs API call fails, so a 403 on one path doesn't block the editor.
 *
 * The caller surfaces any final failure inline in Editor Mode (it never resets
 * the active view), so a doc that can't be read shows a message rather than
 * bouncing the user home.
 *
 * @param accessToken OAuth token (Docs API or `drive.file` scope).
 * @param fileId      The Google Doc's id.
 */
export async function fetchDocumentText(
  accessToken: string,
  fileId: string,
): Promise<string> {
  // Guard against stray whitespace in the id (e.g. from a Picker payload).
  const cleanId = encodeURIComponent(fileId.trim());
  const headers = { Authorization: `Bearer ${accessToken}` };

  // Primary: Google Docs API documents.get.
  let docsError: string | null = null;
  try {
    const res = await fetch(`${DOCS_API_URL}/${cleanId}`, { headers });
    if (res.ok) {
      return extractPlainText((await res.json()) as DocsApiDocument);
    }
    docsError = `HTTP ${res.status}`;
  } catch {
    docsError = 'network error';
  }

  // Fallback: Drive plain-text export.
  const exportUrl = `${DRIVE_FILES_URL}/${cleanId}/export?mimeType=text/plain`;
  const res = await fetch(exportUrl, { headers });
  await throwIfAuthExpired(res);
  if (!res.ok) {
    throw new Error(
      `Could not load the document text (Docs API ${docsError}, export HTTP ${res.status}).`,
    );
  }
  return cleanExportedText(await res.text());
}

/**
 * Resolve the human-readable name of the Drive folder a document lives in.
 *
 * Looks up the file's `parents`, then fetches that parent's `name`. Falls back
 * cleanly to `"My Drive"` when the file has no parent (root), when the parent
 * lookup is denied/unavailable under `drive.file`, or on any error — so the
 * caller always gets a usable label and never has to handle a throw.
 *
 * @param accessToken OAuth token with the `drive.file` scope.
 * @param fileId      The Google Doc's Drive file id.
 * @returns The parent folder's name, or `"My Drive"` as a safe default.
 */
export async function fetchDocumentFolderName(
  accessToken: string,
  fileId: string,
): Promise<string> {
  const DEFAULT_FOLDER = 'My Drive';
  try {
    const fileRes = await fetch(
      `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?fields=parents`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!fileRes.ok) return DEFAULT_FOLDER;

    const { parents } = (await fileRes.json()) as { parents?: string[] };
    const parentId = parents?.[0];
    if (!parentId) return DEFAULT_FOLDER;

    const parentRes = await fetch(
      `${DRIVE_FILES_URL}/${encodeURIComponent(parentId)}?fields=name`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!parentRes.ok) return DEFAULT_FOLDER;

    const { name } = (await parentRes.json()) as { name?: string };
    return name?.trim() || DEFAULT_FOLDER;
  } catch {
    return DEFAULT_FOLDER;
  }
}

/**
 * Overwrite the full text of an existing Google Doc by uploading new
 * `text/plain` content through the Drive media-update endpoint
 * (`PATCH /upload/drive/v3/files/{fileId}?uploadType=media`). Drive re-converts
 * the plain text into the document's body, replacing the previous content.
 *
 * This uses the Drive API (same as the editor's read/export path) rather than
 * the Google Docs API. The `drive.file` scope authorizes it for docs this app
 * created or that the user granted via the Picker, and it does not require the
 * separate Google Docs API to be enabled on the Cloud project — which is what
 * previously produced an HTTP 403 on `docs.googleapis.com`.
 *
 * @param accessToken OAuth token with the `drive.file` scope.
 * @param documentId  The Google Doc's Drive file id.
 * @param newText     The full plain text the document should contain.
 */
export async function saveDocumentText(
  accessToken: string,
  documentId: string,
  newText: string,
): Promise<void> {
  const updateUrl = `${DRIVE_UPLOAD_FILES_URL}/${encodeURIComponent(documentId)}?uploadType=media`;
  const res = await fetch(updateUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'text/plain; charset=UTF-8',
    },
    body: newText,
  });
  await throwIfAuthExpired(res);
  if (!res.ok) {
    throw new Error(`Could not save the document (HTTP ${res.status}).`);
  }
}

const DOCS_API_URL = 'https://docs.googleapis.com/v1/documents';

/** The body's end index from the Docs API; the body starts at index 1. */
async function fetchBodyEndIndex(accessToken: string, documentId: string): Promise<number> {
  const res = await fetch(`${DOCS_API_URL}/${encodeURIComponent(documentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await throwIfAuthExpired(res);
  if (!res.ok) {
    throw new Error(`Could not read the document before appending (HTTP ${res.status}).`);
  }
  const body = (await res.json()) as { body?: { content?: { endIndex?: number }[] } };
  const content = body.body?.content ?? [];
  return content.reduce((max, seg) => Math.max(max, seg.endIndex ?? 0), 1);
}

/**
 * Append `newText` to the end of an existing Google Doc WITHOUT touching any
 * existing content, so headings, colors, lists, tables, and images are
 * preserved. Uses the Docs API `insertText` at `endIndex - 1` (just before the
 * body's trailing newline) rather than a full overwrite.
 *
 * Returns the index at which the appended text starts, so the caller can
 * re-append on subsequent auto-saves by first removing only the previously
 * appended range (see `replaceAppendedRange`).
 *
 * NOTE: unlike `saveDocumentText` (Drive media), this requires the Google Docs
 * API to be enabled on the Cloud project.
 *
 * @returns The start index of the inserted text within the document body.
 */
export async function appendDocumentText(
  accessToken: string,
  documentId: string,
  newText: string,
): Promise<number> {
  const endIndex = await fetchBodyEndIndex(accessToken, documentId);
  // Body is empty when endIndex <= 2 (just the mandatory trailing newline).
  const isEmpty = endIndex <= 2;
  const insertIndex = Math.max(1, endIndex - 1);
  const payload = isEmpty || !newText ? newText : `\n\n${newText}`;
  if (!payload) return insertIndex;

  const res = await fetch(`${DOCS_API_URL}/${encodeURIComponent(documentId)}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [{ insertText: { location: { index: insertIndex }, text: payload } }],
    }),
  });
  await throwIfAuthExpired(res);
  if (!res.ok) {
    throw new Error(`Could not append to the document (HTTP ${res.status}).`);
  }
  // The visible appended text starts after the "\n\n" prefix (when present).
  return insertIndex + (isEmpty || !newText ? 0 : 2);
}

/**
 * Update only the previously appended session text: delete everything from
 * `appendStart` to the end of the body, then insert the current `newText`.
 * Content before `appendStart` (the user's pre-existing document) is never
 * touched. Used by the append-only editor's debounced auto-save so repeated
 * saves don't duplicate the appended block.
 *
 * @param appendStart The body index where this session's appended text begins.
 */
export async function replaceAppendedRange(
  accessToken: string,
  documentId: string,
  appendStart: number,
  newText: string,
): Promise<void> {
  const endIndex = await fetchBodyEndIndex(accessToken, documentId);
  const requests: unknown[] = [];
  // Remove the old appended block (if any) without crossing into prior content.
  if (endIndex - 1 > appendStart) {
    requests.push({
      deleteContentRange: { range: { startIndex: appendStart, endIndex: endIndex - 1 } },
    });
  }
  if (newText) {
    requests.push({ insertText: { location: { index: appendStart }, text: newText } });
  }
  if (requests.length === 0) return;

  const res = await fetch(`${DOCS_API_URL}/${encodeURIComponent(documentId)}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });
  await throwIfAuthExpired(res);
  if (!res.ok) {
    throw new Error(`Could not update the appended text (HTTP ${res.status}).`);
  }
}

/**
 * Move a Drive file to the trash. Used to discard the scratch OCR doc once its
 * text has been appended to the real target doc. Best-effort: never throws.
 */
export async function trashDriveFile(accessToken: string, fileId: string): Promise<void> {
  try {
    await fetch(`${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ trashed: true }),
    });
  } catch {
    // Leaving a stray scratch doc in JoltSync is harmless.
  }
}

/**
 * Upload a preprocessed image to Drive as a native Google Doc so Google's
 * server-side Vision/OCR engine transcribes the handwriting, then export the
 * resulting text. This is the primary (high-quality) transcription path.
 *
 * @param accessToken OAuth token with the `drive.file` scope.
 * @param folderId    Drive folder to create the document in.
 * @param imageBlob   Preprocessed image (JPEG or PNG).
 * @param docTitle    Name for the generated Google Doc.
 * @param imageMime   The image's content type; defaults to the blob's own type.
 */
export async function transcribeImageWithGoogleDrive(
  accessToken: string,
  folderId: string,
  imageBlob: Blob,
  docTitle: string,
  imageMime: string = imageBlob.type || 'image/jpeg',
): Promise<DriveTranscription> {
  const boundary = `jolt-${crypto.randomUUID()}`;
  const metadata = {
    name: docTitle,
    parents: [folderId],
    mimeType: DOC_MIME,
  };

  // Build the multipart/related body from Blob parts so the binary image
  // survives intact (string concatenation would corrupt the bytes).
  const body = new Blob(
    [
      `--${boundary}\r\n`,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      `${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\n`,
      `Content-Type: ${imageMime}\r\n\r\n`,
      imageBlob,
      `\r\n--${boundary}--`,
    ],
    { type: `multipart/related; boundary=${boundary}` },
  );

  const uploadRes = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  });
  await throwIfAuthExpired(uploadRes);
  if (!uploadRes.ok) {
    throw new Error(`Drive image conversion failed (HTTP ${uploadRes.status}).`);
  }

  const doc = (await uploadRes.json()) as Partial<CreatedDoc>;
  if (!doc.id || !doc.webViewLink) {
    throw new Error('Drive did not return the converted document link.');
  }

  const exportUrl = `${DRIVE_FILES_URL}/${doc.id}/export?mimeType=text/plain`;
  const exportRes = await fetch(exportUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await throwIfAuthExpired(exportRes);
  if (!exportRes.ok) {
    throw new Error(`Could not export transcribed text (HTTP ${exportRes.status}).`);
  }

  const extractedText = cleanExportedText(await exportRes.text());
  return { docId: doc.id, webViewLink: doc.webViewLink, extractedText };
}
