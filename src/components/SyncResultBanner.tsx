import type { CreatedDoc } from '../services/googleDocsService';

/**
 * Confirmation / error banner shown after a "Sync to Jolt" attempt. On
 * success it surfaces a clickable link to open the new Google Doc.
 */
interface SyncResultBannerProps {
  /** The created document on success, or null when there's an error. */
  doc: CreatedDoc | null;
  /** Error message to display, or null on success. */
  error: string | null;
}

export default function SyncResultBanner({ doc, error }: SyncResultBannerProps) {
  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
      >
        {error}
      </div>
    );
  }

  if (!doc) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
    >
      <span>Synced to Drive as “{doc.name}”.</span>
      <a
        href={doc.webViewLink}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-emerald-300 underline underline-offset-2 hover:text-emerald-100"
      >
        Open Google Doc ↗
      </a>
    </div>
  );
}
