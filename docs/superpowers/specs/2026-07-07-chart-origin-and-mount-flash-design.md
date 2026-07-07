# ChIC — Chart Y-Origin & Mount-Flash Design (2026-07-07)

**Context.** Two "first glance" issues were reported (in German) after the v0.5.3 review:

1. **Chart axes look off.** The origin currently sits at ≈ **(15, 0)**; it should sit at **(15, 600)**.
2. **First-load flash.** On the very first page load a plain "GitHub repository / GitHub
   page"–style document flashes for a moment before the real app appears.

This doc records the **root-cause investigation** (systematic-debugging Phase 1–2, with browser
evidence captured via Playwright) and specifies the two fixes. Both are small, dependency-free, and
follow the AGENTS.md rule "smallest change that fits the existing pattern; don't add deps."

## Root cause — Issue 1 (chart y-origin)

The y-axis is logarithmic with `CONFIG.CHART_Y_MIN = 100` (`src/config/config.js:24`) while the
first labelled tick and the whole clinical model start at the **baseline 600 ml/m**
(`CONFIG.MODEL.CLASS_BASELINE_ML_PER_M`, the class-A floor; every threshold curve is
`600·(1+r)^age`). The result is a **dead-zone**: the plot area extends from the 600 baseline down
to 100, and Chart.js draws the x-axis (the "Age (years)" line, ticks 15–85) at the bottom of that
empty band. Visually the origin reads as ≈ (15, 0) with a large blank gap under class A.

Evidence (Playwright, dev server): the "before" chart shows the grey class-A band bottoming at the
`600` tick with an empty region beneath it down to the axis line; the tight origin crop shows the
`600` label floating well above the x-axis. The live y-scale min is 100.

The `CHART_Y_MIN: 100` comment ("must not clip small htTLV (<600)") is the only counter-argument.
It is not a real constraint for this tool: `AGE_MIN = 15`, and the model's minimum meaningful htTLV
is the baseline 600 (nothing below class A exists in the model). A patient with htTLV < 600 is below
the entire A–E band system and outside the tool's clinical purpose. The domain author's explicit
request — origin at (15, 600) — is the authority here.

### Fix 1 — set the y-floor to the model baseline

`src/config/config.js`: `CHART_Y_MIN: 100` → `CHART_Y_MIN: 600` (the class-A baseline / first tick).

- The class-A (grey) band now fills from the axis floor upward; the `600` tick sits exactly at the
  origin corner → origin = (15, 600), as requested.
- No dead-zone; the x-axis labels sit flush at 600.
- `CHART_Y_MAX`, `CHART_Y_TICKS`, the ceiling/baseline datasets, and all fill logic are unchanged
  (ChartDisplay reads `CONFIG.CHART_Y_MIN/MAX` — single source of truth, no other edits needed).
- Accepted trade-off: an htTLV strictly below 600 would render at/under the floor. This matches the
  requested clinical framing and cannot occur for a valid in-model patient at age ≥ 15.

## Root cause — Issue 2 (first-load flash)

`index.html` embeds a static **SEO shell** inside `#app` (`.chic-seo-shell`, ~lines 373–469): logo,
headings, key-terms, FAQ, a **"Source code on GitHub"** link, and "Loading the interactive ChIC
tool…". This shell exists on purpose for no-JS crawlers and link scrapers (progressive enhancement).
The browser paints it as soon as the HTML arrives; Vue then replaces `#app` on mount. On first load
(cold cache, before the JS bundle parses/executes) the user sees this plain, README/GitHub-looking
document — the reported flash.

Evidence (Playwright): rendering `index.html` with JavaScript disabled — exactly what the browser
paints before Vue mounts — shows the shell with the GitHub "Source code" link and the ChIC heading
(`shellPainted:true, hasGithubLink:true`). This is the flashed content.

### Fix 2 — hide the shell from JS users; show a minimal on-brand splash

Keep the shell in the DOM for crawlers/no-JS, but never let it flash for JS users. In `index.html`
`<head>` add a tiny style block (no JS, no deps):

- Hide the shell by default (JS present): `.chic-seo-shell { display: none }`.
- Re-show it for no-JS via `<noscript><style>.chic-seo-shell{display:block}...</style></noscript>`.
- Add a minimal branded **splash** (`.chic-app-splash`) **inside `#app`, after the shell**: centered
  ChIC logo (`favicon.png`, already inlined-by-path in the shell) + a subtle pulse and "Loading…".
  It is `display:flex` by default (JS) and set to `display:none` inside the `<noscript>` override.
  Because it lives inside `#app`, Vue's mount **replaces it automatically** — no teardown code.

Design details (UI/UX):

