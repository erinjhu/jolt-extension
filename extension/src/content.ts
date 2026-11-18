/**
 * Jolt content-script orchestrator. Runs in the page context on
 * writewithjolt.com, listens for an AUTOFILL_JOLT message, and drives the full
 * sequence end to end:
 *
 *   1. Open the orange "+" action menu and choose "Add manual session".
 *   2. Fill the session fields (date, time, duration, words, title, etc.).
 *   3. Reveal and fill the new-document title + content fields.
 *   4. Inject the note image into the file input.
 *
 * It intentionally STOPS after data entry: it never clicks the document "ADD"
 * button or the form "SUBMIT" button, and never presses Enter. The populated
 * modal is left open so a human can review and submit manually.
 *
 * All DOM detail lives in focused modules (`domUtils`, `sessionForm`,
 * `navigation`); this file only sequences them and reports per-step status.
 */

import { FieldStatus, dataUrlToFile } from './domUtils';
import { fillNewDocumentFields, openAddManualSession } from './navigation';
import {
  AutofillReport as SessionReport,
  fillSessionFields,
  findModalRoot,
} from './sessionForm';
import { ExtensionMessage, JoltSessionPayload, MessageResponse } from './types';

/**
 * Full report returned to the popup: every session field plus the new-document
 * title/content fields. No submit/add status because those actions are
 * deliberately left to the user. The popup iterates this as a generic record
 * of statuses.
 */
export type AutofillReport = SessionReport & {
  newDocumentTitle: FieldStatus;
  newDocumentContent: FieldStatus;
};

/** Pick a filename extension from the image data URL's mime type. */
function imageFilename(dataUrl: string): string {
  const mime = /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? '';
  const ext = /png/i.test(mime) ? 'png' : /webp/i.test(mime) ? 'webp' : 'jpg';
  return `jolt-note.${ext}`;
}

/**
 * Navigate → fill session fields → fill new-document fields, then STOP.
 * Does not click "ADD" or "SUBMIT", leaving the populated modal open for the
 * user to review and submit manually.
 */
async function runAutofill(payload: JoltSessionPayload): Promise<AutofillReport> {
  const opened = await openAddManualSession();
  if (!opened) {
    throw new Error(
      'Could not open the Add Manual Session modal from the orange + menu.',
    );
  }

  const root = findModalRoot();

  const imageFile = payload.imageBase64
    ? dataUrlToFile(payload.imageBase64, imageFilename(payload.imageBase64))
    : null;

  const sessionFields = fillSessionFields(payload, root, imageFile);

  // Reveal and fill the new-document fields, but do not append or submit.
  const doc = await fillNewDocumentFields(payload, root);

  return {
    ...sessionFields,
    document: doc.status,
    newDocumentTitle: doc.title,
    newDocumentContent: doc.content,
  };
}

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender,
    sendResponse: (r: MessageResponse<AutofillReport | 'pong'>) => void,
  ) => {
    // Liveness probe used by the popup to decide whether injection is needed.
    if (message.type === 'PING') {
      sendResponse({ ok: true, data: 'pong' });
      return undefined;
    }

    if (message.type !== 'AUTOFILL_JOLT') return undefined;

    runAutofill(message.payload)
      .then((report) => {
        const filledAny = Object.values(report).some((s) => s === 'filled');
        if (!filledAny) {
          sendResponse({
            ok: false,
            error:
              'Opened the modal but could not fill any fields — Jolt’s form markup may have changed.',
          });
          return;
        }
        sendResponse({ ok: true, data: report });
      })
      .catch((err: unknown) => {
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : 'Autofill failed.',
        });
      });

    // Async response: keep the message channel open.
    return true;
  },
);
