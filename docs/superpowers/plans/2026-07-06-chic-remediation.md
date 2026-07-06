# ChIC Remediation Implementation Plan (rev 2 — post Codex NO-GO)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix all issues from the 2026-07-06 review — correctness bugs, monolith refactor, tooling/CI, deploy/branch — grounding classification in the ChIC manuscript, without changing validated clinical behavior.

**Architecture:** One pure `src/domain/classification.js` (fed by a central `CONFIG`) used by both entry paths; pin it with Vitest; de-monolith `App.vue`/`app.css` under a 600-LOC cap by **extracting and wiring in the same phase** (so any touched over-cap file lands under cap); modernize tooling; split CI/deploy; fix base path and default branch.

**Source spec:** `docs/superpowers/specs/2026-07-06-chic-remediation-design.md` (rev 2). Read §2 before Phase B.

## Global Constraints

- **600 LOC hard cap** per `.vue`/`.js`/`.css`. Any file you touch that is over cap must be brought under cap **in the same phase** (never commit an over-cap file you modified without reducing it).
- **Behavior-preserving refactor:** move code, don't rewrite. Preserve exact visuals (copy the real `.PG1`–`.PG5` / chart colors), query-param semantics, and feature behavior.
- **Clinical contract (spec §2):** `htTLV = TLV/height`; classes A–E via `600·1.01^age … 600·1.04^age`; `LGR = (htTLV/600)^(1/age) − 1`; `≥` on **unrounded** htTLV.
- **NO HARDCODING:** every model/display constant lives in `src/config/config.js`; domain + chart import from it. Assumed height is **`CONFIG.MODEL.ASSUMED_HEIGHT_M`** (one canonical key, used everywhere).
- **Row schema (canonical, defined once):**
  ```
  { id:string, age:number, height:number|null, tlv:number,
    htlv:number|null,            // measured tlv/height; null if height absent
    htlvEstimated:boolean,
    estimatedHtTLV:number|null,  // from estimated height; null if measured
    class:'A'..'E'|null,         // validated; null when estimated
    estimatedClass:'A'..'E'|null,// from estimated htTLV; null when measured
    lgr:string, group:string, groupColor:string|null }
  ```
  UI renders `class`; if `htlvEstimated`, renders `estimatedClass`/`estimatedHtTLV` with distinct treatment. Legacy `pg` codes are mapped to letters **only at the import boundary** via `legacyPgToLetter`; internal state uses `class`.
