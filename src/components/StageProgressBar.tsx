import type { ScanProgressState } from '../services/scanProgress';

interface StageProgressBarProps {
  /** Current milestone: percent complete and the running step's label. */
  progress: ScanProgressState;
}

/**
 * Monochrome stage progress bar: label left, tabular percentage right, then a
 * sharp 1px-bordered track with a solid #111111 fill. Presentational only.
 */
export default function StageProgressBar({ progress }: StageProgressBarProps) {
  const percent = Math.min(100, Math.max(0, Math.round(progress.percent)));
  return (
    <div className="flex flex-col gap-1.5 text-[#111111]" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold">{progress.label}</span>
        <span className="font-mono text-xs tabular-nums">{percent}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-none border border-[#111111] bg-[#FFFFFF]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-none bg-[#111111] transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
