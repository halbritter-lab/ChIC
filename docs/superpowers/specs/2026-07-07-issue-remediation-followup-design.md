# ChIC Issue Remediation — Follow-up Design (2026-07-07)

**Context.** GitHub issues #3–#11 were filed on 2026-07-06 after a full review. A prior
session executed the remediation plan (`docs/superpowers/plans/2026-07-06-chic-remediation.md`,
rev 2, post-Codex) and landed most of it on `main` (App.vue de-monolithed to ~548 LOC,
`src/domain/classification.js` extracted, central `CONFIG`, Vitest suite, split CI/deploy,
base-path/branch fixes). This doc records an **evidence-based audit** of each issue against the
**current** code and specifies only the work that genuinely remains.

## Audit — status of each issue against `main`

| Issue                          | Status                               | Evidence (current code)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#3** Deploy base path & CI   | ✅ Resolved                          | `vite.config.js:7` `base='/ChIC/'`; `src/router/index.js` uses `createWebHistory(import.meta.env.BASE_URL)`; default branch `main`; `.github/workflows/deploy.yml` triggers on `main`; footer logos resolved via `withBase(link.img)` in `AppFooter.vue`.                                                                                                                                                                                                                                                                                                |
| **#4** Favicon                 | ✅ Resolved                          | Root cause was the base path (now fixed); `index.html` icons use `%BASE_URL%…?v=6`; `public/_old` and `public/pgs_old` deleted.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **#5** Batch import classifier | ⚠️ Core resolved; 2 minor items open | Unified `classify()` used by both interactive (`App.vue:244`) and import (`useDataPersistence.js` → `processRows`) paths; export writes the **A–E letter** (`buildExportRows` `Class: p.class`); cohort-mean height replaces the `/850` fallback; domain + persistence tests exist. **Remaining:** CSV parsing still `String.split(',')` with no quoted-field support (`useDataPersistence.js:246,254`) and export does not quote fields → a group name containing a comma corrupts a round-trip; invalid rows are dropped silently with no UI feedback. |
| **#6** Chart edit methods      | ✅ Resolved                          | `ChartDisplay.vue:473` exposes `{ downloadChart, updateChartPoint, updatePointStyle, clearChart }`; `clearChart` clears only the `Patient Data`/`Selected Point` datasets (never threshold curves); `App.vue` calls resolve.                                                                                                                                                                                                                                                                                                                             |
| **#7** Mobile chart distortion | ❌ Open                              | `src/styles/layout.css:36–48` still forces `.chart-container { aspect-ratio:16/9 }` + `canvas { width/height:100% !important }`, which fights Chart.js `responsive:true`/`maintainAspectRatio:false`.                                                                                                                                                                                                                                                                                                                                                    |
| **#9** README accuracy         | ✅ Resolved (PMID pending)           | License now "MIT License" linking `LICENSE`; deploy URL `/ChIC/`; age range 15–85 throughout; the flagged typos are gone; Development section + `CONTRIBUTING.md`/`SECURITY.md` exist. Only `PMID:TBD` for the in-prep ChIC paper remains — legitimately unavailable until publication, not a code fix.                                                                                                                                                                                                                                                  |
| **#10** Contact email          | ✅ Resolved                          | `contact.md` deleted; feedback address is `jan.halbritter@charite.de` (disclaimer + README); footer "Feedback Form" points at a live Google Form; no `pld-progression-grouper.org` address anywhere.                                                                                                                                                                                                                                                                                                                                                     |
| **#11** Compiler-macro imports | ❌ Open                              | `ChartDisplay.vue:9`, `DisclaimerModal.vue:25`, `CitationSection.vue:7`, `AppFooter.vue:59`, `DocumentationSection.vue:7` still import `defineProps`/`defineEmits`/`defineExpose` from `'vue'`; `@vue/compiler-sfc` emits a warning per macro (visible in `npm test` output).                                                                                                                                                                                                                                                                            |

## Scope of this change

Fix the three genuinely-open items. Everything else is verified resolved and will be reported
(with issue comments) rather than re-touched.

### Fix A — #11: remove compiler-macro imports (behavior-neutral)

`defineProps`/`defineEmits`/`defineExpose` are compiler macros in `<script setup>`; importing them
from `'vue'` is unnecessary and triggers the SFC warning.

- `ChartDisplay.vue:9` — keep `ref, onMounted, onUnmounted, watch`; drop `defineProps, defineExpose`.
- `DisclaimerModal.vue:25` — the line imports only the two macros → delete the whole line.
- `CitationSection.vue:7`, `DocumentationSection.vue:7`, `AppFooter.vue:59` — each imports only
  `defineProps` → delete the whole line.

Verify before editing that no other `'vue'` runtime API on those lines is being dropped (checked:
each is macro-only except `ChartDisplay`, which keeps its four real imports). Zero behavior change;
the three warnings disappear from `npm test`/dev/build.

### Fix B — #7: mobile chart CSS

Let Chart.js own the canvas; size the container only. In `src/styles/layout.css` `@media (max-width: 800px)`:

- **Remove** the `canvas { width/height:100% !important }` rule.
- Replace `.chart-container { aspect-ratio:16/9; height:auto }` with a **portrait-friendly** sizing:
  `min-height: 60vh` (with `height:auto`) so the log axis + labels have vertical room on a phone,
  keeping `width/max-width:100%`, `padding`, and `box-sizing`.

