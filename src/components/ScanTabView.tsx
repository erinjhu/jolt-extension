import { useScanProgress } from '../hooks/useScanProgress';
import LeaveSessionModal from './LeaveSessionModal';
import PhotoUploadLanding from './PhotoUploadLanding';
import ScanProgress from './ScanProgress';
import SessionForm from './SessionForm';
import SyncResultBanner from './SyncResultBanner';
import type { TargetDoc } from '../services/joltDocumentsService';
import type { JoltSessionPayload } from '../types/session';
import type { TranscriptionResult } from '../services/transcription';

/**
 * The SCAN feature view: the document-selection / photo-capture landing, then
 * the OCR progress + pre-filled ADD MANUAL SESSION form, with the scan leave
 * confirmation and (in guest mode) the extracted-doc preview modal.
 *
 * Presentational: all state and side effects live in App; this component only
 * wires them to the scan UI so App stays small and focused on orchestration.
 */
interface ScanTabViewProps {
  accessToken: string;
  flowKey: number;
  selectedDoc: TargetDoc | null;
  transcription: TranscriptionResult | null;
  imageBase64: string;
  hasImage: boolean;
  isTranscribing: boolean;
  isSyncing: boolean;
  isSignedIn: boolean;
  transcribeError: string | null;
  syncError: string | null;
  isGuest: boolean;
  scanLeaveStage: 'closed' | 'confirm' | 'discarded';
  scanDiscardFolder: string;
  onSelectDoc: (doc: TargetDoc) => void;
  onClearDoc: () => void;
  onImageSelected: (imageBase64: string, doc: TargetDoc) => void;
  onLoadSampleNote: () => void;
  onRetake: (imageBase64: string) => void;
  onSyncToDrive: (payload: JoltSessionPayload) => void;
  onOfflineFallback: () => void;
  onScanBack: () => void;
  onScanDiscard: () => void;
  onScanDiscardedOk: () => void;
  onScanLeaveDismiss: () => void;
  onPreviewDoc: () => void;
}

export default function ScanTabView(props: ScanTabViewProps) {
  const scanProgress = useScanProgress();
  const {
    accessToken,
    flowKey,
    selectedDoc,
    transcription,
    imageBase64,
    hasImage,
    isTranscribing,
    isSyncing,
    isSignedIn,
    transcribeError,
    syncError,
    isGuest,
    scanLeaveStage,
    scanDiscardFolder,
    onSelectDoc,
    onClearDoc,
    onImageSelected,
    onLoadSampleNote,
    onRetake,
    onSyncToDrive,
    onOfflineFallback,
    onScanBack,
    onScanDiscard,
    onScanDiscardedOk,
    onScanLeaveDismiss,
    onPreviewDoc,
  } = props;

  if (!hasImage) {
    // Step 1: choose a target document, then capture/upload a photo.
    return (
      <PhotoUploadLanding
        accessToken={accessToken}
        selectedDoc={selectedDoc}
        onSelectDoc={onSelectDoc}
        onClearDoc={onClearDoc}
        onImageSelected={onImageSelected}
        disabled={isTranscribing}
        isGuest={isGuest}
        onLoadSampleNote={onLoadSampleNote}
      />
    );
  }

  // Step 2: ← BACK on top, OCR progress bar, then the pre-filled form.
  const scanComplete = !isTranscribing && transcription?.source === 'google-drive';
  // Single source of truth for the synced doc: the banner link and the
  // "Open your doc" button must always resolve to the same document.
  const syncedDocId: string | undefined = transcription?.docId ?? selectedDoc?.id;
  return (
    <>
      <button
        type="button"
        onClick={onScanBack}
        className="self-start rounded-none border border-[#111111] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#111111] transition hover:bg-gray-100"
      >
        ← Back
      </button>

      {/* While reading the note, dim + block the rest of the screen. */}
      {isTranscribing && <div className="fixed inset-0 z-40 bg-black/40" aria-hidden />}

      {(isTranscribing || scanComplete) && (
        <div className={isTranscribing ? 'relative z-50' : undefined}>
          <ScanProgress
            isScanning={isTranscribing}
            isComplete={scanComplete}
            documentId={syncedDocId ?? null}
            onPreviewDoc={isGuest ? onPreviewDoc : undefined}
            progress={isTranscribing && isSignedIn && !isGuest ? scanProgress : null}
          />
        </div>
      )}

      <SessionForm
        key={flowKey}
        initialDescription={transcription?.text ?? ''}
        imageBase64={imageBase64}
        documentName={selectedDoc?.name ?? ''}
        documentId={syncedDocId}
        isGuest={isGuest}
        onPreviewDoc={onPreviewDoc}
        onImageSelected={onRetake}
        onSyncToDrive={onSyncToDrive}
        disabled={isTranscribing || isSyncing}
        isSignedIn={isSignedIn}
        isSyncing={isSyncing}
        isTranscribing={isTranscribing}
        transcriptionSource={transcription?.source ?? null}
        transcribeError={transcribeError}
        canOfflineFallback={!isSignedIn && !isTranscribing}
        onOfflineFallback={onOfflineFallback}
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

      {scanLeaveStage !== 'closed' && (
        <LeaveSessionModal
          stage={scanLeaveStage}
          isBusy={false}
          folderName={scanDiscardFolder}
          onFinishAndSave={onScanLeaveDismiss}
          onDiscard={onScanDiscard}
          onDiscardedOk={onScanDiscardedOk}
          onDismiss={onScanLeaveDismiss}
        />
      )}
    </>
  );
}
