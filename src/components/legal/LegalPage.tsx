import { useMemo } from 'react';
import { navigateHash } from '../../hooks/useHashRoute';
import { renderMarkdown } from '../../utils/markdown';

interface LegalPageProps {
  /** Raw Markdown source for the page body. */
  markdown: string;
}

/**
 * Shared layout for the public legal pages (Terms, Privacy). Monochrome Jolt
 * styling: #FFFFFF background, #111111 text/borders, 0px radius, 680px max
 * width centered. A `← BACK TO APP` button at the top returns to the app root
 * (which, when unauthenticated, is the sign-in screen).
 *
 * The Markdown is rendered once per source change via a small in-repo renderer
 * and injected as pre-escaped HTML (see utils/markdown).
 */
export default function LegalPage({ markdown }: LegalPageProps) {
  const bodyHtml = useMemo(() => renderMarkdown(markdown), [markdown]);

  return (
    <main className="min-h-dvh w-full bg-[#FFFFFF] px-6 py-10 text-[#111111]">
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-8">
        <button
          type="button"
          onClick={() => navigateHash('/')}
          className="self-start rounded-none border border-[#111111] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#111111] transition hover:bg-gray-100"
        >
          ← Back to App
        </button>

        <article
          className="jolt-legal flex flex-col gap-4 text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </div>
    </main>
  );
}
