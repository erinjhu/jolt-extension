/**
 * Jolt DOM injector. Runs in the page context on writewithjolt.com, listens
 * for an AUTOFILL_JOLT message, and fills the "Add Manual Session" modal.
 *
 * Jolt's form is React-controlled, so simply assigning `input.value` is not
 * enough — React tracks the previous value on the DOM node's internal value
 * tracker. We set the value through the native setter and then dispatch the
 * `input`/`change` events React listens for, which forces its state to sync.
 *
 * Every selector is defensive: we try a list of candidates and bail quietly
 * (logging, never throwing into the page) when a field cannot be found, so a
 * markup change on Jolt's side degrades gracefully instead of breaking.
 */

import { ExtensionMessage, JoltSessionPayload, MessageResponse } from './types';

/** Find the first element matching any of the supplied selectors. */
function queryFirst<T extends Element = HTMLElement>(
  selectors: string[],
  root: ParentNode = document,
): T | null {
  for (const selector of selectors) {
    const el = root.querySelector<T>(selector);
    if (el) return el;
  }
  return null;
}

/**
 * Find a field by walking labels/placeholders/names. Jolt's inputs are not
 * guaranteed to carry stable ids, so we match on several human-facing hints.
 */
function findInputByHints(
  hints: string[],
  root: ParentNode = document,
): HTMLInputElement | HTMLTextAreaElement | null {
  const lowered = hints.map((h) => h.toLowerCase());

  // 1. Placeholder / aria-label / name attributes.
  const candidates = Array.from(
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input, textarea',
    ),
  );
  for (const el of candidates) {
    const haystack = [
      el.getAttribute('placeholder'),
      el.getAttribute('aria-label'),
      el.getAttribute('name'),
      el.id,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (lowered.some((h) => haystack.includes(h))) return el;
  }

  // 2. <label> text wired to a control via `for`, or wrapping the control.
  const labels = Array.from(root.querySelectorAll<HTMLLabelElement>('label'));
  for (const label of labels) {
    const text = (label.textContent ?? '').trim().toLowerCase();
    if (!lowered.some((h) => text.includes(h))) continue;

    const forId = label.getAttribute('for');
    if (forId) {
      const target = document.getElementById(forId);
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return target;
      }
    }
    const nested = label.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      'input, textarea',
    );
    if (nested) return nested;
  }

  return null;
}

/**
 * Assign a value to a React-controlled input/textarea via the native setter
 * so React's internal value tracker is bypassed, then fire input + change.
 */
function setReactValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Select an option in a React/native <select> and notify React. */
function setSelectValue(el: HTMLSelectElement, label: string): boolean {
  const wanted = label.trim().toLowerCase();
  const option = Array.from(el.options).find((opt) => {
    const text = (opt.textContent ?? '').trim().toLowerCase();
    return text === wanted || opt.value.toLowerCase() === wanted;
  });

  if (!option) return false;

  const setter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    'value',
  )?.set;
  if (setter) {
    setter.call(el, option.value);
  } else {
    el.value = option.value;
  }

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

/** Decode a base64 data URL into a `File` suitable for a file <input>. */
function dataUrlToFile(dataUrl: string, filename: string): File | null {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;

  const mime = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const data = match[3] ?? '';

  try {
    let bytes: Uint8Array;
    if (isBase64) {
      const binary = atob(data);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(data));
    }
    // Copy into a dedicated ArrayBuffer so the BlobPart type is satisfied
    // under strict lib typings (avoids SharedArrayBuffer-backed views).
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return new File([buffer], filename, { type: mime });
  } catch {
    return null;
  }
}

/**
 * Inject a decoded image into Jolt's file input using the DataTransfer API,
 * which is the only way to programmatically populate `input.files`.
 */
function injectImage(payload: JoltSessionPayload): boolean {
  const fileInput = queryFirst<HTMLInputElement>([
    'input[type="file"][accept*="image"]',
    'input[type="file"]',
  ]);
  if (!fileInput) return false;

  const ext = /png/i.test(payload.imageBase64) ? 'png' : 'jpg';
  const file = dataUrlToFile(payload.imageBase64, `jolt-note.${ext}`);
  if (!file) return false;

  try {
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  } catch {
    return false;
  }
}

/** Autofill every field we can locate; returns a per-field success report. */
function autofill(payload: JoltSessionPayload): Record<string, boolean> {
  const report: Record<string, boolean> = {};

  const titleEl = findInputByHints(['title', 'session name', 'name']);
  if (titleEl) {
    setReactValue(titleEl, payload.title);
    report.title = true;
  } else {
    report.title = false;
  }

  const descEl =
    queryFirst<HTMLTextAreaElement>(['textarea']) ??
    findInputByHints(['description', 'notes', 'details']);
  if (descEl) {
    setReactValue(descEl, payload.description);
    report.description = true;
  } else {
    report.description = false;
  }

  const hoursEl = findInputByHints(['hour', 'hrs', 'hh']);
  if (hoursEl) {
    setReactValue(hoursEl, String(payload.durationHours));
    report.hours = true;
  } else {
    report.hours = false;
  }

  const minutesEl = findInputByHints(['minute', 'mins', 'mm']);
  if (minutesEl) {
    setReactValue(minutesEl, String(payload.durationMinutes));
    report.minutes = true;
  } else {
    report.minutes = false;
  }

  const docSelect = queryFirst<HTMLSelectElement>([
    'select[name*="document" i]',
    'select[aria-label*="document" i]',
    'select',
  ]);
  if (docSelect) {
    report.document = setSelectValue(docSelect, payload.targetDocumentName);
  } else {
    report.document = false;
  }

  const wordCountEl = findInputByHints(['word count', 'words', 'wordcount']);
  if (wordCountEl) {
    setReactValue(wordCountEl, String(payload.wordCount));
    report.wordCount = true;
  } else {
    report.wordCount = false;
  }

  const quoteEl = findInputByHints(['quote']);
  if (quoteEl) {
    setReactValue(quoteEl, payload.quote);
    report.quote = true;
  } else {
    report.quote = false;
  }

  const dateEl = findInputByHints(['date']);
  if (dateEl) {
    setReactValue(dateEl, payload.date);
    report.date = true;
  } else {
    report.date = false;
  }

  report.image = injectImage(payload);

  return report;
}

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (r: MessageResponse) => void) => {
    if (message.type !== 'AUTOFILL_JOLT') return;

    try {
      const report = autofill(message.payload);
      const filledAny = Object.values(report).some(Boolean);
      if (!filledAny) {
        sendResponse({
          ok: false,
          error:
            'Could not find any Jolt form fields. Open the "Add Manual Session" modal first.',
        });
        return;
      }
      sendResponse({ ok: true, data: report });
    } catch (err) {
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : 'Autofill failed.',
      });
    }
    // Synchronous response; no need to keep the channel open.
  },
);
