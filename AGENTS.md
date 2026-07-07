# AGENTS.md

Guidance for AI coding agents (and humans) working in **ChIC** — the Charité Imaging Classification app. Read this before making changes. It captures the conventions, invariants, and fragile areas that are **not** obvious from the code.

## What this app is

ChIC is a single-page **clinical/research calculator for Polycystic Liver Disease (PLD) progression**. A user enters patient ID, age (15–80), height (m), and total liver volume (TLV, ml). The app:

1. Computes **height-adjusted TLV**: `htTLV = TLV / height`.
2. Assigns a **Charité Imaging Class A–E** by comparing `htTLV` against four exponential age-dependent threshold curves.
3. Derives a **Liver Growth Rate (LGR, %/yr)**.
4. Plots points on a log-scale scatter chart over shaded class bands, collects them in an editable table, and supports batch **import/export** (JSON / CSV / Excel).

It is a PWA, deployed to GitHub Pages, and gated behind a medical disclaimer. It is **informational/educational, not a diagnostic device** — preserve that framing (see `src/mixins/disclaimerMixin.js`).

## Stack

- **Vue 3** (mixed Options + Composition API — see conventions below), **vue-router 4** (single route).
- **Vite 6** build, **vite-plugin-pwa** for the service worker.
- **Chart.js 4** for the plot; **exceljs** for Excel I/O.
- Plain **JavaScript** (no TypeScript), **ESLint** for linting. No test framework yet.
- Node 20 in CI; repo currently has no `.nvmrc`/`engines` pin.

## Commands

```bash
npm ci            # install (uses package-lock.json)
npm run dev       # Vite dev server on http://localhost:8137
npm run build     # production build -> dist/
npm run preview   # serve the production build locally
npm run lint      # ⚠️ runs eslint WITH --fix — mutates files. See below.
```

- **`npm run lint` auto-fixes in place.** There is no check-only lint script yet. In CI or when you want to _see_ violations without changing files, run:
  `npx eslint . --ext .vue,.js,.jsx,.cjs,.mjs --ignore-path .gitignore`
- There are **no tests**. Do not claim a change is verified by tests. Verify by running `npm run build` (must succeed) and exercising the affected flow in `npm run dev`.

## Architecture map — where things live

