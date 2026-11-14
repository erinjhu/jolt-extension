import { useCallback, useEffect, useRef, useState } from 'react';
import { countWords } from '../utils/text';

/**
 * Real-time writing-session tracker for the distraction-free editor.
 *
 * Responsibilities:
 *  - Capture the session start time on the first edit.
 *  - Run a 1s active-duration timer that pauses when the editor tab is
 *    inactive or the user has been idle for more than IDLE_TIMEOUT_MS.
 *  - Track net session words (current - initial, floored at 0).
 *  - Split active seconds into Drafting vs. Editing buckets using a short
 *    "editing-state" window opened by deletions / mid-text edits.
 *  - Derive Flow metrics: overall WPH and a sliding-window peak (highest WPH).
 *
 * The hook is pure React state + timers; the editor feeds it text changes via
 * `recordChange` and tells it whether its tab is currently active via `active`.
 */

/** Idle longer than this (ms) pauses the active timer. */
const IDLE_TIMEOUT_MS = 45_000;
/** How long (ms) a deletion / mid-text edit keeps the session in "editing". */
const EDITING_WINDOW_MS = 4_000;
/** Sliding window (seconds) used for the burst / highest-WPH calculation. */
const BURST_WINDOW_SECONDS = 30;
/** Minimum active seconds before overall WPH is reported (avoids early noise). */
const MIN_SECONDS_FOR_WPH = 5;
/** Minimum active seconds before highest WPH is trusted (clamps spikes). */
const MIN_SECONDS_FOR_PEAK = 10;

/** A single word-add event, used for the rolling burst-speed window. */
interface WordSample {
  /** ms timestamp of the sample. */
  t: number;
  /** Net session words at that moment. */
  words: number;
}

export interface WritingSessionMetrics {
  /** True once the first edit has happened and tracking has begun. */
  hasStarted: boolean;
  /** Cleanly formatted local start time, e.g. "3:34 PM" (empty before start). */
  sessionStartTime: string;
  /** Raw epoch ms of the first edit (null before start). */
  sessionStartTimestamp: number | null;
  /** Active (non-idle) seconds accumulated so far. */
  activeSeconds: number;
  /** Net words added this session: max(0, current - initial). */
  sessionWords: number;
  /** Drafting share of active time, whole number; 0 before typing. */
  draftingPct: number;
  /** Editing share of active time, whole number; 0 before typing. */
  editingPct: number;
  /** Real-time session pace in words/hour (0 until MIN_SECONDS_FOR_WPH). */
  overallWph: number;
  /** Peak burst pace in words/hour over the sliding window. */
  highestWph: number;
}

export interface WritingSession extends WritingSessionMetrics {
  /** Report a text change from the editor (new full text + caret position). */
  recordChange: (nextText: string, caret: number) => void;
}

/**
 * @param text              Current editor text (controlled by the editor).
 * @param initialWordCount  Word count of the document when it loaded.
 * @param active            Whether the editor tab is currently visible/active.
 */
export function useWritingSession(
  text: string,
  initialWordCount: number,
  active: boolean,
): WritingSession {
  const [hasStarted, setHasStarted] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState('');
  const [sessionStartTimestamp, setSessionStartTimestamp] = useState<number | null>(null);
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [draftingSeconds, setDraftingSeconds] = useState(0);
  const [editingSeconds, setEditingSeconds] = useState(0);
  const [highestWph, setHighestWph] = useState(0);

  const sessionWords = Math.max(0, countWords(text) - initialWordCount);

  // Refs read inside the interval without making it a dependency.
  const lastEditAtRef = useRef(0);
  const activeRef = useRef(active);
  const hasStartedRef = useRef(false);
  // When > now, the session is in the post-deletion "editing" window.
  const editingUntilRef = useRef(0);
  // Previous text, to classify the next change as drafting vs. editing.
  const prevTextRef = useRef(text);
  const sessionWordsRef = useRef(sessionWords);
  // Rolling samples of (timestamp, net words) for the burst calculation.
  const samplesRef = useRef<WordSample[]>([]);

  activeRef.current = active;
  sessionWordsRef.current = sessionWords;

  // Keep prevTextRef in sync with externally driven text resets (e.g. the
  // document reloading) so the first real edit isn't misclassified.
  useEffect(() => {
    if (!hasStartedRef.current) {
      prevTextRef.current = text;
      samplesRef.current = [{ t: Date.now(), words: 0 }];
    }
  }, [text]);

  const recordChange = useCallback(
    (nextText: string, caret: number) => {
      const now = Date.now();
      const prev = prevTextRef.current;

      // First edit: start the session clock.
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        setHasStarted(true);
        setSessionStartTimestamp(now);
        setSessionStartTime(
          new Date(now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        );
        samplesRef.current = [{ t: now, words: 0 }];
      }

      lastEditAtRef.current = now;

      // Classify the edit. Deleting text, or editing anywhere other than the
      // very end of the document (caret not at the tail / text got shorter),
      // opens/extends the editing-state window. A pure forward append leaves
      // the session in drafting unless the window is still open.
      const isDeletion = nextText.length < prev.length;
      const isForwardAppend =
        nextText.length > prev.length &&
        caret === nextText.length &&
        nextText.startsWith(prev);

      if (isDeletion || !isForwardAppend) {
        editingUntilRef.current = now + EDITING_WINDOW_MS;
      }

      prevTextRef.current = nextText;
    },
    [],
  );

  // 1-second tick: advance active time and the drafting/editing split, pausing
  // when the tab is inactive or the user has gone idle.
  useEffect(() => {
    if (!hasStarted) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      const idle = now - lastEditAtRef.current > IDLE_TIMEOUT_MS;
      if (!activeRef.current || idle) return;

      setActiveSeconds((s) => s + 1);
      if (now < editingUntilRef.current) {
        setEditingSeconds((s) => s + 1);
      } else {
        setDraftingSeconds((s) => s + 1);
      }

      // Record a burst sample and prune to the sliding window.
      const samples = samplesRef.current;
      samples.push({ t: now, words: sessionWordsRef.current });
      const cutoff = now - BURST_WINDOW_SECONDS * 1000;
      while (samples.length > 1 && samples[0].t < cutoff) samples.shift();

      // Peak burst speed, only trusted once enough time has elapsed so a
      // single fast keystroke can't distort the headline number.
      const elapsed = (now - (samples[0]?.t ?? now)) / 1000;
      if (elapsed >= MIN_SECONDS_FOR_PEAK) {
        const windowWordsAdded = sessionWordsRef.current - samples[0].words;
        if (windowWordsAdded > 0) {
          const burstWph = Math.round((windowWordsAdded / elapsed) * 3600);
          setHighestWph((peak) => (burstWph > peak ? burstWph : peak));
        }
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [hasStarted]);

  const trackedSeconds = draftingSeconds + editingSeconds;
  let draftingPct = 0;
  let editingPct = 0;
  if (trackedSeconds > 0) {
    draftingPct = Math.round((draftingSeconds / trackedSeconds) * 100);
    editingPct = 100 - draftingPct;
  }

  const overallWph =
    activeSeconds >= MIN_SECONDS_FOR_WPH
      ? Math.round((sessionWords / activeSeconds) * 3600)
      : 0;

  return {
    hasStarted,
    sessionStartTime,
    sessionStartTimestamp,
    activeSeconds,
    sessionWords,
    draftingPct,
    editingPct,
    overallWph,
    highestWph,
    recordChange,
  };
}
