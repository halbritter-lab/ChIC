# ChIC — Issue #29: Bundle Code-Split + GitHub-Pages 404 Fallback — Design Spec

- **Date:** 2026-07-07
- **Status:** Draft for review (author + Codex)
- **Author:** Bernt Popp (with Claude Code)
- **Issue:** [#29](https://github.com/halbritter-lab/ChIC/issues/29) — "Perf/deploy follow-ups: code-split the ~1.28 MB JS bundle + add public/404.html for deep-link refresh"
- **Scope:** Two independent, evidence-backed follow-ups filed during the chart-origin/mount-flash work. Neither is a correctness bug. Delivered together (one PR, two atomic commits) but designed to review and revert independently.
- **Non-goals:** No new runtime dependencies. No clinical-model change. No TypeScript migration. No change to the Chart.js dataset order/labels or the `CONFIG` single-source-of-truth invariants. No second Pages/docs target.

---

## 1. Context & Goals

`npm run build` emits a **single application chunk of 1,286.96 kB (395.28 kB gzip)** and prints Vite's _"chunks larger than 500 kB"_ warning. Under a throttled Lighthouse run this chunk dominates load: the reported Performance ~55 with FCP ~7.5 s / LCP ~8.6 s is entirely bundle-driven (CLS 0.001, A11y/BP 100). Separately, the router uses `createWebHistory(import.meta.env.BASE_URL)` with base `/ChIC/`; GitHub Pages has no built-in SPA fallback, so a deep-link/refresh on a non-root path would 404 — latent today (only the `/` route exists) but a live trap the moment a second route or a shared sub-path link appears.

**Success criteria (from the issue):**

1. **Code-split:** main entry chunk drops under the 500 kB warning threshold (or the heavy deps are split out and loaded on demand); Lighthouse FCP/LCP improve; `npm test` + `npm run build` stay green; **zero behaviour change**.
2. **404 fallback:** refreshing / deep-linking a sub-path serves the app instead of a 404.
3. **Full CI gate green:** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.

---

## 2. Evidence — measured, not eyeballed

### 2.1 Bundle composition

Measured with a **throwaway** `npx vite-bundle-visualizer -t raw-data` run (no analyzer dependency added to the repo), aggregating rendered/gzip bytes per package:

| Package                                                       | rendered (kB) | gzip (kB) | share of entry | needed at first paint?                       |
| ------------------------------------------------------------- | ------------: | --------: | -------------: | -------------------------------------------- |
| **exceljs**                                                   |         925.3 |     250.1 |          52.2% | **No** — only on import/export (user action) |
| **chart.js** (+ `@kurkle/color`)                              |         493.3 |     104.1 |          27.8% | **Yes** — paints the main chart on load      |
| `@vue/runtime-core` + `reactivity` + `runtime-dom` + `shared` |         175.6 |      42.5 |           9.9% | Yes                                          |
| `vue-router`                                                  |          61.4 |      15.8 |           3.5% | Yes                                          |
| app `src/`                                                    |         114.2 |      35.0 |           6.4% | Yes                                          |
| **TOTAL (single chunk)**                                      |    **~1,287** |   **395** |           100% |                                              |

The single largest contributor — **exceljs at 52%** — is used only at two user-triggered call sites and is never needed for first paint.

### 2.2 Where the heavy deps are imported (verified)

| Dep        | Import sites                                                                                                                                                                                                                           | First-paint? |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `exceljs`  | `src/composables/useDataPersistence.js:2` (static `import ExcelJS from 'exceljs'`, used in `loadDataFromExcel` + `downloadDataAsExcel`) · `src/components/FaqModal.vue:168` (**already** dynamic: `(await import('exceljs')).default`) | No           |
| `chart.js` | `src/components/ChartDisplay.vue:10` (`import { Chart, registerables, Filler }`)                                                                                                                                                       | **Yes**      |

FaqModal already lazy-loads exceljs — so **the dynamic-import pattern is already established in this codebase**; the fix simply extends it to the one static importer.

### 2.3 Prototype builds (disposable worktree, since removed)

Applying dynamic `import()` to the two `useDataPersistence.js` exceljs sites (mirroring FaqModal), then optionally adding a `chart.js` manual chunk:

| Variant                            |   entry chunk |    entry gzip | lazy / extra chunks                                                                            | > 500 kB warning? |
| ---------------------------------- | ------------: | ------------: | ---------------------------------------------------------------------------------------------- | ----------------- |
| Baseline                           |   1,286.96 kB |     395.28 kB | —                                                                                              | **Yes**           |
| **A: exceljs dynamic-import only** | **346.68 kB** | **123.47 kB** | `exceljs` 939 kB / 271 kB gzip (lazy)                                                          | **No**            |
| B: A + `chart.js` manualChunk      |     140.92 kB |      52.27 kB | `chartjs` 205 kB / 70.5 kB gzip (**modulepreload**, render-blocking), `exceljs` 939/271 (lazy) | No                |

> Note: the visualizer's "chart.js 493 kB" is the pre-tree-shake module size (`ChartDisplay` imports `registerables`); the actually-emitted split chunk is 205 kB / 70.5 kB gzip.

### 2.4 Lighthouse (headless Chrome, Lighthouse 13.4)

Two static servers each served the respective `dist/` at base `/ChIC/` (per the `browser-verify-prod-build` memory — **not** `vite preview`, whose chunks 404 under headless Chromium).

**Mobile preset (simulated throttling — reproduces the issue's methodology):**

| Build               | Performance |       FCP |       LCP |   TBT |
| ------------------- | ----------: | --------: | --------: | ----: |
| Baseline            |      **58** |     7.5 s |     8.1 s | 30 ms |
| **A: exceljs-only** |      **88** | **3.0 s** | **3.1 s** | 10 ms |
| B: A + chart split  |          83 |     3.2 s |     3.7 s | 20 ms |

**Desktop preset** (for reference; less throttled): baseline 91 (FCP 1.3 s / LCP 1.4 s) → B 99 (FCP 0.6 s / LCP 0.8 s). The desktop baseline already scores 91, which is why the issue's ~55 corresponds to the mobile/throttled profile.

**Decisive finding:** **Variant A (exceljs-only) beats Variant B** on the throttled profile (88 vs 83, FCP 3.0 vs 3.2 s). Chart.js is on the critical path (it paints the main chart at load), so hoisting it into a separately-preloaded chunk adds a request and a second parse boundary **without removing render-blocking work** — a net wash-to-slightly-worse. Variant A already puts the entry at **123 kB gzip, well under the 500 kB warning**, and delivers the full FCP/LCP improvement. This is the chosen approach.

### 2.5 Tests stay green

The Variant-A prototype passed the full suite unchanged: **70/70 Vitest tests**. `useDataPersistence.test.js` exercises `processRows`/`parseCsv`/`toCsv` — pure functions that never touch exceljs — so moving exceljs to a dynamic import inside `loadDataFromExcel`/`downloadDataAsExcel` does not affect any test.

---

## 3. Part 1 — Code-split (exceljs on demand)

### 3.1 Options weighed

| Option                                                   |                                      Entry gzip |  FCP/LCP (mobile) | Behaviour risk                                                                  | Verdict                                                     |
| -------------------------------------------------------- | ----------------------------------------------: | ----------------: | ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Dynamic `import()` of exceljs** (chosen)               |                                          123 kB |             58→88 | None — same async flow FaqModal already uses; export/import are already `async` | ✅ Smallest change, fits existing pattern, meets acceptance |
| + `manualChunks` for chart.js                            |                                           52 kB |     58→83 (worse) | Low, but changes chunk graph                                                    | ❌ No first-load win; chart.js is critical-path             |
| Async `defineAsyncComponent(ChartDisplay)`               |                                          ~52 kB | chart paints late | **Changes render sequencing** — chart appears after a gap                       | ❌ Violates "zero behaviour change"                         |
| `manualChunks` vendor-splitting only (no dynamic import) | still ~395 in one entry unless exceljs isolated |        negligible | Low                                                                             | ❌ Doesn't move exceljs off the critical parse              |

**Decision: dynamic `import()` of exceljs only.** Rationale: it is the single change that (a) drops the entry under 500 kB, (b) delivers the full measured FCP/LCP win, (c) reuses the exact `(await import('exceljs')).default` idiom already in `FaqModal.vue`, and (d) carries no behaviour change because both exceljs consumers (`downloadDataAsExcel`, `loadDataFromExcel`) are already `async`.

### 3.2 The change (three edits, one file)

`src/composables/useDataPersistence.js`:

1. **Remove** the top-level `import ExcelJS from 'exceljs';` (line 2).
2. In `loadDataFromExcel` (before `new ExcelJS.Workbook()`), add `const ExcelJS = (await import('exceljs')).default;`.
3. In `downloadDataAsExcel` (before `new ExcelJS.Workbook()`), add the same line.

Both functions are already `async` and already wrapped in `try/catch`, so a dynamic-import failure surfaces through the existing `errorLoading` / `console.error` paths — no new error handling. `FaqModal.vue:168` already does this and needs no change.

### 3.3 PWA precache decision (the subtle trap — resolved)

`vite.config.js` workbox `globPatterns: ['**/*.{js,css,html,...}']` precaches **all** JS, including the new lazy `exceljs-*.js` chunk. Measured: precache goes **44 entries / 7254 KiB → 45 entries / 7253 KiB** — essentially unchanged.

**Therefore the split's payoff is first-load parse/execute, not repeat-visit transfer:**

- **First load (the acceptance target):** the render-blocking entry the browser must fetch + parse + execute before mount drops from **395 kB → 123 kB gzip**. This is exactly what moves FCP/LCP (proven: 58→88). The exceljs chunk is fetched by the service worker **after** the page is interactive, at low priority, off the critical path.
- **Repeat visit:** identical precache footprint (~7.25 MB) with or without the split — no regression, no improvement.

**Decision: leave workbox `globPatterns` unchanged.** The acceptance criteria are met without touching it, and the alternative (`globIgnores: ['**/exceljs*.js']` + a `runtimeCaching` CacheFirst rule) would trade a **strict behaviour change** — a first-time xlsx export/import while offline would fail until the chunk is runtime-cached — for a first-visit _transfer_ saving that is **not** in the acceptance set. Under the hard "zero behaviour change" constraint, that trade is out of scope.

> **Optional future work (explicitly out of scope for #29):** excluding the exceljs chunk from precache via `globIgnores` + `runtimeCaching` would cut ~271 kB gzip from first-visit background transfer, at the cost of offline xlsx export/import not working until first online use (CSV/JSON export/import are unaffected — they use no exceljs). Revisit only if first-visit data budget becomes a goal and the offline-xlsx edge is deemed acceptable.

### 3.4 Part 1 acceptance criteria

- [ ] Main **entry** chunk drops under the 500 kB warning threshold: ≤ ~347 kB (123 kB gzip), down from 1,287 kB.
- [ ] A separate `exceljs-*.js` chunk exists and is loaded only on import/export, and is **not** referenced by a `<script>`/`modulepreload` in the entry HTML.
- [ ] Vite's "chunks larger than 500 kB" warning, **if it still prints, refers only to the intentionally on-demand `exceljs` chunk** (939 kB), never the entry. This satisfies the issue's acceptance ("or the heavy deps split out and loaded on demand"). Do **not** silence it by raising `build.chunkSizeWarningLimit` — that would also hide a future entry-chunk regression.
- [ ] Lighthouse (mobile throttle, `dist` served at `/ChIC/`) FCP/LCP improve materially vs. baseline (target ≈ FCP 3.0 s / LCP 3.1 s / perf 88, matching the prototype).
- [ ] xlsx **export** and **import** still work end-to-end in the dev server and the prod build (manual check).
- [ ] `npm test` (70+ green), `lint`, `format:check`, `typecheck`, `build` all pass.

---

## 4. Part 2 — GitHub-Pages 404 fallback (formalize in build)

### 4.1 Current state (verified)

- `.github/workflows/deploy.yml:30-31` already runs **`cp dist/index.html dist/404.html`**, so production **already has a working fallback**. Confirmed live: `curl https://halbritter-lab.github.io/ChIC/<deep>` returns **HTTP 404 with the full `index.html` body**; GitHub Pages serves `404.html` and the SPA boots because the browser parses the HTML and runs the (absolute-path) module script regardless of the 404 status. A Pages-mimicking static server + headless Chrome confirmed the app **fully mounts** on `/ChIC/some/deep/path` (identical 28,377-byte mounted DOM to the root path).

### 4.2 The three gaps to close

1. **Local builds lack the fallback.** `npm run build` / `npm run preview` don't produce `dist/404.html` — only CI does. A local prod-build deep-link test fails, and any non-CI deploy path silently ships without a fallback.
2. **Coupling.** The `cp` lives in the deploy workflow, decoupled from the build that produces `dist/`. A second deploy target or a manual deploy would forget it.
3. **Cosmetic asset-path bug on deep paths.** `index.html` uses `./favicon.png` at two spots (line 477 SEO shell, line 576 splash). At root `/ChIC/` this resolves to `/ChIC/favicon.png` ✓; served as `404.html` at `/ChIC/a/b` it resolves to `/ChIC/a/favicon.png` ✗ (icon 404s). The app still boots (the module `src` is absolute), so this is cosmetic — but it's exactly the deep-path correctness this item targets.

### 4.3 Options weighed

| Option                                                                                            | Local build self-sufficient? | Extra hop?                    | Moving parts       | Verdict                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`postbuild` npm script copies index.html→404.html** (chosen)                                    | Yes                          | No                            | 1 tiny Node script | ✅ Consolidates the copy into the build; deploy.yml step becomes redundant                                                                                                |
| Document & close (no code)                                                                        | No                           | No                            | 0                  | ❌ Leaves gaps 1–3 open                                                                                                                                                   |
| `spa-github-pages` redirect (`public/404.html` with redirect script + index.html restore snippet) | Yes                          | **Yes** (redirect round-trip) | 2 scripts          | ❌ Extra complexity/hop with no benefit for a copy-of-index approach; only pays off when you must preserve the exact deep path in `location`, which this app doesn't need |

**Decision: formalize the existing copy into the build via a `postbuild` npm lifecycle script**, remove the now-redundant `cp` from `deploy.yml`, and fix the two `./favicon.png` refs to `%BASE_URL%favicon.png` (matching the absolute `%BASE_URL%` icon links already in `<head>`) so the fallback renders correctly on any depth. This keeps the copy-of-index approach (no redirect hop) while making local builds self-sufficient and decoupling correctness from the deploy workflow.

> Why not `spa-github-pages`'s redirect dance? That pattern exists to **preserve the original deep path** in the address bar via a query-string round-trip before handing back to the router. ChIC copies `index.html` wholesale, so the router already boots at the requested path with no redirect — the extra script + hop would add complexity for a guarantee this single-route app doesn't need. If a future multi-route version needs the exact path preserved through the bounce, revisit then.

### 4.4 The change

- **Add** `scripts/spa-404-fallback.mjs` (Node, no deps): copy `dist/index.html` → `dist/404.html`; fail loudly if `dist/index.html` is missing.
- **Add** to `package.json` scripts: `"postbuild": "node scripts/spa-404-fallback.mjs"` (npm runs `postbuild` automatically after `build`; the `build` string itself is unchanged).
- **Remove** the `SPA 404 fallback` step (`cp dist/index.html dist/404.html`) from `deploy.yml` — the build now produces `404.html`, which the existing `upload-pages-artifact` step already uploads.
- **Edit** `index.html`: the two `./favicon.png` occurrences (SEO shell + splash) → `%BASE_URL%favicon.png`. Root behaviour is byte-identical (`%BASE_URL%` = `/ChIC/` in build, `/` in dev); deep-path fallback now resolves the icon correctly.

`public/404.html` is intentionally **not** added: `public/` files are copied verbatim and would ship a stale, un-hashed HTML that drifts from the built `index.html` (whose script tags carry content hashes). Generating `404.html` from the built `index.html` keeps it always in sync with the current asset hashes.

### 4.5 Part 2 acceptance criteria

- [ ] `npm run build` produces `dist/404.html` byte-identical to `dist/index.html`.
- [ ] `deploy.yml` no longer contains a `cp … 404.html` step; CI/deploy still publishes `404.html`.
- [ ] Serving `dist` through a Pages-emulating static server (serves `404.html` with a 404 status on miss) and loading `/ChIC/<deep>/<path>` in a browser **mounts the full app** (disclaimer modal / input controls / footer render), and the favicon/splash icon resolves (no 404 for the icon).
- [ ] Root path `/ChIC/` behaviour and `index.html` root rendering are unchanged.
- [ ] Full CI gate green.

---

## 5. Invariants honoured

- **No new runtime dependency.** exceljs/chart.js unchanged in `package.json`; the analyzer was a throwaway `npx` run. The `postbuild` script is plain Node, zero deps.
- **`CONFIG` single source of truth**, **Chart.js dataset order + `'Patient Data'`/`'Selected Point'` labels**, and the `App.vue ↔ ChartDisplay` `defineExpose` contract are all untouched — neither part touches `ChartDisplay.vue`, `classification.js`, or `CONFIG`.
- **600 LOC cap:** `useDataPersistence.js` loses one line (net); new `scripts/spa-404-fallback.mjs` is born well under the cap. No file grows toward the cap.
- **Base path `/ChIC/`** preserved; the `%BASE_URL%` idiom is reused, not replaced.
- **Zero behaviour change:** export/import flows keep identical semantics (already async); precache footprint unchanged; root-path rendering unchanged.

---

## 6. Delivery

Per decision: **one PR closing #29, two atomic commits** (independent to review/revert):

- **Commit 1 — `perf: lazy-load exceljs to shrink the initial bundle`** (Part 1): `src/composables/useDataPersistence.js` only.
- **Commit 2 — `build: emit dist/404.html as a Pages SPA fallback`** (Part 2): `scripts/spa-404-fallback.mjs`, `package.json`, `.github/workflows/deploy.yml`, `index.html`.

The two parts are unrelated subsystems (client bundle vs. deploy plumbing); keeping them as separate commits preserves independent bisect/revert while the single PR closes the single issue. Each commit ends with its own measurable gate (§3.4 / §4.5) and the full CI command.

---

## 7. Verification plan (baked into every task)

- **Bundle gate:** capture `npm run build` chunk sizes before/after; assert no >500 kB warning and the exceljs chunk is separate.
- **Lighthouse gate:** serve `dist` at base `/ChIC/` via a static server (not `vite preview`), run Lighthouse mobile-throttle before/after, record FCP/LCP/perf.
- **404 gate:** build, assert `dist/404.html` exists and equals `dist/index.html`; serve through a Pages-emulating server (404-on-miss → `404.html`) and confirm a deep path mounts the app in a headless browser.
- **CI gate (both commits):** `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build` — all green.
