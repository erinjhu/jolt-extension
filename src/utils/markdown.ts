/**
 * Tiny Markdown-to-HTML renderer for the static legal pages. It supports only
 * the subset used in `src/content/*.md`: `#`/`##`/`###` headings, blank-line
 * separated paragraphs, `-` bullet lists, `**bold**`, and inline `code`.
 *
 * All text is HTML-escaped before any inline formatting is applied, so the
 * Markdown source cannot inject markup. The result is safe to pass to
 * `dangerouslySetInnerHTML`.
 */

/** Escape the five HTML-significant characters. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Apply inline `**bold**` and `` `code` `` to already-escaped text. */
function renderInline(escaped: string): string {
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

/** Convert the supported Markdown subset to an HTML string. */
export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = renderInline(escapeHtml(paragraph.join(' ').trim()));
    if (text) html.push(`<p>${text}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    html.push(`<ul>${listItems.join('')}</ul>`);
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Skip HTML comment lines used as authoring notes in the source files.
    if (line.trim().startsWith('<!--') || line.trim().startsWith('-->')) continue;

    if (line.trim() === '') {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(escapeHtml(heading[2].trim()))}</h${level}>`);
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line.trim());
    if (bullet) {
      flushParagraph();
      listItems.push(`<li>${renderInline(escapeHtml(bullet[1].trim()))}</li>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  return html.join('\n');
}
