import { useEffect, useId, useMemo, useState, type FocusEvent, type FormEvent } from 'react';
import type { JoltSessionPayload, SessionVisibility } from '../types/session';
import { combineDateAndTime, toIsoString } from '../utils/duration';
import { countWords } from '../utils/text';
import {
  defaultSessionTitle,
  toDateInputValue,
  toTimeInputValue,
} from '../utils/sessionDefaults';
import type { WritingSessionMetrics } from '../hooks/useWritingSession';
import { JOLT_DOCUMENTS } from '../data/documents';
import type { TranscriptionSource } from '../services/transcription';
import PhotoCapture from './PhotoCapture';
import TranscriptionStatus from './TranscriptionStatus';
import {
  JoltField,
  JoltLabel,
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
  /**
   * Drive file id of the active Google Doc. When present, a subtle "view
   * document" link appears above the Quote field so the user can open the doc
   * in a new tab to copy a quote. Omitted for photo-scan sessions.
   */
  documentId?: string;
  /**
   * Tracked analytics from a finished TEXT EDITOR session. When provided, the
   * form seeds Words / Start Time / Duration from these values and shows a
   * read-only WRITING MODES / FLOW summary. Absent for photo-scan sessions.
   */
  sessionMetrics?: WritingSessionMetrics | null;
  /** Guest demo: open the in-app Demo Document Preview instead of docs.google.com. */
  isGuest?: boolean;
  /** Guest demo: invoked by the "open doc" action to show the preview. */
  onPreviewDoc?: () => void;
  /** Fires when a photo is captured/uploaded in the PHOTOS section. */
  onImageSelected: (imageBase64: string) => void;
  /** Returns to the mode-selection landing screen. */
  onBack?: () => void;
  /** Invoked with the assembled payload on submit. */
  onSyncToDrive: (payload: JoltSessionPayload) => void;
  disabled?: boolean;
  isSignedIn?: boolean;
  isSyncing?: boolean;
  isTranscribing?: boolean;
  transcriptionSource?: TranscriptionSource | null;
  transcribeError?: string | null;
  canOfflineFallback?: boolean;
  onOfflineFallback?: () => void;
}

export default function SessionForm({
  initialDescription,
  imageBase64,
  documentName = '',
  documentId,
  sessionMetrics = null,
  isGuest = false,
  onPreviewDoc,
  onImageSelected,
  onBack,
  onSyncToDrive,
  disabled = false,
  isSignedIn = true,
  isSyncing = false,
  isTranscribing = false,
  transcriptionSource = null,
  transcribeError = null,
  canOfflineFallback = false,
  onOfflineFallback,
}: SessionFormProps) {
  const quoteFieldId = useId();
  const now = useMemo(() => new Date(), []);
  // A finished editor session's start time anchors Date / Start Time; fall
  // back to "now" for photo-scan sessions with no tracked start.
  const startDate = useMemo(
    () =>
      sessionMetrics?.sessionStartTimestamp != null
        ? new Date(sessionMetrics.sessionStartTimestamp)
        : now,
    [sessionMetrics?.sessionStartTimestamp, now],
  );
  // Active seconds split into whole hours + rounded minutes for the Duration
  // inputs (defaults to the usual 0h 15m when there are no tracked metrics).
  const trackedDuration = useMemo(() => {
    const secs = sessionMetrics?.activeSeconds ?? 0;
    if (!sessionMetrics || secs <= 0) return { hours: 0, minutes: 15 };
    return { hours: Math.floor(secs / 3600), minutes: Math.round((secs % 3600) / 60) };
  }, [sessionMetrics]);

  const [title, setTitle] = useState(() => defaultSessionTitle(now));
  const [date, setDate] = useState(() => toDateInputValue(startDate));
  const [startTime, setStartTime] = useState(() => toTimeInputValue(startDate));
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
  // Words seed: tracked net words from the editor session when present,
  // otherwise the transcribed OCR text's word count.
  const [wordCount, setWordCount] = useState(() =>
    sessionMetrics ? sessionMetrics.sessionWords : countWords(initialDescription),
  );
  const [durationHours, setDurationHours] = useState(trackedDuration.hours);
  const [durationMinutes, setDurationMinutes] = useState(trackedDuration.minutes);

  // For photo-scan sessions the WORDS stat is auto-calculated from the
  // transcribed text, which arrives after mount (async OCR). Editor sessions
  // keep their tracked word count untouched.
  useEffect(() => {
    if (!sessionMetrics) setWordCount(countWords(initialDescription));
  }, [initialDescription, sessionMetrics]);

  function selectAll(event: FocusEvent<HTMLInputElement>) {
    event.target.select();
  }

  /**
   * Open the active document so the user can copy a quote. In guest demo mode
   * there's no real Drive file, so show the in-app Demo Document Preview
   * instead of a (dead) docs.google.com link.
   */
  function openDocInNewTab() {
    if (isGuest) {
      onPreviewDoc?.();
      return;
    }
    if (!documentId) return;
    window.open(
      `https://docs.google.com/document/d/${documentId}/edit`,
      '_blank',
      'noopener,noreferrer',
    );
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
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="self-start rounded-none border border-[#111111] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#111111] transition hover:bg-gray-100"
        >
          ← Back
        </button>
      )}

      <div className="flex flex-col gap-4">
        <h1 className="text-sm font-bold uppercase tracking-wide">Add Manual Session</h1>

        {/* Date stays compact (auto width); Document expands to fill the row.
            `items-start` aligns both columns at the label baseline so the
            Document cell's "+ Create new document" helper row below the select
            can't drag the Date field's height or alignment. */}
        <div className="grid grid-cols-[auto_1fr] items-start gap-3">
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

      {sessionMetrics && (
        <div className="flex flex-col gap-3">
          <JoltSectionHeader>Flow</JoltSectionHeader>
          <div className="flex justify-between font-mono text-xs text-gray-600">
            <span>Overall {sessionMetrics.overallWph} wph</span>
            <span>Highest {sessionMetrics.highestWph} wph</span>
          </div>
        </div>
      )}

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
              placeholder="Name your session"
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
              placeholder="How did it go?"
            />
          )}
        </JoltField>

        <TranscriptionStatus
          source={transcriptionSource}
          error={transcribeError}
          canOfflineFallback={canOfflineFallback}
          onOfflineFallback={() => onOfflineFallback?.()}
        />

        <div className="flex flex-col gap-2">
          {/* Quote label and the (shared) open-doc action on one row. */}
          <div className="flex items-center justify-between gap-2">
            <JoltLabel htmlFor={quoteFieldId}>Quote</JoltLabel>
            {documentId && (
              <button
                type="button"
                onClick={openDocInNewTab}
                className="shrink-0 rounded-none border border-[#111111] bg-[#FFFFFF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#111111] transition hover:bg-gray-100"
              >
                Open your doc to find quote ↗
              </button>
            )}
          </div>
          <textarea
            id={quoteFieldId}
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            className={`${joltInputClass} min-h-28 resize-y py-1.5 font-mono`}
            placeholder="Share a favorite line from your writing..."
          />
        </div>

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
        {!isSignedIn ? 'Sign in to Google to sync' : isSyncing ? 'Submitting…' : 'Submit'}
      </button>
    </form>
  );
}
