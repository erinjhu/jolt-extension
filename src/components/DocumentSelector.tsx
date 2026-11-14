import { useEffect, useState } from 'react';
import {
  createTargetDoc,
  getDefaultFolder,
  listRecentDocs,
  type TargetDoc,
} from '../services/joltDocumentsService';
import { isPickerConfigured, pickGoogleDoc, pickGoogleFolder } from '../services/googlePicker';
import { joltSingleLineClass } from './jolt/JoltField';

interface DocumentSelectorProps {
  accessToken: string;
  selectedDoc: TargetDoc | null;
  onSelect: (doc: TargetDoc) => void;
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
}: DocumentSelectorProps) {
  const [docs, setDocs] = useState<TargetDoc[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [destFolder, setDestFolder] = useState<TargetDoc | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listRecentDocs(accessToken)
      .then((list) => !cancelled && setDocs(list))
      .catch(() => !cancelled && setError('Could not load your documents.'));
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  /** Open the create flow, defaulting the destination folder to JoltSync. */
  async function startCreating() {
    setIsCreating(true);
    if (!destFolder) {
      try {
        setDestFolder(await getDefaultFolder(accessToken));
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
      const folder = await pickGoogleFolder(accessToken);
      if (folder) setDestFolder(folder);
    } catch {
      setError('Could not open the folder picker.');
    }
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createTargetDoc(accessToken, newTitle, destFolder?.id);
      const doc = { id: created.id, name: created.name };
      setDocs((prev) => [doc, ...prev]);
      onSelect(doc);
      setIsCreating(false);
      setNewTitle('');
    } catch {
      setError('Could not create the document.');
    } finally {
      setBusy(false);
    }
  }

  async function handleBrowse() {
    setError(null);
    if (!isPickerConfigured()) {
      setError('Google Picker is not configured (missing API key).');
      return;
    }
    try {
      const picked = await pickGoogleDoc(accessToken);
      if (picked) {
        setDocs((prev) => [picked, ...prev.filter((d) => d.id !== picked.id)]);
        onSelect(picked);
      }
    } catch {
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
          />

          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-xs text-gray-500">
              Folder: {destFolder?.name ?? 'JoltSync'}
            </span>
            <button
              type="button"
              onClick={() => void handleChooseFolder()}
              className="whitespace-nowrap rounded-none border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-black transition hover:bg-gray-100"
            >
              Choose Folder…
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={busy || !newTitle.trim()}
              className="whitespace-nowrap rounded-none bg-black px-4 py-1.5 text-xs font-bold uppercase text-white disabled:opacity-40"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="whitespace-nowrap rounded-none border border-gray-300 bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-black hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
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
          <button
            type="button"
            onClick={() => void handleBrowse()}
            className="rounded-none border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-black transition hover:bg-gray-100"
          >
            Select a Doc from Drive
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
