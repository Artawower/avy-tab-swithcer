# Avy Tab Switcher

Avy Tab Switcher is a keyboard-first, visual MRU (most recently used) tab switcher for Google Chrome / Chromium and Mozilla Firefox. Pressing `Alt+Q` opens an in-page overlay allowing immediate tab switching via single-letter jump mnemonics, directional arrow navigation, Enter activation, or full-window fuzzy text search.

## Features

- **MRU Ordering**: Tabs are ordered by recency of use within the current window.
- **Current Tab Excluded**: The currently active tab is excluded from the switcher display.
- **Deterministic Jump Hints**: In quick mode, the top 10 MRU tabs receive unique, deterministic one-letter mnemonic hints (`a`–`z`) prioritizing title, then hostname, with tie-breakers. Quick mode is strictly capped at 10 tabs.
- **Local Search Mode**: Pressing `/` switches to search mode. An empty or whitespace-only query displays the top 10 MRU tabs without hints, while a non-empty search filters across all current-window tabs and renders all matches (including >10), preserving the same visual tile grid.
- **Stale-Tab Recovery**: If a displayed target tab closes before activation, it is automatically removed from the switcher and the overlay reopens without switching windows or crashing.
- **Visual Grid Navigation**: Arrow keys (`Left`, `Right`, `Up`, `Down`) navigate the responsive grid with boundary clamping for lateral and vertical movement.
- **Shadow DOM Isolation**: The switcher is rendered inside an open Shadow DOM host with style isolation, preventing CSS bleeding between the host page and switcher.
- **Adaptive Accessibility**: Full support for light and dark themes (`prefers-color-scheme`) and reduced motion (`prefers-reduced-motion`).

## Architecture Map

```
entrypoints/
├── background.ts          # Privileged MV3 service worker / background script:
│                          # - Listens for open-switcher command (Alt+Q)
│                          # - Manages nonce-authorized switcher sessions
│                          # - Queries current window tabs via browser.tabs.query
│                          # - Injects switcher.js via browser.scripting.executeScript
│                          # - Dispatches typed OPEN_SWITCHER_HOST messages
│                          # - Handles typed ACTIVATE_TAB messages with sendResponse
├── frame.html             # Extension-origin frame page (web_accessible_resource):
│                          # - Hosts Vue application in isolated extension execution context
└── switcher.ts            # Unlisted content script injected programmatically:
                           # - Manages open Shadow DOM host with transparent extension iframe
                           # - Preserves and restores host page prior focus

src/
├── domain/                # Pure business logic (zero browser APIs, zero Vue dependencies):
│   ├── tab.ts             # Tab domain entity definitions
│   ├── tab-order.ts       # MRU sorting and recency tie-breaking
│   ├── hint-allocator.ts  # Deterministic single-character mnemonic allocation
│   └── tab-search.ts      # Score-ranked title/hostname search matching
├── application/           # Application orchestration & contracts:
│   ├── background.ts      # Pure background port orchestration & URL injectability checks
│   ├── sessions.ts        # Cryptographic nonce session store with TTL & cleanup
│   ├── tab-operations.ts  # Window tab normalization and safe tab activation logic
│   ├── selection.ts       # Grid column math and visual arrow navigation
│   └── messages.ts        # Typed and runtime-validated message contracts & guards
└── ui/                    # Presentation layer:
    ├── Switcher.vue       # Main switcher overlay, search input, and keyboard event routing
    ├── TabTile.vue        # Individual tab card rendering title, favicon (with fallback), and hint
    ├── frame-main.ts      # Extension frame Vue app mounting and runtime messaging
    ├── switcher-host.ts   # Shadow DOM container creation and idempotent host reuse
    └── switcher.css       # Complete scoped component styling and theme tokens
```

## Stack and Prerequisites

- **Node.js**: `>=20` (Node 22 recommended and used in CI)
- **Package Manager**: `pnpm` 10.33.2
- **Task Runner**: `just` (command-line runner)
- **Supported Browsers**: Current supported Chromium-based browsers (Chrome, Brave, Edge) and Mozilla Firefox
- **Playwright Chromium**: Required for end-to-end browser tests. Install with:
  ```bash
  pnpm exec playwright install --with-deps chromium
  ```

## Installation & Development

1. **Install dependencies**:

   ```bash
   just install
   # or: pnpm install
   ```

2. **Start development mode with hot reload**:

   ```bash
   # Chromium development:
   just dev
   # or: pnpm dev

   # Firefox development:
   just dev-firefox
   # or: pnpm dev:firefox
   ```

