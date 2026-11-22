# Jolt Extension

Independent companion web app for the Jolt Chrome extension. Lets users scan handwritten notes or draft/append text and save to a `joltsync` folder in Google Drive.

## Commands
- Typecheck: `npx tsc --noEmit`
- Build: `npm run build`
- Dev server: `npm run dev`

## Branding & UX Rules
- **Product Name:** Always refer to the app as **Jolt Extension** (never "Jolt" or "JoltSync" alone) so it is clearly distinct from the official Jolt extension.
- **Monochrome Design System:** Strictly use `#FFFFFF` / `#FAFAFA` backgrounds, `#111111` primary ink and `1px` solid borders, and `0px` border radius (`rounded-none`) across all components and modals. Do not introduce ad-hoc colors, gradients, drop shadows, or rounded corners.
- **User Cancellations vs. Real Errors:**
  - Silently reset loading states without showing red error banners when a user intentionally cancels Google OAuth (`popup_closed_by_user` / `access_denied` on popup close) or dismisses the Google Drive Picker (`Action.CANCEL`).
  - For genuine failures (network drops, blocked popups, API errors), wrap async calls in `try / catch / finally` so loading flags always reset, and surface concise, plain-language error messages (no stack traces or raw API jargon). Handle expired OAuth tokens by prompting re-authentication.
- **Verification:** Always run `npx tsc --noEmit` and `npm run build` after code changes. Do not run headless browser verification unless explicitly requested.

## Architecture & Separation of Concerns (`src/`)
- **UI Components (`src/components/`):** Keep focused on rendering and user interaction. Never put raw `fetch()` calls, complex Google Docs/Drive index math, or token management directly inside JSX components.
- **Services (`src/services/`):** Isolate all external API calls (Google Docs, Drive, Auth, OCR/Vision) into typed service functions with explicit inputs, outputs, and error handling.
- **Custom Hooks (`src/hooks/`):** Extract stateful timers, auto-save debouncing, keystroke tracking, and multi-step modal flows into reusable custom hooks.

## TypeScript & Effect Hygiene
- **Zero `any`:** Explicitly type all props, API responses, and state objects. Never use `any` or `@ts-ignore`. Handle `null` and `undefined` explicitly (especially optional Google Docs fields like `textStyle`, `fontSize`, or `parents`).
- **Clean State & Effects:** Clean up all timers (`setInterval`, `setTimeout`) and event listeners in `useEffect` return functions. Derive computed values (`overallWph`, `draftingPct`, `editingPct`) during render or via `useMemo` instead of syncing state with `useEffect`. Remove unused imports, dead variables, and debug `console.log` statements before finishing.

## File Length & Modularity Guardrails
- **New Files (< 500 Lines):** Every newly created source file must stay strictly under **500 lines** (including imports, types, and JSX). Split large features into cohesive subcomponents, `hooks/`, or `services/` before writing.
- **Existing Files (No Line-Count Growth):** Check the file's line count before editing:
  - If an existing file is **≥ 500 lines**, do **not** increase its line count—extract new logic, modals, or subcomponents into new files so its net line count stays equal or decreases.
  - If an existing file is **< 500 lines**, do not let edits push it over 500 lines.