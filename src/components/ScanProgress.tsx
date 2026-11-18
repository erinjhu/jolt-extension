import { useEffect, useRef, useState } from 'react';

/**
 * Minimalist monochrome scan-progress indicator shown above the ADD MANUAL
 * SESSION form in Scan Mode. While the photo is being read it animates a
 * sharp-cornered bar smoothly toward 90%; on completion it snaps to 100% and
 * the status reads "Note added to Google Doc ↗", where "Google Doc ↗" is a
 * link that opens the document in a new tab.
 */
interface ScanProgressProps {
  /** True while the work (reading / creating) is in progress. */
  isScanning: boolean;
  /** True once the work has finished. */
  isComplete: boolean;
  /** Label shown while in progress (e.g. "Reading note…"). */
  scanningLabel?: string;
  /** Label shown once complete (e.g. "Note added to Google Doc"). */
  completeLabel?: string;
  /** Drive file id of the doc to open once complete (null hides the action). */
  documentId?: string | null;
  /** Show the "Open Google Doc ↗" action on completion (default true). */
  showOpenDoc?: boolean;
  /**
   * Guest demo: when provided, the completion action opens an in-app preview
   * modal ("Preview extracted doc") instead of linking to docs.google.com.
   */
  onPreviewDoc?: () => void;
  /**
   * Render the card centered in a full-viewport dimmed backdrop (used for the
   * blocking "Syncing session to Jolt…" state) instead of inline in the flow.
   */
  overlay?: boolean;
}

/** Ceiling the indeterminate progress creeps toward while still scanning. */
const SCANNING_CEILING = 90;

export default function ScanProgress({
  isScanning,
  isComplete,
  scanningLabel = 'Reading note…',
  completeLabel = 'Note added to Google Doc',
  documentId,
  showOpenDoc = true,
  onPreviewDoc,
  overlay = false,
}: ScanProgressProps) {
  const [percent, setPercent] = useState(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Clear any running creep interval before deciding the next phase.
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isScanning) {
      // Ease toward the ceiling: bigger steps early, smaller as it approaches.
      intervalRef.current = window.setInterval(() => {
        setPercent((p) => (p >= SCANNING_CEILING ? p : p + Math.max(1, (SCANNING_CEILING - p) * 0.12)));
      }, 200);
    } else if (isComplete) {
      setPercent(100);
    } else {
      setPercent(0);
    }

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isScanning, isComplete]);

  const docHref = documentId
    ? `https://docs.google.com/document/d/${documentId}/edit`
    : null;

  // The progress card itself — reused inline or inside the centered overlay.
  const card = (
    <div
      className={`flex flex-col gap-2 rounded-none border border-[#111111] bg-[#FFFFFF] text-[#111111] ${
        overlay ? 'w-full max-w-md p-6' : 'p-4'
      }`}
    >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wide">
            {isComplete ? (
              showOpenDoc && onPreviewDoc ? (
                // Guest demo: in-app preview instead of an external Docs link.
                <>
                  Note added to{' '}
                  <button
                    type="button"
                    onClick={onPreviewDoc}
                    className="underline underline-offset-2 transition hover:text-gray-600"
                  >
                    extracted doc ↗
                  </button>
                </>
              ) : showOpenDoc && docHref ? (
                // "Note added to " stays plain; "Google Doc ↗" is the link.
                <>
                  Note added to{' '}
                  <a
                    href={docHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 transition hover:text-gray-600"
                  >
                    Google Doc ↗
                  </a>
                </>
              ) : (
                completeLabel
              )
            ) : (
              scanningLabel
            )}
          </span>
          <span className="font-mono text-xs text-gray-500">
            {isComplete ? '✓' : `${Math.round(percent)}%`}
          </span>
        </div>

        <div
          className="h-2 w-full overflow-hidden rounded-none bg-[#F0F0F0]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
        >
          <div
            className="h-full rounded-none bg-[#111111] transition-[width] duration-300 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
    </div>
  );

  // Blocking sync state: center the card in a full-viewport dimmed backdrop.
  if (overlay) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
        {card}
      </div>
    );
  }

  // Inline (scan reading / complete): sits in the normal document flow.
  return <div className="flex flex-col gap-3">{card}</div>;
}
