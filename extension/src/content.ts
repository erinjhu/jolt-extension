/**
 * Jolt DOM injector. Runs in the page context on writewithjolt.com, listens
 * for an AUTOFILL_JOLT message, and fills the "Add Manual Session" modal.
 *
 * The real Jolt form (captured from the live DOM) does not expose `id`,
 * `name`, or `aria-label` on its fields — inputs are associated with their
 * `<label>` only by DOM structure (label + control are siblings inside the
 * same flex wrapper). Several controls are also custom widgets rather than
 * native form elements:
 *   - Document is a custom <button> dropdown, not a <select>.
 *   - Duration is two bare numeric <input>s distinguished by adjacent
 *     "hr" / "min" <span>s.
 *   - Title / Description are <textarea>s behind a placeholder overlay; their
 *     real `placeholder` attribute is empty, so we match on the overlay text.
 *
 * Jolt's form is React-controlled, so we assign values through the element
 * prototype's native setter (bypassing React's value tracker) and dispatch
 * `input`, `change`, and `blur` (all bubbling) so component state and the
 * Submit button's validation update.
 */

import { ExtensionMessage, JoltSessionPayload, MessageResponse } from './types';

/** Per-field outcome so the popup can distinguish misses from matches. */
type FieldStatus = 'filled' | 'not-found' | 'no-match';

type FillableField =
  | 'title'
  | 'description'
  | 'quote'
  | 'date'
  | 'hours'
  | 'minutes'
  | 'wordCount'
  | 'document'
  | 'image';

export type AutofillReport = Record<FillableField, FieldStatus>;

type TextControl = HTMLInputElement | HTMLTextAreaElement;

/* -------------------------------------------------------------------------- */
/* DOM helpers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Locate the open "Add Manual Session" modal. The captured markup is a
 * `<form>` whose first heading reads "Add Manual Session"; fall back to a
 * dialog container, then the whole document.
 */
function findModalRoot(): ParentNode {
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

/** Normalize text for comparison (trim + lowercase + collapse whitespace). */
function norm(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Find the field group (the `flex flex-col` wrapper) whose `<label>` text
 * matches one of the hints, then return the first input/textarea inside it.
 * This mirrors Jolt's structure where label + control are siblings.
 */
function findByLabel(hints: string[], root: ParentNode): TextControl | null {
  const wanted = hints.map(norm);
  const labels = Array.from(root.querySelectorAll<HTMLLabelElement>('label'));

  for (const label of labels) {
    const text = norm(label.textContent);
    if (!wanted.some((h) => text === h || text.startsWith(h))) continue;

    // Walk up to the group wrapper and search within it for a control.
    const group = label.closest('div') ?? label.parentElement;
    const control =
      group?.querySelector<TextControl>('input, textarea') ?? null;
    if (control) return control;
  }
  return null;
}

/** Find a control by the placeholder-overlay span text (Title/Description). */
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
    const container = overlay.parentElement;
    const textarea = container?.querySelector<HTMLTextAreaElement>('textarea');
    if (textarea) return textarea;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* React-aware value setting                                                  */
/* -------------------------------------------------------------------------- */

/** Dispatch the events React / form validation listen for (all bubbling). */
function fireReactEvents(el: HTMLElement): void {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
}

/** Assign a value via the native setter so React's value tracker updates. */
function setNativeValue(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (setter) setter.call(el, value);
  else (el as { value: string }).value = value;
}

/** Focus, set, and notify a text control. */
function fillControl(el: TextControl | null, value: string): FieldStatus {
  if (!el) return 'not-found';
  el.focus();
  el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
  setNativeValue(el, value);
  fireReactEvents(el);
  return 'filled';
}

/* -------------------------------------------------------------------------- */
/* Field-specific fillers                                                     */
/* -------------------------------------------------------------------------- */

/** Date: a native `<input type="date">` expecting a `YYYY-MM-DD` value. */
function fillDate(payload: JoltSessionPayload, root: ParentNode): FieldStatus {
  const el =
    root.querySelector<HTMLInputElement>('input[type="date"]') ??
    (findByLabel(['date'], root) as HTMLInputElement | null);
  if (!el) return 'not-found';
  // Derive YYYY-MM-DD from the payload date or createdAt.
  const raw = payload.date || payload.createdAt || payload.startTime;
  const ymd = /^\d{4}-\d{2}-\d{2}/.exec(raw)?.[0] ?? '';
  if (!ymd) return 'no-match';
  return fillControl(el, ymd);
}

/**
 * Duration: two bare numeric inputs distinguished by the trailing "hr" / "min"
 * <span>. We read each input's following sibling span to decide which is which.
 */
function fillDuration(
  payload: JoltSessionPayload,
  root: ParentNode,
): { hours: FieldStatus; minutes: FieldStatus } {
  const group = findDurationGroup(root);
  if (!group) return { hours: 'not-found', minutes: 'not-found' };

  const inputs = Array.from(
    group.querySelectorAll<HTMLInputElement>('input'),
  );

  let hoursEl: HTMLInputElement | null = null;
  let minutesEl: HTMLInputElement | null = null;

  for (const input of inputs) {
    const unit = norm(input.parentElement?.textContent);
    if (unit.includes('hr') || unit.includes('hour')) hoursEl = input;
    else if (unit.includes('min')) minutesEl = input;
  }
  // Fall back to positional order (first = hours, second = minutes).
  if (!hoursEl && inputs[0]) hoursEl = inputs[0];
  if (!minutesEl && inputs[1]) minutesEl = inputs[1];

  return {
    hours: fillControl(hoursEl, pad2(payload.durationHours)),
    minutes: fillControl(minutesEl, pad2(payload.durationMinutes)),
  };
}

/** Locate the Duration group wrapper via its label. */
function findDurationGroup(root: ParentNode): HTMLElement | null {
  const labels = Array.from(root.querySelectorAll<HTMLLabelElement>('label'));
  const label = labels.find((l) => norm(l.textContent) === 'duration');
  const group = label?.closest('div');
  // The group holds both numeric inputs; ensure we grabbed a wrapper with 2.
  if (group && group.querySelectorAll('input').length >= 2) return group;
  return group ?? null;
}

/** Two-digit zero-padded string, as the form displays "00". */
function pad2(n: number): string {
  return String(Math.max(0, Math.trunc(n))).padStart(2, '0');
}

/**
 * Document: a custom button dropdown. Click to open, then click the option
 * whose text matches the target document name. Options render in a popover
 * that may be appended elsewhere in the DOM, so we search the whole document
 * for the newly-visible option after opening.
 */
async function fillDocument(
  payload: JoltSessionPayload,
  root: ParentNode,
): Promise<FieldStatus> {
  const target = norm(payload.targetDocumentName);
  if (!target) return 'no-match';

  // The trigger button shows "Select a document".
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'));
  const trigger = buttons.find((b) =>
    norm(b.textContent).includes('select a document'),
  );
  if (!trigger) return 'not-found';

  trigger.click();
  await nextFrame();

  // Options are usually role=option or list items rendered after opening.
  const option = findClickableByText(target);
  if (!option) {
    // Close the dropdown again to avoid leaving the UI open.
    trigger.click();
    return 'no-match';
  }
  option.click();
  await nextFrame();
  return 'filled';
}

/** Find a visible clickable element (option/button/li/a) matching text. */
function findClickableByText(target: string): HTMLElement | null {
  const selectors = '[role="option"], li, button, a, [data-value]';
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(selectors),
  );
  return (
    candidates.find((el) => {
      const text = norm(el.textContent);
      return (
        (text === target || text.includes(target)) &&
        el.offsetParent !== null // visible
      );
    }) ?? null
  );
}

/** Resolve after the next animation frame (lets a popover render). */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/* -------------------------------------------------------------------------- */
/* Image / file injection                                                     */
/* -------------------------------------------------------------------------- */

/** Decode a base64 data URL into a `File` suitable for a file <input>. */
function dataUrlToFile(dataUrl: string, filename: string): File | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;

  const mime = match[1] || 'image/jpeg';
  const isBase64 = Boolean(match[2]);
  const data = match[3] ?? '';

  try {
    let bytes: Uint8Array;
    if (isBase64) {
      const binary = atob(data);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(data));
    }
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return new File([buffer], filename, { type: mime });
  } catch {
    return null;
  }
}

