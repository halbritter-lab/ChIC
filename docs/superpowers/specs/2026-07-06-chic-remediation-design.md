# ChIC Remediation — Design Spec

- **Date:** 2026-07-06
- **Status:** Draft for review (Codex + author)
- **Author:** Bernt Popp (with Claude Code)
- **Scope:** One comprehensive program fixing all issues from the 2026-07-06 repo review (`docs/RECOMMENDATIONS.md`), grounded in the ChIC 3rd-draft manuscript.

---

## 1. Context & Goals

ChIC is a Vue 3 + Vite SPA implementing the **Charité Imaging Classification** for Polycystic Liver Disease (PLD) progression. A repository review found correctness bugs, an incomplete rebrand that breaks deployment, no quality gates, and a monolithic component structure. This spec defines a single program to fix them, make the repo safe for sustained multi-agent development, and align the app precisely with the manuscript.

**Success criteria (program-level):**
- Classification is single-source and matches the manuscript exactly; imported and manually-entered patients get identical classes.
- App builds and deploys correctly to GitHub Pages at the real URL.
- Modern lint/format/typecheck/test/CI gates exist and pass.
- No source file exceeds 600 LOC; touched code is DRY/KISS/SOLID and modular.
- Default branch and repo hygiene follow community standards.

**Non-goals:** new clinical features; changing the validated statistical model; endpoint/event modeling (the app only classifies, it does not compute liver-event outcomes); a full TypeScript migration (JSDoc + checkJs path only).

---

## 2. Authoritative Clinical Model (ground truth for WS-1)

Extracted from `ChIC_3rdDraft_Clean_2026-07-06.docx` (Methods → *New ChIC Model*; Fig. 1 legend) and `ChIC_3rdDraft_Supplement_2026-07-06.docx` (Table S1). **This section is the contract WS-1 must satisfy.**

- **Metric:** height-adjusted TLV, `htTLV = TLV(ml) / height(m)`. Manuscript requires **measured height**.
- **Model:** compound exponential growth, analogous to the Mayo Imaging Classification (Irazabal, kidney htTKV), with a **baseline principle of 600 ml/m at age 0**.
- **Classes A–E** by compound annual growth rate:
  | Class | Annual growth rate | Threshold curve (lower bound) |
  |---|---|---|
  | A | `< 1%` | below `600·1.01^age` |
  | B | `≥1% – <2%` | `≥ 600·1.01^age` |
  | C | `≥2% – <3%` | `≥ 600·1.02^age` |
  | D | `≥3% – <4%` | `≥ 600·1.03^age` |
  | E | `≥4%` | `≥ 600·1.04^age` |
- **Growth rate (LGR):** `LGR = (htTLV / 600)^(1/age) − 1` (fraction; ×100 for %). This is algebraically the compound annual growth rate `g` where `htTLV = 600·(1+g)^age`. The current code is correct; only the `/100` comment in `formulasConfig.js:31` is wrong.
- **`850` is retired.** The manuscript states the reform explicitly "replaced normalized liver volumes against a standard baseline of 850 ml at age 20 with htTLV" (per KDIGO 2025 / ERN 2026 recommendations). `CONFIG.NORMALIZATION_FACTOR = 850` and `CONFIG.CHART_Y_AXIS_MAX = 25` are dead artifacts of the predecessor (Sierks 2022) nTLV model. **Delete both.**
- **Data scale (Table S1):** cohort htTLV mean 1922 ml/m, **range 632–10344**. The chart Y-axis max of 10100 clips the top of the real range → raise ceiling to ~10500.
- **Age:** manuscript extends the lower bound to 15 (cohort range 17–81). README states 15–85; app caps at 80. `AGE_MAX` (80 vs 85) is flagged for author confirmation; not silently changed.

**Class code decision:** the extracted classifier returns the class **letter `A`–`E` directly** (manuscript nomenclature), eliminating the internal `PG1`–`PG5` codes and the `pgLabelMap` translation layer.

---

## 3. Decisions Log (locked)

| # | Decision | Choice |
|---|---|---|
| D1 | Program structure | One comprehensive plan covering all workstreams |
| D2 | Canonical classifier | 5-class A–E, `htTLV = TLV/height`, base 600, thresholds 1.01–1.04; one shared function used by manual + import paths |
| D3 | Height-less imported rows | **Coherent normalisation**: estimate htTLV using an assumed height, flagged as non-validated estimate. Never `/850`. |
| D4 | Assumed-height source | Prefer **cohort mean** of rows in the same file that carry height; fall back to `CONFIG.ASSUMED_HEIGHT_M = 1.70` m if none |
| D5 | Default branch | Make `main` the GitHub default; fast-forward it to current tip; switch local; delete `copilot/start-from-version-1` and stale `yml-edit-2`. Executed on the remote. |
| D6 | Deploy base path | `vite` build base → `/ChIC/` |
| D7 | Estimated rows | Visibly flagged in table + export; caveat text per manuscript (measured height required for validated class) |

