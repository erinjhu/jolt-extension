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
