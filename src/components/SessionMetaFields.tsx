import FormField from './FormField';

interface SessionMetaFieldsProps {
  date: string;
  onDateChange: (value: string) => void;
  wordCount: number;
  onWordCountChange: (value: number) => void;
  startTime: string;
  onStartTimeChange: (value: string) => void;
  stopTime: string;
  onStopTimeChange: (value: string) => void;
  inputClass: string;
}

/** Grid of date, word count, start time, and end time inputs. */
export default function SessionMetaFields({
  date,
  onDateChange,
  wordCount,
  onWordCountChange,
  startTime,
  onStartTimeChange,
  stopTime,
  onStopTimeChange,
  inputClass,
}: SessionMetaFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField label="Date">
        {(id) => (
          <input
            id={id}
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className={inputClass}
          />
        )}
      </FormField>

      <FormField label="Word count">
        {(id) => (
          <input
            id={id}
            type="number"
            min={0}
            value={wordCount}
            onChange={(e) => onWordCountChange(Number(e.target.value) || 0)}
            className={inputClass}
          />
        )}
      </FormField>

      <FormField label="Start time">
        {(id) => (
          <input
            id={id}
            type="time"
            value={startTime}
            onChange={(e) => onStartTimeChange(e.target.value)}
            className={inputClass}
            required
          />
        )}
      </FormField>

      <FormField label="End time">
        {(id) => (
          <input
            id={id}
            type="time"
            value={stopTime}
            onChange={(e) => onStopTimeChange(e.target.value)}
            className={inputClass}
            required
          />
        )}
      </FormField>
    </div>
  );
}
