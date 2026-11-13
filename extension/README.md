# Jolt Autofill — Chrome Extension (Manifest V3)

Reads the latest `JoltSessionPayload` your app syncs to Google Drive
(`JoltSync/latest_jolt_session.json`) and autofills the Jolt
**Add Manual Session** form at `https://writewithjolt.com/*`.

## What it does

1. **Sync from Drive** — authenticates with `chrome.identity.getAuthToken`
   (OAuth scope `drive.file`), finds your `JoltSync` folder, downloads
   `latest_jolt_session.json`, validates it, and caches it in
   `chrome.storage.local`.
2. **Autofill Jolt Form** — on an open `writewithjolt.com` tab, fills the
   title, description, hours/minutes, and document dropdown, and injects the
   note image into Jolt's file input via the `DataTransfer` API. Synthetic
   `input`/`change` events are dispatched so React registers the changes.

## File layout

```
extension/
├─ manifest.json          # MV3 manifest (identity, storage, host perms)
├─ popup.html             # Popup UI
├─ src/
│  ├─ background.ts       # Service worker: OAuth + Drive, message router
│  ├─ driveFetcher.ts     # Drive folder/file lookup, download, validate, cache
│  ├─ auth.ts             # getAuthToken wrapper
│  ├─ content.ts          # Jolt DOM injector (defensive selectors)
│  ├─ popup.ts            # Popup controller (UI only)
│  └─ types.ts            # Shared session + message contracts
└─ public/icons/          # Extension icons (generated)
```

## Prerequisites

- Node.js 18+ and npm (tested on Node 22).
- A Google Cloud OAuth 2.0 **Chrome App** client id with the Drive API enabled.

## 1. Configure the OAuth client id

1. In the [Google Cloud Console](https://console.cloud.google.com/), create a
   project and enable the **Google Drive API**.
2. Create an **OAuth client ID** of type **Chrome Extension** (you'll need the
   extension id after loading it unpacked once — load it, copy the id from
   `chrome://extensions`, then add it to the client).
3. Copy the client id into `manifest.json` → `oauth2.client_id`, replacing
   `REPLACE_WITH_YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com`.

## 2. Build (Windows / PowerShell)

```powershell
cd extension
npm install
npm run build
```

The compiled, unpacked extension is written to `extension\dist\`, containing
`manifest.json`, `background.js`, `content.js`, `popup.html` / `popup.js`, and
the `icons\` folder.

## 3. Load unpacked in Chrome

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top-right) on.
3. Click **Load unpacked** and select the `extension\dist` folder.
4. Copy the extension **ID** and, if you haven't already, add it to your OAuth
   Chrome Extension client in Google Cloud, then reload the extension.

## 4. Use it

1. Make sure your app has synced a session to
   `Google Drive / JoltSync / latest_jolt_session.json`.
2. Click the extension icon → **Sync from Drive** (approve the Google consent
   screen the first time). The popup shows the session title and duration.
3. On `https://writewithjolt.com`, open the **Add Manual Session** modal.
4. Click **Autofill Jolt Form**. The popup reports which fields were filled.

## Permissions rationale

- `host_permissions` is limited to `https://writewithjolt.com/*` (autofill
  target) and `https://www.googleapis.com/*` (Drive API) only.
- The content script matches `https://writewithjolt.com/*` only.
- `identity` + the `drive.file` scope grant access only to files this app
  created/opened — not your whole Drive.

## Troubleshooting

- **"Could not find a JoltSync folder"** — confirm your app wrote the folder
  and file, and that you authorized with the same Google account.
- **"Could not find any Jolt form fields"** — open the *Add Manual Session*
  modal before clicking Autofill; the content script only fills visible fields.
- **Auth errors after revoking access** — the extension clears the cached
  token on a 401 and re-prompts on the next sync.
