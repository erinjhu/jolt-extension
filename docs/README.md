# Jolt Extension — Developer Docs

**Jolt Extension** is a lightweight, **zero-database, client-side** web
companion for the Jolt Chrome extension. It lets you:

- Scan handwritten pages and extract their text.
- Draft in a distraction-free editor with live writing metrics.
- Sync sessions straight to your own **Google Drive / Google Docs**.

There is **no backend server and no external database**. The browser talks
directly to Google; the OAuth token stays in the browser (memory and
`localStorage`) and session data goes to your Drive. A **Guest Demo Mode** runs
the whole flow against an in-memory mock so visitors can try it with no Google
account.

## System at a glance

```
                         ┌───────────────────────────────┐
                         │        Browser client         │
                         │   (React + Vite, this app)    │
                         └───────────────┬───────────────┘
                                         │  OAuth token stays in browser
        ┌────────────────┬───────────────┼────────────────┬───────────────┐
        ▼                ▼               ▼                ▼               ▼
 Google Identity   Drive API +     Google Docs API   (no backend)   Guest Demo Mode
 Services (OAuth)  Drive Picker    documents.get /    — no server,   in-memory mock
 drive.file + docs pick/list docs  batchUpdate        no database    (guestDemoService)
```

Everything above the "no backend" line is a direct browser → Google call. The
app itself ships as static files (GitHub Pages).

## Table of contents

| Doc | What it covers |
| --- | --- |
| [auth-and-routing.md](auth-and-routing.md) | OAuth + Guest Mode init; `App.tsx` screen state machine and nav guards |
| [scan-and-editor-flows.md](scan-and-editor-flows.md) | Scan Mode pipeline; new-doc vs. append-only editor; writing metrics |
| [module-map.md](module-map.md) | File-by-file responsibilities across `src/` |
| [design-conventions.md](design-conventions.md) | Zero-backend, monochrome design, and file-size rules |
| [editor-mode-picker-bounce-bug.md](editor-mode-picker-bounce-bug.md) | Postmortem: the StrictMode home-bounce bug and its fix |

## Run it locally

```powershell
npm install
npm run dev     # http://localhost:5173/jolt-extension/
```


