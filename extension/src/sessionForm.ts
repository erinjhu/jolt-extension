/**
 * Fillers for the Jolt "Add Manual Session" modal fields. The live form does
 * not expose `id` / `name` / `aria-label`, so fields are located by label-group
 * structure, placeholder-overlay text, or adjacent unit spans. See each helper.
 */

import { FieldStatus, TextControl, fillControl, norm } from './domUtils';
import { JoltSessionPayload } from './types';

/** Which session fields the autofill attempts, with per-field status. */
export type AutofillReport = Record<
  | 'title'
  | 'description'
  | 'quote'
  | 'date'
  | 'hours'
  | 'minutes'
  | 'wordCount'
  | 'document'
  | 'image',
  FieldStatus
>;

/**
 * Locate the open "Add Manual Session" modal — the `<form>` whose heading reads
 * "Add Manual Session". Falls back to a dialog container, then the document.
 */
export function findModalRoot(): ParentNode {
  const forms = Array.from(document.querySelectorAll<HTMLFormElement>('form'));
  const manualForm = forms.find((f) =>
    /add manual session/i.test(f.textContent ?? ''),
  );
  if (manualForm) return manualForm;

  const dialog = document.querySelector<HTMLElement>(
    '[role="dialog"], [aria-modal="true"], .modal, [class*="modal" i]',
  );
  return dialog ?? document;
}

/** Two-digit zero-padded string, as the form displays "00". */
function pad2(n: number): string {
  return String(Math.max(0, Math.trunc(n))).padStart(2, '0');
}

/**
 * Find the field group (the flex wrapper) whose `<label>` text matches a hint,
 * then return the first input/textarea inside it.
 */
function findByLabel(hints: string[], root: ParentNode): TextControl | null {
  const wanted = hints.map(norm);
  const labels = Array.from(root.querySelectorAll<HTMLLabelElement>('label'));
  for (const label of labels) {
    const text = norm(label.textContent);
    if (!wanted.some((h) => text === h || text.startsWith(h))) continue;
    const group = label.closest('div') ?? label.parentElement;
    const control = group?.querySelector<TextControl>('input, textarea') ?? null;
    if (control) return control;
  }
  return null;
}

/** Find a textarea by the placeholder-overlay span text (Title/Description). */
function findByOverlayPlaceholder(
  phrases: string[],
  root: ParentNode,
): HTMLTextAreaElement | null {
  const wanted = phrases.map(norm);
  const overlays = Array.from(
    root.querySelectorAll<HTMLElement>('[aria-hidden="true"]'),
  );
  for (const overlay of overlays) {
    if (!wanted.some((p) => norm(overlay.textContent).includes(p))) continue;
    const textarea =
      overlay.parentElement?.querySelector<HTMLTextAreaElement>('textarea');
    if (textarea) return textarea;
  }
  return null;
}

/** Date: native `<input type="date">` expecting a `YYYY-MM-DD` value. */
function fillDate(payload: JoltSessionPayload, root: ParentNode): FieldStatus {
  const el =
    root.querySelector<HTMLInputElement>('input[type="date"]') ??
    (findByLabel(['date'], root) as HTMLInputElement | null);
  if (!el) return 'not-found';
  const raw = payload.date || payload.createdAt || payload.startTime;
  const ymd = /^\d{4}-\d{2}-\d{2}/.exec(raw)?.[0] ?? '';
  if (!ymd) return 'no-match';
  return fillControl(el, ymd);
}

/** Locate the Duration group wrapper (holds the two numeric inputs). */
function findDurationGroup(root: ParentNode): HTMLElement | null {
  const labels = Array.from(root.querySelectorAll<HTMLLabelElement>('label'));
  const label = labels.find((l) => norm(l.textContent) === 'duration');
  let group: HTMLElement | null = label?.closest('div') ?? null;
  // Walk up until the wrapper actually contains both numeric inputs.
  while (group && group.querySelectorAll('input').length < 2) {
    const parent = group.parentElement;
    if (!parent || parent === root) break;
    group = parent;
  }
  return group;
}

/** Duration: two numeric inputs distinguished by adjacent "hr"/"min" spans. */
function fillDuration(
  payload: JoltSessionPayload,
  root: ParentNode,
): { hours: FieldStatus; minutes: FieldStatus } {
  const group = findDurationGroup(root);
  if (!group) return { hours: 'not-found', minutes: 'not-found' };

  const inputs = Array.from(group.querySelectorAll<HTMLInputElement>('input'));
  let hoursEl: HTMLInputElement | null = null;
  let minutesEl: HTMLInputElement | null = null;

  for (const input of inputs) {
    const unit = norm(input.parentElement?.textContent);
    if (unit.includes('hr') || unit.includes('hour')) hoursEl = input;
    else if (unit.includes('min')) minutesEl = input;
  }
  if (!hoursEl && inputs[0]) hoursEl = inputs[0];
  if (!minutesEl && inputs[1]) minutesEl = inputs[1];

  return {
    hours: fillControl(hoursEl, pad2(payload.durationHours)),
    minutes: fillControl(minutesEl, pad2(payload.durationMinutes)),
  };
}

/** Inject the decoded image into Jolt's hidden file input via DataTransfer. */
function injectImage(
  file: File | null,
  root: ParentNode,
): FieldStatus {
  const fileInput =
    root.querySelector<HTMLInputElement>(
      'input[type="file"][accept*="image"]',
    ) ?? root.querySelector<HTMLInputElement>('input[type="file"]');
  if (!fileInput) return 'not-found';
  if (!file) return 'no-match';
  try {
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    return 'filled';
  } catch {
    return 'no-match';
  }
}

/**
 * Fill every session field except the document dropdown (handled separately by
 * the caller, since it may branch into document creation). Returns a partial
 * report; the caller fills in `document` and `image` status.
 */
export function fillSessionFields(
  payload: JoltSessionPayload,
  root: ParentNode,
  imageFile: File | null,
): Omit<AutofillReport, 'document'> {
  const titleEl =
    findByOverlayPlaceholder(['name this session'], root) ??
    (findByLabel(['title'], root) as HTMLTextAreaElement | null);
  const descEl =
    findByOverlayPlaceholder(['how did it go'], root) ??
    (findByLabel(['description'], root) as HTMLTextAreaElement | null);
  const quoteEl =
    root.querySelector<HTMLTextAreaElement>(
      'textarea[placeholder*="favorite line" i]',
    ) ?? (findByLabel(['quote'], root) as HTMLTextAreaElement | null);
  const wordsEl = findByLabel(['words', 'word count'], root);

  const duration = fillDuration(payload, root);

  return {
    title: fillControl(titleEl, payload.title),
    description: fillControl(descEl, payload.description),
    quote: fillControl(quoteEl, payload.quote),
    date: fillDate(payload, root),
    hours: duration.hours,
    minutes: duration.minutes,
    wordCount: fillControl(wordsEl, String(payload.wordCount)),
    image: injectImage(imageFile, root),
  };
}
