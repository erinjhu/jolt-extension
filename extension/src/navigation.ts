/**
 * Navigation steps that drive the Jolt UI around the session form: opening the
 * orange "+" action menu, choosing "Add manual session", and revealing/filling
 * the inline new-document fields.
 *
 * These steps deliberately stop at data entry. They never click the document
 * "ADD" button or the form "SUBMIT" button and never press Enter, so the
 * populated modal stays open for the user to review and submit manually.
 */

import {
  FieldStatus,
  delay,
  fillControl,
  findButtonByText,
  nextFrame,
  norm,
} from './domUtils';
import { JoltSessionPayload } from './types';

/** Selector for the primary orange "+" action button. */
const ORANGE_BUTTON = 'button.bg-\\[\\#FF6038\\]';

/** Outcome of the new-document fill step. */
export interface DocumentCreationResult {
  /** Overall step status for the popup report. */
  status: FieldStatus;
  /** Status of the document title field specifically. */
  title: FieldStatus;
  /** Status of the document content field specifically. */
  content: FieldStatus;
}

/**
 * Open the orange "+" menu and click "Add manual session". Returns true once
 * the session modal (its heading) is present. No-ops gracefully if the modal
 * is already open.
 */
export async function openAddManualSession(): Promise<boolean> {
  if (isManualSessionModalOpen()) return true;

  const orange = document.querySelector<HTMLButtonElement>(ORANGE_BUTTON);
  if (!orange) return false;

  orange.click();
  await nextFrame();
  await delay(50);

  const menuItem = findButtonByText('add manual session');
  if (!menuItem) return false;

  menuItem.click();
  // Wait for the modal to mount.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (isManualSessionModalOpen()) return true;
    await delay(50);
  }
  return isManualSessionModalOpen();
}

/** True when the "Add Manual Session" modal is on screen. */
export function isManualSessionModalOpen(): boolean {
  const forms = Array.from(document.querySelectorAll('form'));
  return forms.some((f) => /add manual session/i.test(f.textContent ?? ''));
}

/**
 * Reveal the inline new-document fields via "+ Create new document" and fill
 * the title and content. Content falls back to the session description, then
 * the title, so the fields are never left empty.
 *
 * Does NOT click the "ADD" button — the user appends and submits manually.
 */
export async function fillNewDocumentFields(
  payload: JoltSessionPayload,
  root: ParentNode,
): Promise<DocumentCreationResult> {
  const trigger =
    root.querySelector<HTMLButtonElement>('button.self-start.text-\\[11px\\]') ??
    findButtonByText('create new document', root);

  if (!trigger) {
    return { status: 'not-found', title: 'not-found', content: 'not-found' };
  }

  trigger.click();
  await nextFrame();
  await delay(50);

  const title = fillControl(
    findDocFieldByHint(['document title', 'title', 'name'], root),
    payload.targetDocumentName,
  );
  const body = payload.description || payload.targetDocumentName;
  const content = fillControl(
    findDocFieldByHint(['content', 'body', 'text'], root),
    body,
  );

  const status: FieldStatus =
    title === 'filled' || content === 'filled' ? 'filled' : 'not-found';
  return { status, title, content };
}

/**
 * Locate a newly-revealed document field. The create-document inputs appear
 * after the trigger; we match by label text, placeholder, or (as a fallback)
 * the last empty input/textarea in the modal.
 */
function findDocFieldByHint(
  hints: string[],
  root: ParentNode,
): HTMLInputElement | HTMLTextAreaElement | null {
  const wanted = hints.map(norm);

  // 1. Placeholder match.
  const byPlaceholder = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input, textarea',
    ),
  ).find((el) => {
    const ph = norm(el.getAttribute('placeholder'));
    return ph !== '' && wanted.some((h) => ph.includes(h));
  });
  if (byPlaceholder) return byPlaceholder;

  // 2. Label-group match.
  const labels = Array.from(root.querySelectorAll<HTMLLabelElement>('label'));
  for (const label of labels) {
    const text = norm(label.textContent);
    if (!wanted.some((h) => text === h || text.includes(h))) continue;
    const group = label.closest('div') ?? label.parentElement;
    const control =
      group?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        'input, textarea',
      ) ?? null;
    if (control) return control;
  }
  return null;
}
