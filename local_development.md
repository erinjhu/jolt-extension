## Local development

Run the web app:

```powershell
npm install
Copy-Item .env.example .env   # first time only; then fill in the values
npm run dev
```

Vite serves the app at `http://localhost:5173/jolt-extension/`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | For Google sign-in | OAuth client ID of type **Web application**. |
| `VITE_GOOGLE_API_KEY` | For picking from Drive | API key used by the Google Picker. |
| `VITE_GOOGLE_APP_ID` | No | Cloud project number. Derived from the client ID if unset. |

In the Google Cloud project, enable the **Drive**, **Docs** and **Picker** APIs,
and add `http://localhost:5173` to the client's **Authorized JavaScript
origins**. The demo works without any of this.

Check your changes with:

```powershell
npx tsc --noEmit
npm run build
```

## Chrome extension development

```powershell
cd extension
npm install
npm run build
```

Then open `chrome://extensions`, turn on **Developer mode**, click **Load
unpacked** and select `extension/dist`.

- **OAuth client:** the extension needs its own client of type **Chrome
  Extension**, tied to the extension ID, in a project with the Drive API
  enabled. To use a client other than the one in `manifest.json`, set
  `JOLT_OAUTH_CLIENT_ID` in `extension/.env` before building.
- **Extension ID:** the `key` field in `extension/manifest.json` gives unpacked
  builds the same ID as the Web Store item.
- **Store package:** bump `version` in `extension/manifest.json`, then run
  `npm run zip:store`. Upload `extension/jolt-autofill-store.zip`, which has
  `key` removed. Don't zip `extension/dist` by hand, as it still contains `key`.

## Deployment

Every push to `main` builds the web app and deploys it to GitHub Pages through
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Set
`VITE_GOOGLE_CLIENT_ID` and `VITE_GOOGLE_API_KEY` as repository variables under
**Settings → Secrets and variables → Actions → Variables**, and add the Pages
origin to the OAuth client's authorized origins.

The app is served under `/jolt-extension/`. Set `VITE_BASE` at build time to
change that.

## Testing on a phone with a Cloudflare tunnel

Your phone can't reach your computer's `localhost`, and the app needs HTTPS on
any other host. A Cloudflare quick tunnel provides a public HTTPS URL for free,
with no account.

### 1. Start the dev server

```powershell
npm run dev
```

### 2. Open the tunnel (in a second terminal)

```powershell
npx cloudflared tunnel --url http://localhost:5173
```

On your phone, open the printed URL with the base path added:

```
https://<random-words>.trycloudflare.com/jolt-extension/
```

The hostname changes every time you restart `cloudflared`. Google sign-in only
works from an authorized origin, so either add the current tunnel URL to the
OAuth client's **Authorized JavaScript origins** or test with **Try Interactive
Demo**.

Press `Ctrl+C` in each terminal when you're done.

### Vite host allow-list

Vite rejects requests from hosts it doesn't recognize.
[`vite.config.ts`](vite.config.ts) already allows quick tunnels:

```ts
server: {
  host: true,
  allowedHosts: ['.trycloudflare.com'],
},
```

Entries are bare hostnames with no `https://`, and a leading dot matches every
subdomain. Add your own hostname to the array if you use a custom domain.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Blocked request. This host is not allowed.` | Add the bare hostname (no `https://`) to `server.allowedHosts`. |
| Phone can't load the page | Check that `npm run dev` and `cloudflared` are both still running. |
| Google sign-in fails with `origin_mismatch` | Add the exact origin you're on to the OAuth client's authorized origins. |
| `Google Picker is not configured` | Set `VITE_GOOGLE_API_KEY` and restart the dev server. |
| Extension shows no sessions | Sync a session from the web app first, using the same Google account, then click **Refresh Sessions**. |
| Extension asks for Drive access | Click **Grant Drive Access** and check the Drive box on Google's screen. |
| Extension can't fill the form | Make a `writewithjolt.com` tab active, reload it and try again. |