- **Age range:** `AGE_MIN=15`, `AGE_MAX=85` (fits manuscript + README), all read from `CONFIG` incl. chart x-axis, validation, query-param clamping, and UI copy.
- **Git:** every task creating/deleting files uses **`git add -A && git commit`** (never `-am` for new files). Node ≥ 20. Each task ends green on `npm run lint && npm test && npm run build`. Commit trailer: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` + `Claude-Session: …`.

## Phases (strict order)

A. Toolchain (1–6) → B. Config + domain, pure (7–12) → C. De-monolith App.vue **while** wiring domain + pg→class migration (13–23) → D. Import + chart correctness (24–26) → E. Deploy/rebrand (27–29) → F. CI/hygiene/infra (30–35) → G. App smoke tests (36) → H. Branch surgery, last (37).

---

## Phase A — Toolchain foundation

### Task 1: Editor & Node pinning — ✅ DONE (commit 32f4020)
`.nvmrc` (20), `.editorconfig`, `package.json` `engines.node>=20`.

### Task 2: ESLint 9 flat config — ✅ DONE (commit c238964)
`eslint.config.mjs` (js.recommended + vue flat/essential + prettier-off), deleted `.eslintrc.js` + `eslintConfig`. **Fix that mattered:** pin `@eslint/js@^9` (unpinned resolves to 10 → ERESOLVE). `lint` is check-only (flat config drops `--ext`/`--ignore-path`). Baseline: 0 errors, 9 warnings.

### Task 3: Prettier — ✅ DONE (commit 7a8eb1c)
`.prettierrc.json`, `.prettierignore`, `eslint-config-prettier` last in flat config, `format`/`format:check` scripts. No mass-format yet.

### Task 4: Vitest harness

**Files:** Create `vitest.config.js`; modify `package.json`.

- [ ] **Step 1: Install** `npm i -D vitest @vue/test-utils jsdom @vitest/coverage-v8`
- [ ] **Step 2: `vitest.config.js`**
```js
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': '/src' } },
  test: { environment: 'jsdom', globals: true, include: ['src/**/*.{test,spec}.js'] },
})
```
- [ ] **Step 3: Scripts** — add `"test": "vitest run"`, `"test:watch": "vitest"`, `"coverage": "vitest run --coverage"`.
- [ ] **Step 4:** Add `coverage` to `.gitignore` and `.prettierignore` (already) / eslint ignores (already).
- [ ] **Step 5: Commit** `git add -A && git commit -m "test: add Vitest + @vue/test-utils harness"`. (No test yet — first real test is Task 8.)

### Task 5: Typecheck (spec WS-3 — was missing)

**Files:** modify `jsconfig.json`, `package.json`.

- [ ] **Step 1: Install** `npm i -D vue-tsc typescript`
- [ ] **Step 2:** `jsconfig.json` → `"target": "ESNext"`, add `"checkJs": false` (advisory; flip later), keep `paths`.
- [ ] **Step 3: Script** — add `"typecheck": "vue-tsc --noEmit"`.
- [ ] **Step 4: Run** `npm run typecheck` — record output (advisory; must not block the build). If it errors on JS-without-types, keep `checkJs:false` so it's a no-op scaffold for now.
- [ ] **Step 5: Commit** `git add -A && git commit -m "build: add vue-tsc typecheck scaffold"`.

### Task 6: Stop tracking dist/

- [ ] **Step 1:** `git rm -r --cached dist`
- [ ] **Step 2:** `npm run build` — succeeds (dist regenerates, now ignored).
- [ ] **Step 3: Commit** `git add -A && git commit -m "chore: stop tracking dist/ build output"`.

---

## Phase B — Config + domain (pure; no `App.vue` touch)

### Task 7: Central config — single source of truth (FIRST in Phase B)

**Files:** Rewrite `src/config/config.js`.

- [ ] **Step 1: Read the real class colors first** so nothing visual changes:
```bash
grep -nA3 '\.PG[1-5]' src/styles/app.css
grep -nE "backgroundColor|borderColor|'#|rgba" src/components/ChartDisplay.vue | head -40
```
- [ ] **Step 2: Rewrite `src/config/config.js`** — copy the ACTUAL colors into `CLASS_COLORS` (do not invent):
```js
// src/config/config.js — single source of truth for all ChIC parameters.
export const CONFIG = {
  // --- Clinical model (manuscript; spec §2) ---
  MODEL: {
    CLASS_BASELINE_ML_PER_M: 600,
    GROWTH_RATE_CUTOFFS: [0.01, 0.02, 0.03, 0.04], // A/B,B/C,C/D,D/E
    ASSUMED_HEIGHT_M: 1.70,                          // fallback for height-less imports (flagged)
  },
  // --- Input validation ranges ---
  AGE_MIN: 15, AGE_MAX: 85, AGE_MIN_LGR: 0,
  TLV_MIN: 0, TLV_MAX: 20000,
  HEIGHT_MIN: 0.5, HEIGHT_MAX: 2.5,
  // --- Chart domain ---
  CHART_X_MIN: 15, CHART_X_MAX: 85,
  CHART_Y_MIN: 100, CHART_Y_MAX: 10500,
  CHART_Y_TICKS: [600, 800, 1000, 2000, 4000, 6000, 8000, 10000],
  // --- Class band colors: COPY EXACT current values for A..E from app.css/ChartDisplay ---
  CLASS_COLORS: { A: '<copy .PG1>', B: '<copy .PG2>', C: '<copy .PG3>', D: '<copy .PG4>', E: '<copy .PG5>' },
  // --- UI ---
  MODAL_MAX_WIDTH: '500px', MODAL_MAX_HEIGHT: '90%',
}
```
> Removed: `NORMALIZATION_FACTOR` (850), `CHART_Y_AXIS_MAX` (25), `AGE_INI`. Renamed `CHART_X_AXIS_MIN/MAX`→`CHART_X_MIN/MAX`.
- [ ] **Step 3: Grep** `grep -rn "NORMALIZATION_FACTOR\|CHART_Y_AXIS_MAX\|CHART_X_AXIS_MIN\|CHART_X_AXIS_MAX\|AGE_INI" src` — remaining hits are in `useDataPersistence.js`/`ChartDisplay.vue`, fixed in Tasks 24–25.
- [ ] **Step 4:** `npm run build` (app still references old keys in chart/import until Tasks 24–25 — if build breaks on a renamed key, that file is fixed in its task; keep this task's change limited to config and accept that chart/import get fixed next). To avoid a red build between tasks, **do Tasks 7→24→25 as a tight group** or keep temporary aliases. Simplest: keep `CHART_X_AXIS_MIN/MAX` as aliases pointing to the new keys until Task 25, then delete.
- [ ] **Step 5: Commit** `git add -A && git commit -m "refactor(config): single source of truth — model, ranges, chart domain, real colors (15–85, drop /850)"`.

### Task 8: Domain — height-adjusted TLV (TDD)

**Files:** Create `src/domain/classification.js`, `src/domain/__tests__/classification.test.js`.
**Produces:** `heightAdjustedTLV(tlv, height)`, `CLASS_BASELINE`, `GROWTH_RATES`.

- [ ] **Step 1: Failing test**
```js
import { describe, it, expect } from 'vitest'
import { heightAdjustedTLV } from '../classification.js'
describe('heightAdjustedTLV', () => {
  it('divides TLV by height (m)', () => { expect(heightAdjustedTLV(3400, 1.7)).toBeCloseTo(2000, 6) })
  it('NaN for non-positive height', () => { expect(Number.isNaN(heightAdjustedTLV(3400, 0))).toBe(true) })
})
```
- [ ] **Step 2: Run** `npm test` → FAIL.
- [ ] **Step 3: Implement** (constants from config — no hardcoding)
```js
// src/domain/classification.js — pure ChIC domain (spec §2). No Vue reactivity.
import { CONFIG } from '@/config/config.js'
export const CLASS_BASELINE = CONFIG.MODEL.CLASS_BASELINE_ML_PER_M
export const GROWTH_RATES = CONFIG.MODEL.GROWTH_RATE_CUTOFFS
export function heightAdjustedTLV(tlv, height) {
  const t = Number(tlv), h = Number(height)
  if (!Number.isFinite(t) || !Number.isFinite(h) || h <= 0) return NaN
  return t / h
}
```
- [ ] **Step 4: Run** → PASS. **Step 5:** `git add -A && git commit -m "feat(domain): height-adjusted TLV"`.

### Task 9: Domain — classify A–E (epsilon-tested)

**Produces:** `classify(htTLV, age) → 'A'..'E'`.

- [ ] **Step 1: Failing tests** — full boundary + epsilon per spec:
```js
import { classify, CLASS_BASELINE, GROWTH_RATES } from '../classification.js'
const curve = (rate, age) => CLASS_BASELINE * Math.pow(1 + rate, age)
describe('classify boundaries', () => {
  const age = 50
  const cases = [
    ['A', curve(0.01, age) - 1e-6, 'A'],
    ['B@1%', curve(0.01, age), 'B'],
    ['B<2%', curve(0.02, age) - 1e-6, 'B'],
    ['C@2%', curve(0.02, age), 'C'],
    ['D@3%', curve(0.03, age), 'D'],
    ['E@4%', curve(0.04, age), 'E'],
  ]
  it.each(cases)('%s', (_n, htlv, expected) => { expect(classify(htlv, age)).toBe(expected) })
  it('holds at another age (25)', () => { expect(classify(curve(0.04, 25), 25)).toBe('E') })
})
```
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** (derived from `GROWTH_RATES`)
```js
const CLASS_LETTERS = ['B', 'C', 'D', 'E'] // must match GROWTH_RATES length
export function classify(htTLV, age) {
  const h = Number(htTLV), a = Number(age)
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null
  const curve = (rate) => CLASS_BASELINE * Math.pow(1 + rate, a)
  for (let i = GROWTH_RATES.length - 1; i >= 0; i--) {
    if (h >= curve(GROWTH_RATES[i])) return CLASS_LETTERS[i]
  }
  return 'A'
}
```
- [ ] **Step 4: Run** → PASS. **Step 5:** commit `feat(domain): five-class A–E classifier`.

### Task 10: Domain — LGR + labels + legacy shim + display rounding

**Produces:** `liverGrowthRate`, `formatClassLabel`, `legacyPgToLetter`, `formatHtTLV`.

- [ ] **Step 1: Failing tests**
```js
import { liverGrowthRate, formatClassLabel, legacyPgToLetter, formatHtTLV } from '../classification.js'
describe('lgr', () => {
  it('recovers CAGR', () => { const a=40,g=0.025,h=600*Math.pow(1+g,a); expect(liverGrowthRate(a,h)).toBeCloseTo(g,10) })
  it('null on bad input', () => { expect(liverGrowthRate(0,1000)).toBeNull(); expect(liverGrowthRate(40,0)).toBeNull() })
})
describe('labels + rounding (separate from classification)', () => {
  it('label', () => { expect(formatClassLabel('C')).toBe('Class C') })
  it('legacy', () => { expect(legacyPgToLetter('PG4')).toBe('D'); expect(legacyPgToLetter('B')).toBe('B') })
  it('display rounds to 2dp but classify uses raw', () => { expect(formatHtTLV(1999.996)).toBe('2000.00') })
})
```
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**
```js
export function liverGrowthRate(age, htTLV) {
  const a = Number(age), h = Number(htTLV)
  if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(h) || h <= 0) return null
  return Math.pow(h / CLASS_BASELINE, 1 / a) - 1
}
const PG_TO_LETTER = { PG1:'A', PG2:'B', PG3:'C', PG4:'D', PG5:'E' }
export function formatClassLabel(letter) { return letter ? `Class ${letter}` : '' }
export function legacyPgToLetter(code) { return code == null ? null : (PG_TO_LETTER[code] ?? String(code)) }
export function formatHtTLV(htTLV) { return Number.isFinite(Number(htTLV)) ? Number(htTLV).toFixed(2) : '' }
```
- [ ] **Step 4: Run** → PASS. **Step 5:** commit `feat(domain): LGR, labels, legacy shim, display rounding`.

### Task 11: Absorb `formulasConfig.js` (spec §2 — was missing)

**Files:** Modify/replace `src/config/formulasConfig.js`; update importers.

- [ ] **Step 1:** Find importers: `grep -rn "formulasConfig\|formulas\." src`.
- [ ] **Step 2:** Re-export a thin compatibility `formulas` object from the domain module so existing callers keep working, but the numbers live only in config/domain:
```js
// src/config/formulasConfig.js — thin compat shim over the domain module.
import { CLASS_BASELINE, GROWTH_RATES, liverGrowthRate } from '@/domain/classification.js'
export const formulas = {
  thresholdFor: (rate, age) => CLASS_BASELINE * Math.pow(1 + rate, age),
  curves: GROWTH_RATES.map((r) => (age) => CLASS_BASELINE * Math.pow(1 + r, age)),
  calculateLiverGrowthRate: liverGrowthRate,
}
```
> Removes the hardcoded `600`/`1.01`–`1.04` and dead `calculatePG2/3Threshold`, `generateLineData1/2`. Update `ChartDisplay.vue` threshold-curve construction to use `formulas.curves`/`thresholdFor` (done in Task 25).
- [ ] **Step 3:** `npm run lint && npm test && npm run build`. **Step 4:** commit `refactor: absorb formula constants into domain/config`.

### Task 12: Domain — LGR display note & full domain green

- [ ] **Step 1:** Ensure `formulasConfig.js`'s old `/100` comment is gone; confirm `npm test` covers all domain funcs. **Step 2:** commit if any cleanup, else skip.

---

## Phase C — De-monolith `App.vue` while wiring domain + pg→class migration

> **Discipline:** every task here reduces `App.vue`. After the phase, `App.vue` and all new files are < 600 LOC (verified in Task 23). Move code verbatim; wire the domain module as you go. Migrate the data-point shape from `pg` to the canonical row schema (Global Constraints).

### Task 13: Extract `useQueryParams` (with age clamping — spec D8)

**Files:** Create `src/composables/useQueryParams.js`; modify `App.vue`.
- [ ] Move `getUrlQueryParams` (`App.vue:318-333`) + init. **Preserve** `?patientId=&age=&tlv=`, `acknowledgeBanner`, `show*`. **Add:** clamp parsed `age` to `[CONFIG.AGE_MIN, CONFIG.AGE_MAX]`. Verify each mode. `git add -A && git commit -m "refactor: extract useQueryParams with config age clamping"`.

### Task 14: Extract `usePatientForm` (validation from CONFIG)

**Files:** Create `src/composables/usePatientForm.js`; modify `App.vue`.
- [ ] Move input refs + `isAgeValid`/`isHeightValid`/`formattedHeightAdjustedTLV`. Validation reads `CONFIG.AGE_MIN/MAX`, `HEIGHT_MIN/MAX`, `TLV_MIN/MAX`. commit `refactor: extract usePatientForm`.

### Task 15: Wire domain classifier into `App.vue` + migrate data-point shape to `class`

**Files:** Modify `App.vue`.
- [ ] **Step 1:** Import the domain module **without name collision** (App has a computed `heightAdjustedTLV`):
```js
import { classify, formatClassLabel, liverGrowthRate,
         heightAdjustedTLV as calcHtTLV } from '@/domain/classification.js'
