/**
 * Local copy of the session contract shared with the main app
 * (`src/types/session.ts`). Kept in-sync by hand so the extension can be
 * built as a standalone project without reaching outside `extension/`.
 */

/**
 * Fully-formed payload synced to Jolt (writewithjolt.com) via Google Drive.
 * All fields are required so downstream consumers never have to guess.
 */
export type SessionVisibility = 'public' | 'private';

export interface JoltSessionPayload {
  /** Stable unique id for this session (used for dedupe + sync tracking). */
  id: string;
  /** Short session title shown in Jolt. */
  title: string;
  /** The user's manual notes typed into the Description field (may be empty). */
  description: string;
  /** OCR-transcribed text from the captured photo (goes into the Google Doc). */
  ocrText: string;
  /** A memorable quote captured during the session. */
  quote: string;
  /** Calendar date of the session as a `YYYY-MM-DD` string. */
  date: string;
  /** Session start time as an ISO 8601 string. */
  startTime: string;
  /** Session stop time as an ISO 8601 string. */
  stopTime: string;
  /** Whole-hour portion of the session duration. */
  durationHours: number;
  /** Remaining-minute portion of the session duration (0-59). */
  durationMinutes: number;
  /** Number of words written, seeded from the OCR text. */
  wordCount: number;
  /** Whether the session is shared publicly or kept private. */
  visibility: SessionVisibility;
  /** Name of the Jolt target document the session attaches to. */
  targetDocumentName: string;
  /** Source note image encoded as a base64 data URL. */
  imageBase64: string;
  /** Timestamp the payload was assembled, as an ISO 8601 string. */
  createdAt: string;
}

/** `chrome.storage.local` key for the cached list of all fetched sessions. */
export const SESSIONS_KEY = 'joltSessions' as const;
/** `chrome.storage.local` key for the ids of sessions already autofilled. */
export const SYNCED_IDS_KEY = 'syncedSessionIds' as const;

/**
 * Lightweight session summary cached in `chrome.storage.local` for the popup
 * list. Deliberately OMITS `imageBase64` — base64 photos are large and would
 * blow past the storage quota. The full payload (with image) is fetched from
 * Drive on demand when a specific session is autofilled.
 */
export type SessionSummary = Omit<JoltSessionPayload, 'imageBase64'>;

/** Cached list of session summaries pulled from Drive, newest first. */
export interface CachedSessions {
  /** Summaries sorted by `createdAt` descending (most recent first). */
  sessions: SessionSummary[];
  /** When the list was fetched from Drive (epoch ms). */
  fetchedAt: number;
}

/** Messages exchanged between popup / background / content scripts. */
export type ExtensionMessage =
  | { type: 'SYNC_FROM_DRIVE' }
  | { type: 'GET_CACHED_SESSIONS' }
  | { type: 'GET_SYNCED_IDS' }
  | { type: 'MARK_SESSION_SYNCED'; sessionId: string }
  | { type: 'GET_SESSION_PAYLOAD'; sessionId: string }
  | { type: 'AUTOFILL_JOLT'; payload: JoltSessionPayload }
  | { type: 'PING' };

/** Uniform response envelope for message handlers. */
export type MessageResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };
