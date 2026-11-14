/**
 * Minimalist two-segment mode switch for the top header: SCAN (photo scan)
 * and EDITOR (text editor). Sharp corners, 1px #111111 border, solid #111111
 * with white text for the active segment.
 */

/** The two features the toggle switches between. */
export type AppTab = 'scan' | 'editor';

interface ModeToggleProps {
  active: AppTab;
  onChange: (tab: AppTab) => void;
}

const TABS: { id: AppTab; label: string }[] = [
  { id: 'scan', label: 'SCAN' },
  { id: 'editor', label: 'EDITOR' },
];

export default function ModeToggle({ active, onChange }: ModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Mode"
      className="flex rounded-none border border-[#111111]"
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-pressed={isActive}
            className={`rounded-none px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
              isActive
                ? 'bg-[#111111] text-[#FFFFFF]'
                : 'bg-[#FFFFFF] text-[#111111] hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
