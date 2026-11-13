import type { SessionVisibility } from '../types/session';

interface VisibilityToggleProps {
  value: SessionVisibility;
  onChange: (next: SessionVisibility) => void;
}

/** Two-state segmented toggle for public vs private session visibility. */
export default function VisibilityToggle({ value, onChange }: VisibilityToggleProps) {
  const isPublic = value === 'public';

  return (
    <div
      role="radiogroup"
      aria-label="Session visibility"
      className="inline-flex rounded-lg border border-gray-700 bg-gray-800 p-1"
    >
      <ToggleOption
        label="Private"
        selected={!isPublic}
        onClick={() => onChange('private')}
      />
      <ToggleOption
        label="Public"
        selected={isPublic}
        onClick={() => onChange('public')}
      />
    </div>
  );
}

interface ToggleOptionProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

function ToggleOption({ label, selected, onClick }: ToggleOptionProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
        selected ? 'bg-indigo-500 text-white' : 'text-gray-300 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}
