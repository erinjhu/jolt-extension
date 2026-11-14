import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { countWords } from '../utils/text';
import { useWritingSession, type WritingSessionMetrics } from '../hooks/useWritingSession';
import EditorStatsBar from './EditorStatsBar';
import type { TargetDoc } from '../services/joltDocumentsService';

/** Delay after the last keystroke before an auto-save fires. */
const AUTOSAVE_DELAY_MS = 3_000;

/** Save lifecycle used to drive the header status badge. */
type SaveStatus = 'idle' | 'saved' | 'saving' | 'unsaved' | 'error';

/**
 * Distraction-free mobile editor for the selected Google Doc with real-time
 * two-way sync. On open it exports the doc's current plain text and seeds the
 * textarea; edits are debounced-saved back to the actual Google Doc (and also
 * flushed when the user leaves the tab or finishes the session).
 *
 * A writing-session tracker records start time, active duration (idle-paused),
 * net words, drafting/editing split, and flow metrics. Those metrics keep
 * accumulating in state across background saves and are handed to the logging
 * screen when the session is finished.
 */
interface TextEditorProps {
  doc: TargetDoc;
  /** Export the document's current plain text (OAuth-aware, token-retrying). */
  loadText: (fileId: string) => Promise<string>;
  /** Overwrite the Google Doc's content (OAuth-aware, token-retrying). */
  saveText: (fileId: string, text: string) => Promise<void>;
  /**
   * Whether the TEXT EDITOR tab is the one currently showing. The active
   * timer pauses when this is false, and leaving the tab flushes a save.
   */
  isActive: boolean;
  /** Return to the document selection screen. */
  onChangeDoc: () => void;
  /** Return to the mode-selection landing screen. */
  onBack?: () => void;
  /** Finish the session: final metrics + text handed to the logging screen. */
  onFinish: (summary: { metrics: WritingSessionMetrics; text: string }) => void;
}

