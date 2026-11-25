# Design System & Engineering Rules

Rules to ensure consistent development while using AI agents.

## Zero-backend / privacy-first

- **No server, no database.** The browser calls Google APIs directly.
- OAuth tokens stay in client memory + `localStorage`; documents and session
  files live only in the user's own Google Drive.
- Never add a backend, analytics, or third-party data sink.
- Keep scopes minimal. The web app uses `drive.file` and `documents` (plus the
  profile scopes); the extension uses `drive.readonly` and `userinfo.email`.

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