3. **Run local verification**:
   ```bash
   just check
   ```

## Loading the Extension Locally

### Google Chrome / Chromium

1. Build the Chrome extension:
   ```bash
   just build-chrome
   ```
2. Navigate to `chrome://extensions` in your browser.
3. Enable **Developer mode** toggle in the top right corner.
4. Click **Load unpacked** and select the `.output/chrome-mv3` directory within this repository.

### Mozilla Firefox

1. Build the Firefox extension:
   ```bash
   just build-firefox
   ```
2. Navigate to `about:debugging#/runtime/this-firefox` in Firefox.
3. Click **Load Temporary Add-on...**.
4. Select the `.output/firefox-mv3/manifest.json` file.

## Keyboard Shortcut Configuration

The default shortcut to open the switcher is `Alt+Q`.

You can customize this shortcut at any time in your browser settings:

- **Chrome / Chromium**: Navigate to `chrome://extensions/shortcuts` and adjust the shortcut for "Avy Tab Switcher".
- **Firefox**: Navigate to `about:addons`, click the gear icon (Manage Extension Shortcuts), and configure the shortcut under "Avy Tab Switcher".

## Permissions & Privacy

Avy Tab Switcher is built according to least-privilege principles:

- **Minimal Permissions**: The manifest requests strictly `["tabs", "activeTab", "scripting"]`.
- **Zero Host Permissions**: No `<all_urls>`, wildcard origins, or broad host permissions are declared or requested.
- **Local Data Processing Only**: Tab data (`title`, `url`, `hostname`, `favIconUrl`, `lastAccessed`) is processed strictly in-memory within the local browser process.
- **No Analytics / Telemetry**: No tracking, metrics, analytics, or external API calls are made.
- **No Browsing History or Storage**: Does not access browser history or write to persistent extension storage.
- **Favicon Handling**: Favicons render existing browser-provided URLs (`favIconUrl`) directly via image tags, which may allow the browser to load or cache that original-site URL. No third-party favicon fetching services or external APIs are used.

### Recency Fallback Behavior (`lastAccessed`)

Tabs are sorted using `lastAccessed` timestamp in descending order. If a browser does not report `lastAccessed` or if two tabs share identical timestamps:

1. Tabs with known `lastAccessed` timestamps appear before tabs with missing recency data.
2. Ties between tabs are broken deterministically by ascending `tabId`, ensuring stable, flicker-free ordering.

### Restricted Pages

Browser security policies prevent extensions from injecting content scripts into restricted pages, including:

- Browser internal schemes: `chrome://`, `chrome-extension://`, `about:`, `moz-extension:`, `edge://`
- Web store pages: Chrome Web Store, Firefox Add-ons (AMO)
- File and data URLs: `file://`, `data:`, `javascript:`

When `Alt+Q` is pressed on a restricted page, the extension exits gracefully without alert dialogs, errors, or permission escalation.

### Keyboard Isolation & Event Handling

Avy Tab Switcher isolates all overlay execution and event routing within an extension-origin frame to guarantee keyboard containment:

- **Extension-Origin Frame Boundary & Content-Script/Page Isolation**: The switcher UI mounts inside a transparent, focused `chrome-extension://` / `moz-extension://` iframe hosted within a runtime-injected open Shadow DOM container. Keystroke containment guarantees content-script and host-page isolation while the modal frame owns focus; the host webpage and other content scripts have zero access to keystrokes while the frame is focused.
- **Focus Reassertion**: If host-page code programmatically focuses an element on the webpage while the switcher is open, the host controller detects iframe blur and reasserts iframe focus as long as the host remains open, the top document still has focus, and the tab is visible. It deliberately does not fight browser chrome (such as address bar navigation), OS window changes, hidden/inactive tabs, or overlay closing.
- **No Host-Page Keyboard Listeners**: The extension registers zero keyboard listeners on the host webpage's `window` or `document`. Keystrokes are intercepted exclusively by the focused extension frame, eliminating race conditions with pre-existing capture listeners or input-ignoring extension scripts.
- **Generic Keyup Containment & Matching-Keyup Activation**: Keyboard actions (mnemonic quick-selection, Enter activation, and Escape dismissal) initiate on keydown and execute upon the matching `keyup` event. All trailing key releases within the frame are generically consumed, ensuring that releasing an activation or dismissal key never leaks into the underlying page or newly activated target tab.
- **Timeout & Blur Cancellation**: If an activation or dismissal key is held continuously beyond an 800 ms safety threshold, or if the window loses focus (`window.blur`), the pending action is cancelled cleanly (`pendingAction = null`). The overlay remains open and usable, and the eventual key release is absorbed without executing premature tab switches or leaking keys. Repeated keydowns (`event.repeat`) while an action is pending are strictly suppressed.
- **Heartbeat & Exclusively Claimed Sessions**: On mount, the frame queries initial tab data with a cryptographically random, exclusively claimed session nonce. The background service worker binds this nonce to the sender's exact `frameId` and `documentId`. An active 15-second heartbeat loop refreshes session liveness; if the heartbeat fails or the 60-second rolling idle expiry elapses without activity, the frame initiates graceful teardown. Cloned or unauthorized frames attempting to reuse or claim the session nonce are rejected.
- **Deep Prior Focus Preservation & Restoration**: When the switcher opens, the content script records the active deep-focused element (traversing nested open shadow roots). When the overlay closes or is destroyed, focus is faithfully restored to that prior element if it remains connected.
- **Browser-Level Shortcut Limitations**: Browser-reserved accelerator shortcuts (such as `Ctrl+W`, `Cmd+Q`, `Alt+F4`, or address bar navigation) are handled by the browser chrome at the native OS/browser layer and cannot be intercepted by extension frames or web content.

