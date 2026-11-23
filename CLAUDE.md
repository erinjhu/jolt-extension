# CLAUDE.md — Jolt Autofill Chrome Extension

## Architecture & TypeScript Guardrails
- **Strict File Length:** Keep every source file strictly under **500 lines**. Refactor into modular hooks, services, or components before exceeding this limit.
- **Strict TypeScript:** Zero `any` types anywhere (`npx tsc --noEmit` must pass with zero errors).
- **Separation of Concerns:** Keep OAuth token logic, Google Drive/Docs API requests, and error classification in dedicated service modules—never inside UI components.

## UI & Monochrome Design System
- **Palette:** Strict monochrome only (`#FFFFFF` / `#FAFAFA` backgrounds, `#111111` ink/text, subtle neutral grays for muted states). Zero accent colors or drop shadows.
- **Geometry:** Sharp `0px` border radius (`rounded-none`) and `1px` solid `#111111` borders.
- **Mutually Exclusive Auth UI States:**
  - **Signed Out (`!isAuthenticated`):** Render ONLY the sign-in prompt and `"Sign In with Google"` button. Completely hide the connected account card, `"Switch Account"`, and `"Sign Out"`.
  - **Signed In (`isAuthenticated`):** Render ONLY the connected account card (`"Switch Account"`, `"Sign Out"`, and connected status) and hide `"Sign In with Google"`.
  - Default to `isAuthenticated = false` on initial popup mount until stored token/session validity is confirmed, and immediately reset to `false` on sign-out or OAuth errors.

## Chrome Web Store Fast-Review Guardrails (DO NOT VIOLATE)
- **Freeze `permissions` & `host_permissions`:** Do NOT add, remove, or modify `permissions` (`identity`, `storage`, `activeTab`, `scripting`) or `host_permissions` in `manifest.json` unless explicitly instructed—changing permissions triggers manual human review and delays store approval.
- **No `"key"` in Store Builds:** `dist/manifest.json` MUST NOT contain a `"key"` field (Chrome Web Store rejects packages containing `"key"`).
- **No Remote Code Execution (MV3 Compliance):** Never introduce remote hosted scripts, external `<script>` tags, `eval()`, `new Function()`, or obfuscated CDN bundles. All JavaScript must be bundled locally inside `dist/`.
- **Restricted Network Domains:** Only communicate with existing Google OAuth/Drive/Docs endpoints—do not add new external domains or background polling.
- **Version Bumping:** Whenever code or manifest changes are prepared for a Chrome Web Store update, increment `"version"` in `manifest.json` (e.g., `"1.0.0"` -> `"1.0.1"`).

## Build & Verification Checklist
Before finishing any task:
1. Run `npx tsc --noEmit` and verify zero type errors.
2. Run `npm run build` and verify clean compilation into `dist/`.
3. Inspect `dist/manifest.json` to confirm:
   - `"key"` is absent.
   - `permissions` and `host_permissions` are unchanged.
   - `"version"` is incremented if preparing a store release.