import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { countWords } from '../utils/text';
import { useWritingSession, type WritingSessionMetrics } from '../hooks/useWritingSession';
import EditorStatsBar from './EditorStatsBar';
import ExistingDocContext from './ExistingDocContext';
import LeaveSessionModal from './LeaveSessionModal';
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
  /**
   * Overwrite the Google Doc's content (OAuth-aware, token-retrying). Used for
   * NEW docs only — full-document editing.
   */
  saveText: (fileId: string, text: string) => Promise<void>;
  /**
   * Append-only save for EXISTING docs: persist `appendText` after the
   * preserved `baseText`, never overwriting the original body/formatting.
   * Required when the opened doc is not new (doc.isNew !== true).
   */
  appendText?: (fileId: string, baseText: string, appendText: string) => Promise<void>;
  /**
   * Resolve the document's Drive folder name (OAuth-aware). Defaults to
   * "My Drive" on error. Used in the post-discard confirmation message.
   */
  loadFolderName?: (fileId: string) => Promise<string>;
  /**
   * Whether the TEXT EDITOR tab is the one currently showing. The active
   * timer pauses when this is false, and leaving the tab flushes a save.
   */
  isActive: boolean;
  /**
   * Return to the document selection screen. Currently unused in the UI (the
   * Change Doc button was removed), kept for call-site compatibility.
   */
  onChangeDoc?: () => void;
  /** Return to the mode-selection landing screen. */
  onBack?: () => void;
  /** Finish the session: final metrics + text handed to the logging screen. */
  onFinish: (summary: { metrics: WritingSessionMetrics; text: string }) => void;
  /** Guest demo: show "Saved locally (Demo)" instead of "Saved to Drive". */
  isGuest?: boolean;
  /**
   * Incrementing counter used by the header "Go home" action to request a
   * leave: when it changes the editor runs its own ← BACK guard (showing the
   * discard/save confirmation when there's an active session).
   */
  leaveRequest?: number;
}

