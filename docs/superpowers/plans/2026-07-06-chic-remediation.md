# ChIC Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all issues from the 2026-07-06 repo review — correctness bugs, monolith refactor, tooling/CI, deploy/branch — grounding the classification in the ChIC manuscript, without changing validated clinical behavior.

**Architecture:** Extract the clinical model into one pure `src/domain/classification.js` used by both entry paths; pin it with Vitest; decompose `App.vue`/`app.css` under a 600-LOC cap via behavior-preserving extraction; modernize tooling (ESLint 9 flat, Prettier, Vitest, typecheck); split CI/deploy; fix the base path and default branch.

**Tech Stack:** Vue 3 (`<script setup>` + Composition API), Vite 6, Chart.js 4, exceljs, vite-plugin-pwa, ESLint 9 flat, Prettier, Vitest + @vue/test-utils + jsdom.

**Source spec:** `docs/superpowers/specs/2026-07-06-chic-remediation-design.md` (rev 2, Codex-reviewed). Read §2 (clinical contract) before Phase B.

## Global Constraints

- **600 LOC hard cap** per `.vue`/`.js`/`.css` file. New files born under it.
- **Behavior-preserving refactor:** move code, don't rewrite. Verify with `npm run build` + manual smoke.
- **Clinical contract (spec §2):** `htTLV = TLV/height`; classes A–E via `600·1.01^age … 600·1.04^age`; `LGR = (htTLV/600)^(1/age) − 1`; `≥` boundaries on **unrounded** htTLV.
- **Never** reintroduce `/850` normalization or present an estimated class as validated.
- **Node ≥ 20.** Every code change ends green on `npm run lint`, `npm test`, `npm run build`.
- **Commit frequently**, one deliverable per task. Commit trailer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` + `Claude-Session: …`.
- **NO HARDCODING — everything configurable.** Every clinical and display constant lives in `src/config/config.js` and is read from there: the model itself (baseline `600` ml/m, growth-rate cutoffs `[0.01,0.02,0.03,0.04]`), age/TLV/height validation ranges, chart x/y domain, tick marks, and class colors. No magic numbers in components or the domain module — they import from config. Config is the single source of truth (Task 10 builds it; it is created **first** in Phase B).
- **D8 age range — RESOLVED to fit the manuscript: `AGE_MIN=15`, `AGE_MAX=85`** (paper extends the lower bound to 15; README states 85; cohort max 81). Chart x-axis matches (`CHART_X_MIN=15`, `CHART_X_MAX=85`). All read from `CONFIG`.

## Execution phases (order matters)

A. Toolchain foundation (Tasks 1–5) → B. Correctness, TDD (6–14) → C. Refactor under green tests (15–23) → D. Deploy/rebrand (24–26) → E. CI/hygiene/infra (27–32) → F. Branch surgery, last (33).

---

## Phase A — Toolchain foundation

### Task 1: Editor & Node pinning

**Files:**
- Create: `.nvmrc`, `.editorconfig`
- Modify: `package.json` (add `engines`)

- [ ] **Step 1: Create `.nvmrc`**
```
20
```

- [ ] **Step 2: Create `.editorconfig`**
```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 3: Add `engines` to `package.json`** (after `"private": true,`)
```json
  "engines": { "node": ">=20" },
```

- [ ] **Step 4: Commit**
```bash
git add .nvmrc .editorconfig package.json
git commit -m "chore: pin Node 20 and add EditorConfig"
```

### Task 2: ESLint 9 flat config

**Files:**
- Create: `eslint.config.mjs`
- Delete: `.eslintrc.js`
- Modify: `package.json` (remove `eslintConfig` block; swap deps; scripts)

**Interfaces — Produces:** `npm run lint` (check-only), `npm run lint:fix`.

- [ ] **Step 1: Swap ESLint deps** — pin `@eslint/js` to the SAME major as eslint (unpinned it resolves to 10, which peers `eslint@^10` → ERESOLVE):
```bash
npm i -D eslint@^9 eslint-plugin-vue@^10 @eslint/js@^9 globals
```
Expected: installs cleanly. (Verified: `@eslint/js@^9` is the fix; the earlier failures were `@eslint/js@10` demanding eslint 10.)

- [ ] **Step 2: Create `eslint.config.mjs`**
```js
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  { ignores: ['dist/**', 'dev-dist/**', 'node_modules/**', 'public/**', 'coverage/**'] },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Bootstrapping: keep the baseline green; tighten later.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'vue/multi-word-component-names': 'off',
    },
  },
]
```

