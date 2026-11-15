import type { TranscriptionSource } from '../services/transcription';

interface TranscriptionStatusProps {
  /** True while a transcription (Drive or Tesseract) is running. */
  isTranscribing: boolean;
  /** Which engine produced the current text, or null if none yet. */
  source: TranscriptionSource | null;
  /** Error from the last transcription attempt, if any. */
  error: string | null;
  /** Whether the offline (Tesseract) fallback button should be offered. */
  canOfflineFallback: boolean;
  /** Triggers the explicit offline fallback transcription. */
  onOfflineFallback: () => void;
}

/**
 * Status row above the editable notes: shows the "Transcribing…" indicator,
 * the created Google Doc link, transcription errors, and the explicit
 * offline-fallback control when the user is not signed in.
 */
export default function TranscriptionStatus({
  isTranscribing,
  source,
  error,
  canOfflineFallback,
  onOfflineFallback,
}: TranscriptionStatusProps) {
  return (
    <div className="flex flex-col gap-2">
      {isTranscribing && (
        <p className="text-sm text-indigo-300" aria-live="polite">
          Transcribing handwriting via Google Drive…
        </p>
      )}

      {!isTranscribing && source === 'tesseract' && (
        <p className="text-xs text-amber-300">
          Transcribed offline with Tesseract. Sign in to Google for higher-quality OCR.
        </p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      {canOfflineFallback && (
        <button
          type="button"
          onClick={onOfflineFallback}
          className="self-start rounded-lg border border-gray-600 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-gray-800"
        >
          Run Offline Fallback OCR
        </button>
      )}
    </div>
  );
}
