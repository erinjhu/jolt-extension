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
const DOCS_API_URL = 'https://docs.googleapis.com/v1/documents';
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
 * The structural index that marks the end of a document's body. The Docs model
 * always starts the body at index 1; the final segment's `endIndex` points one
 * past the last character (the implicit trailing newline Docs enforces).
 */
async function fetchBodyEndIndex(accessToken: string, documentId: string): Promise<number> {
  const res = await fetch(`${DOCS_API_URL}/${encodeURIComponent(documentId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Could not read the document before saving (HTTP ${res.status}).`);
  }
  const body = (await res.json()) as {
    body?: { content?: { endIndex?: number }[] };
  };
  const content = body.body?.content ?? [];
  // The largest endIndex across top-level segments is the body's end.
  return content.reduce((max, seg) => Math.max(max, seg.endIndex ?? 0), 1);
}

/**
 * Overwrite the full text of an existing Google Doc via the Docs API
 * `documents.batchUpdate`. The body range (index 1 to `endIndex - 1`) is
 * deleted, then the new text is inserted at index 1 in a single atomic batch.
 *
 * Docs always keeps a trailing newline, so a truly empty doc reports an
 * `endIndex` of 2; in that case there's nothing to delete and we only insert.
 *
 * @param accessToken OAuth token authorized for the Google Docs API.
 * @param documentId  The target document's id.
 * @param newText     The full plain text the document should contain.
 */
export async function saveDocumentText(
  accessToken: string,
  documentId: string,
  newText: string,
): Promise<void> {
  const endIndex = await fetchBodyEndIndex(accessToken, documentId);

  // deleteContentRange requires endIndex > startIndex; an empty body
  // (endIndex <= 2) has no content to remove, so we only insert.
  const requests: unknown[] = [];
  if (endIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: { startIndex: 1, endIndex: endIndex - 1 },
      },
    });
  }
  if (newText.length > 0) {
    requests.push({
      insertText: { location: { index: 1 }, text: newText },
    });
  }

  // Nothing to change (clearing an already-empty doc) — skip the round trip.
  if (requests.length === 0) return;

  const res = await fetch(
    `${DOCS_API_URL}/${encodeURIComponent(documentId)}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    },
  );
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