- [ ] **Step 3: Delete `.eslintrc.js` and the `package.json` `eslintConfig` block**
```bash
git rm .eslintrc.js
```
Then remove the entire `"eslintConfig": { … }` key from `package.json`.

- [ ] **Step 4: Update lint scripts in `package.json`** — ESLint 9 flat config removed `--ext` and `--ignore-path` (ignores live in the config; `.vue` is added by the vue plugin's `files`):
```json
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
```

- [ ] **Step 5: Run lint; triage fallout**
Run: `npm run lint`
Expected: exits 0 (unused-vars are warnings). Record any errors; fix trivial ones (e.g. remove unused `useRoute` import in `src/router/index.js`).

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "build: migrate to ESLint 9 flat config, single source of lint truth"
```

### Task 3: Prettier

**Files:**
- Create: `.prettierrc.json`, `.prettierignore`
- Modify: `package.json` (deps, scripts), `eslint.config.mjs` (append prettier-off)

- [ ] **Step 1: Install**
```bash
npm i -D prettier eslint-config-prettier
```

- [ ] **Step 2: Create `.prettierrc.json`**
```json
{ "singleQuote": true, "semi": false, "printWidth": 100, "trailingComma": "es5" }
```

- [ ] **Step 3: Create `.prettierignore`**
```
dist
dev-dist
coverage
public
package-lock.json
```

- [ ] **Step 4: Append `eslint-config-prettier` as the LAST element of `eslint.config.mjs`'s array**
```js
import prettier from 'eslint-config-prettier'
// … existing array, then add `prettier` as the final element:
//   ...pluginVue.configs['flat/essential'], { … }, prettier,
```

- [ ] **Step 5: Add scripts**
```json
    "format": "prettier --write .",
    "format:check": "prettier --check .",
```

- [ ] **Step 6: Commit (do NOT mass-format yet — that rides with WS-2 file touches)**
```bash
git add -A
git commit -m "build: add Prettier with ESLint integration"
```

### Task 4: Vitest infrastructure

**Files:**
- Create: `vitest.config.js`, `src/domain/__tests__/smoke.test.js`
- Modify: `package.json` (deps, scripts)

**Interfaces — Produces:** `npm test`, `npm run coverage`.

- [ ] **Step 1: Install**
```bash
npm i -D vitest @vue/test-utils jsdom @vitest/coverage-v8
```

- [ ] **Step 2: Create `vitest.config.js`**
```js
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': '/src' } },
  test: { environment: 'jsdom', globals: true, include: ['src/**/*.{test,spec}.js'] },
})
```

- [ ] **Step 3: Write a smoke test `src/domain/__tests__/smoke.test.js`**
```js
import { describe, it, expect } from 'vitest'
describe('vitest wiring', () => {
  it('runs', () => { expect(1 + 1).toBe(2) })
})
```

- [ ] **Step 4: Add scripts**
```json
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage",
```

- [ ] **Step 5: Run**
Run: `npm test`
Expected: 1 passing test.

- [ ] **Step 6: Commit**
```bash
git add -A
git commit -m "test: add Vitest + @vue/test-utils harness"
```

### Task 5: Stop tracking dist/, fix jsconfig

**Files:** Modify `jsconfig.json`; untrack `dist/`.

- [ ] **Step 1: Untrack build output**
```bash
git rm -r --cached dist
```

- [ ] **Step 2: Set `jsconfig.json` `target`**
Change `"target": "es5"` → `"target": "ESNext"`.

- [ ] **Step 3: Verify build still works**
Run: `npm run build`
Expected: succeeds (build regenerates dist locally; it's now ignored).

- [ ] **Step 4: Commit**
```bash
git add -A
git commit -m "chore: stop tracking dist/, modernize jsconfig target"
```

---

## Phase B — Correctness (TDD)

> Read spec §2. All thresholds/labels come from the manuscript.
> **Task order within Phase B: build the central config (Task 10) FIRST**, then the domain module (Tasks 6–9, which import model constants from config), then wiring (Tasks 11–14).

### Task 6: Domain — height-adjusted TLV

> Depends on Task 10's `CONFIG.MODEL`.

**Files:**
- Create: `src/domain/classification.js`, `src/domain/__tests__/classification.test.js`

**Interfaces — Produces:** `heightAdjustedTLV(tlv, height) → number`.

- [ ] **Step 1: Write failing test** (`classification.test.js`)
```js
import { describe, it, expect } from 'vitest'
import { heightAdjustedTLV } from '../classification.js'