## Developer Interface (`justfile`)

All common workflows are standardized via the root `justfile`:

| Command                | Description                                                                  |
| :--------------------- | :--------------------------------------------------------------------------- |
| `just install`         | Install workspace dependencies via pnpm install                              |
| `just dev`             | Start WXT development server targeting Chrome MV3                            |
| `just dev-firefox`     | Start WXT development server targeting Firefox MV3                           |
| `just format`          | Automatically format all tracked files with Prettier                         |
| `just format-check`    | Check code formatting across the repository with Prettier                    |
| `just lint`            | Run ESLint with strict TypeScript and Vue type-aware rules                   |
| `just typecheck`       | Run `vue-tsc --noEmit` type checking                                         |
| `just test`            | Run Vitest unit and integration test suite                                   |
| `just coverage`        | Run Vitest tests with v8 code coverage reporting                             |
| `just e2e`             | Build Chrome MV3 extension and execute Playwright E2E suite                  |
| `just build`           | Build production bundles for both Chrome and Firefox                         |
| `just build-chrome`    | Build production bundle for Chrome MV3 (`.output/chrome-mv3`)                |
| `just build-firefox`   | Build production bundle for Firefox MV3 (`.output/firefox-mv3`)              |
| `just package`         | Package production zip archives for Chrome, Firefox, and sources             |
| `just package-chrome`  | Package Chrome distribution zip (`.output/*-chrome.zip`)                     |
| `just package-firefox` | Package Firefox distribution zip and source zip                              |
| `just check`           | Canonical CI check: `format:check && lint && typecheck && coverage && build` |

## End-to-End & Cross-Browser Testing

- **Chromium E2E Automation**: Playwright tests run against Playwright's bundled Chromium binary using a persistent context. Because browser automation drivers (CDP/WebDriver) cannot reliably dispatch OS-level keyboard shortcuts (`Alt+Q`), the E2E test bypasses only the OS/browser command dispatch, while reusing production MRU/query logic, the same unlisted `/switcher.js`, Shadow DOM UI, typed OPEN/ACTIVATE protocol, and real background tab activation.
- **Isolated E2E Extension Copy**: The E2E fixture copies `.output/chrome-mv3` into an isolated temporary directory and patches temporary localhost permission only in the copied test build for fixture server interaction. The original production `.output/chrome-mv3` build output remains byte-for-byte pristine.
- **Firefox Coverage**: Firefox uses identical shared pure domain logic, application orchestration, Vue components, and build pipelines. Verification is ensured via comprehensive shared unit tests enforcing configured minimum thresholds (90% statements, lines, and functions; 85% branches), Firefox production builds, and manual smoke testing.

## Manual Verification Checklist

**Setup**: Build and load the unpacked extension, open at least five regular HTTP/HTTPS tabs, visit them in a known sequence to establish MRU recency, and press `Alt+Q` to trigger the switcher.

Use this checklist to verify core behaviors before releases:

