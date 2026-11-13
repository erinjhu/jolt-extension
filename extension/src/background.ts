/**
 * MV3 service worker. Owns all privileged work (OAuth + Drive network calls)
 * so the popup and content scripts never touch tokens directly. Communicates
 * over `chrome.runtime` messages with a uniform success/error envelope.
 */

import { getCachedSession, syncFromDrive } from './driveFetcher';
import { ExtensionMessage, MessageResponse } from './types';

/** Normalize any thrown value into a readable error string. */
function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unexpected error.';
}

async function handleMessage(
  message: ExtensionMessage,
): Promise<MessageResponse> {
  switch (message.type) {
    case 'SYNC_FROM_DRIVE': {
      const cached = await syncFromDrive();
      return { ok: true, data: cached };
    }
    case 'GET_CACHED_SESSION': {
      const cached = await getCachedSession();
      return { ok: true, data: cached };
    }
    default:
      return { ok: false, error: `Unknown message type.` };
  }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: toErrorMessage(err) }));
  // Returning true keeps the message channel open for the async response.
  return true;
});
