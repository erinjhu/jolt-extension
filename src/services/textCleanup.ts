/**
 * Normalizes raw OCR output into tidy, readable text.
 * Kept separate from the OCR service so the cleanup rules stay testable
 * and the engine wiring stays small.
 */
export function cleanOcrText(rawText: string): string {
  return rawText
    // Normalize Windows / old-Mac line endings to \n.
    .replace(/\r\n?/g, '\n')
    // Collapse runs of spaces and tabs into a single space.
    .replace(/[ \t]+/g, ' ')
    // Trim trailing whitespace on each line.
    .replace(/ +\n/g, '\n')
    // Collapse 3+ blank lines down to a single blank line.
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
