/**
 * Transcription orchestrator. Chooses the OCR source:
 *   - Primary: Google Drive's server-side image-to-Doc OCR (needs sign-in).
 *   - Fallback: local Tesseract.js, used offline / when not signed in.
 *
 * Both paths return the extracted text plus, for the Drive path, the created
 * Google Doc so the UI can link to it.
 */

import { preprocessImageForOcr } from '../utils/imagePreprocessor';
import { ensureSyncFolder } from './driveFolderService';
import { docEditUrl } from '../utils/docUrl';
import { transcribeImageWithGoogleDrive, trashDriveFile } from './googleDocsService';
import { recognizeHandwriting } from './ocrService';

export type TranscriptionSource = 'google-drive' | 'tesseract';

export interface TranscriptionResult {
  text: string;
  source: TranscriptionSource;
  /** Present only for the Drive path: link to the generated Google Doc. */
  webViewLink?: string;
  /** Present only for the Drive path: the generated Doc's id. */
  docId?: string;
}

/**
 * Transcribe via Google Drive's native OCR. Preprocesses the image, uploads
 * it as a Google Doc for server-side recognition, and returns the text and
 * the created document link.
 */
export async function transcribeViaGoogleDrive(
  accessToken: string,
  imageBlob: Blob,
  docTitle: string,
): Promise<TranscriptionResult> {
  const processed = await preprocessImageForOcr(imageBlob);
  const folderId = await ensureSyncFolder(accessToken);
  const result = await transcribeImageWithGoogleDrive(
    accessToken,
    folderId,
    processed.blob,
    docTitle,
    processed.mimeType,
  );

  return {
    text: result.extractedText,
    source: 'google-drive',
    webViewLink: result.webViewLink,
    docId: result.docId,
  };
}

/**
 * Scan into a specific target doc. Drive OCR needs a scratch Google Doc, so
 * the text is read from that scratch doc, APPENDED to `targetDocId` (existing
 * content is preserved), and the scratch doc is trashed. The returned
 * `docId` / `webViewLink` always describe `targetDocId`, so every UI link
 * resolves to the doc the text was actually written to.
 *
 * With no `targetDocId` the scratch doc itself becomes the target.
 */
export async function transcribeIntoTargetDoc(
  accessToken: string,
  imageBlob: Blob,
  docTitle: string,
  targetDocId: string | null,
  appendToTarget: (docId: string, text: string) => Promise<void>,
): Promise<TranscriptionResult> {
  const ocr = await transcribeViaGoogleDrive(accessToken, imageBlob, docTitle);
  if (!targetDocId || !ocr.docId || ocr.docId === targetDocId) return ocr;

  await appendToTarget(targetDocId, ocr.text);
  await trashDriveFile(accessToken, ocr.docId);
  return { ...ocr, docId: targetDocId, webViewLink: docEditUrl(targetDocId) };
}

/** Transcribe locally with Tesseract.js (offline fallback). */
export async function transcribeViaTesseract(
  imageSource: string | Blob,
): Promise<TranscriptionResult> {
  const { text } = await recognizeHandwriting(imageSource);
  return { text, source: 'tesseract' };
}
