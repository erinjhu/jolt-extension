import JoltLogoIcon from './jolt/JoltLogoIcon';

/**
 * Guest Demo Mode header. A minimal sticky top bar (matching AppHeader's
 * frame): a clickable JOLT logo/wordmark that returns to the mode-selection
 * home screen, a GUEST DEMO MODE label, and an EXIT DEMO action.
 */
interface GuestBadgeProps {
  onExit: () => void;
  /** Clicking the logo/name returns to the mode-selection home screen. */
  onHome: () => void;
}

export default function GuestBadge({ onExit, onHome }: GuestBadgeProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#111111] bg-[#FFFFFF] px-4 text-[#111111]">
      <button
        type="button"
        onClick={onHome}
        aria-label="Go to home"
        className="flex cursor-pointer items-center gap-2 rounded-none bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2"
      >
        <JoltLogoIcon size={24} title="Jolt Extension" />
        <span className="text-lg font-bold tracking-tight">Jolt Extension</span>
      </button>
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
