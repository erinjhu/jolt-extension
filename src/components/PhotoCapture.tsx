import { useId, useState, type ChangeEvent } from 'react';
import { isImageFile, readFileAsDataUrl } from '../utils/imageFile';

/**
 * Photo capture/upload area for the PHOTOS section. Supports the mobile
 * camera and desktop file picker, and shows a preview of the selected note.
 * Styled to match Jolt's minimalist light form.
 */
interface PhotoCaptureProps {
  /** Fires with the base64 data URL once an image is selected. */
  onImageSelected: (imageBase64: string) => void;
  /** Disables selection while OCR or syncing is in progress. */
  disabled?: boolean;
}

export default function PhotoCapture({ onImageSelected, disabled = false }: PhotoCaptureProps) {
  const inputId = useId();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isImageFile(file)) {
      setErrorMessage('Please choose an image file.');
      return;
    }
    setErrorMessage(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPreviewUrl(dataUrl);
      onImageSelected(dataUrl);
    } catch {
      setErrorMessage('Could not read that image. Try again.');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Entire card is clickable; tapping anywhere opens the camera / picker. */}
      <label
        htmlFor={inputId}
        aria-disabled={disabled}
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-none border border-dashed border-[#111111] bg-[#FFFFFF] px-6 py-10 text-center text-[#111111] transition hover:bg-gray-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      >
        {/* Monochrome camera icon. */}
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 8a2 2 0 0 1 2-2h2l1.2-1.6a1 1 0 0 1 .8-.4h6a1 1 0 0 1 .8.4L19 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Z" />
          <circle cx="12" cy="12.5" r="3.2" />
        </svg>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold uppercase tracking-wide">
            {previewUrl ? 'Retake or choose another photo' : 'Click to snap or upload photos'}
          </span>
          <span className="font-mono text-xs text-gray-500">
            Take a photo or choose from your library
          </span>
        </div>
      </label>

      <input
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled}
        onChange={handleFileChange}
        className="sr-only"
      />

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

      {previewUrl && (
        <img
          src={previewUrl}
          alt="Selected note preview"
          className="w-full rounded-none border border-gray-300 object-contain"
        />
      )}
    </div>
  );
}
