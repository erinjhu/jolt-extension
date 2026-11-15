/**
 * Creates a Google Doc from plain text inside a given Drive folder using the
 * Drive multipart upload endpoint. The `text/plain` body is converted to a
 * native Google Doc by setting the target mimeType to google-apps.document.
 *
 * Works under the `drive.file` scope because the app both creates and then
 * owns the resulting document.
 */

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

/**
 * Fetch the current plain-text content of an existing Google Doc by exporting
 * it through the Drive API (`GET /drive/v3/files/{fileId}/export`). The export
 * path works under the `drive.file` scope for docs this app created or that
 * the user granted via the Picker, which is why we prefer it over the broader
 * Docs API (`documents.get`).
 *
 * @param accessToken OAuth token with the `drive.file` scope.
 * @param fileId      The Google Doc's Drive file id.
 * @returns The document's plain text, cleaned of BOM / carriage-return noise.
 */
export async function fetchDocumentText(
  accessToken: string,
  fileId: string,
): Promise<string> {
  const exportUrl = `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}/export?mimeType=text/plain`;
  const res = await fetch(exportUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Could not load the document text (HTTP ${res.status}).`);
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
  if (!res.ok) {
    throw new Error(`Could not save the document (HTTP ${res.status}).`);
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
  if (!exportRes.ok) {
    throw new Error(`Could not export transcribed text (HTTP ${exportRes.status}).`);
  }

  const extractedText = cleanExportedText(await exportRes.text());
  return { docId: doc.id, webViewLink: doc.webViewLink, extractedText };
}
