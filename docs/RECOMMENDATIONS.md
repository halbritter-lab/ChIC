# ChIC — Repository Review & Improvement Roadmap

_Review date: 2026-07-06. Scope: full-repo audit for correctness, tooling, CI/CD, and readiness for sustained multi-agent development._

This document is the agreed backlog. Items are grouped by tier and ordered by value/effort. Effort: **S** ≈ <1h, **M** ≈ half-day, **L** ≈ multi-day. Every claim here was verified against the code.

---

## TL;DR

The app builds and works, but it carries **three real correctness bugs**, an **incomplete rebrand that breaks the deploy path**, and **no quality gates** (no check-only lint, no tests, no CI lint, EOL ESLint). None are hard to fix. Do Tier 0 (correctness + deploy) first — those affect users. Then Tier 1 (tooling foundation) to make the repo safe for parallel/agentic work. Tiers 2–3 are polish and hardening.

---

## Tier 0 — Correctness & deployment (fix first; these affect users)

| # | Issue | Evidence | Fix | Effort |
|---|---|---|---|---|
| 0.1 | **Classification algorithm duplicated & out of sync.** Manual entry uses 4 thresholds → 5 classes (A–E); file import uses 2 thresholds → 3 classes. Same patient gets a different class depending on entry path; imported rows can never be Class D/E. | `App.vue:409` (`progressionGroup`, PG1–PG5) vs `useDataPersistence.js:72` (`processLoadedRow`, only `calculatePG2/PG3Threshold`) | Extract one shared classifier into `formulasConfig.js`; call it from both paths. | **M** |
| 0.2 | **`App.vue` calls chart methods that don't exist** → silent no-ops via `?.`. Editing a point's group/color in the table never updates the chart marker. | `App.vue:644` `updatePointStyle(...)`, `App.vue:692` `clearChart()`; `ChartDisplay.vue:449` exposes only `{ downloadChart, updateChartPoint }` | Either implement + `defineExpose` the missing methods, or route the table-edit path through the existing `updateChartPoint(index, sample)`. | **S–M** |
| 0.3 | **Import path diverges on htTLV too.** Rows without height fall back to `TLV / 850` (`NORMALIZATION_FACTOR`), while the interactive path requires height and uses `TLV / height`; threshold base is `600`. Loaded rows are normalized by a different constant, skewing class/LGR. | `useDataPersistence.js:70` vs `App.vue:384` | Decide one rule; reconcile `850` vs `600`; reject or clearly flag height-less rows. | **S–M** |
| 0.4 | **Vite `base` points at the wrong repo.** `base` = `/pld-progression-grouper/` but this is `halbritter-lab/ChIC` (Pages serves `/ChIC/`). Hashed assets + `%BASE_URL%` icons 404 on the real Pages path. | `vite.config.js:7` | Set `base = command === 'build' ? '/ChIC/' : '/'` **after confirming the live Pages URL** (the sibling `pld-progression-grouper` repo may still be the intended host — verify first). | **S** |
| 0.5 | **CI deploys only on push to `main`, but the default branch is `copilot/start-from-version-1`.** Landing on the default branch does not deploy. | `.github/workflows/gh-pages.yml` trigger; `origin/HEAD → copilot/start-from-version-1` | Rename `copilot/start-from-version-1` → `main` and delete the copilot branch, **or** change the workflow trigger. Then delete dead branch `yml-edit-2` (fully merged). | **S** |
| 0.6 | **Router omits the base path.** `createWebHistory()` has no base arg, so deep links/refresh break under the Pages subpath. Footer logos use bare `:src` filenames that also ignore `base`. | `router/index.js:14`; `footerMixin.js:9,15` | Pass `import.meta.env.BASE_URL` to `createWebHistory()`; resolve footer images through the alias/`base`. | **S** |

---

## Tier 1 — Tooling foundation (makes the repo safe for sustained & multi-agent dev)

