import { createContext, useContext } from 'react';

/** Whether Drive is usable for this session, and how to fix it if it isn't. */
export interface DriveAccess {
  /** False when sign-in succeeded but the Drive permission was left unchecked. */
  hasDriveScope: boolean;
  /**
   * Re-run Google consent (`prompt: 'consent'`, which shows the permission
   * checkboxes again). Resolves with the fresh access token when Drive was
   * granted, or null if the user cancelled or still left it unchecked.
   */
  grant: () => Promise<string | null>;
}

/** Outside the provider (e.g. guest demo) Drive is treated as available. */
const DEFAULT_ACCESS: DriveAccess = { hasDriveScope: true, grant: async () => null };

export const DriveAccessContext = createContext<DriveAccess>(DEFAULT_ACCESS);

export function useDriveAccess(): DriveAccess {
  return useContext(DriveAccessContext);
}
