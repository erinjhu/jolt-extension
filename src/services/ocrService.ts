import { createWorker, type Worker } from 'tesseract.js';
import type { OcrResult } from '../types/session';
import { cleanOcrText } from './textCleanup';

/**
 * Client-side OCR service built on tesseract.js. All recognition runs inside
 * the browser via WebAssembly, so note images never leave the user's device.
 */

/** Signature for progress callbacks, reporting a 0-1 completion fraction. */
export type OcrProgressHandler = (progressFraction: number) => void;

let sharedWorker: Worker | null = null;

/** Lazily creates (and reuses) a single English-language OCR worker. */
async function getWorker(onProgress?: OcrProgressHandler): Promise<Worker> {
  if (sharedWorker) {
    return sharedWorker;
  }

  sharedWorker = await createWorker('eng', 1, {
    logger: (message) => {
      if (onProgress && message.status === 'recognizing text') {
        onProgress(message.progress);
      }
    },
  });

  return sharedWorker;
}

/**
 * Recognizes handwritten/printed text in an image and returns cleaned text
 * alongside confidence and timing metrics.
 *
 * @param imageSource A base64 data URL, Blob, File, or image element URL.
 */
export async function recognizeHandwriting(
  imageSource: string | Blob,
  onProgress?: OcrProgressHandler,
): Promise<OcrResult> {
  const worker = await getWorker(onProgress);
  const startedAt = performance.now();

  const { data } = await worker.recognize(imageSource);

  return {
    text: cleanOcrText(data.text),
    confidence: Math.round(data.confidence),
    processingTimeMs: Math.round(performance.now() - startedAt),
  };
}

/** Releases the shared worker and its WebAssembly resources. */
export async function disposeOcrWorker(): Promise<void> {
  if (sharedWorker) {
    await sharedWorker.terminate();
    sharedWorker = null;
  }
}
