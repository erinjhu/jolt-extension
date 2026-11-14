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
const DOC_MIME = 'application/vnd.google-apps.document';

/** Metadata returned for a freshly created Google Doc. */
export interface CreatedDoc {
  id: string;
  name: string;
  /** Shareable link that opens the document in the Drive UI. */
  webViewLink: string;
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
