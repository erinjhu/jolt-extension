# Codebase Module Map

Where things live in `src/` and what each file owns (single responsibility).

## Top level

| Path | Responsibility |
| --- | --- |
| `App.tsx` | Root orchestrator: screen state machine, render gate, wires handlers to views. |
| `main.tsx` | React entry; mounts `<App>` in `<StrictMode>`. |
| `content/` | `privacy.md` / `terms.md` source for the public legal pages. |
| `data/` | Static seed data (e.g. preset document list). |
| `types/` | Shared TS types (e.g. the Jolt session payload). |
| `utils/` | Pure helpers: text/word counting, duration, image preprocessing. |

## Services (`src/services/`) — all external I/O

| File | Responsibility |
| --- | --- |
| `googleAuth.ts` | OAuth scopes, sign-in/refresh, token → profile, session persistence. |
| `authStorage.ts` | Read/write/validate the stored session in `localStorage`. |
| `clientIdStore.ts` | Resolve the OAuth client ID from env. |
| `googlePicker.ts` | Google Drive Picker (pick a doc/folder); sets `appId` for `drive.file`. |
| `driveFolderService.ts` | Ensure the `JoltSync` Drive folder exists. |
| `joltDocumentsService.ts` | List/create target docs; defines `TargetDoc` (`isNew`). |
| `googleDocsService.ts` | Read (`documents.get`/export), overwrite, and append doc text. |
| `syncSessionToDrive.ts` | Assemble + write a session doc/file to Drive. |
| `sessionFileService.ts` | The machine-readable session JSON the extension reads. |
| `transcription.ts` / `ocrService.ts` | Drive OCR + local Tesseract text extraction. |
| `textCleanup.ts` | Normalize/clean extracted text. |
| `guestDemoService.ts` | In-memory mock of the whole Drive/Docs layer for Guest Mode. |

## Hooks (`src/hooks/`)

| File | Responsibility |
| --- | --- |
| `useGoogleAuth.ts` | Owns auth state; restores session on mount. |
| `useTokenRetry.ts` | Runs Drive/Docs calls with a live token + silent 401 refresh. |
| `useDocumentSync.ts` | One interface for load/save/append/folder (real + guest). |
| `useGuestMode.ts` | Guest flags + enter/exit transitions. |
| `useWritingSession.ts` | Live timers, word count, Drafting/Editing, WPH. |
| `useHashRoute.ts` | Minimal `#/privacy` · `#/terms` hash router. |

## Components (`src/components/`)

| File | Responsibility |
| --- | --- |
| `SignInScreen` · `ModeSelectionLanding` | Unauthenticated + mode-choice screens. |
| `AppTopBar` · `AppHeader` · `GuestBadge` | Header (clickable logo → home, profile / demo). |
| `PhotoUploadLanding` · `DocumentSelector` · `PhotoCapture` | Scan step 1: target doc + image. |
| `ScanProgress` · `TranscriptionStatus` | OCR/sync progress + status. |
| `SessionForm` · `SessionLoggingView` | "Add Manual Session" review/sync form. |
| `TextEditor` · `ExistingDocContext` · `EditorStatsBar` | Editor, read-only context, live stats. |
| `LeaveSessionModal` · `DemoDocPreview` · `SyncConfirmation` | Leave guard, demo preview, post-sync. |

---

Prev ← [Scan & Editor Flows](scan-and-editor-flows.md) · Next → [Design Conventions](design-conventions.md)