1. [ ] **Known MRU Order**: Tabs appear in descending order of last access.
2. [ ] **Current Tab Omission**: The active tab from which the switcher was opened is omitted.
3. [ ] **Previous Tab Preselected**: The 1st candidate tile (index 0) is selected by default on open.
4. [ ] **Enter Activation**: Pressing `Enter` activates the currently selected tab and closes the overlay.
5. [ ] **Unique Mnemonic Jump**: Pressing an assigned single-character hint immediately activates that tab.
6. [ ] **Search Mode Entry**: Pressing `/` enters search mode and focuses the input field.
7. [ ] **Full Window Search**: A non-empty search filters across all tabs in the current window and renders all matching tabs, including more than 10.
8. [ ] **Identical Grid Layout**: Search results use the exact same grid layout and tile component as quick mode.
9. [ ] **Search Escape Key**: Pressing `Escape` while searching clears the query and returns to quick mode.
10. [ ] **Quick Escape Key**: Pressing `Escape` in quick mode closes the switcher overlay.
11. [ ] **Close Button (`×`)**: Clicking the top-right `×` button closes the switcher.
12. [ ] **Mouse Tile Selection**: Clicking any tab tile with the mouse switches to that tab.
13. [ ] **Empty Search Query**: Clearing the search input remains in search mode and displays the top 10 MRU tabs without quick hints.
14. [ ] **Empty Search State**: Entering a query with no matches displays a "No matching tabs" message.
15. [ ] **Arrow Navigation**: Arrow keys (`Left`, `Right`, `Up`, `Down`) update visual selection.
16. [ ] **Responsive Breakpoints**: Grid adjusts column counts by viewport width (2 cols <= 480px, 3 cols <= 720px, 5 cols > 720px).
17. [ ] **Horizontal Clamp**: Pressing `Left` at the start of a visual row or `Right` at the end of a visual row clamps within the row.
18. [ ] **Vertical Clamp**: Pressing `Up` on the top row or `Down` on the bottom row stays in the same column.
19. [ ] **Light Theme**: Default theme renders clear borders, legible fonts, and high contrast.
20. [ ] **Dark Theme**: Operating system dark mode (`prefers-color-scheme: dark`) applies dark palette seamlessly.
21. [ ] **Reduced Motion**: Setting `prefers-reduced-motion: reduce` disables CSS transitions and transforms.
22. [ ] **Shadow DOM Isolation**: Host page CSS styles do not leak into or distort switcher UI elements.
23. [ ] **Frame Keyboard & Focus Containment**: The host webpage and other extension scripts receive zero keystrokes while the modal frame owns focus, and programmatic page focus shifts are automatically reasserted back to the frame.
24. [ ] **Long-Hold Release Safety**: Holding Escape or a mnemonic key for >800 ms cancels the pending action without closing or switching tabs, and subsequent release leaks no keys to the page.
25. [ ] **Prior Deep Focus Restoration**: Dismissing the switcher or activating a tab faithfully restores focus to the prior deeply-focused element on the page.
26. [ ] **Chrome MV3 Compatibility**: Operates without errors in current supported Chrome/Chromium.
27. [ ] **Firefox MV3 Compatibility**: Operates without errors in current supported Firefox.
28. [ ] **Graceful Restricted Pages**: Invoking on internal/store pages (`chrome://`, `about:`) fails silently without uncaught errors.
29. [ ] **Background Command Activation**: Triggering `Alt+Q` reliably invokes the switcher.
30. [ ] **Deterministic Mnemonic Hinting**: Tabs receive stable hints derived first from title characters, then hostname.
31. [ ] **Deterministic Recency Tie-Breaking**: Tabs with missing or identical timestamps break ties by ascending tab ID.
32. [ ] **Stale-Tab Recovery**: If a displayed target tab closes before activation, clicking its tile removes the tab and reopens the overlay without switching windows or crashing.

## Packaging & Releases

Production archives are created with:

```bash
just package
```

This outputs three zip archives in `.output/`:

- `.output/avy-tab-switcher-<version>-chrome.zip` (Chrome distribution package)
- `.output/avy-tab-switcher-<version>-firefox.zip` (Firefox distribution package)
- `.output/avy-tab-switcher-<version>-sources.zip` (Firefox source code package for AMO review)

### GitHub Release Workflow

Pushing a tag matching `v*.*.*` (e.g. `v0.1.0`) triggers `.github/workflows/release.yml`. The workflow:

1. Verifies that the git tag strictly matches `v` + `version` in `package.json`.
2. Executes the full quality gate (`just check` and `just e2e`).
3. Generates release archives (`just package`).
4. Creates a GitHub Release and attaches the three `.zip` files.

_Note on Web Store Publication_: Automated Chrome Web Store and Firefox Add-ons (AMO) publishing is deliberately not implemented in this repository. Store publication requires dedicated developer accounts, store listings, code signing, and API credentials configured within a protected GitHub `production` environment with manual approval gates.
