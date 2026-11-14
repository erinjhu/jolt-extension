import type { ReactNode } from 'react';
import type { CreatedDoc } from '../services/googleDocsService';

/** Name shown on the extension's toolbar icon (see extension/manifest.json). */
const EXTENSION_NAME = 'Jolt Autofill';
const JOLT_URL = 'https://writewithjolt.com';

interface SyncConfirmationProps {
  /** The Google Doc created by the successful sync, if available. */
  doc: CreatedDoc | null;
  /** Resets the flow and returns to the main mode / document view. */
  onStartNewSession: () => void;
}

/** One numbered instruction row: a square numeral beside the step text. */
function Step({ number, children }: { number: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-none border border-[#111111] font-mono text-xs font-bold"
      >
        {number}
      </span>
      <span className="pt-0.5 text-sm leading-snug">{children}</span>
    </li>
  );
}

/**
 * Post-sync confirmation. The session is saved to Google Drive, but it only
 * reaches the user's Jolt log once the Chrome extension on their computer
 * autofills it, so this card walks them through that last step. Monochrome
 * Jolt look: #FFFFFF background, 1px #111111 border, 0px radius.
 */
export default function SyncConfirmation({ doc, onStartNewSession }: SyncConfirmationProps) {
  return (
    <section className="flex flex-col gap-6 rounded-none border border-[#111111] bg-[#FFFFFF] p-6 text-[#111111]">
      <div className="flex flex-col items-center gap-3 border-b border-[#111111] pb-6 text-center">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-none bg-[#111111] text-xl font-bold text-[#FFFFFF]"
        >
          ✓
        </span>
        <h2 className="text-sm font-bold uppercase tracking-wide">
          Session saved to Google Drive
        </h2>
        <p className="font-mono text-xs text-gray-600">
          One more step to add it to your Jolt log.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="text-xs font-bold uppercase tracking-wide">Finish on your computer</h3>
        <ol className="flex flex-col gap-4">
          <Step number={1}>
            Open <strong>Jolt</strong> (
            <a
              href={JOLT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              writewithjolt.com
            </a>
            ) in Chrome on your computer, then open <strong>Add Manual Session</strong>.
          </Step>
          <Step number={2}>
            Click the <strong>{EXTENSION_NAME}</strong> extension icon in your toolbar.
          </Step>
          <Step number={3}>
            Find this session in the list and click <strong>Sync</strong> to fill in the form.
            If it isn&apos;t listed, press <strong>Refresh Sessions</strong> first.
          </Step>
        </ol>
      </div>

      {doc && (
        <a
          href={doc.webViewLink}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate border-t border-gray-300 pt-4 font-mono text-xs underline underline-offset-4 hover:text-gray-600"
        >
          Open “{doc.name}” in Google Docs ↗
        </a>
      )}

      <button
        type="button"
        onClick={onStartNewSession}
        className="w-full rounded-none bg-[#111111] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#FFFFFF] transition hover:bg-black"
      >
        Start new session
      </button>
    </section>
  );
}
