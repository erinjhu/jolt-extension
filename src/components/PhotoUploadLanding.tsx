import { useId, useState, type ChangeEvent } from 'react';
import { isImageFile, readFileAsDataUrl } from '../utils/imageFile';
import type { TargetDoc } from '../services/joltDocumentsService';
import DocumentSelector from './DocumentSelector';

/**
 * Step 1 landing view. The user must first choose or create a target Google
 * Doc; only then are the camera / library buttons enabled. Selecting a photo
 * hands up the image plus the chosen doc so OCR appends to that document and
 * the session form's Document field is pre-filled.
 *
 * The chosen target doc is lifted to App so the persistent bottom navigation
 * (Scan / Editor) can appear as soon as a document is selected.
 */
interface PhotoUploadLandingProps {
  accessToken: string;
  selectedDoc: TargetDoc | null;
  onSelectDoc: (doc: TargetDoc) => void;
  onClearDoc: () => void;
  onImageSelected: (imageBase64: string, doc: TargetDoc) => void;
  disabled?: boolean;
}

export default function PhotoUploadLanding({
  accessToken,
  selectedDoc,
  onSelectDoc,
  onClearDoc,
  onImageSelected,
  disabled = false,
}: PhotoUploadLandingProps) {
  const cameraInputId = useId();
  const libraryInputId = useId();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedDoc) return;
    if (!isImageFile(file)) {
      setErrorMessage('Please choose an image file.');
      return;
    }
    setErrorMessage(null);
    try {
      onImageSelected(await readFileAsDataUrl(file), selectedDoc);
    } catch {
      setErrorMessage('Could not read that image. Try again.');
    }
  }

  return (
    <section className="flex flex-col items-center gap-5 rounded-none border border-gray-300 bg-white px-6 py-10 text-center text-black">
      <div className="flex flex-col gap-1">
        <h1 className="text-sm font-bold uppercase tracking-wide">New Writing Session</h1>
      </div>

      {/* Step 1: document selection only, until a target doc is chosen. */}
      {!selectedDoc ? (
        <DocumentSelector
          accessToken={accessToken}
          selectedDoc={selectedDoc}
          onSelect={onSelectDoc}
        />
      ) : (
        // Step 2: show the chosen doc (+ Change) and reveal the photo buttons.
        <div className="flex w-full flex-col gap-5">
          <div className="flex items-center justify-between gap-3 border border-gray-300 px-3 py-2 text-left">
            <div className="flex min-w-0 flex-col">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Target Document
              </span>
              <span className="truncate text-sm font-semibold text-black">
                {selectedDoc.name}
              </span>
            </div>
            <button
              type="button"
              onClick={onClearDoc}
              className="whitespace-nowrap font-mono text-xs text-gray-500 underline underline-offset-4 hover:text-black"
            >
              Change
            </button>
          </div>

          <div className="flex w-full flex-col items-center gap-3">
            <label
              htmlFor={cameraInputId}
              className={`w-full cursor-pointer rounded-none bg-black px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-gray-800 ${
                disabled ? 'pointer-events-none opacity-40' : ''
              }`}
            >
              Take Photo
            </label>
            <input
              id={cameraInputId}
              type="file"
              accept="image/*"
              capture="environment"
              disabled={disabled}
              onChange={handleFileChange}
              className="sr-only"
            />

            <label
              htmlFor={libraryInputId}
              className={`cursor-pointer font-mono text-sm text-gray-500 underline underline-offset-4 transition hover:text-black ${
                disabled ? 'pointer-events-none opacity-40' : ''
              }`}
            >
              Or upload from photo library
            </label>
            <input
              id={libraryInputId}
              type="file"
              accept="image/*"
              disabled={disabled}
              onChange={handleFileChange}
              className="sr-only"
            />
          </div>
        </div>
      )}

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
    </section>
  );
}
