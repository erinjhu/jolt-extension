import { useMemo } from 'react';
import { navigateHash } from '../../hooks/useHashRoute';
import { renderMarkdown } from '../../utils/markdown';
import JoltLogoIcon from '../jolt/JoltLogoIcon';

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
    <div className="min-h-dvh w-full bg-[#FFFFFF] text-[#111111]">
      <header className="sticky top-0 z-30 border-b border-[#111111] bg-[#FFFFFF] text-[#111111]">
        <div className="mx-auto flex h-14 max-w-[680px] items-center justify-between px-4">
          <button
            type="button"
            onClick={() => navigateHash('/')}
            aria-label="Go to home"
            className="flex cursor-pointer items-center gap-2 rounded-none bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2"
          >
            <JoltLogoIcon size={24} title="Jolt Extension" />
            <span className="text-lg font-bold tracking-tight">Jolt Extension</span>
          </button>
          <button
            type="button"
            onClick={() => navigateHash('/')}
            className="rounded-none border border-[#111111] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#111111] transition hover:bg-gray-100"
          >
            ← Back to App
          </button>
        </div>
      </header>
      <main className="px-6 py-10">
        <div className="mx-auto flex w-full max-w-[680px] flex-col gap-8">
          <article
            className="jolt-legal flex flex-col gap-4 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </div>
      </main>
    </div>
  );
}
