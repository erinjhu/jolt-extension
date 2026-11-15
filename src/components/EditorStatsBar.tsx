import { useState, type ReactNode } from 'react';
import type { WritingSessionMetrics } from '../hooks/useWritingSession';

/**
 * Compact monochrome status bar for the TEXT EDITOR tab. Shows live net words,
 * active time, and overall pace at a glance, with a collapsible breakdown of
 * the Editing/Drafting split and highest burst WPH.
 */
interface EditorStatsBarProps {
  metrics: WritingSessionMetrics;
  /**
   * Optional node rendered in the top-right of the headline row (used for the
   * editor's "Saved to Drive" / "Saving…" save-status indicator).
   */
  statusSlot?: ReactNode;
}

/** Format whole seconds as MM:SS. */
function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function EditorStatsBar({ metrics, statusSlot }: EditorStatsBarProps) {
  const [expanded, setExpanded] = useState(false);
  const {
    sessionWords,
    activeSeconds,
    overallWph,
    draftingPct,
    editingPct,
    highestWph,
    sessionStartTime,
  } = metrics;

  return (
    <div className="border-b border-gray-300 bg-white font-mono text-black">
      {/* Headline row: WORDS / TIME / PACE + expand toggle. */}
      <div className="flex items-stretch divide-x divide-gray-300 text-[11px]">
        <div className="flex flex-1 flex-col px-3 py-1.5">
          <span className="text-[9px] font-bold uppercase tracking-wide text-gray-500">Words</span>
          <span className="font-semibold">+{sessionWords}</span>
        </div>
        <div className="flex flex-1 flex-col px-3 py-1.5">
          <span className="text-[9px] font-bold uppercase tracking-wide text-gray-500">Time</span>
          <span className="font-semibold">{formatClock(activeSeconds)}</span>
        </div>
        <div className="flex flex-1 flex-col px-3 py-1.5">
          <span className="text-[9px] font-bold uppercase tracking-wide text-gray-500">Pace</span>
          <span className="font-semibold">{overallWph} wph</span>
        </div>
        {/* Save-status indicator in the top-right corner of the stats row. */}
        {statusSlot && (
          <div className="flex items-center px-3 py-1.5">{statusSlot}</div>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide session breakdown' : 'Show session breakdown'}
          className="flex items-center justify-center rounded-none bg-white px-3 text-xs font-bold text-black transition hover:bg-gray-100"
        >
          {expanded ? '−' : '+'}
        </button>
      </div>

      {/* Collapsible breakdown: writing modes, highest WPH, start time. */}
      {expanded && (
        <div className="border-t border-gray-200 px-3 py-2 text-[10px] text-gray-600">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-bold uppercase tracking-wide text-gray-500">Writing Modes</span>
            <span>
              Drafting {draftingPct}% · Editing {editingPct}%
            </span>
          </div>
          {/* Monochrome drafting/editing split bar. */}
          <div className="mb-2 flex h-1.5 w-full overflow-hidden border border-gray-300">
            <div className="h-full bg-black" style={{ width: `${draftingPct}%` }} />
            <div className="h-full bg-gray-400" style={{ width: `${editingPct}%` }} />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold uppercase tracking-wide text-gray-500">Flow</span>
            <span>Highest {highestWph} wph</span>
          </div>
          {sessionStartTime && (
            <div className="mt-1 flex items-center justify-between">
              <span className="font-bold uppercase tracking-wide text-gray-500">Started</span>
              <span>{sessionStartTime}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
