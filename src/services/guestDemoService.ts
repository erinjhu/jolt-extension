/**
 * Guest Demo Mode: an in-memory stand-in for the Google Drive + Docs layer so
 * visitors can explore the full Jolt workflow (editor, scan, session tracking)
 * without signing in. Every function here mirrors the signature of its real
 * counterpart (joltDocumentsService / googleDocsService / transcription /
 * syncSessionToDrive) but operates purely on module-local state — no network.
 *
 * Nothing persists across reloads; the store resets when the tab closes, which
 * is the intended "sandbox" behavior for a demo.
 */

import type { GoogleUser } from './googleAuth';
import type { TargetDoc } from './joltDocumentsService';
import type { CreatedDoc } from './googleDocsService';
import type { TranscriptionResult } from './transcription';
import type { JoltSessionPayload } from '../types/session';

/** Folder label shown in the post-discard "saved to Drive" confirmation. */
export const GUEST_FOLDER_NAME = 'My Drive (Demo)';

/** Synthetic user that satisfies the auth gate + header without real OAuth. */
export const GUEST_USER: GoogleUser = {
  hasDriveScope: true,
  accessToken: 'guest-demo',
  email: 'guest@demo.local',
  name: 'Guest',
  picture: null,
};

/** A mock document: a selectable target plus its in-memory body text. */
interface GuestDoc {
  id: string;
  name: string;
  text: string;
}

/** Build a clean local date-time title, e.g. "Nov 16, 2026, 10:30 PM". */
function formatDocTitle(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/** Sample handwritten-note text the mock OCR "extracts" in Scan Mode. */
export const SAMPLE_OCR_TEXT = [
  'Morning pages — ideas are finally flowing again.',
  '',
  'The trick is to keep the hand moving and not stop to judge the words.',
  'Momentum beats perfection. Three pages, every day, before the inbox.',
].join('\n');

/** Starting body for the pre-populated "Sample Draft" document. */
const SAMPLE_DRAFT_TEXT = [
  'I start every morning by getting slapped in the face. The first time it happened, I thought my dreams of flying like a bird came true. But then I face-planted into sweaty socks that smelled like moldy cheese. It’s not easy being an alarm clock.'
].join('\n');

/** Starting body for the pre-populated "Project Notes" document. */
const PROJECT_NOTES_TEXT = [
  '- make story either present or past tense',
  '- brainstorm ideas for ending',
  '- rewrite the intro paragraph',
].join('\n');

/**
 * The in-memory workspace. Seeded with two sample docs on first use so the
 * demo always has something to open. A counter keeps new-doc ids unique.
 */
let docs: GuestDoc[] = [];
let idCounter = 0;
let seeded = false;

function nextId(): string {
  idCounter += 1;
  return `guest-doc-${idCounter}`;
}

/** Seed the two sample documents exactly once per session. */
function ensureSeeded(): void {
  if (seeded) return;
  seeded = true;
  docs = [
    { id: nextId(), name: `${formatDocTitle(new Date())} (Sample Draft)`, text: SAMPLE_DRAFT_TEXT },
    { id: nextId(), name: 'Project Notes', text: PROJECT_NOTES_TEXT },
  ];
}

/** Reset the sandbox (used when exiting demo mode). */
export function resetGuestWorkspace(): void {
  docs = [];
  idCounter = 0;
  seeded = false;
}

function findDoc(id: string): GuestDoc | undefined {
  return docs.find((d) => d.id === id);
}

// ── Shadows of joltDocumentsService ───────────────────────────────────────

/** Guest equivalent of `listRecentDocs`: the mock workspace, newest first. */
export function guestListDocs(): TargetDoc[] {
  ensureSeeded();
  return docs.map(({ id, name }) => ({ id, name }));
}

/** Guest equivalent of `getDefaultFolder`. */
export function guestDefaultFolder(): TargetDoc {
  return { id: 'guest-folder', name: GUEST_FOLDER_NAME };
}

/** Guest equivalent of `createTargetDoc`: adds an empty mock doc. */
export function guestCreateDoc(title: string): CreatedDoc {
  ensureSeeded();
  const name = title.trim() || formatDocTitle(new Date());
  const doc: GuestDoc = { id: nextId(), name, text: '' };
  docs = [doc, ...docs];
  return { id: doc.id, name: doc.name, webViewLink: `#demo/${doc.id}` };
}

// ── Shadows of googleDocsService ──────────────────────────────────────────

/** Guest equivalent of `fetchDocumentText`. */
export function guestLoadText(fileId: string): string {
  ensureSeeded();
  return findDoc(fileId)?.text ?? '';
}

/** Guest equivalent of `saveDocumentText`: overwrite the mock body. */
export function guestSaveText(fileId: string, newText: string): void {
  const doc = findDoc(fileId);
  if (doc) doc.text = newText;
}

/**
 * Append-only save for existing mock docs: set the body to the preserved
 * `baseText` plus this session's `appendText` (blank-line separated when both
 * are non-empty). Idempotent across auto-saves since it rebuilds from the
 * fixed base each time, so the Demo Document Preview shows the original
 * content followed by the newly appended text.
 */
export function guestSetAppendedText(fileId: string, baseText: string, appendText: string): void {
  const doc = findDoc(fileId);
  if (!doc) return;
  if (!appendText) {
    doc.text = baseText;
    return;
  }
  doc.text = baseText ? `${baseText}\n\n${appendText}` : appendText;
}

/** Guest equivalent of `fetchDocumentFolderName`. */
export function guestFolderName(): string {
  return GUEST_FOLDER_NAME;
}

// ── Shadow of the scan transcription path ─────────────────────────────────

/**
 * Guest equivalent of `transcribeViaGoogleDrive`: persist the text that OCR
 * actually extracted from the user's photo into the selected mock doc, so the
 * in-app Demo Document Preview shows live scanned content rather than stale or
 * placeholder text. Appends to any existing body (or sets it, for a freshly
 * created empty doc) so multiple pages scanned in one session accumulate
 * cleanly. `SAMPLE_OCR_TEXT` is used only as a fallback when OCR returned
 * nothing readable, so the demo never shows an empty result.
 *
 * Returns a TranscriptionResult pointing at the mock doc (no real Drive link).
 */
export function guestTranscribe(docId: string, extractedText?: string): TranscriptionResult {
  const scanned = extractedText?.trim() ? extractedText.trim() : SAMPLE_OCR_TEXT;
  const doc = findDoc(docId);
  if (doc) {
    doc.text = doc.text ? `${doc.text}\n\n${scanned}` : scanned;
  }
  return {
    text: scanned,
    source: 'google-drive',
    docId,
    webViewLink: `#demo/${docId}`,
  };
}

// ── Shadow of syncSessionToDrive ──────────────────────────────────────────

/**
 * Guest equivalent of `syncSessionToDrive`: no network. Returns a CreatedDoc
 * describing the (mock) target so the confirmation screen can render.
 */
export function guestSyncSession(payload: JoltSessionPayload): CreatedDoc {
  const existing = docs.find((d) => d.name === payload.targetDocumentName);
  const id = existing?.id ?? nextId();
  return {
    id,
    name: payload.targetDocumentName || payload.title || 'Demo Session',
    webViewLink: `#demo/${id}`,
  };
}
