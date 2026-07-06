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

**Class code decision & migration (revised per review):** the domain classifier returns the class **letter `A`–`E` directly** (manuscript nomenclature). Because the current `PG1`–`PG5` codes are load-bearing in CSS and templates, this requires an explicit migration map, not a silent swap:

| Layer | Old | New |
|---|---|---|
| Domain return value | `'PG1'..'PG5'` | `'A'..'E'` |
| CSS selector (`app.css:100`, `.progression-group PGx` in `App.vue:158-170`) | `.PG1..PG5` | `.class-a..class-e` |
| UI/display label | via `pgLabelMap` | `Class A..E` (formatter takes a letter) |
| Export column value | `PG1..PG5` | `Class A..E` |
| **Legacy import compatibility** | — | Import must still accept old files carrying `pg: 'PG1'..'PG5'` and map them to `A..E` (one-way shim) |

The `pgLabelMap` translation layer is removed once callers use letters. A single `formatClassLabel('A') → 'Class A'` helper lives with the domain module.

---

## 3. Decisions Log (locked)

| # | Decision | Choice |
|---|---|---|
| D1 | Program structure | One comprehensive plan covering all workstreams |
| D2 | Canonical classifier | 5-class A–E, `htTLV = TLV/height`, base 600, thresholds 1.01–1.04; one shared function used by manual + import paths |
| D3 | Height-less imported rows | **Coherent normalisation**: estimate htTLV using an assumed height. Stored in **separate `estimatedHtTLV`/`estimatedClass` fields** — the validated `class` field stays empty. Never `/850`. |
| D4 | Assumed-height source | Prefer **cohort mean** of rows in the same file that carry height; fall back to `CONFIG.ASSUMED_HEIGHT_M = 1.70` m if none |
| D5 | Default branch | Make `main` the GitHub default; fast-forward it to current tip; switch local; delete `copilot/start-from-version-1` and stale `yml-edit-2`. Executed on the remote. |
| D6 | Deploy base path | `vite` build base → `/ChIC/` |
| D7 | Estimated rows | Estimate rendered in a **distinct visual treatment** (e.g. italic + `≈` + "unvalidated estimate" tooltip), never in the validated class column; export carries `htTLV_estimated` boolean + estimated columns; summary notice "N of M rows used an estimated height". |
| D8 | **Age range** (open — needs author sign-off) | One of `15–80` / `15–81` / `15–85`, applied consistently to input validation, chart x-axis, README, query-param clamping, and tests. **Blocking checkpoint for WS-1.** |

---

## 4. Workstreams

### WS-1 · Correctness (clinical) — highest priority

**Problem:** Classification logic is duplicated and divergent. `App.vue:399-418` implements the correct 5-class model; `useDataPersistence.js:71-79` implements an obsolete 2-threshold/3-class model with a broken `/850` fallback that always yields Class A for height-less rows. Two chart methods called from `App.vue` do not exist.

