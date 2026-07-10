# Final Whole-Branch Review Fix Report

Date: 2026-07-10  
Branch: `fix/pr45-adversarial-hardening`  
Worktree: `/home/bernt-popp/development/ChIC/.worktrees/pr45-hardening`  
Functional commit: `7289ee9 fix: resolve final adversarial review findings`

## Scope and root causes

### 1. Reset retained a stale edit cursor

`App.vue` owned the reset boundary for the form and row collection, but `resetForm()` cleared
`dataPoints` without resetting the `editingIndex` ref returned by `useDataPoints()`. After selecting
row 1, resetting, and calculating again, `addOrUpdatePoint()` still took its indexed-update path
and assigned the new row to index 1 of an empty array. The result was a sparse
`[undefined, newRow]` collection and a `DataTable` render error when it read `point.id`.

The source-boundary fix resets `editingIndex.value = -1` alongside `dataPoints.value = []`.
The component regression reproduces select-later-row -> reset -> calculate and asserts one dense
row with no undefined values. The browser regression repeats the real flow with a selected chart
ring and verifies one row after the next calculation.

### 2. Precache audit accepted an empty parse

`scripts/audit-precache.mjs` parsed Workbox URLs with a regex, then performed missing-artifact,
forbidden-entry, and size checks over that result. An unrecognized or malformed service worker
produced `urls = []`; every downstream check vacuously passed and the script reported zero bytes.

The audit now fails explicitly when zero manifest URLs are found. This check occurs before artifact
mapping, leaving the existing missing-artifact, forbidden-entry, and byte-limit checks unchanged.

### 3. Chart clearing could redraw the SVG selection ring

Overlay deletion and optional selection rendering were coupled inside `drawRingOverlay()`.
`clearChart()` called that renderer after clearing the two point datasets, so still-selected props
could immediately recreate the SVG ring. It also could not clear an overlay when `chartInstance`
was absent because `drawRingOverlay()` returned before deletion.

`clearRingOverlay()` is now an unconditional SVG-only cleanup helper. `drawRingOverlay()` calls it
before deciding whether a selected point can be drawn, while `clearChart()` calls it before the
chart-instance guard and never invokes the renderer. Dataset clearing remains label-scoped to the
magic `Patient Data` and `Selected Point` datasets; dataset order, fill references, props, watchers,
and `defineExpose` are unchanged.

### 4. OG source and raster omitted `(ChIC)`

The raster accurately reflected `scripts/og-image.html`, but the source title itself was
`Charité Imaging Classification` rather than the approved exact
`Charité Imaging Classification (ChIC)`.

The source contract was updated first, the HTML title was corrected, and the PNG was regenerated
from the documented Vite/Playwright process. Logo, subtitle, URL, and existing meta alt text were
preserved.

## Focused RED/GREEN evidence

### Reset/edit cursor

- RED command: `npx vitest run src/__tests__/App.smoke.test.js -t 'resets the edit cursor'`
- Test harness was first corrected to expose the stubbed `clearChart()` contract; the meaningful
  RED then failed with `expected [undefined, newRow] to have a length of 1 but got 2` and surfaced
  the expected `Cannot read properties of undefined (reading 'id')` render error.
- GREEN: same command, 1 passed / 3 skipped.

### Empty precache parse

- RED command:
  `npx vitest run scripts/__tests__/audit-precache.test.js -t 'no recognizable manifest URLs'`
- RED result: child process exited 0, contrary to `expect(result.status).not.toBe(0)`.
- GREEN: same command, 1 passed / 1 skipped, with the expected explicit error contract.

### Overlay clearing

- RED command:
  `npx vitest run src/components/__tests__/ChartDisplay.source.test.js -t 'clears the SVG overlay'`
- RED result: source lacked `const clearRingOverlay = () =>` and `clearChart()` still invoked
  `drawRingOverlay()`.
- GREEN: same command, 1 passed / 2 skipped.
- Focused runtime command:
  `npx playwright test tests/e2e/pr45-hardening.spec.js -g 'reset clears a selected-point overlay'`
- Runtime result: 1 passed. It verified a selected ring existed before reset, zero rings and rows
  existed after reset, and a subsequent calculation produced exactly one row.

### Approved OG title

- RED command:
  `npx vitest run scripts/__tests__/og-image-source.test.js -t 'approved complete product title'`
- RED result: source did not contain the exact approved `<h1>`.
- GREEN: same command, 1 passed / 1 skipped.

## OG raster generation and inspection

Process used:

1. Copied `scripts/og-image.html` to temporary `public/og-render.html`.
2. Started `npm run dev -- --host 127.0.0.1` on port 8137.
3. Used Playwright Chromium with a 1200x630 viewport and device scale factor 1.
4. Loaded `http://127.0.0.1:8137/og-render.html` and screenshot only `.og` to
   `public/og-image.png`.
5. Removed `public/og-render.html` and stopped Vite.

Raster evidence:

- `file public/og-image.png`: PNG, 1200 x 630, 8-bit RGB, non-interlaced.
- `stat -c '%s bytes' public/og-image.png`: 93,449 bytes, below 150 KiB.
- Original-resolution visual inspection confirmed the logo, exact two-line title, subtitle, and URL
  are crisp and legible. All content remains inside the 1080x600 safe zone (approximately
  x=60..1140 and y=15..615). No source typography adjustment was necessary.

## Fresh full verification

- `npm test`: PASS, 14 files / 124 tests.
- `npm run lint`: PASS.
- `npm run format:check`: PASS, all matched files formatted.
- `npm run typecheck`: PASS (`vue-tsc --noEmit`).
- `npm run build`: PASS, 69 modules transformed; PWA generated 22 precache entries
  (379.80 KiB reported by the plugin); `dist/404.html` generated.
- `npm run audit:precache`: PASS, 22 entries / 1,139,902 bytes / 2,190,000-byte limit.
- `npm run test:e2e`: PASS, 7 Chromium tests.
- `git diff --check`: PASS.
- File-cap inspection: PASS. Largest source file is `src/components/ChartDisplay.vue` at 583 lines;
  touched `src/App.vue` is 553 lines. No source file exceeds 600 lines.
- Temporary `public/og-render.html` and Playwright `test-results/` artifacts were removed.

## Files changed in functional commit

- `src/App.vue`
- `src/__tests__/App.smoke.test.js`
- `scripts/audit-precache.mjs`
- `scripts/__tests__/audit-precache.test.js`
- `src/components/ChartDisplay.vue`
- `src/components/__tests__/ChartDisplay.source.test.js`
- `tests/e2e/pr45-hardening.spec.js`
- `scripts/og-image.html`
- `scripts/__tests__/og-image-source.test.js`
- `public/og-image.png`

## Concerns / non-blocking warnings

- The build and Playwright web server retain the existing warnings about the Excel chunk exceeding
  500 KiB and `caniuse-lite` data being eight months old. Neither is caused by these fixes and all
  requested gates pass.
- Playwright emits the existing `NO_COLOR` / `FORCE_COLOR` warning. It does not affect results.
- No dependencies, dataset ordering/fills, magic labels, public component contracts, or unrelated
  application behavior were changed.
