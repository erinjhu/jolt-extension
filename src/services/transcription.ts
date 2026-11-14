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
import { transcribeImageWithGoogleDrive } from './googleDocsService';
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

/** Transcribe locally with Tesseract.js (offline fallback). */
export async function transcribeViaTesseract(
  imageSource: string | Blob,
): Promise<TranscriptionResult> {
  const { text } = await recognizeHandwriting(imageSource);
  return { text, source: 'tesseract' };
}
