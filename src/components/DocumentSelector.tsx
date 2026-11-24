import { useEffect, useState } from 'react';
import {
  createTargetDoc,
  getDefaultFolder,
  listRecentDocs,
  type TargetDoc,
} from '../services/joltDocumentsService';
import {
  guestCreateDoc,
  guestDefaultFolder,
  guestListDocs,
} from '../services/guestDemoService';
import { AuthExpiredError } from '../services/authErrors';
import { useAuthRunner } from '../context/AuthRunnerContext';
import { isUserCancellation } from '../services/googleAuth';
import { isPickerConfigured, pickGoogleDoc, pickGoogleFolder } from '../services/googlePicker';
import { CREATE_DOC_STAGES, type ScanProgressState } from '../services/scanProgress';
import { joltSingleLineClass } from './jolt/JoltField';
import StageProgressBar from './StageProgressBar';

/** How long 100% / "Ready" stays visible before the new doc is selected. */
const READY_HOLD_MS = 250;

interface DocumentSelectorProps {
  accessToken: string;
  selectedDoc: TargetDoc | null;
  onSelect: (doc: TargetDoc) => void;
  /** In guest demo mode, use the in-memory mock workspace (no network). */
  isGuest?: boolean;
}

/**
 * Build a clean, human-readable title from the current local date and time,
 * e.g. "Nov 16, 2026, 8:58 PM", using the user's local timezone.
 */
function buildDefaultDocTitle(): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date());
}

/**
 * Target Document selector for the landing card: a recent-docs dropdown, an
 * inline "+ Create New Doc" flow, and a "Browse Google Drive..." Picker
 * button. The chosen doc is reported up so photo capture can be gated on it.
 */
export default function DocumentSelector({
  accessToken,
  selectedDoc,
  onSelect,
  isGuest = false,
}: DocumentSelectorProps) {
  const [docs, setDocs] = useState<TargetDoc[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [destFolder, setDestFolder] = useState<TargetDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ScanProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Runs Drive calls with silent refresh; an expired session raises the
  // app-level "Session expired" modal instead of an inline error here.
  const runWithAuth = useAuthRunner(accessToken);

  useEffect(() => {
    if (isGuest) {
      setDocs(guestListDocs());
      return;
    }
    let cancelled = false;
    runWithAuth((token) => listRecentDocs(token))
      .then((list) => !cancelled && setDocs(list))
      .catch((err) => {
        if (cancelled || err instanceof AuthExpiredError) return;
        setError('Could not load your documents.');
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, isGuest, runWithAuth]);

  /** Open the create flow, defaulting the destination folder to JoltSync. */
  async function startCreating() {
    setIsCreating(true);
    setNewTitle(buildDefaultDocTitle());
    if (!destFolder) {
      if (isGuest) {
        setDestFolder(guestDefaultFolder());
        return;
      }
      try {
        setDestFolder(await runWithAuth((token) => getDefaultFolder(token)));
      } catch {
        // Non-fatal: create still works, falling back to JoltSync server-side.
      }
    }
  }

  async function handleChooseFolder() {
    setError(null);
    if (!isPickerConfigured()) {
      setError('Google Picker is not configured (missing API key).');
      return;
    }
    try {
      const folder = await runWithAuth((token) => pickGoogleFolder(token));
      if (folder) setDestFolder(folder);
    } catch (err) {
      if (isUserCancellation(err)) return;
      setError('Could not open the folder picker.');
    }
  }

  async function handleCreate() {
    if (busy) return; // ignore rapid double-clicks while a doc is being made
    const title = newTitle.trim() || buildDefaultDocTitle();
    setBusy(true);
    setError(null);
    setProgress(CREATE_DOC_STAGES.resolving);
    try {
      let created: { id: string; name: string };
      if (isGuest) {
        setProgress(CREATE_DOC_STAGES.creating);
        created = guestCreateDoc(title);
        setProgress(CREATE_DOC_STAGES.ready);
      } else {
        created = await runWithAuth((token) =>
          createTargetDoc(token, title, destFolder?.id, setProgress),
        );
      }
      // Briefly hold on 100% before handing over to the created-doc state.
      await new Promise<void>((resolve) => window.setTimeout(resolve, READY_HOLD_MS));
      const listed = { id: created.id, name: created.name };
      setDocs((prev) => [listed, ...prev]);
      // Flag as new ONLY for this immediate selection, so it opens the full
      // editor; if picked again later from the list it counts as existing.
      onSelect({ ...listed, isNew: true });
      setIsCreating(false);
      setNewTitle('');
    } catch (err) {
      if (!(err instanceof AuthExpiredError)) setError('Could not create the document.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function handleBrowse() {
    setError(null);
    if (!isPickerConfigured()) {
      setError('Google Picker is not configured (missing API key).');
      return;
    }
    try {
      const picked = await runWithAuth((token) => pickGoogleDoc(token));
      if (picked) {
        setDocs((prev) => [picked, ...prev.filter((d) => d.id !== picked.id)]);
        onSelect(picked);
      }
    } catch (err) {
      if (isUserCancellation(err)) return;
      setError('Could not open the Google Picker.');
    }
  }

  return (
    <div className="flex w-full flex-col gap-2 text-left">
      <span className="text-xs font-bold uppercase tracking-wide text-black">Target Document</span>

      <select
        value={selectedDoc?.id ?? ''}
        onChange={(e) => {
          const doc = docs.find((d) => d.id === e.target.value);
          if (doc) onSelect(doc);
        }}
        className={joltSingleLineClass}
      >
        <option value="" disabled>
          Select a recent document…
        </option>
        {docs.map((doc) => (
          <option key={doc.id} value={doc.id}>
            {doc.name}
          </option>
        ))}
      </select>

      {isCreating ? (
        <div className="flex flex-col gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New document title"
            className={`${joltSingleLineClass} font-mono`}
            autoFocus
            disabled={busy}
          />

          {!isGuest && (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-xs text-gray-500">
                Folder: {destFolder?.name ?? 'JoltSync'}
              </span>
              <button
                type="button"
                onClick={() => void handleChooseFolder()}
                disabled={busy}
                className="whitespace-nowrap rounded-none border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-black transition hover:bg-gray-100 disabled:opacity-40"
              >
                Choose Folder…
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={busy}
              className="whitespace-nowrap rounded-none bg-black px-4 py-1.5 text-xs font-bold uppercase text-white disabled:opacity-40"
            >
              {busy ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              disabled={busy}
              className="whitespace-nowrap rounded-none border border-gray-300 bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-black hover:bg-gray-100 disabled:opacity-40"
            >
              Cancel
            </button>
          </div>

          {progress && <StageProgressBar progress={progress} />}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void startCreating()}
            className="rounded-none border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-black transition hover:bg-gray-100"
          >
            + Create New Doc
          </button>
          {!isGuest && (
            <button
              type="button"
              onClick={() => void handleBrowse()}
              className="rounded-none border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-black transition hover:bg-gray-100"
            >
              Select a Doc from Drive
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
