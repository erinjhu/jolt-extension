import { useMemo } from 'react';
import { navigateHash } from '../../hooks/useHashRoute';
import { renderDocMarkdown } from '../../utils/docMarkdown';
import { DOC_PAGES, resolveDocPage } from './docsRegistry';

interface DocsPageProps {
  /** Current hash route, e.g. "/docs" or "/docs/module-map". */
  route: string;
}

/** Hash target for a doc slug ('' = the overview page). */
const docHref = (slug: string) => `#/docs${slug ? `/${slug}` : ''}`;

/**
 * In-app documentation reader at /docs and /docs/:slug. Static (docs/*.md
 * bundled via ?raw), monochrome, and consistent with the legal pages: a
 * ← BACK TO APP button, a nav bar of all pages, the rendered Markdown, and
 * Prev/Next links. Returning to the app preserves the auth/guest session.
 */
export default function DocsPage({ route }: DocsPageProps) {
  const page = resolveDocPage(route);
  const index = DOC_PAGES.findIndex((p) => p.slug === page.slug);
  const prev = index > 0 ? DOC_PAGES[index - 1] : null;
  const next = index < DOC_PAGES.length - 1 ? DOC_PAGES[index + 1] : null;
  const bodyHtml = useMemo(() => renderDocMarkdown(page.markdown), [page.markdown]);

  return (
    <main className="min-h-dvh w-full bg-[#FFFFFF] px-6 py-10 text-[#111111]">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-8">
        <button
          type="button"
          onClick={() => navigateHash('/')}
          className="self-start rounded-none border border-[#111111] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#111111] transition hover:bg-gray-100"
        >
          ← Back to App
        </button>

        {/* Doc nav bar: all pages, active one inverted. */}
        <nav className="flex flex-wrap gap-2">
          {DOC_PAGES.map((p) => {
            const active = p.slug === page.slug;
            return (
              <a
                key={p.slug || 'overview'}
                href={docHref(p.slug)}
                aria-current={active ? 'page' : undefined}
                className={`rounded-none border border-[#111111] px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                  active
                    ? 'bg-[#111111] text-[#FFFFFF]'
                    : 'bg-[#FFFFFF] text-[#111111] hover:bg-gray-100'
                }`}
              >
                {p.title}
              </a>
            );
          })}
        </nav>

        <article
          className="jolt-doc flex flex-col gap-4 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />

        {/* Prev / Next. */}
        <nav className="flex items-center justify-between gap-3 border-t border-[#111111] pt-6">
          {prev ? (
            <a
              href={docHref(prev.slug)}
              className="rounded-none border border-[#111111] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#111111] transition hover:bg-gray-100"
            >
              ← {prev.title}
            </a>
          ) : (
            <span />
          )}
          {next ? (
            <a
              href={docHref(next.slug)}
              className="rounded-none border border-[#111111] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#111111] transition hover:bg-gray-100"
            >
              {next.title} →
            </a>
          ) : (
            <span />
          )}
        </nav>
      </div>
    </main>
  );
}
