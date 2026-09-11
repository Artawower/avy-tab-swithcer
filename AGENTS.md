# Agent Guide — Avy Tab Switcher

## 1. Project Purpose & Scope

- **Target Environments**: Chrome/Chromium and Mozilla Firefox (Manifest V3).
- **Core Purpose**: Keyboard-first visual MRU switcher for currently open tabs within the active window (`Alt+Q` -> overlay -> one mnemonic/Enter/search).
- **Hard Scope Boundary**: Operates strictly on open tabs in the current window. Do not add browser history, recently closed tabs, bookmarks, saved sessions, workspaces, tab grouping, tab closing, tab creation, or remote cloud sync without an explicit product spec decision.

## 2. Architectural Boundaries

- **Background Layer (`entrypoints/background.ts`)**:
  - Handles privileged extension operations (`browser.commands`, `browser.tabs.query`, `browser.tabs.get`, `browser.tabs.update`).
  - Dispatches `OPEN_SWITCHER_HOST` and executes `/switcher.js` via `browser.scripting.executeScript`.
  - Validates nonce sessions and responds to `ACTIVATE_TAB` messages using the asynchronous `sendResponse` pattern.
- **Presentation Layer (`entrypoints/switcher.ts`, `entrypoints/frame.html`, `src/ui/`)**:
  - Manages the open Shadow DOM host mounted on the active webpage containing a transparent extension iframe.
  - Hosts `Switcher.vue` and `TabTile.vue` with scoped CSS tokens in `switcher.css` inside the extension frame.
  - Handles keydown events, search filtering, visual tile rendering, queued release suppression, and dispatches activation messages.
- **Domain Layer (`src/domain/`)**:
  - Pure, deterministic TypeScript with zero browser APIs and zero Vue dependencies.
  - Contains MRU sorting logic (`tab-order.ts`), single-letter hint allocation (`hint-allocator.ts`), and fuzzy tab search scoring (`tab-search.ts`).
- **Application Layer (`src/application/`)**:
  - Bridges presentation and domain with runtime validation and navigation algorithms.
  - Contains strictly typed and runtime-validated browser message contracts (`messages.ts`), cryptographic nonce session store (`sessions.ts`), grid selection navigation math (`selection.ts`), tab normalization, and background port interfaces.

## 3. Engineering & Type Discipline

- **Strict TypeScript**:
  - Zero `any` types.
  - Zero non-null assertions (`!`).
  - Zero `@ts-ignore` or `@ts-expect-error` directives.
  - Avoid type assertions or casts (`as ...`, `<type>...`); any unavoidable framework-boundary assertion must be strictly localized and justified; unsafe assertions are forbidden.
- **No Over-Engineering**:
  - Avoid unnecessary dependencies (no Pinia, Vue Router, state machine libraries, or schema validators).
  - Use idiomatic Vue 3 composition (`ref`, `computed`, `watch`, `nextTick`).
  - Write plain CSS in `src/ui/switcher.css`; do not introduce CSS preprocessors or utility frameworks.
- **Least Privilege Permissions**:
  - Manifest permissions are strictly limited to `["tabs", "activeTab", "scripting"]`.
  - Do not add host permissions without a concrete explicit product decision and documentation.

## 4. Verification Commands & Quality Gates

- **Canonical Gate**: Always run `just check` before concluding code tasks. This executes:
  - `pnpm format:check` (Prettier code style check)
  - `pnpm lint` (ESLint with strict type-aware and Vue rules)
  - `pnpm typecheck` (`vue-tsc --noEmit` check)
  - `pnpm coverage` (Vitest unit suite enforcing configured minimum thresholds: 90% lines, statements, functions; 85% branches)
  - `pnpm build` (Production builds for Chrome and Firefox)
- **Browser & UI Gate**: For any change to UI components, content scripts, background orchestration, or messaging, run `just e2e` (Playwright Chromium suite).
- **Rule Integrity**: Never weaken lint or compiler rules (e.g. disabling `no-misused-promises` or `@typescript-eslint/no-explicit-any`) merely to pass CI. Fix the underlying types or promise flow directly.

## 5. Jujutsu (jj) Version Control Rules

- **VCS Tool**: Use Jujutsu (`jj`) exclusively for version control. Never run `git add` or `git commit`.
- **Atomic Revisions**: Keep one logical change per revision. Implementation code and unit tests belong in the same revision.
- **Folded Review Fixes**: Fold review fixes and corrections directly into the assigned working copy revision rather than creating trailing fix commits.
- **Unrelated Cleanup**: Do not bundle opportunistic refactorings or cleanup into feature/fix revisions; keep unrelated cleanup in a separate revision.
- **Clear Descriptions**: Use conventional commit descriptions (`feat: ...`, `fix: ...`, `test: ...`, `chore: ...`, `docs: ...`).

## 6. Testing Philosophy

- **Domain & Application Invariants**: Test edge cases, empty states, boundary values, and input immutability thoroughly. Maintain high coverage exceeding configured thresholds.
- **E2E Test Hermeticity**: Ensure Playwright E2E tests clean up temporary directories and never mutate production output artifacts.
- **Cross-Browser Verification**: Because automated E2E runs on Chromium, verify Firefox production builds (`just build-firefox`) and execute manual smoke tests against Firefox MV3.

## 7. Documentation Maintenance

- Keep `README.md` and `AGENTS.md` accurate and up to date whenever permissions, commands, architecture, or user-facing behaviors are modified.
