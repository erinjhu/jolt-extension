/**
 * Guest Demo Mode header. A minimal sticky top bar (matching AppHeader's
 * frame) showing the JOLT wordmark, a GUEST DEMO MODE pill, and an EXIT DEMO
 * action that returns to the sign-in screen.
 */
interface GuestBadgeProps {
  onExit: () => void;
}

export default function GuestBadge({ onExit }: GuestBadgeProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#111111] bg-[#FFFFFF] px-4 text-[#111111]">
      <span className="pl-[0.35em] text-lg font-bold tracking-[0.35em]">JOLT</span>
      <span className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
          Guest Demo Mode
        </span>
        <button
          type="button"
          onClick={onExit}
          className="rounded-none border border-[#111111] bg-[#FFFFFF] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#111111] transition hover:bg-gray-100"
        >
          Exit Demo
        </button>
      </span>
    </header>
  );
}
