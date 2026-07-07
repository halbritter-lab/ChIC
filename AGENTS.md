# AGENTS.md

Guidance for AI coding agents (and humans) working in **ChIC** — the Charité Imaging Classification app. Read this before making changes. It captures the conventions, invariants, and fragile areas that are **not** obvious from the code.

## What this app is

ChIC is a single-page **clinical/research calculator for Polycystic Liver Disease (PLD) progression**. A user enters patient ID, age (15–85), height (m), and total liver volume (TLV, ml). The app:

1. Computes **height-adjusted TLV**: `htTLV = TLV / height`.
2. Assigns a **Charité Imaging Class A–E** by comparing `htTLV` against four exponential age-dependent threshold curves.
3. Derives a **Liver Growth Rate (LGR, %/yr)**.
4. Plots points on a log-scale scatter chart over shaded class bands, collects them in an editable table, and supports batch **import/export** (JSON / CSV / Excel).

It is a PWA, deployed to GitHub Pages, and gated behind a medical disclaimer. It is **informational/educational, not a diagnostic device** — preserve that framing (see `src/mixins/disclaimerMixin.js`).

## Stack

- **Vue 3** (mixed Options + Composition API — see conventions below), **vue-router 4** (single route).
- **Vite 6** build, **vite-plugin-pwa** for the service worker.
- **Chart.js 4** for the plot; **exceljs** for Excel I/O.
- Plain **JavaScript** (no TypeScript). **ESLint** (flat config) + **Prettier** + **Vitest**; **vue-tsc** typecheck is advisory.
- Node 20, pinned via `.nvmrc` + `package.json` `engines`.

## Commands

```bash
npm ci            # install (uses package-lock.json)
npm run dev       # Vite dev server on http://localhost:8137
npm run build     # production build -> dist/
npm run preview   # serve the production build locally
npm run lint      # eslint . — CHECK-ONLY (does not mutate files)
npm run lint:fix  # eslint . --fix
npm run format:check   # prettier --check .
npm test          # vitest run
npm run typecheck # vue-tsc --noEmit (advisory)
```

- **`npm run lint` is check-only** (`eslint .`); use `npm run lint:fix` to auto-fix. CI (`.github/workflows/ci.yml`) runs `lint → format:check → typecheck → test → build`.
- **There ARE tests now** (Vitest, under `src/**/__tests__/`). Verify a change with `npm test` + `npm run build`, and exercise the affected flow in `npm run dev`. State honestly if a change has no test coverage.

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

1. **Classification uses class letters `A`–`E` end to end.** State stores `class` (a letter); the display label comes from `formatClassLabel` in `src/domain/classification.js` (`'A' → 'Class A'`). Legacy `PG1`–`PG5` codes only ever appear in _imported files_ and are mapped to letters at the import boundary via `legacyPgToLetter`. Don't reintroduce internal `PG*` codes.

2. **Classification is unified in one pure module — keep it that way.** `src/domain/classification.js` (`classify`, `heightAdjustedTLV`, `liverGrowthRate`), fed by `CONFIG.MODEL`, is the single source of truth. Both the interactive path (`App.vue` `progressionGroup`, ~`:235`) and the import path (`useDataPersistence.js` `processRows`) call it, so a typed-in and an imported patient get the same A–E class. If you change the clinical model, change it **only here** — never fork a second copy (that fork was the original bug).

3. **Chart datasets are order-sensitive.** `ChartDisplay.vue` (~`:120–289`) paints class bands using dataset **array order**, fractional `order` values, and relative `fill: '+1'/'-1'` references between adjacent datasets. Inserting or reordering a dataset silently breaks the shaded regions.

4. **Chart dataset labels are magic keys.** `updateChart` finds the patient series by `label === 'Patient Data'`; download logic hides `label === 'Selected Point'`. **Do not rename these strings.**

5. **The `App.vue` ↔ `ChartDisplay` imperative contract is `defineExpose` + `ref`.** `ChartDisplay.vue` exposes `{ downloadChart, updateChartPoint, updatePointStyle, clearChart }` (`defineExpose`, ~`:473`). `clearChart` clears **only** the `Patient Data` and `Selected Point` datasets — never the threshold curves / class fills. When adding imperative chart ops, add them to `defineExpose` and keep them dataset-label-scoped.

6. **Query-param API (embed/kiosk mode).** `App.vue` (~`:318`) reads `?patientId=&age=&tlv=` (auto-calculates) plus `?acknowledgeBanner=true` and `showFooter/showCitation/showDocumentation/showControls=false`. Preserve these when refactoring init.

7. **`CONFIG` (`src/config/config.js`) is the single source of truth for constants.** Model params (`CLASS_BASELINE_ML_PER_M: 600`, `GROWTH_RATE_CUTOFFS`, `ASSUMED_HEIGHT_M`), input ranges, and chart Y/X bounds + tick arrays + `CLASS_COLORS` all live there; the domain module and `ChartDisplay.vue` import from it. The old `NORMALIZATION_FACTOR: 850` import fallback is **gone** — height-less imports estimate htTLV from the cohort-mean height (else `CONFIG.MODEL.ASSUMED_HEIGHT_M`) and are flagged as estimates. Add new constants to `CONFIG`, not inline.

## Deployment / config (resolved — kept for context)

- **Base path** is `/ChIC/` in build, `/` in dev (`vite.config.js:7`); the router passes `import.meta.env.BASE_URL` to `createWebHistory`, and footer logos resolve through `withBase(...)` in `AppFooter.vue`. Assets serve correctly at `https://halbritter-lab.github.io/ChIC/`.
- **CI is split:** `.github/workflows/ci.yml` runs `lint → format:check → typecheck → test → build` on PRs/pushes; `.github/workflows/deploy.yml` builds and publishes to Pages **on push to `main`** (now the default branch), with a `404.html` SPA fallback.
- **`dist/` is no longer tracked** (`.gitignore` is honored); CI rebuilds it. Don't commit build output.
- **PWA is owned solely by `vite-plugin-pwa`** (autoUpdate `sw.js`); the old hand-rolled `registerServiceWorker.js` was removed.

## When you make changes

- Prefer the **smallest change that fits the existing pattern**. Match surrounding style, naming, and comment density.
- Honor the **600 LOC cap and Boy-Scout refactor rules above** — every file you touch comes out DRY/KISS/SOLID, modularized, and under the cap.
- After code changes: run `npm test`, `npm run lint`, `npm run format:check`, and `npm run build` (all must pass). Add/extend Vitest coverage for logic you touch; state honestly where a change has none.
- If you fix a bug listed above, update this file so the next agent isn't warned about a problem that's already solved.
- Don't add dependencies, formatters, or CI without being asked — see `docs/RECOMMENDATIONS.md` for the agreed roadmap and pick from it.

## Pointers

- Product/domain context: `README.md`
- Prioritized improvement roadmap: `docs/RECOMMENDATIONS.md`
- Deep architecture notes are inline in this file; the biggest risk is always `App.vue`.
