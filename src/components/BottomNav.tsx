/**
 * Persistent bottom navigation bar, shown once a target document is selected.
 * Lets the user toggle between the Photo Scan capture flow and the Text Editor.
 *
 * Monochrome Jolt look: sharp (0px-radius) tabs, solid #111111 background with
 * #FFFFFF text for the active tab, inverted for the inactive one.
 */

/** The two features the bottom nav switches between. */
export type AppTab = 'scan' | 'editor';

interface BottomNavProps {
  active: AppTab;
  onChange: (tab: AppTab) => void;
}

const TABS: { id: AppTab; label: string }[] = [
  { id: 'scan', label: 'SCAN PHOTO' },
  { id: 'editor', label: 'TEXT EDITOR' },
];

export default function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-xl border-t border-[#111111] bg-white"
      aria-label="Feature navigation"
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex-1 rounded-none px-4 py-4 text-xs font-bold uppercase tracking-wide transition ${
              isActive
                ? 'bg-[#111111] text-[#FFFFFF]'
                : 'bg-[#FFFFFF] text-[#111111] hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
