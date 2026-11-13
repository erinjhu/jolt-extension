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
  /** Short session title shown in Jolt. */
  title: string;
  /** Longer free-form notes / OCR body text. */
  description: string;
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

/** `chrome.storage.local` key under which the cached session lives. */
export const STORAGE_KEY = 'latestJoltSession' as const;

/** Shape persisted in `chrome.storage.local`. */
export interface CachedSession {
  payload: JoltSessionPayload;
  /** When the payload was fetched from Drive (epoch ms). */
  fetchedAt: number;
}

/** Messages exchanged between popup / background / content scripts. */
export type ExtensionMessage =
  | { type: 'SYNC_FROM_DRIVE' }
  | { type: 'GET_CACHED_SESSION' }
  | { type: 'AUTOFILL_JOLT'; payload: JoltSessionPayload };

/** Uniform response envelope for message handlers. */
export type MessageResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };
