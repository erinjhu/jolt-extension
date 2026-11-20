import { useCallback, useRef } from 'react';
import {
  appendDocumentText,
  fetchDocumentFolderName,
  fetchDocumentText,
  replaceAppendedRange,
  saveDocumentText,
} from '../services/googleDocsService';
import {
  guestFolderName,
  guestLoadText,
  guestSaveText,
  guestSetAppendedText,
} from '../services/guestDemoService';

/**
 * The document read/write operations the Text Editor needs, with Google
 * Drive/Docs (via a token-retrying runner) and Guest Demo (in-memory mock)
 * behind one interface. Keeps App lean and isolates all doc I/O here.
 *
 * @param isGuestMode   When true, every op runs against the mock workspace.
 * @param withTokenRetry Runs a Drive/Docs call with silent 401 refresh+retry.
 */
export function useDocumentSync(
  isGuestMode: boolean,
  withTokenRetry: <T>(run: (token: string) => Promise<T>) => Promise<T>,
) {
  /** Load a document's current plain text. */
  const loadDocumentText = useCallback(
    (fileId: string) =>
      isGuestMode
        ? Promise.resolve(guestLoadText(fileId))
        : withTokenRetry((token) => fetchDocumentText(token, fileId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isGuestMode, withTokenRetry],
  );

  /** Overwrite a NEW doc's full body (or the mock doc in demo mode). */
  const saveDocumentText_ = useCallback(
    (fileId: string, newText: string) => {
      if (isGuestMode) {
        guestSaveText(fileId, newText);
        return Promise.resolve();
      }
      return withTokenRetry((token) => saveDocumentText(token, fileId, newText));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isGuestMode, withTokenRetry],
  );

  // Body index where this session's appended text begins in the live doc, set
  // on the first append and reused so later auto-saves replace only that range.
  const appendStartRef = useRef<number | null>(null);

  /** Reset the append anchor so the next existing-doc session starts fresh. */
  const resetAppendAnchor = useCallback(() => {
    appendStartRef.current = null;
  }, []);

  /**
   * Append-only save for EXISTING docs: never overwrites the preserved body.
   * First save inserts at the doc's end and records the anchor; later saves
   * replace only from that anchor. Guest mode rebuilds from the base text.
   */
  const appendDocumentTextFn = useCallback(
    async (fileId: string, baseText: string, appendText: string) => {
      if (isGuestMode) {
        guestSetAppendedText(fileId, baseText, appendText);
        return;
      }
      if (appendStartRef.current == null) {
        appendStartRef.current = await withTokenRetry((token) =>
          appendDocumentText(token, fileId, appendText),
        );
      } else {
        const start = appendStartRef.current;
        await withTokenRetry((token) => replaceAppendedRange(token, fileId, start, appendText));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isGuestMode, withTokenRetry],
  );

  /** Resolve a document's Drive folder name (mock in demo mode). */
  const loadDocumentFolderName = useCallback(
    (fileId: string) =>
      isGuestMode
        ? Promise.resolve(guestFolderName())
        : withTokenRetry((token) => fetchDocumentFolderName(token, fileId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isGuestMode, withTokenRetry],
  );

  return {
    loadDocumentText,
    saveDocumentText: saveDocumentText_,
    appendDocumentText: appendDocumentTextFn,
    loadDocumentFolderName,
    resetAppendAnchor,
  };
}