/**
 * Inject the decoded image into Jolt's hidden file input via DataTransfer,
 * then fire input/change so the dropzone preview and validation update.
 */
function injectImage(payload: JoltSessionPayload, root: ParentNode): FieldStatus {
  const fileInput =
    root.querySelector<HTMLInputElement>('input[type="file"][accept*="image"]') ??
    root.querySelector<HTMLInputElement>('input[type="file"]');
  if (!fileInput) return 'not-found';
  if (!payload.imageBase64) return 'no-match';

  const mimeMatch = /^data:([^;,]+)/.exec(payload.imageBase64)?.[1] ?? '';
  const ext = /png/i.test(mimeMatch)
    ? 'png'
    : /webp/i.test(mimeMatch)
      ? 'webp'
      : 'jpg';

  const file = dataUrlToFile(payload.imageBase64, `jolt-note.${ext}`);
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

/* -------------------------------------------------------------------------- */
/* Orchestration                                                              */
/* -------------------------------------------------------------------------- */

async function autofill(payload: JoltSessionPayload): Promise<AutofillReport> {
  const root = findModalRoot();

  // Title / Description are textareas behind a placeholder overlay; match on
  // the overlay prompt text, falling back to label-group lookup.
  const titleEl =
    findByOverlayPlaceholder(['name this session'], root) ??
    (findByLabel(['title'], root) as HTMLTextAreaElement | null);
  const descEl =
    findByOverlayPlaceholder(['how did it go'], root) ??
    (findByLabel(['description'], root) as HTMLTextAreaElement | null);

  // Quote is a real textarea with a distinctive placeholder.
  const quoteEl =
    root.querySelector<HTMLTextAreaElement>(
      'textarea[placeholder*="favorite line" i]',
    ) ?? (findByLabel(['quote'], root) as HTMLTextAreaElement | null);

  const wordsEl = findByLabel(['words', 'word count'], root);

  const duration = fillDuration(payload, root);

  const report: AutofillReport = {
    title: fillControl(titleEl, payload.title),
    description: fillControl(descEl, payload.description),
    quote: fillControl(quoteEl, payload.quote),
    date: fillDate(payload, root),
    hours: duration.hours,
    minutes: duration.minutes,
    wordCount: fillControl(wordsEl, String(payload.wordCount)),
    document: await fillDocument(payload, root),
    image: injectImage(payload, root),
  };

  return report;
}

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender,
    sendResponse: (r: MessageResponse<AutofillReport>) => void,
  ) => {
    if (message.type !== 'AUTOFILL_JOLT') return undefined;

    autofill(message.payload)
      .then((report) => {
        const filledAny = Object.values(report).some((s) => s === 'filled');
        if (!filledAny) {
          sendResponse({
            ok: false,
            error:
              'Could not find any Jolt form fields. Open the "Add Manual Session" modal first.',
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