describe('heightAdjustedTLV', () => {
  it('divides TLV by height in metres', () => {
    expect(heightAdjustedTLV(3400, 1.7)).toBeCloseTo(2000, 6)
  })
  it('returns NaN for non-positive height', () => {
    expect(Number.isNaN(heightAdjustedTLV(3400, 0))).toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (`npm test`) — "heightAdjustedTLV is not a function".

- [ ] **Step 3: Implement in `classification.js`** — model constants come from config (no hardcoding):
```js
// src/domain/classification.js
// Pure ChIC classification domain per manuscript (spec §2). No Vue reactivity.
import { CONFIG } from '@/config/config.js'

export const CLASS_BASELINE = CONFIG.MODEL.CLASS_BASELINE_ML_PER_M // 600 ml/m at age 0
export const GROWTH_RATES = CONFIG.MODEL.GROWTH_RATE_CUTOFFS       // [0.01,0.02,0.03,0.04]

export function heightAdjustedTLV(tlv, height) {
  const t = Number(tlv)
  const h = Number(height)
  if (!Number.isFinite(t) || !Number.isFinite(h) || h <= 0) return NaN
  return t / h
}
```
> Tests import `CLASS_BASELINE`/`GROWTH_RATES` from the module, so they track config automatically.

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**
```bash
git add src/domain/classification.js src/domain/__tests__/classification.test.js
git commit -m "feat(domain): height-adjusted TLV"
```

### Task 7: Domain — classify A–E (with epsilon policy)

**Interfaces — Produces:** `classify(htTLV, age) → 'A'|'B'|'C'|'D'|'E'`.

- [ ] **Step 1: Add failing tests**
```js
import { classify, CLASS_BASELINE } from '../classification.js'

const threshold = (rate, age) => CLASS_BASELINE * Math.pow(1 + rate, age)

describe('classify', () => {
  const age = 50
  it('A below the 1% curve', () => {
    expect(classify(threshold(0.01, age) - 1e-6, age)).toBe('A')
  })
  it('B at/above the 1% curve, below 2%', () => {
    expect(classify(threshold(0.01, age), age)).toBe('B')
    expect(classify(threshold(0.02, age) - 1e-6, age)).toBe('B')
  })
  it('C at/above 2% curve', () => { expect(classify(threshold(0.02, age), age)).toBe('C') })
  it('D at/above 3% curve', () => { expect(classify(threshold(0.03, age), age)).toBe('D') })
  it('E at/above 4% curve', () => { expect(classify(threshold(0.04, age), age)).toBe('E') })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement `classify`** — derived from `GROWTH_RATES` (config), not hardcoded rates:
```js
const CLASS_LETTERS = ['B', 'C', 'D', 'E'] // class cleared once the i-th ascending cutoff is met
export function classify(htTLV, age) {
  const h = Number(htTLV)
  const a = Number(age)
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null
  const curve = (rate) => CLASS_BASELINE * Math.pow(1 + rate, a)
  for (let i = GROWTH_RATES.length - 1; i >= 0; i--) {
    if (h >= curve(GROWTH_RATES[i])) return CLASS_LETTERS[i]
  }
  return 'A'
}
```
> `CLASS_LETTERS` length must equal `GROWTH_RATES` length (4 cutoffs → B/C/D/E, with A below all). If the config grows the model, extend both.

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit**
```bash
git add -A && git commit -m "feat(domain): five-class A–E classifier (manuscript thresholds)"
```

### Task 8: Domain — liver growth rate

**Interfaces — Produces:** `liverGrowthRate(age, htTLV) → number` (fraction).

- [ ] **Step 1: Add failing test**
```js
import { liverGrowthRate } from '../classification.js'
describe('liverGrowthRate', () => {
  it('recovers the compound annual growth rate', () => {
    const age = 40, g = 0.025
    const htTLV = 600 * Math.pow(1 + g, age)
    expect(liverGrowthRate(age, htTLV)).toBeCloseTo(g, 10)
  })
  it('null for non-positive age or htTLV', () => {
    expect(liverGrowthRate(0, 1000)).toBeNull()
    expect(liverGrowthRate(40, 0)).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** (correcting the old `/100` comment bug)
```js
// LGR = (htTLV / 600)^(1/age) - 1  → the compound annual growth rate g
export function liverGrowthRate(age, htTLV) {
  const a = Number(age)
  const h = Number(htTLV)
  if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(h) || h <= 0) return null
  return Math.pow(h / CLASS_BASELINE, 1 / a) - 1
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Commit** `git commit -am "feat(domain): liver growth rate"`

### Task 9: Domain — labels & legacy shim

**Interfaces — Produces:** `formatClassLabel('A') → 'Class A'`; `legacyPgToLetter('PG1') → 'A'`.

- [ ] **Step 1: Add failing tests**
```js
import { formatClassLabel, legacyPgToLetter } from '../classification.js'
describe('labels', () => {
  it('formats class labels', () => { expect(formatClassLabel('C')).toBe('Class C') })
  it('maps legacy PG codes', () => {
    expect(legacyPgToLetter('PG1')).toBe('A')
    expect(legacyPgToLetter('PG5')).toBe('E')
    expect(legacyPgToLetter('B')).toBe('B') // pass-through for new letters
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement**
```js
const PG_TO_LETTER = { PG1: 'A', PG2: 'B', PG3: 'C', PG4: 'D', PG5: 'E' }
export function formatClassLabel(letter) {
  return letter ? `Class ${letter}` : ''
}
export function legacyPgToLetter(code) {
  if (code == null) return null
  return PG_TO_LETTER[code] ?? String(code)
}
```

- [ ] **Step 4: Run — expect PASS.** **Step 5: Commit** `git commit -am "feat(domain): class labels + legacy PG shim"`

### Task 10: Central config — single source of truth (RUN FIRST in Phase B)

**Files:** Rewrite `src/config/config.js` as the one place all clinical + display constants live. Removes hardcoding across domain, chart, validation.

- [ ] **Step 1: Rewrite `src/config/config.js`**
```js
// src/config/config.js — single source of truth for all ChIC parameters.
export const CONFIG = {
  // --- Clinical model (ChIC, per manuscript; spec §2) ---
  MODEL: {
    CLASS_BASELINE_ML_PER_M: 600,               // htTLV baseline at age 0
    GROWTH_RATE_CUTOFFS: [0.01, 0.02, 0.03, 0.04], // A/B, B/C, C/D, D/E boundaries
    ASSUMED_HEIGHT_M: 1.70,                      // fallback for height-less imports (flagged)
  },

  // --- Input validation ranges (D8: 15–85, fits manuscript + README) ---
  AGE_MIN: 15,
  AGE_MAX: 85,
  AGE_MIN_LGR: 0,
  TLV_MIN: 0,
  TLV_MAX: 20000,
  HEIGHT_MIN: 0.5,
  HEIGHT_MAX: 2.5,

  // --- Chart domain ---
  CHART_X_MIN: 15,
  CHART_X_MAX: 85,
  CHART_Y_MIN: 100,     // log floor; must not clip small htTLV (<600)
  CHART_Y_MAX: 10500,   // above cohort max htTLV 10344 (Table S1)
  CHART_Y_TICKS: [600, 800, 1000, 2000, 4000, 6000, 8000, 10000],

  // --- Class band + series colors (moved out of ChartDisplay) ---
  CLASS_COLORS: {
    A: '#2ecc71', B: '#a3d977', C: '#f1c40f', D: '#e67e22', E: '#e74c3c',
  },

  // --- UI ---
  MODAL_MAX_WIDTH: '500px',
  MODAL_MAX_HEIGHT: '90%',
}
```
> **Removed:** `NORMALIZATION_FACTOR` (850) and `CHART_Y_AXIS_MAX` (25) — dead nTLV artifacts. `CHART_X_AXIS_MIN/MAX` renamed to `CHART_X_MIN/MAX`; `AGE_INI` dropped (unused). Copy the real class-band colors from the current `ChartDisplay.vue` datasets into `CLASS_COLORS` verbatim.

- [ ] **Step 2: Grep for removed/renamed keys across the app**
Run: `grep -rn "NORMALIZATION_FACTOR\|CHART_Y_AXIS_MAX\|CHART_X_AXIS_MIN\|CHART_X_AXIS_MAX\|AGE_INI" src`
Expected: hits only in `ChartDisplay.vue`/`useDataPersistence.js` — all fixed in Tasks 12–13. No other consumer.

- [ ] **Step 3: Commit** `git commit -am "refactor(config): single source of truth — model, ranges, chart domain, colors (15–85, no /850)"`

### Task 11: Wire `App.vue` to the domain module + PG→letter migration

**Files:** Modify `src/App.vue`, `src/styles/app.css`.

**Interfaces — Consumes:** `classify`, `heightAdjustedTLV`, `liverGrowthRate`, `formatClassLabel` from `@/domain/classification.js`.

- [ ] **Step 1:** Import the domain module in `App.vue`; replace the inline `progressionGroup` computed (`App.vue:399-419`) with `classify(heightAdjustedTLV(tlv, height), age)`; replace `pgLabelMap`/`formatPGLabel` (`App.vue:796-806`) with `formatClassLabel`. Class values are now `'A'..'E'`.

- [ ] **Step 2:** Rename CSS classes: in `App.vue` template (`:158-170`) change `progression-group PG1..PG5` → `progression-group class-a..class-e`; in `src/styles/app.css` rename `.PG1..PG5` → `.class-a..class-e`.

- [ ] **Step 3:** Grep to confirm no `PG1..PG5` or `pgLabelMap` references remain in `App.vue`.
Run: `grep -n "PG[1-5]\|pgLabelMap\|formatPGLabel" src/App.vue`
Expected: none.

- [ ] **Step 4: Verify** `npm run lint && npm test && npm run build` — all green.

- [ ] **Step 5: Manual smoke** — `npm run dev`, enter age/height/TLV, confirm class letter + band styling render.

- [ ] **Step 6: Commit** `git commit -am "refactor(app): use shared classifier; migrate PG codes to class letters"`

### Task 12: Wire `useDataPersistence` to the domain module + height estimation

**Files:** Modify `src/composables/useDataPersistence.js`; add tests `src/composables/__tests__/useDataPersistence.test.js`.

- [ ] **Step 1: Write failing tests**
```js
import { describe, it, expect } from 'vitest'
import { classify, heightAdjustedTLV } from '@/domain/classification.js'
// Test processLoadedRow via an exported pure helper (extract it if needed).
describe('processLoadedRow', () => {
  it('classifies with measured height identically to manual path', async () => {
    const { processLoadedRow } = await import('@/composables/useDataPersistence.js')
    const row = processLoadedRow({ id: 'x', age: 50, height: 1.7, tlv: 3400 })
    expect(row.class).toBe(classify(heightAdjustedTLV(3400, 1.7), 50))
    expect(row.htlvEstimated).toBe(false)
  })
  it('estimates htTLV when height missing, leaving validated class empty', async () => {
    const { processLoadedRow } = await import('@/composables/useDataPersistence.js')
    const row = processLoadedRow({ id: 'y', age: 50, tlv: 3400 })
    expect(row.htlvEstimated).toBe(true)
    expect(row.class).toBeNull()
    expect(row.estimatedClass).not.toBeNull()
  })
  it('maps legacy PG codes on import', async () => {
    const { legacyPgToLetter } = await import('@/domain/classification.js')
    expect(legacyPgToLetter('PG4')).toBe('D')
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (old logic returns `pg`, uses `/850`).

- [ ] **Step 3: Rewrite `processLoadedRow`** to: use `heightAdjustedTLV`+`classify`; when height present → `class`, `htlvEstimated:false`; when absent → compute assumed height (mean of same-file rows with height, provided by caller, else `CONFIG.ASSUMED_HEIGHT_M`), set `estimatedHtTLV`/`estimatedClass`, `htlvEstimated:true`, `class:null`. Delete the `/850` branch and the 2-threshold logic. Export `processLoadedRow` for testing. Accept incoming legacy `pg` via `legacyPgToLetter` for display only.
> Cohort-mean requires two passes over the file: first collect heights, compute mean, then map rows. Update `loadDataFromJson`/CSV/Excel loaders to pass the file-level mean.

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Verify** `npm run lint && npm test && npm run build`.

- [ ] **Step 6: Commit** `git commit -am "fix(import): unify classifier, coherent height estimation, drop /850"`

### Task 13: Chart method fix + y-domain

**Files:** Modify `src/components/ChartDisplay.vue`.

- [ ] **Step 1:** Implement `updatePointStyle(index, color, group)` (updates the patient dataset point's color/label) and `clearChart()` (empties datasets + redraws); add both to `defineExpose` (`:449`). Confirm `App.vue:644` (`updatePointStyle`) and `:692` (`clearChart`) now resolve.

- [ ] **Step 2:** Remove ALL hardcoded chart constants — read from config (no magic numbers): y-domain `min`/`max`/`CEILING_Y` ← `CONFIG.CHART_Y_MIN`/`CONFIG.CHART_Y_MAX`; the duplicated tick arrays (`ChartDisplay.vue:334` and `:342`) ← `CONFIG.CHART_Y_TICKS`; x-axis `min`/`max` ← `CONFIG.CHART_X_MIN`/`CONFIG.CHART_X_MAX`; class-band colors ← `CONFIG.CLASS_COLORS`; threshold curve base ← `CONFIG.MODEL.CLASS_BASELINE_ML_PER_M` (or the domain module's `formulas`). Keep log scale; verify a synthetic htTLV of 450 (below 600) renders on-axis, and 10344 renders below the ceiling.

- [ ] **Step 3: Manual smoke** — add a point, edit its group/color in the table, confirm the chart marker updates; add a very small and a very large TLV, confirm neither clips.

- [ ] **Step 4: Verify** `npm run lint && npm run build`.

- [ ] **Step 5: Commit** `git commit -am "fix(chart): implement exposed updatePointStyle/clearChart; explicit y-domain"`

### Task 14: Estimated-row presentation

**Files:** Modify the results table (in `App.vue` for now; moves to `DataTable.vue` in Task 20) and `useDataPersistence.js` export builders.

- [ ] **Step 1:** In the table, render estimated rows' htTLV/class with distinct treatment (italic + `≈` prefix + `title="Unvalidated estimate — measured height missing"`), pulling from `estimatedHtTLV`/`estimatedClass`; the validated columns stay blank.

- [ ] **Step 2:** Add a summary line above the table: `"{n} of {m} rows used an estimated height — not a validated ChIC class"` when any `htlvEstimated`.

- [ ] **Step 3:** Add an `htTLV_estimated` boolean column to CSV/JSON/Excel export builders (`useDataPersistence.js:228+`).

- [ ] **Step 4: Manual smoke** — import a file with a height-less row; confirm the flag, notice, and export column.

- [ ] **Step 5: Commit** `git commit -am "feat(ui): flag estimated-height rows as unvalidated in table + export"`

---

## Phase C — Refactor under green tests (behavior-preserving)

> After each task: `npm run lint && npm test && npm run build` + manual smoke. Move code verbatim; do not change behavior. Verify each extracted file is < 600 LOC.

### Task 15: Extract `useQueryParams`

**Files:** Create `src/composables/useQueryParams.js`; modify `src/App.vue`.
- [ ] **Step 1:** Move `getUrlQueryParams` (`App.vue:318-333`) and related init into `useQueryParams()` returning the parsed params + the `?patientId=&age=&tlv=`, `acknowledgeBanner`, `show*` flags. **Preserve exact param names/behavior.**
- [ ] **Step 2:** Consume it in `App.vue`.
- [ ] **Step 3:** Verify + manual test each query-param mode. **Step 4:** Commit `git commit -am "refactor: extract useQueryParams composable"`.

### Task 16: Extract `usePatientForm`
**Files:** Create `src/composables/usePatientForm.js`; modify `App.vue`.
- [ ] Move patient input refs + validation (`isAgeValid`/`isHeightValid`/`formattedHeightAdjustedTLV` and the input refs) into the composable. Verify + commit `git commit -am "refactor: extract usePatientForm composable"`.

### Task 17: Extract `useDataPoints`
**Files:** Create `src/composables/useDataPoints.js`; modify `App.vue`.
- [ ] Move `dataPoints`, add/edit/remove, `editingIndex` handling. Keep the chart-ref calls in `App.vue`. Verify + commit `git commit -am "refactor: extract useDataPoints composable"`.

### Task 18: Extract `useTheme`
**Files:** Create `src/composables/useTheme.js`; modify `App.vue`.
- [ ] Move theme toggle + localStorage persistence. Verify + commit `git commit -am "refactor: extract useTheme composable"`.

### Task 19: Extract `FaqModal.vue`
**Files:** Create `src/components/FaqModal.vue`; modify `App.vue`.
- [ ] Move the ~66-line inline FAQ modal markup (`App.vue:~40-90`) + its show/hide prop/emit. Verify + commit `git commit -am "refactor: extract FaqModal component"`.

### Task 20: Extract `DataTable.vue` (+ a11y)
**Files:** Create `src/components/DataTable.vue`; modify `App.vue`.
- [ ] **Step 1:** Move the results table (`App.vue:~185-245`), including the Task-14 estimated-row treatment.
- [ ] **Step 2:** A11y: row `@click` gets `role="button"`, `tabindex="0"`, and a keyboard handler (`@keydown.enter`/`.space`); the icon-only remove button gets `aria-label="Remove data point"` + `title`.
- [ ] **Step 3:** Verify + commit `git commit -am "refactor: extract DataTable component with a11y fixes"`.

### Task 21: Fold template downloads into `useDataPersistence`
**Files:** Modify `src/composables/useDataPersistence.js`, `src/App.vue`.
- [ ] Move `downloadTemplateAsCsv`/template helpers out of `App.vue`; **delete the duplicate `downloadCSVTemplate`** (`App.vue:706-714`). Single template function in the composable. Verify + commit `git commit -am "refactor: consolidate template downloads, drop duplicate"`.

### Task 22: Split `app.css` into modules
**Files:** Create `src/styles/{base,layout,controls,table,progression-groups,print}.css` + `src/styles/index.css` barrel; delete `src/styles/app.css`; update the import in `main.js`/`App.vue`.
- [ ] Split by concern (variables/theme → `base.css`, etc.), each < 600 LOC; barrel `@import`s them in order. Verify visual parity in dev. Commit `git commit -am "refactor(styles): split app.css into per-concern modules"`.

### Task 23: Verify cap + full smoke
- [ ] **Step 1:** `find src -name '*.vue' -o -name '*.js' -o -name '*.css' | xargs wc -l | sort -rn | head` — confirm no file > 600 (except generated). If `App.vue` still > 600, extract further.
- [ ] **Step 2:** Full manual smoke of every feature + all query-param modes.
- [ ] **Step 3:** Commit any final extraction `git commit -am "refactor: bring all touched files under 600 LOC"`.

---

## Phase D — Deploy & rebrand

### Task 24: Fix base path & router
**Files:** Modify `vite.config.js`, `src/router/index.js`, `src/mixins/footerMixin.js` (or wherever footer imgs resolve).
- [ ] **Step 1:** `vite.config.js` → `const base = command === 'build' ? '/ChIC/' : '/'`.
- [ ] **Step 2:** `router/index.js` → `createWebHistory(import.meta.env.BASE_URL)`; remove unused `useRoute` import.
- [ ] **Step 3:** Footer image `src` values resolved through `import.meta.env.BASE_URL` (or move assets to `src/assets` + import).
- [ ] **Step 4:** `npm run build`, `npm run preview`; confirm assets load under `/ChIC/`. Commit `git commit -am "fix(deploy): correct GitHub Pages base path to /ChIC/"`.

### Task 25: Complete rebrand
**Files:** `vite.config.js` (PWA manifest `start_url`/`scope`/`id`), any `pld-progression-grouper` string, `README.md` deploy URL.
- [ ] `grep -rn "pld-progression-grouper" . --exclude-dir=node_modules --exclude-dir=.git` → replace with ChIC equivalents. Commit `git commit -am "chore: complete pld-progression-grouper → ChIC rebrand"`.

### Task 26: Retire the double service worker
**Files:** Delete `src/registerServiceWorker.js`; modify `src/main.js`; remove `register-service-worker` dep.
- [ ] Remove the PROD dynamic import block in `main.js:5-7` (keep the dev-unregister cleanup); `npm rm register-service-worker`; verify `vite-plugin-pwa` still emits `sw.js` in build. Commit `git commit -am "fix(pwa): let vite-plugin-pwa own SW; remove legacy registration"`.

---

## Phase E — CI, hygiene, infra

### Task 27: Split CI / deploy workflows
**Files:** Create `.github/workflows/ci.yml`; rewrite `.github/workflows/gh-pages.yml` → `deploy.yml`.
- [ ] **Step 1: `ci.yml`**
```yaml
name: CI
on:
  pull_request:
  push:
    branches-ignore: [gh-pages]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```
- [ ] **Step 2: `deploy.yml`** — trigger only `push` to `main`; `npm ci` → `npm run build` → `cp dist/index.html dist/404.html` → `peaceiris/actions-gh-pages@v4` with `publish_dir: ./dist`. No deploy step in any PR context.
- [ ] **Step 3:** Delete old `gh-pages.yml`. Commit `git commit -am "ci: split validation (ci.yml) from deploy (deploy.yml)"`.

### Task 28: Purge junk
- [ ] `git rm -r public/_old public/pgs_old dist/_old` (dist already untracked); move the Mayo MIC reference from `external-references` into `README.md` References, then `git rm external-references`; `git rm contact.md` and fix the README link. Commit `git commit -am "chore: remove leftover directories and orphan files"`.

### Task 29: Optimize logos
- [ ] Compress the 2 MB logos (WebP/optimized PNG, target < 100 KB), de-dup `src/assets/logo.png` vs `public/` copies; update references. Verify build asset weight dropped. Commit `git commit -am "perf: optimize and de-duplicate logo assets"`.

### Task 30: Audit + dead deps
- [ ] `npm audit fix` (non-breaking); for each of `core-js`, `html2canvas`, `canvas2svg`, `chartjs-plugin-datalabels`: `grep -rn <pkg> src` → if zero, `npm rm <pkg>`; `npm run build` after each. Also remove the dead `annotationPlugin` import in `ChartDisplay.vue:11` if unused. Commit `git commit -am "chore: drop dead deps, patch audit findings"`.

### Task 31: README accuracy
- [ ] Fix license section (it's **MIT**, not "MIT-0"; link `LICENSE` not `LICENSE.md`); reconcile age range with D8; fix typos ("expieriencing", "calssification", "paitents"); add a **Development** section (`npm ci` / `npm run dev` / `build` / `lint` / `test`); align description with the manuscript abstract. Commit `git commit -am "docs: correct README license, setup, and copy"`.

### Task 32: Project infra
**Files:** Create `.github/dependabot.yml`, `SECURITY.md`, `CONTRIBUTING.md`, `.github/CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/bug_report.md`.
- [ ] **dependabot.yml**
```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: "/"
    schedule: { interval: weekly }
  - package-ecosystem: github-actions
    directory: "/"
    schedule: { interval: weekly }
```
- [ ] `CONTRIBUTING.md` documents the dev setup + the **600-LOC / DRY-KISS-SOLID** rules from `AGENTS.md`. `CODEOWNERS` → the maintainers. Commit `git commit -am "chore: add dependabot, security, contributing, templates"`.

---

## Phase F — Branch surgery (LAST, only after all above is green on CI)

### Task 33: Make `main` the default; clean up branches
- [ ] **Step 1:** Ensure local is green: `npm ci && npm run lint && npm test && npm run build`.
- [ ] **Step 2:** Fast-forward `main` to the current tip:
```bash
git checkout main 2>/dev/null || git checkout -b main origin/main
git merge --ff-only copilot/start-from-version-1
git push origin main
```
(If not FF-able because work landed on the copilot branch, `git merge` then push — main is an ancestor so FF is expected.)
- [ ] **Step 3:** Set GitHub default branch:
```bash
gh api -X PATCH repos/halbritter-lab/ChIC -f default_branch=main
```
- [ ] **Step 4:** Delete stale branches:
```bash
git push origin --delete copilot/start-from-version-1 yml-edit-2
```
- [ ] **Step 5:** Confirm `deploy.yml` fires on the `main` push and Pages serves `/ChIC/` correctly.

---

## Self-Review (run before execution)

- **Spec coverage:** WS-1→Tasks 6–14; WS-2→15–23; WS-3→2–5; WS-4→4,6–9,12; WS-5→24–26,33; WS-6→27–31; WS-7→32. All covered.
- **D8 age range:** RESOLVED to 15–85 (fits manuscript + README), fully config-driven in Task 10; chart x-axis + validation + README all read `CONFIG`.
- **No-hardcoding:** all model/display constants centralized in `CONFIG` (Task 10, built first); domain (Tasks 6–9) and chart (Task 13) import from it — verified by the Task 10 Step 2 grep leaving no stray consumers.
- **Type consistency:** `classify`→letters `'A'..'E'`; consumed as such in Tasks 11–14; `htlvEstimated`/`estimatedClass`/`estimatedHtTLV` names consistent across Tasks 12/14/20.
- **Ordering:** tests (Phase B) precede refactor (Phase C); branch surgery last.
