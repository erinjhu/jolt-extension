# Codebase Module Map

Where things live in `src/` and what each file owns (single responsibility).

## Top level

| Path | Responsibility |
| --- | --- |
| `App.tsx` | Root orchestrator: screen state machine, render gate, wires handlers to views. |
| `main.tsx` | React entry; mounts `<App>` in `<StrictMode>`. |
| `content/` | `privacy.md` / `terms.md` source for the public legal pages. |
| `context/` | Shares the token-retrying runner and Drive-permission state. |
| `data/` | Static seed data (e.g. preset document list). |
| `types/` | Shared TS types (e.g. the Jolt session payload). |
| `utils/` | Helpers: word counts, duration, image prep, Markdown rendering. |

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
| `scanProgress.ts` | Milestones behind the scan and doc-creation progress bars. |
| `authErrors.ts` | Classify expired-session and missing-Drive-scope responses. |
| `guestDemoService.ts` | In-memory mock of the whole Drive/Docs layer for Guest Mode. |

## Hooks (`src/hooks/`)

| File | Responsibility |
| --- | --- |
| `useGoogleAuth.ts` | Owns auth state; restores session on mount. |
| `useTokenRetry.ts` | Runs Drive/Docs calls with a live token + silent 401 refresh. |
| `useDocumentSync.ts` | One interface for load/save/append/folder (real + guest). |
| `useGuestMode.ts` | Guest flags + enter/exit transitions. |
| `useWritingSession.ts` | Live timers, word count, Drafting/Editing, WPH. |
| `useHashRoute.ts` | Minimal hash router (`#/privacy`, `#/terms`, `#/docs`). |
| `useAuthExpiry.ts` | Tracks whether the current token was found to be expired. |
| `useDriveScopeGate.ts` | Blocks Drive actions until the permission is granted. |
| `useScanProgress.ts` | Subscribes a component to `scanProgress.ts`. |

## Components (`src/components/`)

| File | Responsibility |
| --- | --- |
| `SignInScreen` · `ModeSelectionLanding` | Unauthenticated + mode-choice screens. |
| `AppTopBar` · `AppHeader` · `GuestBadge` | Header (clickable logo → home, profile / demo). |
| `ScanTabView` · `PhotoUploadLanding` · `DocumentSelector` | Scan view, target doc + image. |
| `ScanProgress` · `StageProgressBar` · `TranscriptionStatus` | OCR/sync progress + status. |
| `SessionForm` · `SessionLoggingView` · `PhotoCapture` | "Add Manual Session" form, photo retake. |
| `TextEditor` · `ExistingDocContext` · `EditorStatsBar` | Editor, read-only context, live stats. |
| `LeaveSessionModal` · `DemoDocPreview` · `SyncConfirmation` | Leave guard, demo preview, post-sync. |
| `AuthExpiryBoundary` · `DriveAccessCard` | Session-expired modal, Drive permission prompt. |
| `SyncResultBanner` · `ProfileAvatar` | Sync errors, account picture. |
| `jolt/` · `legal/` · `docs/` | Form controls and logo, legal pages, docs viewer. |