---

## 4. Workstreams

### WS-1 · Correctness (clinical) — highest priority

**Problem:** Classification logic is duplicated and divergent. `App.vue:399-418` implements the correct 5-class model; `useDataPersistence.js:71-79` implements an obsolete 2-threshold/3-class model with a broken `/850` fallback that always yields Class A for height-less rows. Two chart methods called from `App.vue` do not exist.

**Changes:**
1. **New `src/composables/useClassification.js`** — the single source of truth:
   - `heightAdjustedTLV(tlv, height) → number`
   - `classify(htTLV, age) → 'A'|'B'|'C'|'D'|'E'` (thresholds 1.01–1.04, base 600, `≥` boundaries per §2)
   - `liverGrowthRate(age, htTLV) → number` (fraction; moved/kept from `formulasConfig.js`, comment fixed)
   - Pure functions, no Vue reactivity, fully unit-testable.
2. **`App.vue`** consumes `useClassification`; delete its inline `progressionGroup`/`pgLabelMap`/`formatPGLabel`; render class letters directly.
3. **`useDataPersistence.js` `processLoadedRow`** consumes the same `classify`; delete the 3-class logic and the `/850` fallback.
4. **Height-less rows (D3/D4):** compute assumed height = mean of same-file rows with height, else `CONFIG.ASSUMED_HEIGHT_M`; set `row.htlvEstimated = true`; classify on the estimated htTLV.
5. **Estimated flag (D7):** table shows a marker (e.g. `*` + tooltip) on estimated rows; a summary notice ("N of M rows used an estimated height — not a validated ChIC class"); exports include an `htTLV_estimated` boolean column.
6. **Chart method fix:** implement `updatePointStyle(index, color, group)` and `clearChart()` in `ChartDisplay.vue` and add to `defineExpose`, OR reroute `App.vue:644` through the existing `updateChartPoint(index, sample)`. Table group/color edits must visibly update the chart marker.
7. **Y-axis ceiling** raised to ~10500 (`ChartDisplay.vue` `CEILING_Y` + scale `max`).
8. **Remove** `CONFIG.NORMALIZATION_FACTOR` and `CONFIG.CHART_Y_AXIS_MAX`; add `CONFIG.ASSUMED_HEIGHT_M = 1.70`.

**Acceptance:** manual entry and file import of the same {age, height, tlv} yield identical class + htTLV + LGR; a height-less row is classified via estimated height and flagged; unit tests cover all five class boundaries; editing a point's group/color in the table updates the chart.

### WS-2 · 600-LOC refactor (behavior-preserving)

**Problem:** `src/App.vue` (~1020 ln) and `src/styles/app.css` (~914 ln) exceed the 600-LOC cap and mix many responsibilities.

