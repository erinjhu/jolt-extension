import { useId, type ReactNode } from 'react';

/** Sharp-cornered, 1px gray-bordered input — Jolt's minimalist look. Used
 *  as-is for multi-line textareas (no fixed height). */
export const joltInputClass =
  'w-full rounded-none border border-gray-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-black';

/** Uniform single-line field height, shared across every one-line input so
 *  Date, Document, Words, Start Time, Duration, Title, and Quote align.
 *  Kept compact/low-profile. */
export const joltFieldHeight = 'box-border h-[38px]';

/** Single-line input/select variant: the base look at the uniform compact
 *  field height, with vertical padding removed so the height is exact. */
export const joltSingleLineClass = `${joltInputClass} ${joltFieldHeight} py-0`;

/** Small bold uppercase field label (DATE, WORDS, TITLE, …). */
export function JoltLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="whitespace-nowrap text-xs font-bold uppercase tracking-wide text-black"
    >
      {children}
    </label>
  );
}

/** Bold uppercase section header (SESSION STATS, VISIBILITY, OPTIONAL). */
export function JoltSectionHeader({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-wide text-black">{children}</h2>
  );
}

/** Labeled field wrapper; passes a generated id to its render-prop child. */
export function JoltField({
  label,
  children,
}: {
  label: string;
  children: (fieldId: string) => ReactNode;
}) {
  const fieldId = useId();
  return (
    <div className="flex flex-col gap-1">
      <JoltLabel htmlFor={fieldId}>{label}</JoltLabel>
      {children(fieldId)}
    </div>
  );
}
