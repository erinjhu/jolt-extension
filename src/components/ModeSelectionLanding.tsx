import type { AppTab } from './ModeToggle';

interface ModeSelectionLandingProps {
  onChoose: (mode: AppTab) => void;
}

const MODES: { id: AppTab; title: string; subtitle: string; description: string; cta: string }[] = [
  {
    id: 'scan',
    title: 'SCAN',
    subtitle: 'TRACK AND SAVE HANDWRITTEN PAGES',
    description:
      'Scan handwritten pages into a Google Doc. Automatically count words. Import the session into Jolt later.',
    cta: 'START SCANNING',
  },
  {
    id: 'editor',
    title: 'EDITOR',
    subtitle: 'WRITE ON YOUR PHONE NOW',
    description:
      'Write straight on your phone with live stats and sync it to Google Docs. Import the session into Jolt later.',
    cta: 'OPEN EDITOR',
  },
];

/** Post-sign-in landing: explains SCAN vs. EDITOR before either is entered. */
export default function ModeSelectionLanding({ onChoose }: ModeSelectionLandingProps) {
  return (
    <section className="flex flex-col gap-6 bg-[#FFFFFF] text-[#111111]">
      {MODES.map((mode) => (
        <div
          key={mode.id}
          className="flex flex-col gap-4 rounded-none border border-[#111111] bg-[#FFFFFF] p-5"
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-bold tracking-[0.2em]">{mode.title}</h2>
            <span className="font-mono text-xs uppercase text-gray-600">{mode.subtitle}</span>
          </div>
          <p className="text-sm leading-relaxed">{mode.description}</p>
          <button
            type="button"
            onClick={() => onChoose(mode.id)}
            className="w-full rounded-none bg-[#111111] px-4 py-3 text-sm font-bold uppercase tracking-wide text-[#FFFFFF] transition hover:bg-black"
          >
            {mode.cta}
          </button>
        </div>
      ))}
    </section>
  );
}