Rationale for `min-height` over a fixed portrait `aspect-ratio`: `maintainAspectRatio:false` needs the
container to have a real height; a viewport-relative min-height adapts to phone height without
crushing the axis and without desyncing Chart.js's drawing buffer. The desktop layout (chart height
comes from `controls.css .chart-container`) is untouched. `print.css` has its own chart block and is
out of scope.

### Fix C — #5 remainder: robust, symmetric CSV + skipped-row feedback

All in `src/composables/useDataPersistence.js` (currently 385 LOC; stays < 600), dependency-free
(no Papa Parse — AGENTS.md: don't add deps unless asked):

1. **Quote-aware import parser** `parseCsv(text)`: RFC-4180-ish — fields may be wrapped in double
   quotes; `""` is an escaped quote; commas and newlines are literal inside quotes; tolerate `\r\n`
   and a trailing newline. Returns an array of `{header: value}` row objects with the same
   number-coercion the current loader applies. Replaces the `split('\n')`/`split(',')` logic in
   `loadDataFromCsv`.
2. **Quoted export** in `downloadDataAsCsv`: wrap any field containing `,` `"` `\r` or `\n` in
   double quotes and double interior quotes, so a group label with a comma survives export→import.
3. **Skipped-row feedback**: add a `loadNotice` ref to the composable. Each loader computes
   `skipped = rawRows.length − processedRows.length` and sets a human notice
   (`"N row(s) skipped — missing or out-of-range ID, age, or TLV."`) when `skipped > 0`, else `null`.
   `processRows` keeps returning an array (tests depend on that); the count is derived by the caller,
   not by changing its signature. `App.vue` surfaces `loadNotice` next to the existing `loadingError`,
   with a non-error (info) style.

**Tests** (extend `src/composables/__tests__/useDataPersistence.test.js`): a quoted field with an
internal comma parses as one value; `buildExportRows` + CSV quoting round-trips a comma-containing
group; malformed rows still drop. Export-quoting is unit-tested at the string level via a small
exported `toCsv(rows, columns)` helper (extracted from `downloadDataAsCsv` so the pure string build
is testable without the DOM).

## Non-goals / explicitly out of scope

- `PMID:TBD` in README — no PMID exists yet (paper in prep); cannot be filled.
- Re-touching #3/#4/#6/#9/#10 — verified resolved; only issue comments.
- Adding Papa Parse or any dependency.
- Logo optimization, dead-dep pruning, further `App.vue` extraction — already handled or unrelated
  to these eight issues.

## Verification

`npm run lint` (0 errors), `npm test` (all green **and no `@vue/compiler-sfc` macro warnings**),
`npm run typecheck`, `npm run format:check`, `npm run build`. Manual: mobile emulation shows an
undistorted chart; import a CSV whose group contains a comma and confirm the point/marker + table are
correct and a height-less row triggers the skipped/estimate treatment.

## Invariants honored

- Shared classifier stays the single source of truth (both paths already call `classify()`).
- Chart dataset labels `Patient Data`/`Selected Point` and dataset order unchanged.
- Query-param embed/kiosk API unchanged.
- 600-LOC cap respected on every touched file; changes are behavior-preserving.

## Implementation notes (post adversarial review)

Three Codex high-reasoning review rounds (plan → diff → verification) surfaced items beyond the
original scope that shipped as part of this change:

- **Round-trip import was broken and is now fixed (was mis-scoped as a non-goal).** Export uses
  display headers (`ID`, `Age (y)`, …) while import expected lowercase keys, so re-importing the
  app's own JSON/CSV/Excel export dropped **every** row. Added `normalizeImportRow()` in
  `useDataPersistence.js`, applied at the top of `processRows`, that aliases both header styles
  (`id|ID`, `age|Age (y)`, `height|Height (m)`, `tlv|TLV (ml)`, `group|Group`, `groupColor|GroupColor`,
  `pg|PG`, `class|Class`) to canonical keys. Templates and exports both import now; computed columns
  stay ignored (class is always recomputed). This is issue #5's round-trip concern.
- **Zero-valid-row imports no longer wipe or contradict.** If a non-empty file yields no valid rows,
  the table is preserved and an explicit error is shown ("No valid rows found — nothing imported…"),
  instead of a stale table under a "N skipped" notice.
- **Parser hardening.** `parseCsv` strips a leading UTF-8 BOM, flushes a final empty quoted field
  consistently regardless of trailing newline, and **throws** on an unterminated quote. The CSV
  loader no longer number-coerces cells (leading-zero IDs like `00123` are preserved); `processRows`
  does the numeric coercion. Blank/whitespace IDs are dropped; a CSV with no data rows errors.
- **Config-DRY.** `ChartDisplay.vue` baseline fill now reads `CONFIG.MODEL.CLASS_BASELINE_ML_PER_M`
  instead of a literal `600`.
- **Docs.** `AGENTS.md` + `CLAUDE.md` updated to reflect the now-fixed invariants (unified classifier,
  exposed chart methods, `/ChIC/` base, central `CONFIG`, Vitest present, check-only lint).
