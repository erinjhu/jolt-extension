import type { CreatedDoc } from '../services/googleDocsService';

interface SyncConfirmationProps {
  /** The Google Doc created by the successful sync, if available. */
  doc: CreatedDoc | null;
  /** Resets the flow to a fresh, empty capture form. */
  onStartNewSession: () => void;
}

/**
 * Post-sync confirmation card. Replaces the capture / editor view once a
 * session has synced to Drive: a monochrome success notice, the created
 * document name with a link to open it, and a prominent "Add New Session"
 * button to start over. Matches Jolt's sharp-cornered #FFFFFF / #111111 look.
 */
export default function SyncConfirmation({ doc, onStartNewSession }: SyncConfirmationProps) {
  return (
    <section className="flex flex-col gap-6 rounded-none border border-gray-300 bg-white p-6 text-black">
      <div className="flex flex-col items-center gap-3 border-b border-black pb-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-none border border-[#111111] bg-[#111111] text-xl font-bold text-white">
          ✓
        </span>
        <h2 className="text-sm font-bold uppercase tracking-wide">Synced to Google Drive</h2>

        {doc && (
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-xs text-gray-500">Saved as</span>
            <span className="max-w-full truncate text-sm font-semibold text-black">
              {doc.name}
            </span>
            <a
              href={doc.webViewLink}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-black underline underline-offset-4 transition hover:text-gray-600"
            >
              Open Google Doc ↗
            </a>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onStartNewSession}
        className="w-full rounded-none bg-black px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-gray-800"
      >
        Start New Session
      </button>
    </section>
  );
}
