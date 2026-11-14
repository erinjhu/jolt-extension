/**
 * Client-side image preprocessing for OCR. Draws the captured photo onto an
 * offscreen canvas to normalize orientation, cap resolution, and boost ink
 * contrast before upload, then exports a clean image Blob.
 *
 * Preprocessing runs entirely in the browser; the raw photo is never sent
 * anywhere until the caller uploads the returned Blob.
 */

/** Longest-edge cap. Larger images are scaled down to keep uploads lean. */
const MAX_EDGE_PX = 2048;

/** Canvas filter that makes faint handwriting stand out on ruled paper. */
const INK_FILTER = 'grayscale(1) contrast(1.25) brightness(1.05)';

export interface PreprocessedImage {
  /** The processed image, ready to upload. */
  blob: Blob;
  /** MIME type of `blob` (`image/jpeg` or `image/png`). */
  mimeType: 'image/jpeg' | 'image/png';
  width: number;
  height: number;
}

/**
 * Decode a source image with EXIF orientation already applied. Prefers
 * `createImageBitmap` (which honors EXIF via `imageOrientation`), falling
 * back to an `HTMLImageElement` for browsers that lack the option.
 */
async function decodeOriented(source: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(source, { imageOrientation: 'from-image' });
    } catch {
      // Fall through to the <img> path below.
    }
  }

  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Scale dimensions so the longest edge is at most MAX_EDGE_PX. */
function fitWithinMaxEdge(width: number, height: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= MAX_EDGE_PX) {
    return { width, height };
  }
  const scale = MAX_EDGE_PX / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

/** Promisified canvas export so the caller gets a Blob, not a callback. */
function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas export produced no image.'))),
      mimeType,
      quality,
    );
  });
}

/**
 * Preprocess a captured photo for OCR: apply EXIF orientation, cap the
 * longest edge at 2048px, and boost ink contrast. Exports JPEG by default
 * (smaller uploads); pass `preferPng` for lossless output.
 */
export async function preprocessImageForOcr(
  source: Blob,
  preferPng = false,
): Promise<PreprocessedImage> {
  const image = await decodeOriented(source);
  const { width, height } = fitWithinMaxEdge(image.width, image.height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get a 2D canvas context for preprocessing.');
  }

  ctx.filter = INK_FILTER;
  ctx.drawImage(image, 0, 0, width, height);

  // Release the decoded bitmap's memory where supported.
  if ('close' in image && typeof image.close === 'function') {
    image.close();
  }

  const mimeType = preferPng ? 'image/png' : 'image/jpeg';
  const blob = await canvasToBlob(canvas, mimeType, preferPng ? undefined : 0.92);

  return { blob, mimeType, width, height };
}
