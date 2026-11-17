import { useCallback, useState } from 'react';
import { resetGuestWorkspace } from '../services/guestDemoService';

/**
 * Owns Guest Demo Mode flags and the enter/exit transitions, keeping that
 * concern out of App. Entering/exiting resets the shared app flow (via the
 * injected callbacks) and the in-memory mock workspace so each demo starts
 * clean.
 *
 * @param resetFlow            Clears capture/transcription/sync state in App.
 * @param resetInitialMode     Returns to the post-sign-in mode landing.
 */
export function useGuestMode(resetFlow: () => void, resetInitialMode: () => void) {
  const [isGuestMode, setIsGuestMode] = useState(false);
  // Controls the in-app "preview extracted doc" modal used in Scan Mode.
  const [showDocPreview, setShowDocPreview] = useState(false);

  const enterGuestMode = useCallback(() => {
    resetGuestWorkspace();
    resetFlow();
    resetInitialMode();
    setIsGuestMode(true);
  }, [resetFlow, resetInitialMode]);

  const exitGuestMode = useCallback(() => {
    resetFlow();
    resetInitialMode();
    setIsGuestMode(false);
    setShowDocPreview(false);
    resetGuestWorkspace();
  }, [resetFlow, resetInitialMode]);

  return {
    isGuestMode,
    showDocPreview,
    setShowDocPreview,
    enterGuestMode,
    exitGuestMode,
  };
}
