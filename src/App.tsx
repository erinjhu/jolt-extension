import { useCallback, useState } from 'react';
import AuthStatusChip from './components/AuthStatusChip';
import BottomNav, { type AppTab } from './components/BottomNav';
import GoogleAuthPanel from './components/GoogleAuthPanel';
import PhotoUploadLanding from './components/PhotoUploadLanding';
import SessionForm from './components/SessionForm';
import SyncConfirmation from './components/SyncConfirmation';
import SyncResultBanner from './components/SyncResultBanner';
import TextEditor from './components/TextEditor';
import { syncSessionToDrive } from './services/syncSessionToDrive';
import {
  transcribeViaGoogleDrive,
  transcribeViaTesseract,
  type TranscriptionResult,
} from './services/transcription';
import { defaultSessionTitle } from './utils/sessionDefaults';
import { silentRefresh, type GoogleUser } from './services/googleAuth';
import { fetchDocumentText, type CreatedDoc } from './services/googleDocsService';
import type { TargetDoc } from './services/joltDocumentsService';
import type { JoltSessionPayload } from './types/session';

/**
 * Top-level flow: capture a note photo, transcribe it (Google Drive OCR when
 * signed in, Tesseract offline otherwise), then review and sync the session.
 */
export default function App() {
  const [flowKey, setFlowKey] = useState(0);
  const [imageBase64, setImageBase64] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<TargetDoc | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('scan');
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedDoc, setSyncedDoc] = useState<CreatedDoc | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const isSignedIn = Boolean(googleUser);

  /** Convert a data URL into a Blob for preprocessing / upload. */
  async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
    return (await fetch(dataUrl)).blob();
  }

  /** True when an error looks like an expired/invalid token (HTTP 401). */
  function isAuthError(err: unknown): boolean {
    return err instanceof Error && /\b401\b|unauthorized/i.test(err.message);
  }

  /**
   * Run a Drive operation, and if it fails with a 401, silently refresh the
   * token once and retry. Keeps the user signed in across token expiry.
   */
  async function withTokenRetry<T>(run: (token: string) => Promise<T>): Promise<T> {
    if (!googleUser) throw new Error('Sign in with Google above first.');
    try {
      return await run(googleUser.accessToken);
    } catch (err) {
      if (!isAuthError(err)) throw err;
      const refreshed = await silentRefresh();
      setGoogleUser(refreshed);
      return run(refreshed.accessToken);
    }
  }

  /** A document was chosen on the landing screen; reveal the bottom nav. */
  function handleSelectDoc(doc: TargetDoc) {
    setSelectedDoc(doc);
    setActiveTab('scan');
  }

  /** "Change Doc" — drop the current target and return to selection. */
  function handleClearDoc() {
    setSelectedDoc(null);
    setImageBase64('');
    setTranscription(null);
    setTranscribeError(null);
    setActiveTab('scan');
  }

  /**
   * Load the plain text of a document for the editor, refreshing the token
   * once on a 401. Memoized so TextEditor's effect only re-runs when the
   * target doc changes, not on every App render.
   */
  const loadDocumentText = useCallback(
    (fileId: string) => withTokenRetry((token) => fetchDocumentText(token, fileId)),
    // withTokenRetry closes over googleUser; re-create when the user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [googleUser],
  );

  async function handleImageSelected(dataUrl: string, doc: TargetDoc) {
    setImageBase64(dataUrl);
    setSelectedDoc(doc);
    setTranscription(null);
    setTranscribeError(null);
    setSyncedDoc(null);
    setSyncError(null);

    // Primary path: Google Drive OCR, only when signed in. Otherwise wait
    // for the user to trigger the explicit offline (Tesseract) fallback.
    if (!googleUser) return;

    setIsTranscribing(true);
    try {
      const blob = await dataUrlToBlob(dataUrl);
      const result = await withTokenRetry((token) =>
        transcribeViaGoogleDrive(token, blob, defaultSessionTitle()),
      );
      setTranscription(result);
    } catch (err) {
      setTranscribeError(
        err instanceof Error ? err.message : 'Google Drive transcription failed.',
      );
    } finally {
      setIsTranscribing(false);
    }
  }

  /** Retake from inside the form: reuse the already-selected target doc. */
  async function handleRetake(dataUrl: string) {
    if (selectedDoc) await handleImageSelected(dataUrl, selectedDoc);
  }

  /** Explicit offline fallback: run local Tesseract on the current image. */
  async function handleOfflineFallback() {
    if (!imageBase64) return;
    setIsTranscribing(true);
    setTranscribeError(null);
    try {
      setTranscription(await transcribeViaTesseract(imageBase64));
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : 'Offline OCR failed.');
    } finally {
      setIsTranscribing(false);
    }
  }

  /** Clear every piece of capture/transcription/sync state for a fresh start. */
  function resetFlow() {
    setImageBase64('');
    setSelectedDoc(null);
    setActiveTab('scan');
    setTranscription(null);
    setIsTranscribing(false);
    setTranscribeError(null);
    setSyncedDoc(null);
    setSyncError(null);
    // Bump the key so PhotoCapture (which holds its own preview state)
    // remounts clean, clearing the previous image preview.
    setFlowKey((k) => k + 1);
  }

  async function handleSyncToDrive(payload: JoltSessionPayload) {
    if (!googleUser) {
      setSyncError('Sign in with Google above before syncing.');
      return;
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncedDoc(null);
    try {
      const doc = await withTokenRetry((token) => syncSessionToDrive(token, payload));
      setSyncedDoc(doc);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync to Drive failed.');
    } finally {
      setIsSyncing(false);
    }
  }

  const isSynced = Boolean(syncedDoc);
  const hasImage = Boolean(imageBase64);
  // The bottom nav lives once a target doc is chosen, and is hidden on the
  // post-sync confirmation screen (which runs its own "add new session" flow).
  const showBottomNav = isSignedIn && Boolean(selectedDoc) && !isSynced;

  /** The Scan Photo feature: landing / capture / review-and-sync form. */
  function renderScanTab() {
    if (!hasImage) {
      // Step 1: choose a target document, then capture/upload a photo.
      return (
        <PhotoUploadLanding
          accessToken={googleUser!.accessToken}
          selectedDoc={selectedDoc}
          onSelectDoc={handleSelectDoc}
          onClearDoc={handleClearDoc}
          onImageSelected={handleImageSelected}
          disabled={isTranscribing}
        />
      );
    }
    // Step 2: the session form, populated from the captured photo's OCR.
    return (
      <>
        <SessionForm
          key={flowKey}
          initialDescription={transcription?.text ?? ''}
          imageBase64={imageBase64}
          documentName={selectedDoc?.name ?? ''}
          onImageSelected={handleRetake}
          onSyncToDrive={handleSyncToDrive}
          disabled={isTranscribing || isSyncing}
          isSignedIn={isSignedIn}
          isSyncing={isSyncing}
          isTranscribing={isTranscribing}
          transcriptionDocLink={transcription?.webViewLink ?? null}
          transcriptionSource={transcription?.source ?? null}
          transcribeError={transcribeError}
          canOfflineFallback={!isSignedIn && !isTranscribing}
          onOfflineFallback={handleOfflineFallback}
        />

        {isSyncing && (
          <p className="text-sm text-indigo-300" aria-live="polite">
            Creating your Google Doc in Drive…
          </p>
        )}

        {/* Only errors show here; success is handled by the confirmation view. */}
        {syncError && <SyncResultBanner doc={null} error={syncError} />}
      </>
    );
  }

  return (
    <>
      <main
        className={`mx-auto flex min-h-full max-w-xl flex-col gap-6 px-4 py-6 ${
          showBottomNav ? 'pb-24' : ''
        }`}
      >
        <header className="flex flex-col gap-1">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-white">Jolt Notes OCR</h1>
            <AuthStatusChip isSignedIn={isSignedIn} email={googleUser?.email ?? null} />
          </div>
          <p className="text-sm text-gray-400">
            Snap a handwritten note, review the text, and prepare it for Jolt.
          </p>
        </header>

        <GoogleAuthPanel onAuthChange={setGoogleUser} />

        {isSynced ? (
          <SyncConfirmation doc={syncedDoc} onAddNewSession={resetFlow} />
        ) : !isSignedIn ? (
          <p className="rounded-none border border-gray-300 bg-white px-6 py-10 text-center font-mono text-sm text-gray-500">
            Sign in with Google above to start a session.
          </p>
        ) : activeTab === 'editor' && selectedDoc ? (
          // Text Editor feature: distraction-free Google Doc editing.
          <TextEditor
            doc={selectedDoc}
            loadText={loadDocumentText}
            onChangeDoc={handleClearDoc}
          />
        ) : (
          renderScanTab()
        )}
      </main>

      {showBottomNav && <BottomNav active={activeTab} onChange={setActiveTab} />}
    </>
  );
}
