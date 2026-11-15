import type { SessionVisibility } from '../../types/session';
import { joltFieldHeight } from './JoltField';

interface JoltVisibilityToggleProps {
  value: SessionVisibility;
  onChange: (next: SessionVisibility) => void;
}

/**
 * Two side-by-side rectangular toggles. The active option is a solid black
 * fill with white uppercase text; the inactive one is white with a gray
 * border and muted text — matching Jolt's visibility control.
 */
export default function JoltVisibilityToggle({ value, onChange }: JoltVisibilityToggleProps) {
  return (
    <div role="radiogroup" aria-label="Visibility" className="grid grid-cols-2 gap-3">
      <ToggleButton
        label="Public"
        active={value === 'public'}
        onClick={() => onChange('public')}
      />
      <ToggleButton
        label="Private (just me)"
        active={value === 'private'}
        onClick={() => onChange('private')}
      />
    </div>
  );
}

function ToggleButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex items-center justify-center whitespace-nowrap rounded-none px-3 py-0 text-xs font-bold uppercase tracking-wide transition ${joltFieldHeight} ${
        active
          ? 'bg-black text-white'
          : 'border border-gray-300 bg-white text-gray-400 hover:text-black'
      }`}
    >
      {label}
    </button>
  );
}
