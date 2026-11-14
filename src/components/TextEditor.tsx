import { useEffect, useState } from 'react';
import { countWords } from '../utils/text';
import type { TargetDoc } from '../services/joltDocumentsService';

/**
 * Distraction-free mobile editor for the selected Google Doc. On open (or when
 * the target doc changes) it exports the document's current plain text, seeds a
 * full-height textarea, and tracks the starting word count.
 *
 * A compact header shows the active document name plus a "Change Doc" button so
 * the user can jump back to document selection.
 */
interface TextEditorProps {
  doc: TargetDoc;
  /** OAuth token used to export the document text. */
  loadText: (fileId: string) => Promise<string>;
  /** Return to the document selection screen. */
  onChangeDoc: () => void;
}

export default function TextEditor({ doc, loadText, onChangeDoc }: TextEditorProps) {
  const [text, setText] = useState('');
  const [initialWordCount, setInitialWordCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    loadText(doc.id)
      .then((loaded) => {
        if (cancelled) return;
        setText(loaded);
        setInitialWordCount(countWords(loaded));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load the document.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [doc.id, loadText]);

  return (
    <section className="flex min-h-[70vh] flex-col rounded-none border border-gray-300 bg-white text-black">
      {/* Compact header: document name + Change Doc. */}
      <header className="flex items-center justify-between gap-3 border-b border-gray-300 px-3 py-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Editing
          </span>
          <span className="truncate text-sm font-semibold text-black">{doc.name}</span>
        </div>
        <button
          type="button"
          onClick={onChangeDoc}
          className="whitespace-nowrap rounded-none border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-black transition hover:bg-gray-100"
        >
          Change Doc
        </button>
      </header>

      {error && (
        <p className="border-b border-gray-300 px-3 py-2 text-xs text-red-600" aria-live="polite">
          {error}
        </p>
      )}

      {/* Full-height distraction-free editing surface. */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={isLoading}
        placeholder={isLoading ? 'Loading document…' : 'Start writing…'}
        spellCheck
        className="min-h-[60vh] w-full flex-1 resize-none rounded-none border-0 bg-white px-4 py-4 font-mono text-sm leading-relaxed text-black outline-none disabled:opacity-60"
      />

      <footer className="flex items-center justify-between gap-3 border-t border-gray-300 px-3 py-2 font-mono text-[11px] text-gray-500">
        <span>Words: {countWords(text)}</span>
        <span>Started at: {initialWordCount}</span>
      </footer>
    </section>
  );
}