export default function TextEditor({
  doc,
  loadText,
  saveText,
  appendText,
  loadFolderName,
  isActive,
  onBack,
  onFinish,
  isGuest = false,
  leaveRequest = 0,
}: TextEditorProps) {
  // Existing docs open append-only to preserve their formatting; only newly
  // created docs get full-document overwrite editing.
  const isNewDoc = doc.isNew === true;
  const [text, setText] = useState('');
  // Preserved read-only body of an existing doc (empty for new docs).
  const [baseText, setBaseText] = useState('');
  const [initialWordCount, setInitialWordCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isFinishing, setIsFinishing] = useState(false);
  // ← BACK modal stages: closed, the leave-confirm prompt, or the post-discard
  // "saved to Drive" confirmation. `discardBusy` covers the save+folder lookup.
  const [leaveStage, setLeaveStage] = useState<'closed' | 'confirm' | 'discarded'>('closed');
  const [discardBusy, setDiscardBusy] = useState(false);
  const [discardFolderName, setDiscardFolderName] = useState('My Drive');
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
        if (isNewDoc) {
          // New doc: edit the whole body; metrics count from its current words.
          setText(loaded);
          setInitialWordCount(countWords(loaded));
          lastSavedTextRef.current = loaded;
        } else {
          // Existing doc: keep the body read-only; the append box starts empty
          // and metrics count only the newly appended text (initial = 0).
          setBaseText(loaded);
          setText('');
          setInitialWordCount(0);
          lastSavedTextRef.current = '';
        }
        setSaveStatus('saved');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Keep the user in Editor Mode and surface a clear inline message; a
        // 403 usually means the Docs API isn't enabled or the file wasn't
        // granted to this app. Never reset the active view on a load failure.
        const raw = err instanceof Error ? err.message : '';
        let message = raw || 'Could not load the document.';
        if (/\b403\b/.test(raw)) {
          message =
            'Unable to load this Google Doc (403 Permission Denied). Make sure the Google Docs API is enabled, or try another document.';
        } else if (/\b401\b|unauthenticated|credentials_missing/i.test(raw)) {
          message =
            'Unable to load this Google Doc (401 — your session needs re-authorization). Please sign in again, then reopen the document.';
        }
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [doc.id, loadText, isNewDoc]);

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
      if (isNewDoc) {
        // New doc: overwrite the whole body.
        await saveText(doc.id, pending);
      } else {
        // Existing doc: append-only — never overwrite the preserved body.
        if (!appendText) throw new Error('Append save is not available.');
        await appendText(doc.id, baseText, pending);
      }
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
  }, [doc.id, saveText, appendText, isNewDoc, baseText]);

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

  /** True when there's an active session worth protecting on the way out. */
  const hasActiveSession = metrics.hasStarted || text !== lastSavedTextRef.current;

  /**
   * ← BACK: if an active session exists, open the confirmation modal so the
   * user doesn't lose their writing. Otherwise leave immediately.
   */
  function handleBack() {
    if (!onBack) return;
    if (hasActiveSession) {
      setLeaveStage('confirm');
      return;
    }
    onBack();
  }

  // Header "Go home" requested a leave: run the same guard as the ← BACK
  // button. Compare against the last-seen value (seeded to the initial
  // `leaveRequest`) so this fires ONLY when the nonce actually increments —
  // never on mount, and never on StrictMode's double-invoke of the effect,
  // which previously bounced the user home right after picking a doc.
  const lastLeaveRef = useRef(leaveRequest);
  useEffect(() => {
    if (leaveRequest === lastLeaveRef.current) return;
    lastLeaveRef.current = leaveRequest;
    handleBack();
    // handleBack is stable for this intent; only react to a changed nonce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaveRequest]);

  /** Modal: FINISH & SAVE — same as the Finish Session action. */
  async function handleConfirmFinish() {
    setLeaveStage('closed');
    await handleFinish();
  }

  /**
   * Modal: DISCARD — the document edits are still saved to Drive (so the
   * user's writing isn't lost); only the Jolt session metrics are dropped.
   * Flush any pending save, resolve the folder name, then show the
   * "saved to Drive" confirmation. Navigation waits for the OK button.
   */
  async function handleDiscard() {
    setDiscardBusy(true);
    // Stop the timer: the session tracking is being discarded.
    metrics.finish();
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    // Make sure the actual writing is persisted before leaving.
    await saveNow();
    if (loadFolderName) {
      try {
        setDiscardFolderName(await loadFolderName(doc.id));
      } catch {
        setDiscardFolderName('My Drive');
      }
    }
    if (!mountedRef.current) return;
    setDiscardBusy(false);
    setLeaveStage('discarded');
  }

  /** Post-discard OK: close the popup and complete the navigation back. */
  function handleDiscardedOk() {
    setLeaveStage('closed');
    onBack?.();
  }

  const statusLabel: Record<SaveStatus, string> = {
    idle: '',
    saved: isGuest ? 'Saved locally (Demo)' : 'Saved to Drive',
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

  const saveStatusNode = (
    <span
      className={`whitespace-nowrap font-mono text-[10px] ${statusColor[saveStatus]}`}
      aria-live="polite"
    >
      {statusLabel[saveStatus]}
    </span>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Outer top row: ← BACK on the left; truncated doc title on the right. */}
      <div className="flex items-center justify-between gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={handleBack}
            className="shrink-0 rounded-none border border-[#111111] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#111111] transition hover:bg-gray-100"
          >
            ← Back
          </button>
        ) : (
          <span />
        )}

        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-sm font-semibold text-black">{doc.name}</span>
        </div>
      </div>

      <section className="flex min-h-[70vh] flex-col rounded-none border border-gray-300 bg-white text-black">
      {/* Inner top row: live writing-session stats with the save status in
          the top-right corner, all aligned on one row. */}
      <EditorStatsBar metrics={metrics} statusSlot={saveStatusNode} />

      {error && (
        <p className="border-b border-gray-300 px-3 py-2 text-xs text-red-600" aria-live="polite">
          {error}
        </p>
      )}

      {/* Existing docs: read-only context above + labeled append box below.
          New docs: a single full-document editing surface. */}
      {!isNewDoc && !isLoading && (
        <>
          <ExistingDocContext text={baseText} />
          <span className="px-4 pt-4 text-[10px] font-bold uppercase tracking-wide text-gray-500">
            New Text to Append
          </span>
        </>
      )}
      <textarea
        value={text}
        onChange={handleChange}
        disabled={isLoading}
        placeholder={
          isLoading
            ? 'Loading document…'
            : isNewDoc
              ? 'Start writing…'
              : 'Write your new session text here…'
        }
        spellCheck
        className={`w-full flex-1 resize-none rounded-none border-0 bg-white px-4 py-4 font-mono text-sm leading-relaxed text-black outline-none disabled:opacity-60 ${
          isNewDoc ? 'min-h-[50vh]' : 'min-h-[30vh]'
        }`}
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

      {leaveStage !== 'closed' && (
        <LeaveSessionModal
          stage={leaveStage}
          isBusy={isFinishing || discardBusy}
          folderName={discardFolderName}
          onFinishAndSave={() => void handleConfirmFinish()}
          onDiscard={() => void handleDiscard()}
          onDiscardedOk={handleDiscardedOk}
          onDismiss={() => setLeaveStage('closed')}
        />
      )}
    </div>
  );
}
