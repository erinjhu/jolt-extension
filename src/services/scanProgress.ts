/**
 * Real pipeline progress for the "scan into a Google Doc" flow.
 *
 * The transcription service reports a milestone each time an async step
 * finishes; the UI subscribes (see `hooks/useScanProgress`) and renders the
 * percentage and label. Nothing here is timer-driven.
 */

export interface ScanProgressState {
  /** Percent complete, 0-100. */
  percent: number;
  /** Plain-language label for the step currently running. */
  label: string;
}

/** Called with each milestone as the pipeline advances. */
export type ScanProgressReporter = (state: ScanProgressState) => void;

/** Milestones: the percent reached once the previous step finished. */
export const SCAN_STAGES = {
  creating: { percent: 0, label: 'Creating document...' },
  uploading: { percent: 25, label: 'Uploading image...' },
  appending: { percent: 65, label: 'Appending text...' },
  finalizing: { percent: 90, label: 'Finalizing...' },
  done: { percent: 100, label: 'Done' },
} as const satisfies Record<string, ScanProgressState>;

/**
 * Milestones for "+ Create New Doc". Initial content is never attached at
 * creation time, so the 75% "syncing initial content" step is skipped and the
 * pipeline goes straight from creating to ready.
 */
export const CREATE_DOC_STAGES = {
  resolving: { percent: 15, label: 'Resolving target folder...' },
  creating: { percent: 45, label: 'Creating Google Doc...' },
  ready: { percent: 100, label: 'Ready' },
} as const satisfies Record<string, ScanProgressState>;

type Listener = () => void;

let current: ScanProgressState = SCAN_STAGES.creating;
const listeners = new Set<Listener>();

/** Snapshot for `useSyncExternalStore`; stable until the next report. */
export function getScanProgress(): ScanProgressState {
  return current;
}

export function subscribeScanProgress(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Default reporter: publish a milestone to every subscriber. */
export function reportScanProgress(state: ScanProgressState): void {
  if (state.percent === current.percent && state.label === current.label) return;
  current = state;
  listeners.forEach((notify) => notify());
}

/** Return the bar to its starting point (after an error or a new run). */
export function resetScanProgress(): void {
  reportScanProgress(SCAN_STAGES.creating);
}
