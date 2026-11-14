import { useMemo, useState, type FocusEvent, type FormEvent } from 'react';
import type { JoltSessionPayload, SessionVisibility } from '../types/session';
import { calculateDuration, combineDateAndTime, toIsoString } from '../utils/duration';
import { countWords } from '../utils/text';
import {
  defaultSessionTitle,
  toDateInputValue,
  toTimeInputValue,
} from '../utils/sessionDefaults';
import { JOLT_DOCUMENTS } from '../data/documents';
import FormField from './FormField';
import SessionMetaFields from './SessionMetaFields';
import VisibilityToggle from './VisibilityToggle';

interface SessionFormProps {
  /** OCR-extracted text used to pre-fill the description and word count. */
  initialDescription: string;
  /** Base64 image attached to the session payload. */
  imageBase64: string;
  /** Placeholder callback invoked with the assembled payload. */
  onSyncToDrive: (payload: JoltSessionPayload) => void;
  /** Disables the sync action while work is in progress. */
  disabled?: boolean;
  /** Whether the user is signed in to Google; gates the sync action. */
  isSignedIn?: boolean;
  /** True while the Drive sync is running; shows a loading label. */
  isSyncing?: boolean;
}

const inputClass =
  'rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none focus:border-indigo-400';

export default function SessionForm({
  initialDescription,
  imageBase64,
  onSyncToDrive,
  disabled = false,
  isSignedIn = true,
  isSyncing = false,
}: SessionFormProps) {
  const now = useMemo(() => new Date(), []);
  const [title, setTitle] = useState(() => defaultSessionTitle(now));
  const [date, setDate] = useState(() => toDateInputValue(now));
  const [startTime, setStartTime] = useState(() => toTimeInputValue(now));
  const [stopTime, setStopTime] = useState(() => toTimeInputValue(now));
  const [targetDocumentName, setTargetDocumentName] = useState(JOLT_DOCUMENTS[0] ?? '');
  const [visibility, setVisibility] = useState<SessionVisibility>('private');
  const [description, setDescription] = useState(initialDescription);
  const [quote, setQuote] = useState('');
  const [wordCount, setWordCount] = useState(() => countWords(initialDescription));

  const startDateTime = combineDateAndTime(date, startTime);
  const stopDateTime = combineDateAndTime(date, stopTime);
  const duration = useMemo(
    () => calculateDuration(startDateTime, stopDateTime),
    [startDateTime, stopDateTime],
  );

  /** Select the whole title so an edit replaces the default in one keystroke. */
  function selectAllTitle(event: FocusEvent<HTMLInputElement>) {
    event.target.select();
  }

  /** Edit the notes and keep the word count in sync (still manually overridable). */
  function handleDescriptionChange(value: string) {
    setDescription(value);
    setWordCount(countWords(value));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSyncToDrive({
      title,
      description,
      quote,
      date,
      startTime: toIsoString(startDateTime),
      stopTime: toIsoString(stopDateTime),
      durationHours: duration.hours,
      durationMinutes: duration.minutes,
      wordCount,
      visibility,
      targetDocumentName,
      imageBase64,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label="Title">
        {(id) => (
          <input
            id={id}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onFocus={selectAllTitle}
            className={inputClass}
            required
          />
        )}
      </FormField>

      <FormField label="Document">
        {(id) => (
          <select
            id={id}
            value={targetDocumentName}
            onChange={(e) => setTargetDocumentName(e.target.value)}
            className={inputClass}
          >
            {JOLT_DOCUMENTS.map((doc) => (
              <option key={doc} value={doc}>
                {doc}
              </option>
            ))}
          </select>
        )}
      </FormField>

      <SessionMetaFields
        date={date}
        onDateChange={setDate}
        wordCount={wordCount}
        onWordCountChange={setWordCount}
        startTime={startTime}
        onStartTimeChange={setStartTime}
        stopTime={stopTime}
        onStopTimeChange={setStopTime}
        inputClass={inputClass}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400" aria-live="polite">
          Duration: {duration.hours}h {duration.minutes}m
        </span>
        <VisibilityToggle value={visibility} onChange={setVisibility} />
      </div>

      <FormField label="Description">
        {(id) => (
          <textarea
            id={id}
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            className={`${inputClass} min-h-40 resize-y`}
            placeholder="Extracted text appears here. Edit as needed."
          />
        )}
      </FormField>

      <FormField label="Quote">
        {(id) => (
          <input
            id={id}
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            className={inputClass}
            placeholder="A line worth remembering"
          />
        )}
      </FormField>

      <button
        type="submit"
        disabled={disabled || !isSignedIn}
        className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {!isSignedIn
          ? 'Sign in to Google to sync'
          : isSyncing
            ? 'Syncing to Jolt…'
            : 'Sync to Jolt'}
      </button>
    </form>
  );
}
