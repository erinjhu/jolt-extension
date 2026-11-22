/**
 * Read-only panel showing an existing document's current contents above the
 * append editor, so the user has context without risking edits to it. The
 * real Google Doc keeps its formatting; this plain-text view is just for
 * reading (append-only mode never overwrites the original body).
 */
import { useEffect, useState } from 'react';

interface ExistingDocContextProps {
  text: string;
}

export default function ExistingDocContext({ text }: ExistingDocContextProps) {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    if (!isHelpOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsHelpOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isHelpOpen]);
  return (
    <div className="flex flex-col gap-1 px-4 pt-4">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
          Existing Document
        </span>
        <button
          type="button"
          aria-label="Why is this append-only?"
          aria-haspopup="dialog"
          aria-expanded={isHelpOpen}
          aria-controls="append-only-help"
          onClick={() => setIsHelpOpen((open) => !open)}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-[#111111] text-[11px] font-medium text-[#111111] hover:bg-[#111111] hover:text-[#FFFFFF]"
        >
          ?
        </button>
      </div>
      <div className="max-h-40 overflow-auto rounded-none border border-[#111111] bg-[#FAFAFA] p-4">
        {text.trim() ? (
          <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-[#111111]">
            {text}
          </pre>
        ) : (
          <p className="font-mono text-sm text-gray-500">This document is currently empty.</p>
        )}
      </div>

      {isHelpOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Why is this append-only?"
          id="append-only-help"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setIsHelpOpen(false)}
        >
          <div
            className="max-w-sm rounded-none border border-[#111111] bg-[#FFFFFF] p-5 text-[#111111] shadow-none"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-sm font-bold">Why can I only add to the end?</h2>
              <button
                type="button"
                aria-label="Close explanation"
                onClick={() => setIsHelpOpen(false)}
                className="rounded-none px-1 text-sm font-bold text-[#111111]"
              >
                ×
              </button>
            </div>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-gray-700">
              <p>
                The Google Docs mobile app blocks custom timers and writing extensions from running inside it.
              </p>
              <p>
                This companion web app is a lightweight workaround so you can still track sessions and sync to your Doc.
              </p>
              <p>
                Right now, you can only append new text at the bottom. Full rich-text editing (like bold, italics, and underline) isn't included in this lightweight demo so your existing document's formatting stays untouched.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsHelpOpen(false)}
              className="mt-5 rounded-none border border-[#111111] bg-[#FFFFFF] px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#111111] hover:bg-[#111111] hover:text-[#FFFFFF]"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
