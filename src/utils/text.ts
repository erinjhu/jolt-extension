/** Pure text helpers shared across the session editor. */

/** Count whitespace-delimited words in a block of text. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}