export default function TextEditor({
  doc,
  loadText,
  saveText,
  isActive,
  onChangeDoc,
  onBack,
  onFinish,
}: TextEditorProps) {
  const [text, setText] = useState('');
  const [initialWordCount, setInitialWordCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isFinishing, setIsFinishing] = useState(false);
  // Browser-tab visibility: a backgrounded page also pauses the timer.
  const [pageVisible, setPageVisible] = useState(
    typeof document === 'undefined' ? true : document.visibilityState === 'visible',
  );

  const metrics = useWritingSession(text, initialWordCount, isActive && pageVisible);

  // Refs that the debounce / flush logic reads without re-subscribing.
  const lastSavedTextRef = useRef('');
  const textRef = useRef('');
  const debounceRef = useRef<number | null>(null);
  // Guards against overlapping saves and stale writes after unmount.
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  textRef.current = text;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    loadText(doc.id)
      .then((loaded) => {
        if (cancelled) return;
        setText(loaded);
        setInitialWordCount(countWords(loaded));
        // The freshly loaded text is, by definition, already in Drive.
        lastSavedTextRef.current = loaded;
        setSaveStatus('saved');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load the document.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [doc.id, loadText]);

  /**
   * Persist the current text to the Google Doc if it differs from the last
   * saved version. Serializes concurrent calls so a flush can't race the
   * debounce timer. Returns once the write settles.
   */
  const saveNow = useCallback(async () => {
    const pending = textRef.current;
    if (savingRef.current || pending === lastSavedTextRef.current) return;
    savingRef.current = true;
    setSaveStatus('saving');
    try {
      await saveText(doc.id, pending);
      lastSavedTextRef.current = pending;
      if (!mountedRef.current) return;
      // If the user kept typing while we saved, we're dirty again.
      setSaveStatus(textRef.current === pending ? 'saved' : 'unsaved');
    } catch (err) {
      if (mountedRef.current) {
        setSaveStatus('error');
        setError(err instanceof Error ? err.message : 'Could not save to Drive.');
      }
    } finally {
      savingRef.current = false;
    }
  }, [doc.id, saveText]);

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    // Record the edit for session tracking before React re-renders.
    metrics.recordChange(next, e.target.selectionStart ?? next.length);
    setText(next);
    setSaveStatus(next === lastSavedTextRef.current ? 'saved' : 'unsaved');

    // Debounce: auto-save 3s after the user stops typing.
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      void saveNow();
    }, AUTOSAVE_DELAY_MS);
  }

  // Leaving the TEXT EDITOR tab flushes any pending edits immediately.
  useEffect(() => {
    if (!isActive) {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      void saveNow();
    }
  }, [isActive, saveNow]);

  /** FINISH SESSION: stop the timer, force a final save, hand off metrics. */
  async function handleFinish() {
    if (isFinishing) return;
    setIsFinishing(true);
    // Pause the active timer first so the save round-trip isn't counted.
    metrics.finish();
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    await saveNow();
    // Hand the final text + accumulated analytics to the logging screen.
    onFinish({ metrics, text: textRef.current });
    if (mountedRef.current) setIsFinishing(false);
  }

  /** ← BACK: flush pending edits, then return to the mode landing. */
  async function handleBack() {
    if (!onBack) return;
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    await saveNow();
    onBack();
  }

  const statusLabel: Record<SaveStatus, string> = {
    idle: '',
    saved: 'Saved to Drive',
    saving: 'Saving…',
    unsaved: 'Unsaved changes',
    error: 'Save failed',
  };
  const statusColor: Record<SaveStatus, string> = {
    idle: 'text-gray-400',
    saved: 'text-gray-500',
    saving: 'text-gray-500',
    unsaved: 'text-gray-700',
    error: 'text-red-600',
  };

  return (
    <div className="flex flex-col gap-6">
      {onBack && (
        <button
          type="button"
          onClick={() => void handleBack()}
          className="self-start rounded-none border border-[#111111] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#111111] transition hover:bg-gray-100"
        >
          ← Back
        </button>
      )}

      <section className="flex min-h-[70vh] flex-col rounded-none border border-gray-300 bg-white text-black">
      {/* Compact header: document name, save badge, Change Doc. */}
      <header className="flex items-center justify-between gap-3 border-b border-gray-300 px-3 py-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Editing
          </span>
          <span className="truncate text-sm font-semibold text-black">{doc.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`whitespace-nowrap font-mono text-[10px] ${statusColor[saveStatus]}`}
            aria-live="polite"
          >
            {statusLabel[saveStatus]}
          </span>
          <button
            type="button"
            onClick={onChangeDoc}
            className="whitespace-nowrap rounded-none border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-black transition hover:bg-gray-100"
          >
            Change Doc
          </button>
        </div>
      </header>

      {/* Live writing-session stats. */}
      <EditorStatsBar metrics={metrics} />

      {error && (
        <p className="border-b border-gray-300 px-3 py-2 text-xs text-red-600" aria-live="polite">
          {error}
        </p>
      )}

      {/* Full-height distraction-free editing surface. */}
      <textarea
        value={text}
        onChange={handleChange}
        disabled={isLoading}
        placeholder={isLoading ? 'Loading document…' : 'Start writing…'}
        spellCheck
        className="min-h-[50vh] w-full flex-1 resize-none rounded-none border-0 bg-white px-4 py-4 font-mono text-sm leading-relaxed text-black outline-none disabled:opacity-60"
      />

      {/* Primary action: finish, final-save, go to the logging screen. */}
      <div className="border-t border-gray-300 p-3">
        <button
          type="button"
          onClick={() => void handleFinish()}
          disabled={isLoading || isFinishing}
          className="w-full rounded-none bg-black px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-gray-800 disabled:opacity-40"
        >
          {isFinishing ? 'Finishing…' : 'Finish Session'}
        </button>
      </div>
      </section>
    </div>
  );
}
