import { JoltField, joltFieldHeight, joltInputClass, joltSingleLineClass } from './JoltField';

interface JoltSessionStatsProps {
  words: number;
  onWordsChange: (value: number) => void;
  startTime: string;
  onStartTimeChange: (value: string) => void;
  durationHours: number;
  durationMinutes: number;
  onHoursChange: (value: number) => void;
  onMinutesChange: (value: number) => void;
}

const numeric = (raw: string) => Math.max(0, Number(raw) || 0);

/** SESSION STATS: WORDS, START TIME, and split hr/min DURATION (3-col). */
export default function JoltSessionStats({
  words,
  onWordsChange,
  startTime,
  onStartTimeChange,
  durationHours,
  durationMinutes,
  onHoursChange,
  onMinutesChange,
}: JoltSessionStatsProps) {
  // Keep Words and Start Time narrow so Duration (hr/min + labels) gets the
  // largest share of the row and never looks squished. `items-start` puts all
  // three labels on one top baseline; the uniform input height then keeps the
  // boxes themselves aligned.
  return (
    <div className="grid grid-cols-[1fr_1.2fr_2.5fr] items-start gap-3">
      <JoltField label="Words">
        {(id) => (
          <input
            id={id}
            type="number"
            min={0}
            value={words}
            onChange={(e) => onWordsChange(numeric(e.target.value))}
            className={joltSingleLineClass}
          />
        )}
      </JoltField>

      <JoltField label="Start time">
        {(id) => (
          <input
            id={id}
            type="time"
            value={startTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
            className={joltSingleLineClass}
            required
          />
        )}
      </JoltField>

      <JoltField label="Duration">
        {(id) => (
          <div className={`flex items-stretch gap-2 ${joltFieldHeight}`}>
            <input
              id={id}
              type="number"
              min={0}
              value={String(durationHours).padStart(2, '0')}
              onChange={(e) => onHoursChange(numeric(e.target.value))}
              className={`jolt-single-line ${joltInputClass} box-border h-full min-w-0 appearance-none px-3 py-0 leading-none`}
              aria-label="Duration hours"
            />
            <span className="self-center font-mono text-xs text-gray-500">hr</span>
            <input
              type="number"
              min={0}
              max={59}
              value={String(durationMinutes).padStart(2, '0')}
              onChange={(e) => onMinutesChange(numeric(e.target.value))}
              className={`jolt-single-line ${joltInputClass} box-border h-full min-w-0 appearance-none px-3 py-0 leading-none`}
              aria-label="Duration minutes"
            />
            <span className="self-center font-mono text-xs text-gray-500">min</span>
          </div>
        )}
      </JoltField>
    </div>
  );
}