- Background **white** to match the app's default light theme. First-load visitors (no
  `localStorage.theme`) always get light mode (`useTheme.js` defaults to light), so no theme flash.
  Returning dark-mode users see white for < 1 s until mount — acceptable and strictly better than the
  README flash.
- Brand accent `#00bf7d` (the app `theme-color`) for the spinner; `prefers-reduced-motion` disables
  the animation.
- Net effect for JS users: blank-then-app becomes **logo-splash-then-app** with no README/GitHub
  content ever visible. For crawlers/no-JS: identical SEO content as today.

## Out of scope (noted, not changed here)

- The router uses `createWebHistory` with **no `public/404.html`**, so a deep-link/refresh on GitHub
  Pages would 404. This is a _separate_ latent issue and is **not** the reported homepage flash
  (root `/ChIC/` serves `index.html` directly). Left for a follow-up.

## Revision 2 — residual flicker on refresh (2026-07-07)

After Fix 2 shipped, a **short flicker on refresh** remained. A frame-by-frame CDP screencast of a
warm reload (Playwright, 60 fps) isolated two causes the first fix did not address:

1. **The splash itself flashed.** On a warm/cached reload Vue mounts in ~100 ms, so the centered
   "Loading ChIC…" splash appeared for a single frame, then vanished — a flash-of-spinner.
2. **Theme FOUC (worse in dark mode).** The splash background was hard-coded `#ffffff`, and the
   app's dark background (`.dark-theme { background:#1a1a2e }`) is only applied by JS on mount. So a
   returning **dark-mode** user saw a **white flash** before the dark app painted.

Lighthouse (prod, simulated throttle) confirmed the flicker is **not** layout shift — **CLS = 0.002**
— i.e. a paint/FOUC problem, not a reflow. A11y and Best-Practices were already 100.

Two fixes, both established best practice (see Sources):

### Fix 2a — delay the splash (no flash on fast loads)

The splash starts `opacity: 0` and fades in only after a **300 ms** delay
(`animation: chic-splash-in 0.2s ease-out 0.3s forwards`). A fast/warm load mounts and replaces
`#app` before the delay elapses, so the splash **never becomes visible** — no flicker. It appears
only for a genuinely slow first load (verified by blocking the app chunk: splash shows at
`opacity:1` after 300 ms in both themes). `prefers-reduced-motion` keeps the delay but drops the
fade + logo pulse.

### Fix 2b — themed pre-mount background (no white-on-dark flash)

A tiny **render-blocking inline `<head>` script** reads the same `localStorage 'theme'` as
`useTheme.js` and sets `html[data-chic-theme="dark"]` before first paint; CSS gives `html` a
`#ffffff` / `#1a1a2e` base and the splash `background: transparent` so it inherits the themed base.
Render-blocking is intentional and ~150 bytes (web.dev/FART guidance). Only `localStorage` is used —
**not** `prefers-color-scheme` — because the app itself ignores system preference (defaults to
light). `useTheme.applyTheme()` now also toggles the `data-chic-theme` attribute so an in-session
theme switch keeps the base background correct.

**Evidence (Playwright filmstrips, warm reload):** light → plain white blank that matches the app
(no splash frame); dark → dark `#1a1a2e` blank (no white flash, no splash frame). Lighthouse after:
A11y 100, Best-Practices 100, CLS 0.001 — no regression.

**Still out of scope:** the 1.28 MB JS bundle (FCP/LCP under throttle) — a code-splitting concern,
not the flicker; and the missing `public/404.html` (deep-link refresh).

**Sources:** [web.dev / CSS-Tricks "Flash of inAccurate coloR Theme"](https://css-tricks.com/flash-of-inaccurate-color-theme-fart/) (inline blocking theme script);
NN/g & common loader guidance (delay a spinner ~300 ms; don't show it for sub-300 ms loads).

## Verification

- **Unit (Vitest):** (a) `CONFIG.CHART_Y_MIN === CONFIG.MODEL.CLASS_BASELINE_ML_PER_M` encodes
  "origin at baseline"; (b) an `index.html` structural test asserts the no-flash mechanism exists
  (shell hidden by default + `<noscript>` override + splash present, splash delayed, themed
  pre-mount script + dark base background); (c) a `useTheme` test pins the `data-chic-theme` sync.
- **Build/lint:** `npm run lint`, `npm run format:check`, `npm run build`, `npm test` all green (70 tests).
- **Browser (Playwright + Lighthouse, scratchpad — not committed):** origin at (15, 600), no
  dead-zone; warm-reload filmstrips show no splash flash and no white-on-dark flash in either theme;
  slow-load still shows a themed splash; Lighthouse A11y/BP 100, CLS ≈ 0.001.