```
- [ ] **Step 2:** Replace the inline `progressionGroup` computed (`App.vue:399-419`) with `classify(heightAdjustedTLV.value, age.value)` (reuse the existing computed for the value); replace `pgLabelMap`/`formatPGLabel` (`App.vue:796-806`) with `formatClassLabel`.
- [ ] **Step 3:** Migrate the data-point object built on "Calculate"/add (`App.vue:~477-491`) to the **canonical row schema**: set `class` (letter), `htlv`, `htlvEstimated:false`, `estimatedHtTLV:null`, `estimatedClass:null`. Replace all internal `point.pg` reads with `point.class`.
- [ ] **Step 4:** `grep -n "PG[1-5]\|pgLabelMap\|formatPGLabel\|\.pg\b" src/App.vue` → none. `npm test && npm run build`. commit `refactor(app): wire shared classifier, migrate data points to class letters`.

### Task 16: Extract `useDataPoints`

**Files:** Create `src/composables/useDataPoints.js`; modify `App.vue`.
- [ ] Move `dataPoints`, add/edit/remove, `editingIndex` (keep chart-ref calls in `App.vue`). commit `refactor: extract useDataPoints`.

### Task 17: Extract `useTheme`

**Files:** Create `src/composables/useTheme.js`; modify `App.vue`.
- [ ] Move theme toggle + persistence. commit `refactor: extract useTheme`.

### Task 18: PG→letter CSS migration across App.vue + InputControls.vue + UI copy

**Files:** Modify `App.vue`, `src/components/InputControls.vue`, `src/styles/app.css`, add a `classToCssClass` helper (domain module).
- [ ] **Step 1:** Add `export const classToCssClass = (c) => c ? 'class-' + c.toLowerCase() : ''` to the domain module (+ test).
- [ ] **Step 2:** `App.vue` template (`:158-170`): `progression-group PG1..PG5` → `progression-group class-a..class-e`. `app.css`: rename `.PG1..PG5` → `.class-a..class-e` (keep the exact color values).
- [ ] **Step 3:** `InputControls.vue:205`: `:class="\`output-field ${progressionGroup}\`"` → `:class="['output-field', classToCssClass(progressionGroup)]"`; ensure `progressionGroup` prop is now a letter.
- [ ] **Step 4: UI copy** — `InputControls.vue:~32` placeholder `15-80` and `App.vue:~39` FAQ `15-80 years` → build from `CONFIG.AGE_MIN`/`AGE_MAX` (e.g. ``:placeholder="`${CONFIG.AGE_MIN}-${CONFIG.AGE_MAX}`"``).
- [ ] **Step 5:** `grep -rn "PG[1-5]" src` → none. Manual smoke: band colors + input class styling unchanged; age hints show 15–85. commit `refactor: migrate PG codes to class-letter CSS across app + InputControls`.

### Task 19: Extract `FaqModal.vue`
**Files:** Create `src/components/FaqModal.vue`; modify `App.vue`. Move inline FAQ (`App.vue:~40-90`) + show/hide. commit `refactor: extract FaqModal`.

### Task 20: Extract `DataTable.vue` (+ a11y + estimated-row rendering)
**Files:** Create `src/components/DataTable.vue`; modify `App.vue`.
- [ ] Move the table (`App.vue:~185-245`). Render `class`/`htlv` normally; when `htlvEstimated`, render `estimatedClass`/`estimatedHtTLV` italic + `≈` + `title="Unvalidated estimate — measured height missing"`. Add summary line "N of M rows used an estimated height — not a validated ChIC class". A11y: row `role="button"` + `tabindex="0"` + `@keydown.enter/.space`; remove button `aria-label="Remove data point"`. commit `refactor: extract DataTable with a11y + estimated-row flags`.

### Task 21: Fold template downloads into `useDataPersistence`
**Files:** Modify `useDataPersistence.js`, `App.vue`. Move template helpers out of `App.vue`; delete duplicate `downloadCSVTemplate` (`App.vue:706-714`). commit `refactor: consolidate template downloads`.

### Task 22: Split `app.css` into modules
**Files:** Create `src/styles/{base,layout,controls,table,progression-groups,print}.css` + `src/styles/index.css`; delete `src/styles/app.css`; update import in `main.js`/`App.vue`. Each < 600. Verify visual parity. `git add -A && git commit -m "refactor(styles): split app.css into per-concern modules"`.

### Task 23: Verify 600-LOC cap + full smoke
- [ ] `find src \( -name '*.vue' -o -name '*.js' -o -name '*.css' \) -print0 | xargs -0 wc -l | sort -rn | head` — no file > 600. If `App.vue` still over, extract more (e.g. a `useChartBridge` composable). Full manual smoke incl. all query-param modes. commit any final extraction.

---

## Phase D — Import + chart correctness

### Task 24: Rewrite `processLoadedRow` (unify classifier, cohort-mean height, drop /850)

**Files:** Modify `src/composables/useDataPersistence.js`; add `src/composables/__tests__/useDataPersistence.test.js`.
- [ ] **Step 1: Failing tests** (round-trip, cohort-mean, height-less flag, legacy pg, malformed, export column):
```js
import { describe, it, expect } from 'vitest'
import { classify, heightAdjustedTLV } from '@/domain/classification.js'
import { processRows, buildExportRows } from '@/composables/useDataPersistence.js'
describe('processRows', () => {
  it('measured height matches manual path', () => {
    const [r] = processRows([{ id:'x', age:50, height:1.7, tlv:3400 }])
    expect(r.class).toBe(classify(heightAdjustedTLV(3400,1.7),50)); expect(r.htlvEstimated).toBe(false)
  })
  it('cohort-mean height used before global fallback', () => {
    const rows = processRows([{id:'a',age:50,height:1.6,tlv:3000},{id:'b',age:50,height:1.8,tlv:3000},{id:'c',age:50,tlv:3000}])
    const est = rows.find(r => r.id==='c')
    expect(est.htlvEstimated).toBe(true); expect(est.class).toBeNull()
    expect(est.estimatedHtTLV).toBeCloseTo(3000/1.7, 6) // mean(1.6,1.8)=1.7
  })
  it('global fallback when no heights in file', () => {
    const [r] = processRows([{id:'z',age:50,tlv:3400}])
    expect(r.estimatedHtTLV).toBeCloseTo(3400/1.70, 6)
  })
  it('drops malformed rows', () => { expect(processRows([{id:'q'}]).length).toBe(0) })
  it('export includes htTLV_estimated column', () => {
    const rows = buildExportRows([{ id:'x', age:50, height:1.7, tlv:3400, htlv:2000, class:'C', htlvEstimated:false }])
    expect(rows[0]).toHaveProperty('htTLV_estimated')
  })
})
```
- [ ] **Step 2: Run** → FAIL. **Step 3:** Extract a pure `processRows(rawRows)` that: computes the file-level mean height (rows with valid height); for each row uses `heightAdjustedTLV(tlv, height)` when height present (→ `class`, `htlvEstimated:false`), else estimates via mean-else-`CONFIG.MODEL.ASSUMED_HEIGHT_M` (→ `estimatedHtTLV`/`estimatedClass`, `class:null`, `htlvEstimated:true`); maps any incoming legacy `pg` with `legacyPgToLetter` (informational only). Delete `/850` + 2-threshold logic. Add `buildExportRows` with the `htTLV_estimated` column. Wire the file loaders (JSON/CSV/Excel) through `processRows`.
- [ ] **Step 4: Run** → PASS. `npm run build`. commit `fix(import): unify classifier, cohort-mean estimation, drop /850, export flag`.

### Task 25: Chart — safe methods + config-driven domain/ticks/colors

**Files:** Modify `src/components/ChartDisplay.vue`; remove any temporary CONFIG aliases from Task 7.
- [ ] **Step 1:** Implement `updatePointStyle(index, color, group)` (mutates the `Patient Data` dataset point) and a **SAFE** `clearChart()` that clears **only** the `Patient Data` and `Selected Point` datasets (NEVER the threshold curves / class fills) — or simply delegates to the existing `dataPoints` watcher redraw. Add both to `defineExpose` (`:449`). Confirm `App.vue:644`/`:692` resolve.
- [ ] **Step 2:** Replace hardcoded chart constants with config: y `min/max`/`CEILING_Y`←`CONFIG.CHART_Y_MIN/MAX`; both tick arrays (`:334`,`:342`)←`CONFIG.CHART_Y_TICKS`; x `min/max`←`CONFIG.CHART_X_MIN/MAX`; class colors←`CONFIG.CLASS_COLORS`; threshold curves via `formulas.curves`. Remove the Task 7 temporary `CHART_X_AXIS_*` aliases.
- [ ] **Step 3: Manual smoke** — add point; edit its group/color in the table → marker updates; the background threshold bands remain after edits/reset; htTLV 450 (below 600) and 10344 both render on-axis. commit `fix(chart): safe exposed methods, config-driven domain/ticks/colors`.

### Task 26: Estimated-row export/UI finalize
- [ ] Confirm CSV/JSON/Excel exports carry `htTLV_estimated` (from Task 24) and the DataTable flags (Task 20) render end-to-end via a manual import of a height-less row. commit if any gap closed.

---

## Phase E — Deploy & rebrand

### Task 27: Base path & router
**Files:** `vite.config.js`, `src/router/index.js`, footer image resolution.
- [ ] `base = command==='build' ? '/ChIC/' : '/'`; `createWebHistory(import.meta.env.BASE_URL)`; drop unused `useRoute`; footer imgs via `import.meta.env.BASE_URL` or `@/assets` import. `npm run build && npm run preview` → assets load under `/ChIC/`. commit `fix(deploy): correct Pages base path to /ChIC/`.

### Task 28: Complete rebrand (scoped)
- [ ] **Scoped** replace (not a bare `.`): `grep -rn "pld-progression-grouper" src public vite.config.js README.md package.json index.html`. Replace in those targets only (exclude `dist`, `docs/superpowers`, dirs slated for deletion). Update PWA `start_url`/`scope`/`id`, contact email, README URL. commit `chore: complete pld-progression-grouper → ChIC rebrand`.

### Task 29: Retire double service worker
**Files:** delete `src/registerServiceWorker.js`; modify `main.js`; `npm rm register-service-worker`.
- [ ] Remove the PROD dynamic import block (`main.js:5-7`; keep dev-unregister cleanup). Verify `vite-plugin-pwa` still emits `sw.js`. `git add -A && git commit -m "fix(pwa): let vite-plugin-pwa own SW"`.

---

## Phase F — CI, hygiene, infra

### Task 30: Split CI / deploy (with typecheck + format:check)
**Files:** Create `.github/workflows/ci.yml`; replace `gh-pages.yml` with `deploy.yml`.
- [ ] **`ci.yml`** on `pull_request` + push (ignore `gh-pages`): `npm ci` → `npm run lint` → `npm run format:check` → `npm run typecheck` → `npm test` → `npm run build`.
- [ ] **`deploy.yml`** on push to `main` only: `npm ci` → `npm run build` → `cp dist/index.html dist/404.html` → `peaceiris/actions-gh-pages@v4`. No deploy in any PR context.
- [ ] `git rm .github/workflows/gh-pages.yml`; `git add -A && git commit -m "ci: split validation (ci.yml) from deploy (deploy.yml), add typecheck + format:check"`.

### Task 31: Purge junk (filesystem-aware)
- [ ] Tracked junk: `git rm -r public/_old public/pgs_old contact.md`. **`dist/_old` is now untracked** (Task 6) → remove from filesystem only: `rm -rf dist/_old`. Move the Mayo MIC reference from `external-references` into README References, then `git rm external-references`. `git add -A && git commit -m "chore: remove leftover directories and orphan files"`.

### Task 32: Optimize logos
- [ ] Compress 2 MB logos to < 100 KB (WebP/optimized PNG), de-dup `src/assets/logo.png` vs `public/`. `git add -A && git commit -m "perf: optimize + de-dup logo assets"`.

### Task 33: Audit + dead deps
- [ ] `npm audit fix` (non-breaking). Remove confirmed-unused deps (verified 0 `src` refs): `npm rm core-js html2canvas canvas2svg chartjs-plugin-datalabels`. Remove dead `annotationPlugin` import (`ChartDisplay.vue:11`). `npm run build` after each. `git add -A && git commit -m "chore: drop dead deps, patch audit findings"`.

### Task 34: README accuracy
- [ ] Fix license (MIT not "MIT-0"; link `LICENSE`), age range → 15–85, typos, add a **Development** section (`npm ci`/`dev`/`build`/`lint`/`test`), align description with the manuscript. `git add -A && git commit -m "docs: correct README license, setup, copy"`.

### Task 35: Project infra
**Files:** `.github/dependabot.yml`, `SECURITY.md`, `CONTRIBUTING.md`, `.github/CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/bug_report.md`.
- [ ] dependabot (npm + github-actions weekly); CONTRIBUTING documents dev setup + the 600-LOC/DRY-KISS-SOLID rules. `git add -A && git commit -m "chore: add dependabot, security, contributing, templates"`.

---

## Phase G — App smoke tests (spec WS-4 — was missing)

### Task 36: Component smoke tests
**Files:** `src/__tests__/App.smoke.test.js`.
- [ ] Using `@vue/test-utils` + jsdom: (a) `App` mounts without error; (b) the disclaimer gate blocks/acknowledges (localStorage); (c) entering valid age/height/TLV and clicking Calculate adds a row to `DataTable` and calls the chart update. `npm test` green. `git add -A && git commit -m "test: App mount + disclaimer + add-a-point smoke tests"`.

---

## Phase H — Branch surgery (LAST, only after CI is green)

### Task 37: Make `main` default; clean up
- [ ] **Step 1:** Green locally: `npm ci && npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.
- [ ] **Step 2:** Capture the working branch dynamically (do NOT hardcode): `WORK=$(git branch --show-current)`.
- [ ] **Step 3:** `git checkout main 2>/dev/null || git checkout -b main origin/main; git merge --ff-only "$WORK"; git push origin main` (FF verified valid: main is ancestor).
- [ ] **Step 4:** `gh api -X PATCH repos/halbritter-lab/ChIC -f default_branch=main`.
- [ ] **Step 5:** `git push origin --delete "$WORK" yml-edit-2` (only after confirming `$WORK` is merged into main).
- [ ] **Step 6:** Confirm `deploy.yml` fires on the `main` push and Pages serves `/ChIC/`.

---

## Self-Review (against spec + Codex NO-GO)

- **Codex blockers resolved:** config-before-domain (Phase B order), single `CONFIG.MODEL.ASSUMED_HEIGHT_M` key, extraction interleaved with `App.vue` touches (Phase C, cap verified Task 23), aliased `heightAdjustedTLV` import (Task 15), InputControls in the migration + `classToCssClass` (Task 18), row schema defined once (Global Constraints), real colors (Task 7 copies actual values), safe `clearChart` (Task 25), `git add -A` everywhere, `dist/_old` filesystem-only (Task 31), scoped rebrand grep (Task 28).
- **Spec gaps closed:** typecheck (Task 5) + in CI (Task 30); format:check in CI (Task 30); App smoke tests (Task 36); epsilon + separate rounding tests (Tasks 9–10); cohort-mean + export + malformed tests (Task 24); query-param age clamping (Task 13); UI "15-80" copy (Task 18); formulasConfig absorbed (Task 11).
- **Ordering:** config → domain → interleaved de-monolith/wire → import/chart → deploy → CI/hygiene → smoke → branch last. Branch name captured dynamically (Task 37).
