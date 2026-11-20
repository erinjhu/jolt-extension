# Bug: Editor Mode bounces to the home menu after picking a Google Doc

## Symptom

In **Editor Mode**, selecting an existing Google Doc from the Google Drive
Picker kicked the user straight back to the `START SCANNING` / `OPEN EDITOR`
home screen instead of opening the document in the append-only editor.

Key detail: it reproduced **only in local dev** (`npm run dev`). The deployed
production build worked fine.

## Root cause

A React **`<StrictMode>`** interaction with the editor's "go home" effect.

The header logo uses a nonce (`leaveRequest`, a counter bumped by App's
`handleGoHome`) to ask the mounted `TextEditor` to run its ← BACK guard. The
effect that watched the nonce used a one-shot "skip the first run" boolean:

```ts
const firstLeaveRef = useRef(true);
useEffect(() => {
  if (firstLeaveRef.current) { firstLeaveRef.current = false; return; }
  handleBack();
}, [leaveRequest]);
```

In development, `<StrictMode>` intentionally double-invokes effects on mount
(setup → cleanup → setup) on the **same** component instance, so the ref
persisted between the two setups:

1. First setup: `firstLeaveRef.current` is `true` → set it to `false`, return.
2. Cleanup runs.
3. Second setup: `firstLeaveRef.current` is now `false` → **calls
   `handleBack()`**.

With no active writing session yet (the editor had just mounted), `handleBack()`
fell through to `onBack()` → `handleBackToModes()` → reset to the home menu.

Production builds strip StrictMode's double-invoke, so the effect ran once, the
guard held, and the editor stayed open — hence "works deployed, fails locally."

The document fetch (`fetchDocumentText`) and the Picker callback were **not** the
cause; they ran correctly (token present, doc id valid). The reset fired
independently, right as the editor mounted after the pick.

## How it was debugged

1. **Git baseline.** `git log` / `git diff` confirmed `HEAD == origin/main`
   (the deployed commit) and that all Editor-Mode changes were uncommitted
   working-tree edits — so "works deployed, fails locally" was a code/runtime
   difference on top of the same commit, pointing at a dev-only behavior
   (StrictMode) rather than env vars.
2. **Scan vs. Editor path.** Both modes share `fetchDocumentText`, but only
   Editor Mode invokes it (via `TextEditor.loadText`); Scan reads OCR text.
   This isolated the failure to the editor mount path.
3. **Targeted instrumentation.** Added temporary `[DIAG]` logs:
   - Picker `Action.PICKED` callback (picked id, mimeType, appId, token).
   - Top of `fetchDocumentText` (token presence) + exact HTTP status/body on
     Docs API and Drive export failures.
   - `console.trace('[DIAG] RESETTING VIEW …')` in every view-reset path
     (`handleClearDoc`, `resetFlow`, `handleBackToModes`, `handleSignOut`,
     guest reset) plus a render-time gate log.
4. **Read the trace.** The console showed: `picker PICKED` ✓ →
   `fetchDocumentText` with `hasToken: true` ✓ → immediately
   `RESETTING VIEW — handleBackToModes`. The stack traced the reset to
   `TextEditor`'s `leaveRequest` effect firing on mount — the StrictMode
   double-invoke of the "skip first" guard.

## The fix

Replace the one-shot boolean guard with a **last-seen value comparison**, so the
effect fires only when the nonce actually changes — never on mount, and never on
StrictMode's effect re-invoke:

```ts
const lastLeaveRef = useRef(leaveRequest); // seeded to the initial value
useEffect(() => {
  if (leaveRequest === lastLeaveRef.current) return; // mount + StrictMode: no-op
  lastLeaveRef.current = leaveRequest;
  handleBack();
}, [leaveRequest]);
```

Now `handleBackToModes` only runs from an explicit ← BACK button or a real
header-logo "go home" (a genuine nonce increment). Picking an existing doc stays
in Editor Mode and loads the append-only view.

Also verified/confirmed as part of the fix:

- `fetchDocumentText` errors already surface **inline** inside Editor Mode (the
  load `.catch` only sets an error message and never calls `handleBackToModes`),
  so a failed/denied doc shows a banner instead of bouncing home.
- All temporary `[DIAG]` logs were removed from `App.tsx`,
  `googleDocsService.ts`, and `googlePicker.ts`.

## Takeaway

Effects that should run "only on a real change" must compare the triggering
value (or use an explicit event), not a boolean "first render" flag — a flag is
defeated by StrictMode's double-invoke and by any remount, producing dev-only
bugs that silently disappear in production.
