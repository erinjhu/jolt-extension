import { useEffect } from 'react';

/**
 * In-app Demo Document Viewer for Guest Demo Mode. Stands in for opening the
 * doc in Google Docs (which has no real Drive file in the demo): a centered,
 * monochrome reader that shows the current in-memory mock document's contents
 * so the user can read through it and copy a quote.
 *
 * The demo editor stores plain text, so the body is rendered with preserved
 * whitespace/line breaks. Tapping the backdrop, CLOSE PREVIEW, or Escape closes.
 */
interface DemoDocPreviewProps {
  /** The active mock document's title. */
  title: string;
  /** The document's current full text (may be empty). */
  text: string;
  onClose: () => void;
}

export default function DemoDocPreview({ title, text, onClose }: DemoDocPreviewProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isEmpty = !text.trim();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Demo document preview"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-none border border-[#111111] bg-[#FFFFFF] text-[#111111]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar: close/back, demo badge, and the document title. */}
        <header className="flex items-center justify-between gap-3 border-b border-[#111111] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-none border border-[#111111] bg-[#FFFFFF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#111111] transition hover:bg-gray-100"
          >
            ← Close Preview
          </button>
          <div className="flex min-w-0 flex-col items-end text-right">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
              Demo Document Preview
            </span>
            <span className="min-w-0 truncate text-sm font-semibold">{title}</span>
          </div>
        </header>

        {/* Document body: full current contents, whitespace preserved. */}
        <div className="flex-1 overflow-auto px-6 py-6">
          {isEmpty ? (
            <p className="font-mono text-sm text-gray-500">
              This demo document is currently empty.
            </p>
          ) : (
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-[#111111]">
              {text}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
