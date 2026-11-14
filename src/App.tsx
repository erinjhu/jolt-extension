import { useState } from 'react';
import AuthStatusChip from './components/AuthStatusChip';
import GoogleAuthPanel from './components/GoogleAuthPanel';
import PhotoCapture from './components/PhotoCapture';
import SessionForm from './components/SessionForm';
import { recognizeHandwriting } from './services/ocrService';
import type { GoogleUser } from './services/googleAuth';
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

  function handleSyncToDrive(payload: JoltSessionPayload) {
    // Placeholder: Agent 2 will implement the real Jolt/Drive sync.
    console.log('Session payload ready for sync:', payload);
  }

  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-bold text-white">Jolt Notes OCR</h1>
          <AuthStatusChip email={googleUser?.email ?? null} />
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
            disabled={isProcessing}
            isSignedIn={isSignedIn}
          />
        </>
      )}
    </main>
  );
}