| Path                                                                     | Role                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/App.vue` (~1020 ln)                                                 | **The app.** Root component _and_ the only router destination. Holds nearly all state (inputs, validation, `dataPoints`, theme, modals, query-param init, template downloads). **Almost every feature change touches this file.** |
| `src/components/InputControls.vue`                                       | Patient-input form. `<script setup>`, `defineProps`/`defineEmits`, v-model via `update:*` events.                                                                                                                                 |
| `src/components/ChartDisplay.vue` (~505 ln)                              | Chart.js scatter plot. Builds the threshold curves + class bands + patient points. Exposes imperative methods via `defineExpose`.                                                                                                 |
| `src/composables/useDataPersistence.js`                                  | File import/export (JSON/CSV/Excel). Re-computes htTLV/class/LGR for loaded rows.                                                                                                                                                 |
| `src/components/AppHeader.vue` / `AppFooter.vue` / `DisclaimerModal.vue` | Chrome: nav ribbon, footer/citation, disclaimer gate.                                                                                                                                                                             |
| `src/config/config.js`                                                   | `CONFIG` constants: input limits, chart X-axis, modal sizing.                                                                                                                                                                     |
| `src/config/formulasConfig.js`                                           | Threshold curves and LGR math.                                                                                                                                                                                                    |
| `src/mixins/disclaimerMixin.js` / `footerMixin.js`                       | **Static content** (disclaimer text, footer links) as Options-API `data()` mixins. Edit content _here_, not in the components.                                                                                                    |
| `src/router/index.js`                                                    | Single `/` → `App.vue` route.                                                                                                                                                                                                     |
| `src/styles/app.css` (~914 ln)                                           | Global styles + theming CSS variables + print rules.                                                                                                                                                                              |

## Conventions

- **Child components use `<script setup>`** with explicit `defineProps`/`defineEmits`. Follow that for any new component.
- **`App.vue` uses `setup()` returning a big object, plus two Options-API `mixins`.** This is a half-finished migration. Prefer moving new shared state into **composables** (`src/composables/`), not new mixins.
- **v-model contract:** children emit `update:<prop>`; the parent (`App.vue`) owns the state. Keep it that way — don't introduce a store for one screen unless asked.
- **Indentation is 2 spaces** in `.vue`/most `.js` (note: `main.js` currently uses tabs — an inconsistency, not a rule to copy).
- **Path alias:** `@` → `/src` (configured in `vite.config.js` and `jsconfig.json`).
- Content strings that repeat (disclaimer, footer, citation) live in **config/mixins**, not inline in templates.

## Code size & refactoring rules (hard rules)

- **600 LOC hard cap per file.** No source file (`.vue`, `.js`, `.css`) may exceed **600 lines**. New files must be born under the cap.
- **Boy-Scout refactor on touch.** Any file you modify, you leave cleaner than you found it. Apply **DRY** (extract duplication into one source of truth), **KISS** (the simplest thing that works — no speculative abstraction), **SOLID** (single responsibility; small, focused units with clear inputs/outputs), and **modularize** (split god files into composables / child components / focused modules). If a file you touch is over 600 LOC, split it as part of your change until each resulting file is under the cap.
- **Known over-cap files — split them when you touch them, don't grow them:** `src/App.vue` (~1020 ln), `src/styles/app.css` (~914 ln). Carve state into composables (`src/composables/`), UI into child components, and styles into per-concern modules rather than adding lines here.
- **Extractions must be behavior-preserving.** Move logic, don't rewrite it. Verify with `npm run build` + a manual check in the dev server (there are no tests yet — add them alongside the refactor where practical).

## Load-bearing invariants — do not break these

These are verified, fragile facts. Changing them silently breaks features.

1. **Two class codes exist: internal `PG1`–`PG5` vs. UI `Class A`–`E`.** The mapping is `pgLabelMap` / `formatPGLabel` in `App.vue` (`PG1→A … PG5→E`). Any classification change must keep both in sync.

2. **⚠️ Classification is currently duplicated and OUT OF SYNC across two files (known bug).**
   - Interactive path: `App.vue` `progressionGroup()` (~`:409`) uses **four** thresholds → **five** classes (`PG1`–`PG5`, i.e. Class A–E).
   - Import path: `useDataPersistence.js` `processLoadedRow()` (~`:72`) uses **two** thresholds → only **three** classes (`PG1`/`PG2`/`PG3`).
   - **Consequence:** the same patient gets a different class when typed in vs. loaded from a file; imported rows can never be Class D/E. If you touch classification, fix **both** or (better) extract one shared classifier in `formulasConfig.js` and call it from both paths.

3. **Chart datasets are order-sensitive.** `ChartDisplay.vue` (~`:120–289`) paints class bands using dataset **array order**, fractional `order` values, and relative `fill: '+1'/'-1'` references between adjacent datasets. Inserting or reordering a dataset silently breaks the shaded regions.

4. **Chart dataset labels are magic keys.** `updateChart` finds the patient series by `label === 'Patient Data'`; download logic hides `label === 'Selected Point'`. **Do not rename these strings.**

5. **The `App.vue` ↔ `ChartDisplay` imperative contract is `defineExpose` + `ref`, and is partly broken.** `ChartDisplay.vue:449` exposes only `{ downloadChart, updateChartPoint }`. `App.vue` also calls `updatePointStyle(...)` (`:644`) and `clearChart()` (`:692`) — **these methods do not exist**; the calls are silent no-ops (swallowed by `?.`). When adding imperative chart ops, add them to `defineExpose`. Don't assume the two phantom calls work.

6. **Query-param API (embed/kiosk mode).** `App.vue` (~`:318`) reads `?patientId=&age=&tlv=` (auto-calculates) plus `?acknowledgeBanner=true` and `showFooter/showCitation/showDocumentation/showControls=false`. Preserve these when refactoring init.

7. **Config is split-brain.** Input limits come from `CONFIG` (`config/config.js`), but chart **Y-axis bounds, tick arrays, colors, and the constants `600`/`10100`/`850`** are hardcoded in `ChartDisplay.vue` / `formulasConfig.js`. Changing a limit in one place does not propagate. `NORMALIZATION_FACTOR: 850` (import fallback) and `600` (threshold base) are unreconciled — don't assume they're the same knob.

## Known deployment / config bugs (fix deliberately, verify against live URL)

- **`vite.config.js` `base` is `/pld-progression-grouper/`** but this repo is `halbritter-lab/ChIC` (Pages serves at `/ChIC/`). This is leftover from the sibling project — assets will 404 on the real Pages path. Confirm the intended URL before changing.
- **CI deploys only on push to `main`**, but the GitHub default branch is `copilot/start-from-version-1`. Landing on the default branch does not deploy.
- **`dist/` is committed** despite `.gitignore` listing `/dist`. CI rebuilds it; don't hand-edit committed build output.
- **Service worker is doubly registered:** `vite-plugin-pwa` (autoUpdate) self-registers `sw.js`, but `src/registerServiceWorker.js` (imported in `main.js` PROD) also registers a nonexistent `service-worker.js` using Vue-CLI-era `process.env.*` globals that are undefined under Vite. The hand-rolled path is dead/broken; let the plugin own PWA.

## When you make changes

- Prefer the **smallest change that fits the existing pattern**. Match surrounding style, naming, and comment density.
- Honor the **600 LOC cap and Boy-Scout refactor rules above** — every file you touch comes out DRY/KISS/SOLID, modularized, and under the cap.
- After code changes: run `npm run build` (must pass) and `npx eslint <changed files>` (see check-only command above). State honestly that there are no tests.
- If you fix a bug listed above, update this file so the next agent isn't warned about a problem that's already solved.
- Don't add dependencies, formatters, or CI without being asked — see `docs/RECOMMENDATIONS.md` for the agreed roadmap and pick from it.

## Pointers

- Product/domain context: `README.md`
- Prioritized improvement roadmap: `docs/RECOMMENDATIONS.md`
- Deep architecture notes are inline in this file; the biggest risk is always `App.vue`.
