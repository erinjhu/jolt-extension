/**
 * Small, dependency-free helpers for working with image files in the browser.
 */

/** Reads a File/Blob and resolves with a base64 data URL. */
export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('File read failed.'));
    reader.readAsDataURL(file);
  });
}

/** Returns true when the given file reports an image MIME type. */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/** Convert a data URL into a Blob for preprocessing / upload. */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}
