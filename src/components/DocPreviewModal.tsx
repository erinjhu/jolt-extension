import { useEffect } from 'react';

/**
 * Guest-demo stand-in for opening the doc in Google Docs: a monochrome modal
 * that previews the current (mock) document text in a read-only pane. Tapping
 * the backdrop, the ✕, or pressing Escape closes it.
 */
interface DocPreviewModalProps {
  title: string;
  text: string;
  onClose: () => void;
}

export default function DocPreviewModal({ title, text, onClose }: DocPreviewModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Preview extracted document"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[80vh] w-full max-w-md flex-col rounded-none border border-[#111111] bg-[#FFFFFF] text-[#111111]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[#111111] px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
              Preview Extracted Doc (Demo)
            </span>
            <span className="truncate text-sm font-semibold">{title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-none px-1 text-sm font-bold text-gray-500 transition hover:text-black"
          >
            ✕
          </button>
        </header>

        <pre className="flex-1 overflow-auto whitespace-pre-wrap px-4 py-4 font-mono text-sm leading-relaxed">
          {text.trim() ? text : 'This document is empty.'}
        </pre>
      </div>
    </div>
  );
}
