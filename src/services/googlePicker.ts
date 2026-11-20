/**
 * Google Picker integration: lets the user choose any existing Google Doc
 * from their Drive. Selecting a file through the Picker also grants this app
 * `drive.file` access to that specific file, so we can later read/append to it.
 *
 * The Picker needs a Google API key (the "developer key"); provide it via
 * `VITE_GOOGLE_API_KEY`. When no key is configured, `isPickerConfigured()`
 * returns false and the UI can hide the "Browse Google Drive..." option.
 */

import type { TargetDoc } from './joltDocumentsService';

/** Response delivered to the Picker callback. */
interface PickerResponse {
  action: string;
  docs?: Array<{ id: string; name: string }>;
}

import { resolveClientId } from './clientIdStore';

const GAPI_SRC = 'https://apis.google.com/js/api.js';
const DOC_MIME = 'application/vnd.google-apps.document';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

const apiKey = (import.meta.env.VITE_GOOGLE_API_KEY ?? '').trim();

/**
 * The Google Cloud project NUMBER, set on the PickerBuilder via `setAppId` so a
 * Picker selection grants this app `drive.file` read/write access to the chosen
 * file — without it, reading a picked doc 403s. Prefer an explicit
 * `VITE_GOOGLE_APP_ID`; otherwise derive it from the OAuth client ID's numeric
 * prefix (`{projectNumber}-xxxx.apps.googleusercontent.com`). Empty string when
 * neither is available.
 */
const explicitAppId = (import.meta.env.VITE_GOOGLE_APP_ID ?? '').trim();
const appId = explicitAppId || resolveClientId().split('-')[0] || '';

/** True when an API key is configured, so the Picker can run. */
export function isPickerConfigured(): boolean {
  return Boolean(apiKey);
}

let pickerLoad: Promise<void> | null = null;

/** Load gapi + the Picker module once, reusing the promise thereafter. */
function loadPicker(): Promise<void> {
  if (pickerLoad) return pickerLoad;

  pickerLoad = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GAPI_SRC}"]`);
    const onReady = () => {
      window.gapi?.load('picker', { callback: () => resolve() });
    };
    if (window.gapi) {
      onReady();
      return;
    }
    const script = existing ?? document.createElement('script');
    script.src = GAPI_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener('load', onReady);
    script.addEventListener('error', () => reject(new Error('Failed to load Google Picker.')));
    if (!existing) document.head.appendChild(script);
  });

  return pickerLoad;
}

/**
 * Open the Picker filtered to Google Docs and resolve with the chosen doc,
 * or null if the user cancels. Requires a valid OAuth access token.
 */
export async function pickGoogleDoc(accessToken: string): Promise<TargetDoc | null> {
  if (!isPickerConfigured()) {
    throw new Error('Google Picker is not configured (missing VITE_GOOGLE_API_KEY).');
  }
  await loadPicker();

  const picker = window.google?.picker;
  if (!picker) throw new Error('Google Picker is unavailable.');

  return new Promise<TargetDoc | null>((resolve) => {
    const view = new picker.DocsView(picker.ViewId.DOCUMENTS).setMimeTypes(DOC_MIME);
    let builder = new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey);
    if (appId) builder = builder.setAppId(appId);
    const instance = builder
      .setCallback((data: PickerResponse) => {
        if (data.action === picker.Action.PICKED) {
          const doc = data.docs?.[0];
          resolve(doc ? { id: doc.id, name: doc.name } : null);
        } else if (data.action === picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    instance.setVisible(true);
  });
}

/**
 * Open the Picker filtered to Drive folders and resolve with the chosen
 * folder, or null if the user cancels. Requires a valid OAuth access token.
 */
export async function pickGoogleFolder(accessToken: string): Promise<TargetDoc | null> {
  if (!isPickerConfigured()) {
    throw new Error('Google Picker is not configured (missing VITE_GOOGLE_API_KEY).');
  }
  await loadPicker();

  const picker = window.google?.picker;
  if (!picker) throw new Error('Google Picker is unavailable.');

  return new Promise<TargetDoc | null>((resolve) => {
    const view = new picker.DocsView(picker.ViewId.FOLDERS)
      .setSelectFolderEnabled(true)
      .setMimeTypes(FOLDER_MIME);
    let builder = new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey);
    if (appId) builder = builder.setAppId(appId);
    const instance = builder
      .setCallback((data: PickerResponse) => {
        if (data.action === picker.Action.PICKED) {
          const folder = data.docs?.[0];
          resolve(folder ? { id: folder.id, name: folder.name } : null);
        } else if (data.action === picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    instance.setVisible(true);
  });
}
