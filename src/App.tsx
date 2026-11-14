import { useState } from 'react';
import AuthStatusChip from './components/AuthStatusChip';
import GoogleAuthPanel from './components/GoogleAuthPanel';
import PhotoCapture from './components/PhotoCapture';
import SessionForm from './components/SessionForm';
import SyncResultBanner from './components/SyncResultBanner';
import { recognizeHandwriting } from './services/ocrService';
import { syncSessionToDrive } from './services/syncSessionToDrive';
import type { GoogleUser } from './services/googleAuth';
import type { CreatedDoc } from './services/googleDocsService';
import type { JoltSessionPayload, OcrResult } from './types/session';

/**
 * Top-level flow: capture a note photo, run local OCR, then review and
 * assemble a session payload for Jolt.
 */
export default function App() {
  const [imageBase64, setImageBase64] = useState('');
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncedDoc, setSyncedDoc] = useState<CreatedDoc | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const isSignedIn = Boolean(googleUser);

  async function handleImageSelected(dataUrl: string) {
    setImageBase64(dataUrl);
    setOcrResult(null);
    setIsProcessing(true);
    try {
      const result = await recognizeHandwriting(dataUrl);
      setOcrResult(result);
    } finally {
      setIsProcessing(false);
    }
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
      const doc = await syncSessionToDrive(googleUser.accessToken, payload);
      setSyncedDoc(doc);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync to Drive failed.');
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col gap-6 px-4 py-6">
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

      <PhotoCapture onImageSelected={handleImageSelected} disabled={isProcessing} />

      {isProcessing && (
        <p className="text-sm text-indigo-300" aria-live="polite">
          Reading your note…
        </p>
      )}

      {ocrResult && (
        <>
          <p className="text-xs text-gray-500">
            OCR confidence: {ocrResult.confidence}% · {ocrResult.processingTimeMs}ms
          </p>
          <SessionForm
            key={imageBase64}
            initialDescription={ocrResult.text}
            imageBase64={imageBase64}
            onSyncToDrive={handleSyncToDrive}
            disabled={isProcessing || isSyncing}
            isSignedIn={isSignedIn}
            isSyncing={isSyncing}
          />

          {isSyncing && (
            <p className="text-sm text-indigo-300" aria-live="polite">
              Creating your Google Doc in Drive…
            </p>
          )}

          <SyncResultBanner doc={syncedDoc} error={syncError} />
        </>
      )}
    </main>
  );
}
