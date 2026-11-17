/**
 * JoltLogoIcon — the Jolt brand mark.
 *
 * A stylized lightning bolt / "Z" built from 8 slanted horizontal bars on a
 * 100×100 grid. The top four bars step down and to the left along a shared
 * diagonal right edge; the fifth bar jumps back to the right to form the
 * lightning bolt's mid overhang, then the bottom four step down-left again.
 * Bar 1 has a rounded top-right cap, bar 8 a rounded bottom-left cap. The whole
 * mark leans forward via a uniform `skewX(-12)`.
 *
 * The bars are filled with the Jolt brand purple (#4F46E5) by default. Pass a
 * different `color` (any CSS color, including `currentColor`) to recolor the
 * whole mark — all 8 bars share the single fill.
 */
interface JoltLogoIconProps {
  /** Rendered width/height in pixels. Defaults to 32. */
  size?: number;
  /** Fill applied to all 8 bars. Defaults to the Jolt brand purple. */
  color?: string;
  /** Accessible label; when omitted the icon is hidden from assistive tech. */
  title?: string;
  className?: string;
}

/** Jolt brand purple — shared by the favicon and extension icons. */
export const JOLT_BRAND_PURPLE = '#4F46E5';

const BAR_HEIGHT = 7;

/**
 * The 8 bars, top to bottom, as `[x1, x2, y]` on a 100×100 grid (width is
 * `x2 - x1`). Uniform 7px height and 12px vertical pitch (≈5px gap). The jump
 * from bar 4 (left-most, x:25–60) to bar 5 (shifted right, x:47–82) is the
 * lightning bolt's mid step.
 */
const BARS: ReadonlyArray<readonly [number, number, number]> = [
  [73, 83, 8], // bar 1 — top-right cap (rounded TR)
  [58, 76, 20], // bar 2
  [40, 67, 32], // bar 3
  [25, 60, 44], // bar 4 — upper-middle crossbar (furthest left)
  [47, 82, 56], // bar 5 — lower-middle crossbar (jumps right)
  [40, 67, 68], // bar 6
  [31, 49, 80], // bar 7
  [24, 34, 92], // bar 8 — bottom-left cap (rounded BL)
];

const CAP_RADIUS = 2.5;

/** Builds a bar path; `rounded` adds a single rounded corner for the caps. */
function barPath(x1: number, x2: number, y: number, rounded: 'tr' | 'bl' | null): string {
  const top = y;
  const bottom = y + BAR_HEIGHT;
  const r = CAP_RADIUS;

  if (rounded === 'tr') {
    return [
      `M ${x1} ${top}`,
      `H ${x2 - r}`,
      `Q ${x2} ${top} ${x2} ${top + r}`,
      `V ${bottom}`,
      `H ${x1}`,
      'Z',
    ].join(' ');
  }
  if (rounded === 'bl') {
    return [
      `M ${x1} ${top}`,
      `H ${x2}`,
      `V ${bottom}`,
      `H ${x1 + r}`,
      `Q ${x1} ${bottom} ${x1} ${bottom - r}`,
      'Z',
    ].join(' ');
  }
  return [`M ${x1} ${top}`, `H ${x2}`, `V ${bottom}`, `H ${x1}`, 'Z'].join(' ');
}

export default function JoltLogoIcon({
  size = 32,
  color = JOLT_BRAND_PURPLE,
  title,
  className,
}: JoltLogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title && <title>{title}</title>}
      {/* Forward lean shared by every bar. */}
      <g transform="skewX(-12)" fill={color}>
        {BARS.map(([x1, x2, y], index) => {
          const rounded = index === 0 ? 'tr' : index === BARS.length - 1 ? 'bl' : null;
          return <path key={index} d={barPath(x1, x2, y, rounded)} />;
        })}
      </g>
    </svg>
  );
}
