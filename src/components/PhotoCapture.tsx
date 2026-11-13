import { useId, useState, type ChangeEvent } from 'react';
import { isImageFile, readFileAsDataUrl } from '../utils/imageFile';

/**
 * Captures a note photo from the mobile camera or a desktop file picker,
 * then reports the selected image to the parent as a base64 data URL.
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
    if (!file) {
      return;
    }

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
    <section className="flex flex-col gap-3">
      <label
        htmlFor={inputId}
        className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-600 bg-gray-800 px-4 py-6 text-center text-sm font-medium text-gray-300 transition hover:border-indigo-400 hover:text-indigo-300 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        aria-disabled={disabled}
      >
        {previewUrl ? 'Retake or choose another photo' : 'Take a photo or upload a note'}
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

      {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}

      {previewUrl && (
        <img
          src={previewUrl}
          alt="Selected note preview"
          className="w-full rounded-xl border border-gray-700 object-contain"
        />
      )}
    </section>
  );
}
