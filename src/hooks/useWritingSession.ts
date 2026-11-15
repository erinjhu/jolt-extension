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
 *  - Split active seconds into Drafting (within TYPING_WINDOW_MS of a
 *    keystroke) vs. Editing (active but not actively typing: reading /
 *    reviewing / pausing before the idle pause).
 *  - Derive Flow metrics: overall WPH and a sliding-window peak (highest WPH).
 *
 * The hook is pure React state + timers; the editor feeds it text changes via
 * `recordChange` and tells it whether its tab is currently active via `active`.
 */

/** Idle longer than this (ms) pauses the active timer. */
const IDLE_TIMEOUT_MS = 45_000;
/**
 * A tick within this long (ms) of the last keystroke counts as Drafting
 * (actively typing); active ticks beyond it count as Editing (on the document
 * but not typing — reading / reviewing / pausing).
 */
const TYPING_WINDOW_MS = 2_000;
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
  /**
   * Permanently stop the active timer (session finished). All accumulated
   * metrics stay in state untouched so the logging screen can read them.
   */
  finish: () => void;
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
  // Only Drafting seconds are tracked; Editing = activeSeconds - draftingSeconds.
  const [draftingSeconds, setDraftingSeconds] = useState(0);
  const [highestWph, setHighestWph] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const sessionWords = Math.max(0, countWords(text) - initialWordCount);

  // Refs read inside the interval without making it a dependency.
  const lastEditAtRef = useRef(0);
  const activeRef = useRef(active);
  const hasStartedRef = useRef(false);
  const finishedRef = useRef(false);
  // Previous text, kept only to seed cleanly before the first edit.
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

  const finish = useCallback(() => {
    finishedRef.current = true;
    setIsFinished(true);
  }, []);

  const recordChange = useCallback(
    // `caret` is accepted for call-site compatibility but no longer used:
    // every keystroke now simply marks the moment of typing (lastEditAtRef),
    // and the tick decides Drafting vs. Editing from how recent that was.
    (nextText: string, _caret: number) => {
      // Session already finished: keep prev text in sync but don't resume.
      if (finishedRef.current) {
        prevTextRef.current = nextText;
        return;
      }
      const now = Date.now();

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

      // Mark this keystroke: it keeps the session in "drafting" for the next
      // TYPING_WINDOW_MS and resets the idle-pause countdown.
      lastEditAtRef.current = now;
      prevTextRef.current = nextText;
    },
    [],
  );

  // 1-second tick: advance active time and the drafting/editing split, pausing
  // when the tab is inactive or the user has gone idle.
  useEffect(() => {
    if (!hasStarted || isFinished) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      const idle = now - lastEditAtRef.current > IDLE_TIMEOUT_MS;
      // Finished sessions, inactive tabs, and idle gaps don't accrue time.
      if (finishedRef.current || !activeRef.current || idle) return;

      setActiveSeconds((s) => s + 1);
      // Typed within the last TYPING_WINDOW_MS → Drafting. Otherwise the user
      // is active on the doc but not typing, which falls into Editing via the
      // activeSeconds - draftingSeconds remainder below.
      if (now - lastEditAtRef.current <= TYPING_WINDOW_MS) {
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
  }, [hasStarted, isFinished]);

  // Drafting as a share of all active time; Editing is the remainder.
  // Defaults to 0 / 0 before any active second has accrued.
  let draftingPct = 0;
  let editingPct = 0;
  if (activeSeconds > 0) {
    draftingPct = Math.round((draftingSeconds / activeSeconds) * 100);
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
    finish,
  };
}
