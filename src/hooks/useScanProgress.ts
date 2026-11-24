import { useSyncExternalStore } from 'react';
import {
  getScanProgress,
  subscribeScanProgress,
  type ScanProgressState,
} from '../services/scanProgress';

/** Subscribe a component to the live scan/create pipeline progress. */
export function useScanProgress(): ScanProgressState {
  return useSyncExternalStore(subscribeScanProgress, getScanProgress, getScanProgress);
}
