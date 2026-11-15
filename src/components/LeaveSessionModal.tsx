import { useEffect } from 'react';

/**
 * Two-stage monochrome modal for the ← BACK flow, shared by the Text Editor
 * and Scan sequences. `confirm` asks the user to finish-and-save or discard;
 * `discarded` reassures them the document itself was saved to Drive (in
 * `folderName`) and offers a single OK to leave.
 *
 * White sheet, 1px #111111 sharp border, dark backdrop. In the `confirm`
 * stage, tapping the backdrop / ✕ / Escape dismisses (stay put); the
 * `discarded` stage is terminal and only closes via OK.
 */
export interface LeaveSessionModalProps {
  stage: 'confirm' | 'discarded';
  /** Disables the actions while a save / folder lookup is in flight. */
  isBusy: boolean;
  /** Drive folder name shown in the discarded-confirmation message. */
  folderName: string;
  onFinishAndSave: () => void;
  onDiscard: () => void;
  onDiscardedOk: () => void;
  onDismiss: () => void;
}

export default function LeaveSessionModal({
  stage,
  isBusy,
  folderName,
  onFinishAndSave,
  onDiscard,
  onDiscardedOk,
  onDismiss,
}: LeaveSessionModalProps) {
  // Only the confirm stage is dismissible via backdrop / Escape.
  const dismissible = stage === 'confirm' && !isBusy;

  useEffect(() => {
    if (!dismissible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dismissible, onDismiss]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={stage === 'confirm' ? 'Leave this session' : 'Session discarded'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={dismissible ? onDismiss : undefined}
    >
      <div
        className="relative w-full max-w-sm rounded-none border border-[#111111] bg-[#FFFFFF] p-6 text-[#111111]"
        onClick={(e) => e.stopPropagation()}
      >
        {stage === 'confirm' ? (
          <>
            <button
              type="button"
              onClick={onDismiss}
              disabled={isBusy}
              aria-label="Keep going"
              className="absolute right-3 top-3 rounded-none px-1 text-sm font-bold text-gray-500 transition hover:text-black disabled:opacity-40"
            >
              ✕
            </button>

            <h2 className="mb-2 pr-6 text-sm font-bold uppercase tracking-wide">
              Leave this session?
            </h2>
            <p className="mb-6 text-sm text-gray-600">
              Finish and save your current session before leaving, or discard it?
            </p>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={onFinishAndSave}
                disabled={isBusy}
                className="w-full rounded-none bg-[#111111] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#FFFFFF] transition hover:bg-gray-800 disabled:opacity-40"
              >
                {isBusy ? 'Saving…' : 'Finish & Save Session'}
              </button>
              <button
                type="button"
                onClick={onDiscard}
                disabled={isBusy}
                className="w-full rounded-none border border-[#111111] bg-[#FFFFFF] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#111111] transition hover:bg-gray-100 disabled:opacity-40"
              >
                {isBusy ? 'Discarding…' : 'Discard Session'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide">Session discarded</h2>
            <p className="mb-6 text-sm text-gray-600">
              Your document has been saved to Google Drive in{' '}
              <span className="font-semibold text-[#111111]">{folderName}</span>.
            </p>

            <button
              type="button"
              onClick={onDiscardedOk}
              className="w-full rounded-none bg-[#111111] px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#FFFFFF] transition hover:bg-gray-800"
            >
              OK
            </button>
          </>
        )}
      </div>
    </div>
  );
}
