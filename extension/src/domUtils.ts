/**
 * Low-level DOM helpers shared by the Jolt content-script modules. These are
 * intentionally framework-agnostic: value assignment goes through the native
 * element setter so React's internal value tracker is bypassed, and synthetic
 * events are dispatched so React state and form validation update.
 */

/** Per-field / per-step outcome reported back to the popup. */
export type FieldStatus = 'filled' | 'not-found' | 'no-match';

/** A fillable native text control. */
export type TextControl = HTMLInputElement | HTMLTextAreaElement;

/** Normalize text for comparison (trim + lowercase + collapse whitespace). */
export function norm(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** Resolve after the next animation frame (lets popovers / menus render). */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** Resolve after a fixed delay (for transitions that outlast one frame). */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Dispatch the events React / form validation listen for (all bubbling). */
export function fireReactEvents(el: HTMLElement): void {
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
}

/** Assign a value via the native setter so React's value tracker updates. */
export function setNativeValue(
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

/** Focus, set, and notify a text control; returns a field status. */
export function fillControl(el: TextControl | null, value: string): FieldStatus {
  if (!el) return 'not-found';
  el.focus();
  el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
  setNativeValue(el, value);
  fireReactEvents(el);
  return 'filled';
}

/** True when an element is rendered (has layout). */
export function isVisible(el: HTMLElement): boolean {
  return el.offsetParent !== null || el.getClientRects().length > 0;
}

/**
 * Find the first visible clickable element (option / button / li / a) whose
 * text equals or contains the target. Searches the whole document because
 * popovers are often portalled outside the triggering container.
 */
export function findClickableByText(target: string): HTMLElement | null {
  const normalized = norm(target);
  if (!normalized) return null;
  const selectors = '[role="option"], li, button, a, [data-value]';
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(selectors),
  );
  return (
    candidates.find((el) => {
      const text = norm(el.textContent);
      return (text === normalized || text.includes(normalized)) && isVisible(el);
    }) ?? null
  );
}

/** Find the first visible button whose text equals or contains the phrase. */
export function findButtonByText(
  phrase: string,
  root: ParentNode = document,
): HTMLButtonElement | null {
  const want = norm(phrase);
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'));
  return (
    buttons.find((b) => {
      const text = norm(b.textContent);
      return (text === want || text.includes(want)) && isVisible(b);
    }) ?? null
  );
}

/** Decode a base64 (or URL-encoded) data URL into a `File`. */
export function dataUrlToFile(dataUrl: string, filename: string): File | null {
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
