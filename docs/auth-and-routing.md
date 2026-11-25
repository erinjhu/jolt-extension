# Auth, Guest Mode & Screen State Machine

## Sign-in (no backend)

- **Google OAuth** via Google Identity Services. Scopes requested
  (`services/googleAuth.ts`):
  - `drive.file` — read/write only files this app created or you picked.
  - `documents` — read/append picked Google Docs via the Docs API.
  - `userinfo.email` / `userinfo.profile` — show your account.
- The access token lives in memory + `localStorage` (`services/authStorage.ts`)
  so a reload restores the session; it is never sent to any server of ours.
  - `hooks/useGoogleAuth.ts` owns `{ user, isRestoring, signIn, signOut, ... }`
  and restores the session on mount.
  - `hooks/useTokenRetry.ts` wraps every Drive/Docs call: it reads the live token
  from a ref and silently refreshes on a 401-style error, so a stale/empty
  token never reaches the network.
- An expired stored token is dropped on load rather than refreshed, so no Google
  popup opens by itself. If a session expires mid-use and can't be refreshed,
  `AuthExpiryBoundary` shows a "Session expired" modal and keeps the app state.
- If the Drive permission box was left unchecked, `DriveAccessCard` offers to
  re-run consent (`useDriveScopeGate.ts`).

## Guest Demo Mode

- `services/guestDemoService.ts` is an **in-memory mock** of the Drive/Docs
  layer: seeded sample docs and create/load/save/append, with nothing persisted
  past the tab. Scans run real Tesseract OCR in the browser, falling back to
  sample text if nothing readable comes out.
- `hooks/useGuestMode.ts` + a synthetic `GUEST_USER` satisfy the auth gate, so
  the full Scan + Editor flow works with no Google account.

## Screen state machine (`App.tsx`)

```
 SignIn ──sign in / Try Demo──▶ Mode Selection ──pick──▶ Active Session ──sync──▶ Post-Sync
 screen                         [SCAN | EDITOR]          (scan or editor)         confirmation
   ▲                                 ▲                        │                       │
   └────── sign out ─────────────────┴──── logo / ← BACK ◀────┴──── Start New ────────┘
```

Render gate order (top of `App.tsx` return):

1. `/privacy`, `/terms` hash routes → legal pages (public).
2. `/docs`, `/docs/:slug` hash routes → in-app docs viewer (public).
3. `isRestoring` → blank screen (avoids sign-in flash on reload).
4. `!effectiveUser` → **SignInScreen**.
5. `isSynced` → **SyncConfirmation**.
6. `selectedDoc` → **Active Session** (checked before the home fallback, so
   picking a doc can never bounce to the menu).
7. `!hasChosenInitialMode` → **ModeSelectionLanding**.
8. else → document-selection landing.

## Navigation & unsaved-work guards

- The header logo (`AppTopBar` → `AppHeader`/`GuestBadge`) returns
  home via `handleGoHome`.
- If an editor session is active, a leave **nonce** asks `TextEditor` to run its
  ← BACK guard (discard / finish-and-save modal) instead of leaving silently.
- Scan Mode has its own leave-confirmation before discarding scanned work.