**Changes — `App.vue` decomposition (all behavior-preserving; move, don't rewrite):**
- Composables: `useClassification` (WS-1), `usePatientForm` (input refs + validation), `useDataPoints` (add/edit/remove, `editingIndex`), `useTheme` (toggle + persistence), `useQueryParams` (the `?patientId=&age=&tlv=` embed/kiosk API — **preserved verbatim**).
- Template-download helpers folded into `useDataPersistence.js` (removes the `downloadCSVTemplate`/`downloadTemplateAsCsv` duplicate).
- Components: `FaqModal.vue` (extract inline FAQ modal), `DataTable.vue` (results table + a11y: row `role`/`tabindex`/keyboard handler, `aria-label` on the remove button).
- Inline `<style>` in `App.vue` moved to scoped styles in extracted components or CSS modules.

**Changes — `app.css` split** into per-concern modules under `src/styles/`: `base.css` (variables/theme), `layout.css`, `controls.css`, `table.css`, `progression-groups.css`, `print.css`; imported via a barrel (`styles/index.css`) or `main.js`.

**Acceptance:** every resulting `.vue`/`.js`/`.css` file < 600 LOC; `npm run build` succeeds; the app is visually and behaviorally unchanged (manual smoke of every feature + query-param modes); no file grows to reach the cap.

### WS-3 · Lint / format / typecheck

- **ESLint 9 flat config** `eslint.config.mjs`: `@eslint/js` recommended + `eslint-plugin-vue` `flat/essential` + browser/node globals + ignores (`dist`, `dev-dist`, `public`, `node_modules`). Delete `.eslintrc.js` **and** the `package.json` `eslintConfig` block. (Dev deps already installed: eslint 9, eslint-plugin-vue 10, @eslint/js, globals.)
- **Prettier** + `eslint-config-prettier` (last). `.prettierrc.json` matching existing style (single quotes; 2-space). One-time format applied within WS-2's touched files (no separate noise commit).
- **Scripts:** `lint` (check-only, no `--fix`), `lint:fix`, `format`, `format:check`, `typecheck` (`vue-tsc --noEmit`).
- `jsconfig.json` `target` → `ESNext`; `.editorconfig`; `.nvmrc` (`20`) + `package.json` `engines.node >= 20`.

**Acceptance:** `npm run lint` exits 0 with no `--fix`; `npm run format:check` clean; `npm run typecheck` runs (advisory initially).

### WS-4 · Tests (safety net for WS-1/WS-2)

- **Vitest + @vue/test-utils + jsdom + @vitest/coverage-v8** (installed). `vitest.config.js`; scripts `test`, `test:watch`, `coverage`.
- **Unit (must pass before WS-1/WS-2 land):**
  - `useClassification`: htTLV; each class boundary (A/B/C/D/E) at representative ages; LGR equals the compound growth rate for synthetic `600·(1+g)^age` inputs.
  - `useDataPersistence`: import→classify→export round-trip; height-less estimation + flag; malformed-row handling.
- **Smoke:** `App.vue` mounts; disclaimer gate; add-a-point flow updates table + chart.

**Acceptance:** `npm test` green; classification boundary tests encode the §2 table.

### WS-5 · Deploy + default branch (executed on remote)

- `vite.config.js` build base → `/ChIC/`; `router` uses `createWebHistory(import.meta.env.BASE_URL)`; footer image `src` resolved through `base`.
- Complete `pld-progression-grouper → ChIC` rebrand: PWA `manifest.start_url`/scope, contact email, README deploy URL.
- **Retire double service worker:** remove `register-service-worker` dep + `src/registerServiceWorker.js` + the `main.js` PROD import; `vite-plugin-pwa` (autoUpdate) owns registration.
- **Branch execution:** `git checkout main` (or create from origin/main) → fast-forward to current tip → push → `gh api` set default branch to `main` → switch local work → delete remote `copilot/start-from-version-1` and `yml-edit-2`. Deploy workflow already triggers on `main`.

**Acceptance:** a production build served under `/ChIC/` loads all assets (no 404); default branch is `main`; stale branches gone.

### WS-6 · CI + repo hygiene

- **CI gate:** `.github/workflows/ci.yml` (or extend `gh-pages.yml`): `npm ci` → `lint` → `test` → `build` on `pull_request` + push to non-deploy branches. Deploy job stays trunk-gated. Bump `peaceiris/actions-gh-pages` v3 → v4.
- `git rm -r --cached dist/` (stop tracking build output; `.gitignore` already lists `/dist`).
- Remove junk: `public/_old/`, `public/pgs_old/`, `dist/_old/`, `contact.md` (orphan Jekyll page; fix README link). **`external-references` is folded into README/docs References** (it holds the Mayo MIC source), not deleted blindly.
- Optimize + de-dup logos (2 MB PNGs; `src/assets/logo.png` duplicated in `public/`) — target < 100 KB each.
- `npm audit fix` for the cleanly-patchable highs/moderates; remove dead deps `core-js`, and `html2canvas`/`canvas2svg`/`chartjs-plugin-datalabels` **after grep-confirming zero runtime use**.
- README fixes: license (MIT vs the false "MIT-0"; dead `LICENSE.md` link), age range, typos, **add a dev-setup section**, align description/abstract with the manuscript.

**Acceptance:** CI runs lint+test+build on PRs; `dist/` untracked; bundle image weight materially reduced; README accurate.

### WS-7 · Project infrastructure

- `.github/dependabot.yml` (npm, weekly), `SECURITY.md`, `CONTRIBUTING.md` (with the dev-setup + 600-LOC/refactor rules), `CODEOWNERS`, PR/issue templates.

**Acceptance:** files present and valid; dependabot enabled.

---

## 5. Sequencing (within the single plan)

Even as one plan, internal order de-risks: **WS-3 (lint/format base) + WS-4 (tests) → WS-1 (correctness, pinned by tests) → WS-2 (refactor under green tests) → WS-5/WS-6/WS-7 (deploy, CI, hygiene, infra) → WS-5 branch surgery last** (after everything is green locally). Prettier mass-format rides along with WS-2's file touches.

## 6. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Refactor changes behavior | Behavior-preserving extraction + smoke tests + build gate; move code, don't rewrite |
| Classifier change alters existing users' results | It *corrects* import path to match the manuscript + manual path; documented in changelog; unit tests encode the §2 contract |
| Estimated-height rows misread as validated | Explicit flag, summary notice, export column, caveat text (D7) |
| Branch surgery disrupts collaborators | `main` FF is non-destructive (ancestor); announce; delete only fully-merged branches |
| Removing "unused" deps breaks a lazy path | grep-confirm zero references before removal; build after each removal |

## 7. Out of Scope

New clinical features; statistical re-fit; endpoint/event computation; full TypeScript migration; visual redesign.
