import { useState } from 'react';
import { getStoredClientId, setStoredClientId } from '../services/clientIdStore';

/**
 * Expandable panel for pasting a Google OAuth client ID at runtime. The value
 * is saved to localStorage so a client ID can be tested without a rebuild.
 */
interface ClientIdConfigProps {
  /** Called after the stored client ID changes so the parent can re-check it. */
  onClientIdChange: () => void;
}

export default function ClientIdConfig({ onClientIdChange }: ClientIdConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState(getStoredClientId);

  function handleSave() {
    setStoredClientId(value);
    onClientIdChange();
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="self-start text-xs font-medium text-gray-400 underline-offset-2 hover:text-indigo-300 hover:underline"
      >
        {isOpen ? 'Hide client ID settings' : 'Configure Client ID'}
      </button>

      {isOpen && (
        <div className="flex flex-col gap-2 rounded-lg border border-gray-700 bg-gray-800 p-3">
          <label htmlFor="client-id-input" className="text-xs text-gray-400">
            Overrides VITE_GOOGLE_CLIENT_ID. Leave blank to use the build value.
          </label>
          <input
            id="client-id-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="xxxxx.apps.googleusercontent.com"
            className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-indigo-400"
          />
          <button
            type="button"
            onClick={handleSave}
            className="self-start rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-100 hover:bg-gray-600"
          >
            Save client ID
          </button>
        </div>
      )}
    </div>
  );
}
