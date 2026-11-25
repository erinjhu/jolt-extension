/**
 * Markdown-to-HTML renderer for the in-app Docs viewer. Extends the legal-page
 * subset with fenced code blocks, tables, ordered lists, and links (internal
 * `foo.md` links are rewritten to `#/docs/foo` hash routes). All text is
 * HTML-escaped before formatting, so the source cannot inject markup; the
 * result is safe for `dangerouslySetInnerHTML`.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Rewrite a markdown link target to an app route / safe href. */
function resolveHref(target: string): string {
  const t = target.trim();
  if (/^https?:\/\//i.test(t)) return t; // external
  // Internal doc link: README.md -> /docs, foo.md[#x] -> /docs/foo
  const m = /^([\w-]+)\.md(#.*)?$/i.exec(t);
  if (m) {
    const slug = m[1].toLowerCase() === 'readme' ? '' : m[1];
    return `#/docs/${slug}`;
  }
  if (t.startsWith('../')) return '#/'; // e.g. ../README.md -> app root
  return t;
}

/** Inline: `code`, **bold**, [text](href). Operates on escaped text. */
function renderInline(escaped: string): string {
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_full, label: string, href: string) => {
      const safe = escapeHtml(resolveHref(href));
      return `<a href="${safe}">${label}</a>`;
    });
}

/** Render a `| a | b |` table block (first row = header, second = separator). */
function renderTable(rows: string[]): string {
  const cells = (row: string) =>
    row
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim());
  const head = cells(rows[0]);
  const body = rows.slice(2).map(cells);
  const th = head.map((c) => `<th>${renderInline(escapeHtml(c))}</th>`).join('');
  const trs = body
    .map((r) => `<tr>${r.map((c) => `<td>${renderInline(escapeHtml(c))}</td>`).join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

/** Convert the supported Markdown subset to an HTML string. */
export function renderDocMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let para: string[] = [];
  // One level of nesting: each item holds its indented sub-bullets.
  let list: { text: string; children: string[] }[] = [];
  let listTag: 'ul' | 'ol' = 'ul';

  const flushPara = () => {
    if (!para.length) return;
    const t = renderInline(escapeHtml(para.join(' ').trim()));
    if (t) html.push(`<p>${t}</p>`);
    para = [];
  };
  const flushList = () => {
    if (!list.length) return;
    const inline = (text: string) => renderInline(escapeHtml(text));
    const items = list.map(({ text, children }) => {
      const sub = children.map((child) => `<li>${inline(child)}</li>`).join('');
      return `<li>${inline(text)}${sub ? `<ul>${sub}</ul>` : ''}</li>`;
    });
    html.push(`<${listTag}>${items.join('')}</${listTag}>`);
    list = [];
  };
  const flushAll = () => {
    flushPara();
    flushList();
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();
    const trimmed = line.trim();

    // Fenced code block ``` … ``` (verbatim, preserves ASCII diagrams).
    if (trimmed.startsWith('```')) {
      flushAll();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) buf.push(lines[i++]);
      html.push(`<pre><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // Table block: consecutive lines starting with "|".
    if (trimmed.startsWith('|')) {
      flushAll();
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) buf.push(lines[i++]);
      i--;
      if (buf.length >= 2) html.push(renderTable(buf));
      continue;
    }

    if (trimmed === '') {
      flushAll();
      continue;
    }
    if (/^---+$/.test(trimmed)) {
      flushAll();
      html.push('<hr />');
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushAll();
      const lvl = heading[1].length;
      html.push(`<h${lvl}>${renderInline(escapeHtml(heading[2].trim()))}</h${lvl}>`);
      continue;
    }

    const ordered = /^\d+\.\s+(.*)$/.exec(trimmed);
    if (ordered) {
      flushPara();
      if (listTag !== 'ol') flushList();
      listTag = 'ol';
      list.push({ text: ordered[1].trim(), children: [] });
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      flushPara();
      // An indented bullet belongs to the item above it.
      if (list.length && /^\s{2,}/.test(raw)) {
        list[list.length - 1].children.push(bullet[1].trim());
        continue;
      }
      if (listTag !== 'ul') flushList();
      listTag = 'ul';
      list.push({ text: bullet[1].trim(), children: [] });
      continue;
    }

    // An indented line under a list item is the rest of that item's sentence.
    if (list.length && /^\s/.test(raw)) {
      const item = list[list.length - 1];
      if (item.children.length) item.children[item.children.length - 1] += ` ${trimmed}`;
      else item.text += ` ${trimmed}`;
      continue;
    }

    flushList();
    para.push(trimmed);
  }

  flushAll();
  return html.join('\n');
}
