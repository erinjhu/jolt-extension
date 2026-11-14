import { useEffect, useMemo, useState, type FocusEvent, type FormEvent } from 'react';
import type { JoltSessionPayload, SessionVisibility } from '../types/session';
import { combineDateAndTime, toIsoString } from '../utils/duration';
import { countWords } from '../utils/text';
import {
  defaultSessionTitle,
  toDateInputValue,
  toTimeInputValue,
} from '../utils/sessionDefaults';
import { JOLT_DOCUMENTS } from '../data/documents';
import type { TranscriptionSource } from '../services/transcription';
import PhotoCapture from './PhotoCapture';
import TranscriptionStatus from './TranscriptionStatus';
import {
  JoltField,
  JoltSectionHeader,
  joltInputClass,
  joltSingleLineClass,
} from './jolt/JoltField';
import JoltSessionStats from './jolt/JoltSessionStats';
import JoltVisibilityToggle from './jolt/JoltVisibilityToggle';

interface SessionFormProps {
  /** OCR-extracted text used to pre-fill the description and word count. */
  initialDescription: string;
  /** Base64 image attached to the session payload ('' until captured). */
  imageBase64: string;
  /** Pre-selected target document name (chosen on the landing screen). */
  documentName?: string;
  /** Fires when a photo is captured/uploaded in the PHOTOS section. */
  onImageSelected: (imageBase64: string) => void;
  /** Invoked with the assembled payload on submit. */
  onSyncToDrive: (payload: JoltSessionPayload) => void;
  disabled?: boolean;
  isSignedIn?: boolean;
  isSyncing?: boolean;
  isTranscribing?: boolean;
  transcriptionDocLink?: string | null;
  transcriptionSource?: TranscriptionSource | null;
  transcribeError?: string | null;
  canOfflineFallback?: boolean;
  onOfflineFallback?: () => void;
}

