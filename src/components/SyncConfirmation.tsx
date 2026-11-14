import type { CreatedDoc } from '../services/googleDocsService';

interface SyncConfirmationProps {
  /** The Google Doc created by the successful sync, if available. */
  doc: CreatedDoc | null;
  /** Resets the flow to a fresh, empty capture form. */
  onAddNewSession: () => void;
}

/**
 * Post-sync confirmation card. Replaces the capture form once a session has
 * synced to Drive: shows the success notice, a link to the created Google
 * Doc, and a prominent "Add New Session" button to start over.
 */
export default function SyncConfirmation({ doc, onAddNewSession }: SyncConfirmationProps) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-center">
      <div className="flex flex-col gap-2">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-xl text-emerald-300">
          ✓
        </span>
        <h2 className="text-lg font-semibold text-emerald-200">Synced to Google Drive</h2>
        {doc && (
          <a
            href={doc.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-emerald-300 underline underline-offset-2 hover:text-emerald-100"
          >
            Open Google Doc ↗
          </a>
        )}
      </div>

      <button
        type="button"
        onClick={onAddNewSession}
        className="rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
      >
        Add New Session
      </button>
    </section>
  );
}
