import SessionForm from './SessionForm';
import ScanProgress from './ScanProgress';
import SyncResultBanner from './SyncResultBanner';
import type { WritingSessionMetrics } from '../hooks/useWritingSession';
import type { TargetDoc } from '../services/joltDocumentsService';
import type { JoltSessionPayload } from '../types/session';

/**
 * EDITOR view after FINISH SESSION: the pre-filled ADD MANUAL SESSION form
 * seeded with the written text and tracked analytics, plus sync status.
 * Presentational; App owns the state and handlers.
 */
interface SessionLoggingViewProps {
  flowKey: number;
  text: string;
  metrics: WritingSessionMetrics;
  selectedDoc: TargetDoc | null;
  isSignedIn: boolean;
  isSyncing: boolean;
  syncError: string | null;
  isGuest: boolean;
  onBack: () => void;
  onRetake: (imageBase64: string) => void;
  onSyncToDrive: (payload: JoltSessionPayload) => void;
  onPreviewDoc: () => void;
}

export default function SessionLoggingView({
  flowKey,
  text,
  metrics,
  selectedDoc,
  isSignedIn,
  isSyncing,
  syncError,
  isGuest,
  onBack,
  onRetake,
  onSyncToDrive,
  onPreviewDoc,
}: SessionLoggingViewProps) {
  return (
    <>
      <SessionForm
        key={flowKey}
        initialDescription={text}
        imageBase64=""
        documentName={selectedDoc?.name ?? ''}
        documentId={selectedDoc?.id}
        sessionMetrics={metrics}
        isGuest={isGuest}
        onPreviewDoc={onPreviewDoc}
        onBack={onBack}
        onImageSelected={onRetake}
        onSyncToDrive={onSyncToDrive}
        disabled={isSyncing}
        isSignedIn={isSignedIn}
        isSyncing={isSyncing}
      />

      {/* Syncing the session to Jolt: full-viewport dimmed, centered card. */}
      {isSyncing && (
        <ScanProgress
          isScanning
          isComplete={false}
          scanningLabel="Syncing session to Jolt Extension…"
          showOpenDoc={false}
          overlay
        />
      )}
      {syncError && <SyncResultBanner doc={null} error={syncError} />}
    </>
  );
}
