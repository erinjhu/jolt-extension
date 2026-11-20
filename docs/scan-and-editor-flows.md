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
3. **Extract** — OCR via Google Drive's server-side conversion, or local
   Tesseract fallback (`services/transcription.ts`, `ocrService.ts`). A
   monochrome progress bar shows "Reading note…".
4. **Review & sync** — `SessionForm` pre-fills the text/metadata; syncing
   writes the session to Drive (`syncSessionToDrive.ts`) and shows the
   confirmation screen.

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

## Live writing metrics (`hooks/useWritingSession.ts`)

Metrics track **only the editable text** (for existing docs, only the append
box — `initialWordCount` starts at 0):

- **Word count** — net words added this session.
- **Drafting vs. Editing** — each active second is *Drafting* if a keystroke
  landed within ~2s, else *Editing* (reading/pausing). Idle >45s or a
  backgrounded tab pauses the clock.
- **WPH** — Overall = words ÷ active time × 3600; Highest = peak over a rolling
  window.

---

Prev ← [Auth & Routing](auth-and-routing.md) · Next → [Module Map](module-map.md)
