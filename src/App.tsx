import { useCallback, useState } from 'react';
import AppHeader from './components/AppHeader';
import type { AppTab } from './components/ModeToggle';
import ModeSelectionLanding from './components/ModeSelectionLanding';
import PhotoUploadLanding from './components/PhotoUploadLanding';
import SessionForm from './components/SessionForm';
import SignInScreen from './components/SignInScreen';
import SyncConfirmation from './components/SyncConfirmation';
import SyncResultBanner from './components/SyncResultBanner';
import TextEditor from './components/TextEditor';
import { syncSessionToDrive } from './services/syncSessionToDrive';
import {
  transcribeViaGoogleDrive,
  transcribeViaTesseract,
  type TranscriptionResult,
} from './services/transcription';
import { useGoogleAuth } from './hooks/useGoogleAuth';
import { defaultSessionTitle } from './utils/sessionDefaults';
import { silentRefresh } from './services/googleAuth';
import {
  fetchDocumentFolderName,
  fetchDocumentText,
  saveDocumentText,
  type CreatedDoc,
} from './services/googleDocsService';
import type { WritingSessionMetrics } from './hooks/useWritingSession';
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
  // False until the user picks SCAN or EDITOR on the post-sign-in landing.
  const [hasChosenInitialMode, setHasChosenInitialMode] = useState(false);
  const [transcription, setTranscription] = useState<TranscriptionResult | null>(null);
  // When set, the user finished a TEXT EDITOR session: the ADD MANUAL SESSION
  // form opens inside the EDITOR view, seeded with the written text and the
  // tracked writing analytics (no photo involved, EDITOR stays highlighted).
  const [editorSession, setEditorSession] = useState<{
    text: string;
    metrics: WritingSessionMetrics;
  } | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const {
    user: googleUser,
    isRestoring,
    isBusy: isAuthBusy,
    error: authError,
    signIn,
    signOut,
    switchAccount,
    setUser: setGoogleUser,
  } = useGoogleAuth();
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

  /** A document was chosen; open whichever tab is active in the bottom nav. */
  function handleSelectDoc(doc: TargetDoc) {
    setSelectedDoc(doc);
  }

  /** "Change Doc" — drop the current target and return to selection. */
  function handleClearDoc() {
    setSelectedDoc(null);
    setImageBase64('');
    setTranscription(null);
    setTranscribeError(null);
    setEditorSession(null);
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

  /** Save editor text back to the Google Doc, token-retrying on a 401. */
  const saveDocumentTextFn = useCallback(
    (fileId: string, newText: string) =>
      withTokenRetry((token) => saveDocumentText(token, fileId, newText)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [googleUser],
  );

  /** Resolve the document's Drive folder name, token-retrying on a 401. */
  const loadDocumentFolderName = useCallback(
    (fileId: string) => withTokenRetry((token) => fetchDocumentFolderName(token, fileId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [googleUser],
  );

  /**
   * Finish a TEXT EDITOR session: the editor has already paused its timer and
   * forced a final save. Swap the editor view for the ADD MANUAL SESSION form
   * (seeded with the written text + tracked analytics) WITHOUT changing the
   * active mode, so the header toggle stays on EDITOR.
   */
  function handleFinishSession(summary: { metrics: WritingSessionMetrics; text: string }) {
    setEditorSession({ text: summary.text, metrics: summary.metrics });
  }

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
    setTranscription(null);
    setEditorSession(null);
    setIsTranscribing(false);
    setTranscribeError(null);
    setSyncedDoc(null);
    setSyncError(null);
    // Bump the key so PhotoCapture (which holds its own preview state)
    // remounts clean, clearing the previous image preview.
    setFlowKey((k) => k + 1);
  }

  /** Landing card clicked: set the mode and proceed to document selection. */
  function handleChooseInitialMode(mode: AppTab) {
    setActiveTab(mode);
    setHasChosenInitialMode(true);
  }

  /** Back from the session form: clear the flow and return to the landing. */
  function handleBackToModes() {
    resetFlow();
    setHasChosenInitialMode(false);
  }

  /** Sign out and make the next sign-in start at the mode landing again. */
  function handleSignOut() {
    setHasChosenInitialMode(false);
    void signOut();
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

  // Strict auth gate. Nothing else renders until there is a valid session.
  if (isRestoring) {
    // Blank white screen while a stored session is restored, so signed-in
    // users don't see the sign-in screen flash on reload.
    return <div className="min-h-dvh w-full bg-[#FFFFFF]" aria-busy="true" />;
  }
  if (!googleUser) {
    return <SignInScreen isBusy={isAuthBusy} error={authError} onSignIn={() => void signIn()} />;
  }

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
          documentId={transcription?.docId ?? selectedDoc?.id}
          loadFolderName={loadDocumentFolderName}
          onBack={handleBackToModes}
          onImageSelected={handleRetake}
          onSyncToDrive={handleSyncToDrive}
          disabled={isTranscribing || isSyncing}
          isSignedIn={isSignedIn}
          isSyncing={isSyncing}
          isTranscribing={isTranscribing}
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

  /**
   * EDITOR view after FINISH SESSION: the ADD MANUAL SESSION form seeded with
   * the written text and tracked analytics. Rendered in place of TextEditor
   * while `editorSession` is set, so the header toggle stays on EDITOR.
   */
  function renderEditorFinishedForm() {
    if (!editorSession) return null;
    return (
      <>
        <SessionForm
          key={flowKey}
          initialDescription={editorSession.text}
          imageBase64=""
          documentName={selectedDoc?.name ?? ''}
          documentId={selectedDoc?.id}
          sessionMetrics={editorSession.metrics}
          onBack={handleBackToModes}
          onImageSelected={handleRetake}
          onSyncToDrive={handleSyncToDrive}
          disabled={isSyncing}
          isSignedIn={isSignedIn}
          isSyncing={isSyncing}
        />

        {isSyncing && (
          <p className="text-sm text-indigo-300" aria-live="polite">
            Creating your Google Doc in Drive…
          </p>
        )}
        {syncError && <SyncResultBanner doc={null} error={syncError} />}
      </>
    );
  }

  return (
    <>
      <AppHeader
        user={googleUser}
        isBusy={isAuthBusy}
        error={authError}
        onSignOut={handleSignOut}
        onSwitchAccount={switchAccount}
      />
      <main className="mx-auto flex min-h-full max-w-xl flex-col gap-6 px-4 py-6">
        {!hasChosenInitialMode ? (
          <ModeSelectionLanding onChoose={handleChooseInitialMode} />
        ) : isSynced ? (
          <SyncConfirmation doc={syncedDoc} onStartNewSession={resetFlow} />
        ) : selectedDoc ? (
          // Both features stay mounted once a doc is selected so switching
          // tabs never resets the live writing session; only one is shown.
          <>
            <div className={activeTab === 'scan' ? 'flex flex-col gap-6' : 'hidden'}>
              {renderScanTab()}
            </div>
            <div className={activeTab === 'editor' ? 'contents' : 'hidden'}>
              {editorSession ? (
                // Finished session: the editor already forced its final save
                // before handing off, so swap it for the logging form here.
                renderEditorFinishedForm()
              ) : (
                <TextEditor
                  doc={selectedDoc}
                  loadText={loadDocumentText}
                  saveText={saveDocumentTextFn}
                  loadFolderName={loadDocumentFolderName}
                  isActive={activeTab === 'editor'}
                  onChangeDoc={handleClearDoc}
                  onBack={handleBackToModes}
                  onFinish={handleFinishSession}
                />
              )}
            </div>
          </>
        ) : (
          // No target doc yet: show the document-selection landing.
          <>
            <button
              type="button"
              onClick={() => setHasChosenInitialMode(false)}
              className="self-start font-mono text-xs text-[#111111] underline underline-offset-4 hover:text-black"
            >
              ← Back
            </button>
            {renderScanTab()}
          </>
        )}
      </main>
    </>
  );
}
