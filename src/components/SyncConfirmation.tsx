import { useState } from 'react';
import type { CreatedDoc } from '../services/googleDocsService';

interface SyncConfirmationProps {
  /** The Google Doc created by the successful sync, if available. */
  doc: CreatedDoc | null;
  /** Resets the flow to a fresh, empty capture form. */
  onStartNewSession: () => void;
  /** Guest demo: open the in-app preview instead of a docs.google.com link. */
  isGuest?: boolean;
  /** Guest demo: invoked by the \"open doc\" action to show the preview. */
  onPreviewDoc?: () => void;
}

/** True when the screenshot asset is present in the public folder. */
const SCREENSHOT_SRC = '/images/instructions/jolt-import-step.png';

/**
 * Post-sync confirmation card. Replaces the capture / editor view once a
 * session has synced to Drive: a monochrome success notice, the created
 * document name with a link to open it, the "Next: Import into Jolt" steps,
 * and a prominent OK button to return cleanly to a fresh session.
 * Matches Jolt's sharp-cornered #FFFFFF / #111111 look.
 */
export default function SyncConfirmation({
  doc,
  onStartNewSession,
  isGuest = false,
  onPreviewDoc,
}: SyncConfirmationProps) {
  // Hide the screenshot slot once the image fails to load (file not yet dropped
  // in), so the placeholder border shows instead — nothing ever breaks.
  const [screenshotLoaded, setScreenshotLoaded] = useState(false);
  const [screenshotError, setScreenshotError] = useState(false);

  return (
    <section className="flex flex-col gap-6 rounded-none border border-gray-300 bg-white p-6 text-black">
      {/* ── Success header ── */}
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
            {isGuest ? (
              <button
                type="button"
                onClick={onPreviewDoc}
                className="font-mono text-xs text-black underline underline-offset-4 transition hover:text-gray-600"
              >
                Open Demo Document ↗
              </button>
            ) : (
              <a
                href={doc.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-black underline underline-offset-4 transition hover:text-gray-600"
              >
                Open in Google Docs ↗
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Next: Import into Jolt Chrome Extension ── */}
      <div className="flex flex-col gap-4 rounded-none border border-[#111111] bg-[#FAFAFA] p-4">
        <h3 className="text-xs font-bold uppercase tracking-wide text-black">
          Next: Import into Jolt Chrome Extension
        </h3>

        <ol className="flex flex-col gap-2 font-mono text-xs text-gray-700">
          <li className="flex gap-2">
            <span className="shrink-0 font-bold text-black">1.</span>
            <span>
              Open a new tab in Chrome and click the{' '}
              <span className="font-bold text-black">Jolt</span> extension icon in the toolbar
              (or pin it from the Extensions menu).
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 font-bold text-black">2.</span>
            <span>
              Click <span className="font-bold text-black">Import</span> inside the Jolt
              extension, then open your synced Google Doc — it lives in the{' '}
              <span className="font-bold text-black">joltsync</span> folder in Google Drive.
              {doc && !isGuest && (
                <>
                  {' '}
                  <a
                    href={doc.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-black underline underline-offset-2 hover:text-gray-600"
                  >
                    Open your doc ↗
                  </a>
                </>
              )}
              {isGuest && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={onPreviewDoc}
                    className="font-bold text-black underline underline-offset-2 hover:text-gray-600"
                  >
                    Preview demo doc ↗
                  </button>
                </>
              )}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 font-bold text-black">3.</span>
            <span>
              Select the synced document to bring your notes or draft directly into Jolt as a
              new session entry.
            </span>
          </li>
        </ol>

        {/* Screenshot slot — shows the image when present, placeholder border otherwise */}
        <div
          className={`relative overflow-hidden rounded-none border border-[#111111] bg-white ${
            screenshotLoaded ? '' : 'min-h-[120px]'
          }`}
          aria-label="Jolt import screenshot"
        >
          {/* Actual image — hidden until loaded, invisible when errored */}
          {!screenshotError && (
            <img
              src={SCREENSHOT_SRC}
              alt="Screenshot showing the Jolt Chrome extension Import button"
              className={`w-full object-cover transition-opacity duration-200 ${
                screenshotLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0'
              }`}
              onLoad={() => setScreenshotLoaded(true)}
              onError={() => setScreenshotError(true)}
            />
          )}

          {/* Placeholder shown while the file isn't yet dropped in */}
          {!screenshotLoaded && (
            <div className="flex min-h-[120px] flex-col items-center justify-center gap-1 p-4 text-center">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-gray-400">
                Screenshot
              </span>
              <span className="font-mono text-[10px] text-gray-400">
                Drop{' '}
                <span className="font-bold">jolt-import-step.png</span> into{' '}
                <span className="font-bold">public/images/instructions/</span>
              </span>
            </div>
          )}
        </div>

        {/* Guest mode badge */}
        {isGuest && (
          <p className="font-mono text-[10px] text-gray-400">
            Demo mode — steps above reflect the real Jolt import flow.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onStartNewSession}
        className="w-full rounded-none bg-black px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-gray-800"
      >
        OK
      </button>
    </section>
  );
}
