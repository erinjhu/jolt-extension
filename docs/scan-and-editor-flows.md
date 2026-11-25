# Scan Mode & Append-Only Editor

## Scan Mode flow

```
pick/create target doc ─▶ capture or upload photo ─▶ extract text ─▶ review form ─▶ sync
   (DocumentSelector)        (PhotoUploadLanding)       (OCR)       (SessionForm)  (Drive)
```

1. **Target doc** — choose a recent doc, create a new one, or pick from Drive
   (`DocumentSelector` + `googlePicker.ts`). New docs are created inside the
   `JoltSync` Drive folder (`driveFolderService.ts`).
2. **Capture** — take a photo or upload an image (`PhotoUploadLanding`).
3. **Extract** — signed-in scans use Google Drive's server-side OCR
   (`services/transcription.ts`). The text is read from a scratch Google Doc,
   **appended to the target doc straight away**, and the scratch doc is trashed.
   A progress bar tracks each step. Guest Demo uses local Tesseract instead
   (`ocrService.ts`).
4. **Review & sync** — `SessionForm` pre-fills the title, times and word count;
   Description stays blank because the text is already in the doc. Syncing
   writes `jolt_sessions.json` to `JoltSync` (`syncSessionToDrive.ts`,
   `sessionFileService.ts`) without creating a second doc, then shows the
   confirmation screen.

**Known gap:** the "Run Offline Fallback OCR" button only appears when signed
out, which the auth gate never allows on this screen. A failed Drive OCR shows
an error with no Tesseract fallback.

## Editor Mode: new docs vs. existing docs

`TargetDoc.isNew` decides the editing model:

| Doc kind | `isNew` | Behavior |
| --- | --- | --- |
| Just created via "+ Create New Doc" | `true` | **Full editor** — edit the whole body; saves overwrite it. |
| Existing (recent / Picker / demo seed) | `false` | **Append-only** — never rewrites existing content. |

**Append-only view** (`TextEditor` + `ExistingDocContext`):

```
┌───────────────────────────────────────────┐
│ EXISTING DOCUMENT (READ-ONLY — PRESERVED)  │  ← fetched body, scrollable
├───────────────────────────────────────────┤
│ NEW TEXT TO APPEND …                       │  ← editable box (your session)
└───────────────────────────────────────────┘
```

- Read via **Docs API** `documents.get` (Drive export fallback).
- Save via `insertText` at `endIndex-1`, then `replaceAppendedRange` on later
  auto-saves — so headings/colors/lists/tables/images stay intact and repeated
  saves never duplicate the appended block (`googleDocsService.ts`).
- Guest mode mirrors this with `guestSetAppendedText`.

Both kinds auto-save 3s after typing stops, and when you leave the editor tab.
**Finish Session** saves once more and opens the session form
(`SessionLoggingView`), pre-filled with the tracked duration and word count.

## Live writing metrics (`hooks/useWritingSession.ts`)

Metrics track **only the editable text** (for existing docs, only the append
box — `initialWordCount` starts at 0):

- **Word count** — net words added this session.
- **Drafting vs. Editing** — each active second is *Drafting* if a keystroke
  landed within ~2s, else *Editing* (reading/pausing). Idle >45s or a
  backgrounded tab pauses the clock.
- **WPH** — Overall = words ÷ active time × 3600; Highest = peak over a rolling
  window.