**Changes:**
1. **New pure domain module `src/domain/classification.js`** — the single source of truth (a *module*, not a composable: it holds no Vue reactivity, per review finding #7):
   - `heightAdjustedTLV(tlv, height) → number`
   - `classify(htTLV, age) → 'A'|'B'|'C'|'D'|'E'` (thresholds 1.01–1.04, base 600, `≥` boundaries per §2; operates on **unrounded numeric** htTLV)
   - `liverGrowthRate(age, htTLV) → number` (fraction; moved from `formulasConfig.js`, comment fixed)
   - `formatClassLabel('A') → 'Class A'`; `legacyPgToLetter('PG1') → 'A'` (import shim)
   - Fully unit-testable; `formulasConfig.js` either re-exports from here or is absorbed.
2. **`App.vue`** consumes the domain module; delete inline `progressionGroup`/`pgLabelMap`/`formatPGLabel`; render letters. Apply the **PG→letter CSS/template migration** from §2 (`.PG1..PG5` → `.class-a..class-e`, template class bindings updated).
3. **`useDataPersistence.js` `processLoadedRow`** consumes the same `classify`; delete the 3-class logic and the `/850` fallback; accept legacy `pg` values via `legacyPgToLetter`.
4. **Height-less rows (D3/D4):** compute assumed height = mean of same-file rows with height, else `CONFIG.ASSUMED_HEIGHT_M`. Populate **`estimatedHtTLV` + `estimatedClass`** and set `htlvEstimated = true`; **leave the validated `htlv`/`class` fields empty** so an estimate can never be mistaken for a measured result.
5. **Estimated presentation (D7):** distinct visual treatment (italic + `≈` + "unvalidated estimate" tooltip) in the estimated columns; summary notice "N of M rows used an estimated height — not a validated ChIC class"; export carries `htTLV_estimated` boolean.
6. **Chart method fix:** implement `updatePointStyle(index, color, group)` and `clearChart()` in `ChartDisplay.vue` and add to `defineExpose`, OR reroute `App.vue:644` through the existing `updateChartPoint(index, sample)`. Table group/color edits must visibly update the chart marker.
7. **Chart y-domain (review findings #1/#3):** raise ceiling to ~10500 (cohort max 10344) **and** stop clipping low values — `min: 600` currently hides valid htTLV < 600 (a small/young liver, e.g. TLV 800 / 1.8 m = 444, is off-scale on the log axis). Lower the log-axis `min` to a clinically sensible floor (e.g. 100) or render out-of-domain points with an explicit floor indicator. Define the y-domain explicitly in config, not as inline magic numbers.
8. **Config:** remove `CONFIG.NORMALIZATION_FACTOR` and `CONFIG.CHART_Y_AXIS_MAX`; add `CONFIG.ASSUMED_HEIGHT_M = 1.70` and explicit chart y-domain (`CHART_Y_MIN`, `CHART_Y_MAX`).
9. **Age-range checkpoint (D8):** *blocking* — the confirmed range drives `AGE_MIN`/`AGE_MAX`, chart x-axis, validation, README, query-param clamping, and the boundary tests. Do not proceed past WS-1 with a divergent range.

**Acceptance:** manual entry and file import of the same {age, height, tlv} yield identical `class` + htTLV + LGR; a height-less row produces an `estimatedClass` (flagged), and its validated `class` stays empty; legacy `PG1–PG5` import files still load; unit tests cover all five class boundaries with epsilon policy; editing a point's group/color in the table updates the chart; no htTLV value in the cohort range (632–10344) or below 600 is clipped.

### WS-2 · 600-LOC refactor (behavior-preserving)

**Problem:** `src/App.vue` (~1020 ln) and `src/styles/app.css` (~914 ln) exceed the 600-LOC cap and mix many responsibilities.

**Changes — `App.vue` decomposition (all behavior-preserving; move, don't rewrite):**
- Domain module: `domain/classification.js` (WS-1, pure). Composables: `usePatientForm` (input refs + validation), `useDataPoints` (add/edit/remove, `editingIndex`), `useTheme` (toggle + persistence), `useQueryParams` (the `?patientId=&age=&tlv=` embed/kiosk API — **preserved verbatim**).
- Template-download helpers folded into `useDataPersistence.js` (removes the `downloadCSVTemplate`/`downloadTemplateAsCsv` duplicate).
- Components: `FaqModal.vue` (extract inline FAQ modal), `DataTable.vue` (results table + a11y: row `role`/`tabindex`/keyboard handler, `aria-label` on the remove button).
- Inline `<style>` in `App.vue` moved to scoped styles in extracted components or CSS modules.

**Changes — `app.css` split** into per-concern modules under `src/styles/`: `base.css` (variables/theme), `layout.css`, `controls.css`, `table.css`, `progression-groups.css`, `print.css`; imported via a barrel (`styles/index.css`) or `main.js`.

**Acceptance:** every resulting `.vue`/`.js`/`.css` file < 600 LOC; `npm run build` succeeds; the app is visually and behaviorally unchanged (manual smoke of every feature + query-param modes); no file grows to reach the cap.

### WS-3 · Lint / format / typecheck

- **Explicit dependency changes** (review finding #5 — these are **not** yet in `package.json`; the earlier working-tree install did not persist): add dev deps `eslint@9`, `eslint-plugin-vue@10`, `@eslint/js`, `globals`, `prettier`, `eslint-config-prettier`, `vue-tsc`, `typescript`; remove `eslint@8`/`eslint-plugin-vue@9`. Commit the updated `package.json` **and** regenerated `package-lock.json`.
- **ESLint 9 flat config** `eslint.config.mjs`: `@eslint/js` recommended + `eslint-plugin-vue` `flat/essential` + browser/node globals + ignores (`dist`, `dev-dist`, `public`, `node_modules`). Delete `.eslintrc.js` **and** the `package.json` `eslintConfig` block.
- **Expected fallout:** migrating from the ESLint 8 eslintrc (`vue3-recommended`) to ESLint 9 flat `flat/essential` changes the active rule set; `js.configs.recommended` newly enables core rules (`no-unused-vars`, `no-undef`) that will flag existing dead imports (e.g. `useRoute` in `router/index.js`, the commented-out annotation plugin). Triage: fix trivial violations, downgrade noisy stylistic rules to `warn` to keep the baseline green, and record any deferred items.
- **Prettier** + `eslint-config-prettier` (last). `.prettierrc.json` matching existing style (single quotes; 2-space). One-time format applied within WS-2's touched files (no separate noise commit).
- **Scripts:** `lint` (check-only, no `--fix`), `lint:fix`, `format`, `format:check`, `typecheck` (`vue-tsc --noEmit`).
- `jsconfig.json` `target` → `ESNext`; `.editorconfig`; `.nvmrc` (`20`) + `package.json` `engines.node >= 20`.

**Acceptance:** `npm run lint` exits 0 with no `--fix`; `npm run format:check` clean; `npm run typecheck` runs (advisory initially); `package.json`/lockfile reflect the new toolchain.

### WS-4 · Tests (safety net for WS-1/WS-2)

- **Add dev deps** (not yet installed): `vitest`, `@vue/test-utils`, `jsdom`, `@vitest/coverage-v8`. `vitest.config.js` (jsdom env, globals); scripts `test`, `test:watch`, `coverage`.
- **Unit (must pass before WS-1/WS-2 land):**
  - `domain/classification`: htTLV; each class boundary A/B/C/D/E. **Epsilon/rounding policy (finding #8):** classifier consumes *unrounded* htTLV with `≥` thresholds; tests assert at `threshold`, `threshold − ε`, `threshold + ε` for each cutoff, and test **display rounding separately** from classification. LGR equals the compound growth rate for synthetic `600·(1+g)^age` inputs.
  - `useDataPersistence`: import→classify→export round-trip; height-less estimation populates `estimatedClass` and leaves `class` empty; legacy `PG1–PG5` mapping; malformed-row handling.
- **Smoke:** `App.vue` mounts; disclaimer gate; add-a-point flow updates table + chart.

**Acceptance:** `npm test` green; classification boundary tests encode the §2 table with explicit epsilon handling.

### WS-5 · Deploy + default branch (executed on remote)

- `vite.config.js` build base → `/ChIC/`; `router` uses `createWebHistory(import.meta.env.BASE_URL)`; footer image `src` resolved through `base`.
- Complete `pld-progression-grouper → ChIC` rebrand: PWA `manifest.start_url`/scope, contact email, README deploy URL.
- **Retire double service worker:** remove `register-service-worker` dep + `src/registerServiceWorker.js` + the `main.js` PROD import; `vite-plugin-pwa` (autoUpdate) owns registration.
- **Branch execution:** `git checkout main` (or create from origin/main) → fast-forward to current tip → push → `gh api` set default branch to `main` → switch local work → delete remote `copilot/start-from-version-1` and `yml-edit-2`. Deploy workflow already triggers on `main`.

**Acceptance:** a production build served under `/ChIC/` loads all assets (no 404); default branch is `main`; stale branches gone.

### WS-6 · CI + repo hygiene

- **Split CI and deploy (review finding #6):** separate `.github/workflows/ci.yml` (runs `npm ci` → `lint` → `test` → `build` on `pull_request` + push) from `.github/workflows/deploy.yml` (runs **only** on push to `main`, holds the Pages deploy + `contents: write`/environment permissions). No deploy action ever runs in a PR context. Bump `peaceiris/actions-gh-pages` v3 → v4 (or migrate to `actions/deploy-pages`).
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

---

## 8. Review History

**Rev 2 — 2026-07-06, Codex (GPT-5.x, high reasoning), dual-lens (data scientist + SPA engineer).** Incorporated:
- P0 height-less rows → estimate stored in **separate `estimatedHtTLV`/`estimatedClass`** fields; validated `class` left empty (D3/D7, WS-1.4/5).
- P0 age range → **blocking decision D8** with all consumers aligned (WS-1.9).
- P1 chart low-value clipping (`min: 600`) → explicit y-domain, floor handling (WS-1.7).
- P1 PG→letter migration → explicit CSS/template/export map + **legacy import shim** (§2, WS-1.2/3).
- P1 false "deps installed" claim → **explicit dependency install + lockfile** steps and lint-fallout triage (WS-3/WS-4).
- P1 CI/deploy coupling → **split `ci.yml` / `deploy.yml`** (WS-6).
- P2 pure-module naming → `src/domain/classification.js`, not a composable (WS-1.1).
- P2 test epsilon/rounding policy → explicit boundary + rounding tests (WS-4).

**Open for author:** D8 age range (15–80 / 15–81 / 15–85).
