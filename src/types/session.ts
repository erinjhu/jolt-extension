/**
 * Shared contracts exchanged between the OCR pipeline, the session editor,
 * and the (future) Jolt sync service. These types are the single source of
 * truth for data shape across the app.
 */

/** Result produced by the client-side OCR engine. */
export interface OcrResult {
  /** Cleaned, human-readable text extracted from the image. */
  text: string;
  /** Overall engine confidence as a percentage in the range 0-100. */
  confidence: number;
  /** Wall-clock time the recognition took, in milliseconds. */
  processingTimeMs: number;
}

/** Visibility of a Jolt session. */
export type SessionVisibility = 'public' | 'private';

/**
 * Fully-formed payload that will be synced to Jolt (writewithjolt.com).
 * All fields are required so downstream consumers never have to guess.
 */
export interface JoltSessionPayload {
  /** Stable unique id for this session (used for dedupe + sync tracking). */
  id: string;
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