| # | Item | Why | Fix | Effort |
|---|---|---|---|---|
| 1.1 | **Resolve dual ESLint config.** `.eslintrc.js` (`vue3-recommended`) silently wins; the `package.json` `eslintConfig` block (`vue3-essential` + `eslint:recommended` + `env`) is **dead**. Real behavior is undocumented. | Confusing for humans and agents; lost `eslint:recommended` core rules and `env:node`. | Keep exactly one config. Recommended: migrate straight to flat config (1.2). | **S** |
| 1.2 | **Migrate to ESLint 9 flat config; bump plugin.** ESLint 8 is **EOL**. | 2026 standard; eslint-plugin-vue 10 targets flat config. | `npm i -D eslint@9 eslint-plugin-vue@10 @eslint/js globals`; add `eslint.config.js` with `js.configs.recommended` + `pluginVue.configs['flat/recommended']` + browser/node globals; delete both legacy configs. | **M** |
| 1.3 | **Split the lint script; gate CI on it.** `lint` runs `--fix` by default (mutates files, can't fail-gate); CI runs no lint at all. | Agents and CI need a non-mutating check. | `"lint": "eslint . --ext .vue,.js,.jsx,.cjs,.mjs --ignore-path .gitignore"` + `"lint:fix": "... --fix"`. Add a `lint` + `build` job to CI that runs on PRs. | **S** |
| 1.4 | **Add a test framework + first tests.** Zero tests today. | Nothing protects the formulas/classification during refactors. | `npm i -D vitest @vue/test-utils jsdom @vitest/coverage-v8`; scripts `test`/`test:watch`. Seed with unit tests on `formulasConfig.js` (thresholds, LGR) and `useDataPersistence.js` (round-trip import/export) — these lock down the Tier 0 fixes. | **M** |
| 1.5 | **Add Prettier (or ESLint Stylistic).** No formatter; style is inconsistent (2-space vs tabs in `main.js`). | Deterministic formatting removes diff noise — critical when multiple agents edit in parallel. | `npm i -D prettier eslint-config-prettier`; `.prettierrc.json` matching existing style; `eslint-config-prettier` last in the ESLint config; `format` script; reformat once. | **S** |
| 1.6 | **Pin Node.** No `.nvmrc`/`engines`; CI is Node 20, local is 24 → drift. | Reproducible installs/builds across humans, agents, CI. | Add `.nvmrc` (`20`) + `"engines": { "node": ">=20" }`; have CI `setup-node` read `.nvmrc`. | **S** |
| 1.7 | **Add `.editorconfig`.** Only `.gitattributes` (LF) exists. | Consistent whitespace at the editor level. | `root=true`, `[*]` → `indent_style=space`, `indent_size=2`, `end_of_line=lf`, `charset=utf-8`, `insert_final_newline=true`, `trim_trailing_whitespace=true`. | **S** |
| 1.8 | **Stop tracking `dist/`.** 43 committed build artifacts (~3.6 MB) churn on every build, against the repo's own `/dist` ignore. | Merge noise; CI rebuilds fresh anyway. | `git rm -r --cached dist` and commit. | **S** |
| 1.9 | **Sync lockfile version.** `package-lock.json` says `0.2.0`, `package.json` says `0.2.1`. | Lock drift. | Regenerate via `npm install` after version bumps (or use `npm version`). | **S** |

---

## Tier 2 — Cleanup & hygiene

| # | Item | Evidence | Fix | Effort |
|---|---|---|---|---|
| 2.1 | **Remove dead dependencies.** No `src` reference to `core-js`, `html2canvas`, `canvas2svg`, `chartjs-plugin-datalabels`. `register-service-worker` is redundant with vite-plugin-pwa. | grep of `src/`; `package.json` | `npm rm core-js register-service-worker` (and the others after confirming). Delete `src/registerServiceWorker.js` + the PROD import in `main.js:6`; let vite-plugin-pwa own PWA registration. | **S** |
| 2.2 | **Remove dead code.** `annotationPlugin` imported but registration commented out (`ChartDisplay.vue:11,18`); `formulasConfig.js` `generateLineData1/2` unused; `App.vue` `downloadCSVTemplate` duplicates `downloadTemplateAsCsv`; `config.js` `CHART_Y_AXIS_MAX`/`AGE_INI` unused; `router/index.js:2` unused `useRoute`; `DocumentationSection.vue`/`CitationSection.vue` render nothing. | see refs | Delete after confirming no external refs. | **S–M** |
| 2.3 | **Purge junk directories/files.** `public/_old/`, `public/pgs_old/` (incl. 1.2 MB PNG), `dist/_old/`; `external-references` (stray URL scratch file); `contact.md` (orphaned Jekyll page the SPA can't render, yet linked from README). | `git ls-files` | Delete; update the README `contact.md` link. | **S** |
| 2.4 | **Optimize/relocate oversized images.** `public/ChICLogo_NoText_2026-07-02.png` is **2.0 MB**; `src/assets/logo.png` is **2 MB** and shipped into the JS bundle. Total `public/` ≈ 11 MB. | build output (2 MB logo asset), `du` | Compress logos (WebP/optimized PNG, target <100 KB); de-duplicate the src/public copies; consider `vite-plugin-image-optimizer`. | **S–M** |
| 2.5 | **Fix README inaccuracies.** No dev-setup section; license section claims "MIT No Attribution (MIT-0)" and links `LICENSE.md`, but the file is standard **MIT** at `LICENSE`; deploy URL still says `/pld-progression-grouper/`; `PMID:TBD` placeholders; age range stated as both 15–85 and 15–80; typos. | `README.md`, `LICENSE` | Add install/dev/build/contribute section; correct the license name + path; reconcile the deploy URL with 0.4; fix age range + typos. | **S–M** |
| 2.6 | **Complete the `pld-progression-grouper` → ChIC rebrand.** Package `chic-app` / product "Charité Imaging Classification", but Vite `base`, PWA `start_url`, and contact email still say `pld-progression-grouper`. | `vite.config.js`, manifest, `contact.md` | Sweep all `pld-progression-grouper` references once 0.4's target URL is decided. | **S** |

---

## Tier 3 — Robustness, quality & DX hardening

| # | Item | Evidence | Fix | Effort |
|---|---|---|---|---|
| 3.1 | **Memory leak: un-removed global listener.** `document.addEventListener('click', …)` in `onMounted` with no `onUnmounted` cleanup; the component is behind `v-if`. | `InputControls.vue:384` | Store the handler ref; remove it in `onUnmounted`. | **S** |
| 3.2 | **Accessibility gaps.** Table rows clickable via `@click` on `<tr>` with no `role`/`tabindex`/keyboard handler; icon-only remove button (`-`) has no `aria-label`. | `App.vue:203,241` | Add keyboard handlers + ARIA labels; make row actions focusable. | **S–M** |
| 3.3 | **Fragile CSV parser + silent row drops.** Naive split on `\n`/`,` (no quoted-field support); invalid rows dropped with only `console.warn`; save failures only `console.error`. | `useDataPersistence.js:164,52` | Use a small CSV parser (or Papa Parse); surface skipped-row / failure feedback in the UI. | **M** |
| 3.4 | **Address `npm audit` findings.** 6 vulns (2 high: `minimatch`, `tmp`; 4 moderate). Most reach prod via `exceljs`/workbox. | `npm audit --omit=dev` | `npm audit fix` clears minimatch/tmp/postcss/brace-expansion. The `uuid`←`exceljs` chain needs an exceljs upgrade evaluation (avoid the breaking 3.4.0 downgrade). | **M** |
| 3.5 | **Bundle size / code-split.** Single JS chunk ≈ 1.28 MB (gzip 393 KB); PWA precache ≈ 13.7 MB. exceljs/chart.js/html2canvas load eagerly. | build output | Dynamic-import exceljs (only needed on export) and chart.js where feasible; add `manualChunks`; tighten PWA `globPatterns` so multi-MB images aren't precached. | **M** |
| 3.6 | **Optional: JS typechecking.** Pure JS, `jsconfig.json target:"es5"` is stale. | `jsconfig.json` | Set `target:"ESNext"` + `checkJs:true`; add `vue-tsc --noEmit` typecheck script; annotate hot paths with JSDoc. Full TS migration is a separate **L** effort. | **M** |
| 3.7 | **Git hooks.** No pre-commit gate. | — | `simple-git-hooks` + `lint-staged` running `eslint --fix` + `prettier --write` on staged `*.{js,vue}`. | **S** |
| 3.8 | **Fix stale/contradictory comments & prop types.** `formulasConfig.js` LGR comment says `/100` but code returns `root - 1`; `ChartDisplay` `editingIndex` prop is `Number` but `App.vue` assigns `null` (dev warnings). | `formulasConfig.js:26`; `App.vue:491,624` | Correct the comment; default `editingIndex` handling to a consistent sentinel. | **S** |

---

## Tier 4 — Project infrastructure (collaboration & sustainability)

| # | Item | Fix | Effort |
|---|---|---|---|
| 4.1 | **CI quality gate on PRs** | Extend `gh-pages.yml` (or add `ci.yml`): `npm ci` → `lint` → `test` → `build` on `pull_request`. Deploy job stays gated on the trunk branch. | **S** |
| 4.2 | **Dependency automation** | Add `.github/dependabot.yml` (npm, weekly) or Renovate. | **S** |
| 4.3 | **Contributor docs & templates** | `CONTRIBUTING.md` (README invites contributions with no guide), `SECURITY.md`, `CODEOWNERS`, PR/issue templates under `.github/`. | **S–M** |
| 4.4 | **Bump CI action versions** | `peaceiris/actions-gh-pages@v3` → v4; keep checkout/setup-node/cache at v4. | **S** |
| 4.5 | **Branch protection** | After 0.5 rationalizes branches, protect the trunk (require PR + green CI). | **S** |

---

## Suggested execution order

1. **Tier 0** (0.4/0.5/0.6 first — deploy; then 0.1/0.2/0.3 — correctness, ideally landed with the Tier-1.4 tests that pin them).
2. **Tier 1** as one "tooling foundation" PR (1.1–1.9). This is what unlocks safe multi-agent work.
3. **Tier 2** cleanup (low-risk, high signal-to-noise).
4. **Tier 3 / Tier 4** incrementally.

Keep `AGENTS.md` in sync: when a bug listed there is fixed, remove the warning so the next agent isn't misled.
