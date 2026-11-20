/**
 * Read-only panel showing an existing document's current contents above the
 * append editor, so the user has context without risking edits to it. The
 * real Google Doc keeps its formatting; this plain-text view is just for
 * reading (append-only mode never overwrites the original body).
 */
interface ExistingDocContextProps {
  text: string;
}

export default function ExistingDocContext({ text }: ExistingDocContextProps) {
  return (
    <div className="flex flex-col gap-1 px-4 pt-4">
      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
        Existing Document (Read-Only — Formatting Preserved)
      </span>
      <div className="max-h-40 overflow-auto rounded-none border border-[#111111] bg-[#FAFAFA] p-4">
        {text.trim() ? (
          <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-[#111111]">
            {text}
          </pre>
        ) : (
          <p className="font-mono text-sm text-gray-500">This document is currently empty.</p>
        )}
      </div>
    </div>
  );
}
