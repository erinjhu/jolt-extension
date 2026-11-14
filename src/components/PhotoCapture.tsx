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
      <label
        htmlFor={inputId}
        className="flex cursor-pointer items-center justify-center border border-dashed border-gray-300 bg-white px-4 py-6 text-center font-mono text-sm text-gray-500 transition hover:border-black hover:text-black aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        aria-disabled={disabled}
      >
        {previewUrl ? 'Retake or choose another photo' : 'Snap or upload your handwritten page'}
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
          className="w-full border border-gray-300 object-contain"
        />
      )}
    </div>
  );
}
