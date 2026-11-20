# Design System & Engineering Rules

Preserve these when adding any feature.

## Zero-backend / privacy-first

- **No server, no database.** The browser calls Google APIs directly.
- OAuth tokens stay in client memory + `localStorage`; documents and session
  files live only in the user's own Google Drive.
- Never add a backend, analytics, or third-party data sink. Keep the
  `drive.file`-scoped, least-privilege posture.

## Monochrome design system

- **Surfaces:** `#FFFFFF`, with `#FAFAFA` for read-only/secondary panels.
- **Ink & borders:** `#111111`, `1px` solid.
- **Border radius:** `0px` everywhere (sharp corners).
- No ad-hoc colors, gradients, shadows, or rounded corners. Use uppercase,
  tracked labels for headers/buttons to match the existing look.

## File-size discipline

- **Code files:** keep under **500 lines**. Extract hooks (`hooks/`),
  services (`services/`), or subcomponents before a file grows past that.
- **Doc files:** keep under **100 lines** (aim 50–85) so each is scannable.

## Other conventions

- Effects that act "only on real change" must compare the triggering value —
  never a "first render" boolean (StrictMode double-invokes defeat it; see the
  [picker-bounce postmortem](editor-mode-picker-bounce-bug.md)).
- Surface API errors **inline** in the current view; never reset the active
  mode on a load/save failure.

---

Prev ← [Module Map](module-map.md) · [Docs Index](README.md)