export default function SessionForm({
  initialDescription,
  imageBase64,
  documentName = '',
  onImageSelected,
  onSyncToDrive,
  disabled = false,
  isSignedIn = true,
  isSyncing = false,
  isTranscribing = false,
  transcriptionDocLink = null,
  transcriptionSource = null,
  transcribeError = null,
  canOfflineFallback = false,
  onOfflineFallback,
}: SessionFormProps) {
  const now = useMemo(() => new Date(), []);
  const [title, setTitle] = useState(() => defaultSessionTitle(now));
  const [date, setDate] = useState(() => toDateInputValue(now));
  const [startTime, setStartTime] = useState(() => toTimeInputValue(now));
  const [targetDocumentName, setTargetDocumentName] = useState(
    documentName || JOLT_DOCUMENTS[0] || '',
  );
  // Include the landing-chosen document in the dropdown if it's not a preset.
  const documentOptions = useMemo(
    () =>
      documentName && !JOLT_DOCUMENTS.includes(documentName)
        ? [documentName, ...JOLT_DOCUMENTS]
        : [...JOLT_DOCUMENTS],
    [documentName],
  );
  const [visibility, setVisibility] = useState<SessionVisibility>('private');
  // Description stays BLANK by default — the OCR text goes to the Google Doc,
  // not into this editable field. The user types notes here only if they want.
  const [description, setDescription] = useState('');
  const [quote, setQuote] = useState('');
  const [wordCount, setWordCount] = useState(() => countWords(initialDescription));
  const [durationHours, setDurationHours] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(15);

  // The WORDS stat is still auto-calculated from the transcribed text, which
  // arrives after mount (async OCR). It does not touch the Description field.
  useEffect(() => {
    setWordCount(countWords(initialDescription));
  }, [initialDescription]);

  function selectAll(event: FocusEvent<HTMLInputElement>) {
    event.target.select();
  }

  // Description is the user's manual notes; it no longer drives the word
  // count (WORDS comes from the OCR text, still manually overridable).
  function handleDescriptionChange(value: string) {
    setDescription(value);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Start is date + start time; stop is start plus the entered duration.
    const startIso = toIsoString(combineDateAndTime(date, startTime));
    const startMs = startIso ? new Date(startIso).getTime() : Date.now();
    const stopMs = startMs + (durationHours * 60 + durationMinutes) * 60_000;
    onSyncToDrive({
      id: crypto.randomUUID(),
      title,
      description,
      ocrText: initialDescription,
      quote,
      date,
      startTime: startIso,
      stopTime: new Date(stopMs).toISOString(),
      durationHours,
      durationMinutes,
      wordCount,
      visibility,
      targetDocumentName,
      imageBase64,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-none border border-gray-300 bg-white p-6 text-black"
    >
      <div className="flex flex-col gap-4 border-b border-black pb-5">
        <h1 className="text-sm font-bold uppercase tracking-wide">Add Manual Session</h1>

        {/* Date stays compact (auto width); Document expands to fill the row. */}
        <div className="grid grid-cols-[auto_1fr] gap-3">
          <JoltField label="Date">
            {(id) => (
              <input
                id={id}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={joltSingleLineClass}
              />
            )}
          </JoltField>

          <JoltField label="Document">
            {(id) => (
              <div className="flex flex-col gap-1">
                <select
                  id={id}
                  value={targetDocumentName}
                  onChange={(e) => setTargetDocumentName(e.target.value)}
                  className={joltSingleLineClass}
                >
                  {documentOptions.map((doc) => (
                    <option key={doc} value={doc}>
                      {doc}
                    </option>
                  ))}
                </select>
                <span className="font-mono text-xs text-gray-500">+ Create new document</span>
              </div>
            )}
          </JoltField>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <JoltSectionHeader>Session Stats</JoltSectionHeader>
        <JoltSessionStats
          words={wordCount}
          onWordsChange={setWordCount}
          startTime={startTime}
          onStartTimeChange={setStartTime}
          durationHours={durationHours}
          durationMinutes={durationMinutes}
          onHoursChange={setDurationHours}
          onMinutesChange={setDurationMinutes}
        />
      </div>

      <div className="flex flex-col gap-3 border-b border-gray-200 pb-6">
        <JoltSectionHeader>Visibility</JoltSectionHeader>
        <JoltVisibilityToggle value={visibility} onChange={setVisibility} />
      </div>

      <div className="flex flex-col gap-4">
        <JoltSectionHeader>Optional</JoltSectionHeader>

        <JoltField label="Title">
          {(id) => (
            <input
              id={id}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onFocus={selectAll}
              className={joltSingleLineClass}
              required
            />
          )}
        </JoltField>

        <JoltField label="Description">
          {(id) => (
            <textarea
              id={id}
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              className={`${joltInputClass} min-h-28 resize-y py-1.5`}
              placeholder="Write or paste your session notes..."
            />
          )}
        </JoltField>

        <TranscriptionStatus
          isTranscribing={isTranscribing}
          docLink={transcriptionDocLink}
          source={transcriptionSource}
          error={transcribeError}
          canOfflineFallback={canOfflineFallback}
          onOfflineFallback={() => onOfflineFallback?.()}
        />

        <JoltField label="Quote">
          {(id) => (
            <textarea
              id={id}
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              className={`${joltInputClass} min-h-28 resize-y py-1.5 font-mono`}
              placeholder="Share a favorite line from your writing..."
            />
          )}
        </JoltField>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wide text-black">Photos</span>
          <PhotoCapture onImageSelected={onImageSelected} disabled={isTranscribing} />
        </div>
      </div>

      <button
        type="submit"
        disabled={disabled || !isSignedIn}
        className="rounded-none bg-black px-4 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {!isSignedIn ? 'Sign in to Google to sync' : isSyncing ? 'Syncing…' : 'Sync to Jolt'}
      </button>
    </form>
  );
}
