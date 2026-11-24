/**
 * MV3 service worker. Owns all privileged work (OAuth + Drive network calls)
 * so the popup and content scripts never touch tokens directly. Communicates
 * over `chrome.runtime` messages with a uniform success/error envelope.
 */

import {
  getCachedSessions,
  getSessionPayload,
  getSyncedSessionIds,
  markSessionSynced,
  syncFromDrive,
} from './driveFetcher';
import {
  AUTH_EXPIRED_MESSAGE,
  isAuthRevokedOrExpired,
  MISSING_DRIVE_MESSAGE,
  MissingDrivePermissionError,
} from './auth';
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
    case 'GET_CACHED_SESSIONS': {
      const cached = await getCachedSessions();
      return { ok: true, data: cached };
    }
    case 'GET_SYNCED_IDS': {
      const ids = await getSyncedSessionIds();
      return { ok: true, data: ids };
    }
    case 'MARK_SESSION_SYNCED': {
      const ids = await markSessionSynced(message.sessionId);
      return { ok: true, data: ids };
    }
    case 'GET_SESSION_PAYLOAD': {
      const payload = await getSessionPayload(message.sessionId);
      if (!payload) {
        return { ok: false, error: 'That session was not found in Drive. Fetch again.' };
      }
      return { ok: true, data: payload };
    }
    default:
      return { ok: false, error: `Unknown message type.` };
  }
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((err: unknown) => {
      // Auth failures keep their own code so the popup shows "sign in again"
      // instead of a generic (or timeout) message.
      let response: MessageResponse;
      if (err instanceof MissingDrivePermissionError) {
        response = { ok: false, error: MISSING_DRIVE_MESSAGE, code: 'DRIVE_PERMISSION' };
      } else if (isAuthRevokedOrExpired(err)) {
        response = { ok: false, error: AUTH_EXPIRED_MESSAGE, code: 'AUTH_EXPIRED' };
      } else {
        response = { ok: false, error: toErrorMessage(err) };
      }
      sendResponse(response);
    });
  // Returning true keeps the message channel open for the async response.
  return true;
});
