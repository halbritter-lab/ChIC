# Design — Resolve open ChIC issues #35, #36, #37, #38, #42, #43

**Date:** 2026-07-10
**Branch:** `fix/issues-batch-35-43`
**Scope:** Six actionable open issues. #40 (update citations) is explicitly deferred — it is blocked on manuscript acceptance/publication and is out of scope here.

## Goals & non-goals

**Goals**

- Fix three chart/input bugs (#43, #35, #36).
- Replace the questioned height-estimation behaviour with an explicit "could not calculate" model (#37).
- Replace the dead Google Form feedback link with a GitHub-native flow (#38).
- Redesign the Open Graph social-preview image (#42).
- Resolve every actionable PR review thread and the additional import defects reproduced during
  adversarial Playwright testing.
- Remove patient-bearing query parameters from public bug-report links.
- Reduce initial JavaScript and PWA installation cost without weakening the calculator's offline
  availability.
- **All new external links and repo coordinates are config-driven** (single source of truth), per the maintainer directive and AGENTS.md invariant #7.
- Every fix is verified in a production-like build via Playwright. Lighthouse Accessibility, Best
  Practices, and SEO must remain 100; Performance must improve from the locally reproduced baseline
  (84 without compression/cache headers) and all measurements must be reported with their serving
  conditions rather than normalized into a target score.

**Non-goals**

- No new runtime dependencies (dev-only tooling via `npx` is acceptable; nothing added to `package.json` without sign-off).
- No dataset reordering / renaming in the chart (invariants #3, #4).
- No change to the clinical model math (`classification.js`, `formulasConfig.js`).
- #40 citations, and any manuscript-dependent copy, are untouched.

## Cross-cutting: config-driven links (`src/config/links.js`, new)

A new focused module centralises every GitHub/contact URL and its display label. Rationale: today the Google Form URL is hardcoded inline in `AppFooter.vue:39` and the contact email inline in `disclaimerMixin.js:24`, with no single source. New module keeps `config.js` reserved for the clinical/UI constants it already owns (SRP) while giving the feedback/repo/contact links one home.

```js
// src/config/links.js — external links & labels (single source of truth).
const REPO = 'https://github.com/halbritter-lab/ChIC';
export const LINKS = {
  repo: REPO,
  documentation: `${REPO}/blob/main/README.md`,
  // Open-ended feedback → GitHub Discussions (Ideas category).
  feedbackDiscussions: `${REPO}/discussions/new?category=ideas`,
  // Structured bug reports → prefilled Issue Form.
  bugReportTemplate: `${REPO}/issues/new?template=bug_report.yml&labels=bug`,
  contactEmail: 'jan.halbritter@charite.de',
};
// Build a bug-report URL with the reporter's context prefilled (page URL, app version).
export function buildBugReportUrl({ version, url } = {}) {
  /* appends &version=&page-url= URL-encoded after sanitizing the page URL */
}
```

`sanitizeBugReportPageUrl(url)` parses an absolute HTTP(S) URL and returns the same origin/path while
allowlisting only the non-clinical display parameters `acknowledgeBanner`, `showFooter`,
`showCitation`, `showDocumentation`, and `showControls`. It drops `patientId`, `age`, `height`,
`tlv`, all unknown query parameters, credentials, fragments, and any unparseable/non-HTTP(S) input.
`buildBugReportUrl` always applies this sanitizer itself so no caller can accidentally bypass it.

`AppFooter.vue` and `disclaimerMixin.js` (and anywhere else touched) import from here instead of hardcoding. The two citation PMID links in the footer are content, not touched.

---

## Issue #43 — URL-param TLV rejected as "not a number"

**Root cause:** `useQueryParams.js:41` assigns `tlv` as a raw string (`totalLiverVolume.value = q.tlv`); the validator `usePatientForm.js:75` uses `Number.isFinite`, which is `false` for the string `"15000"`, so `tlvValidationMessage` fires. `age` (lines 32–39) is coerced correctly; `tlv` and `height` (line 40) are not. `15000` is within range (`TLV_MAX = 20000`) — the value is valid; only the type is wrong.

**Fix:** In `useQueryParams.js`, coerce `tlv` and `height` with the exact `age` pattern (numeric → Number, else keep raw string so a genuinely non-numeric param still surfaces a real error):

```js
// Trim first so a whitespace-only param isn't coerced to 0 (codex #4).
const num = (raw) => {
  const t = String(raw).trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : raw;
};
if (q.height) {
  const v = num(q.height);
  if (v !== null) height.value = v;
}
const tlvParam = num(q.tlv);
if (tlvParam !== null) totalLiverVolume.value = tlvParam;
```

(`tlv=0` remains accepted because `TLV_MIN=0`; changing that clinical/input constant requires domain
owner approval and is out of scope.)

**Docs:** `docs/url-parameters.md` — the "Set all inputs" example (line 40–44) and the auto-calc note (line 18) must state that **`height` is required to plot a class** (the auto-calc guard returns early without a valid height). Add `&height=1.75` to that example so following it actually plots.

The same normalizer is used for age, height, and TLV. Auto-calculation is based on the normalized
values, not raw query-key presence: a non-blank patient ID plus non-null normalized age and TLV are
required. A genuinely non-numeric value remains verbatim and still triggers downstream validation;
a whitespace-only value is ignored and never triggers calculation.

**Tests:** extend `useQueryParams.test.js` to assert numeric coercion, whitespace handling for all
numeric fields, invalid-value preservation, display toggles, and that whitespace-only TLV does not
call `calculateDataPoint`.

**Verify:** load `/ChIC/?patientId=12345&age=50&tlv=15000&height=1.75&acknowledgeBanner=true` in-browser → no TLV error, point plotted.

---

## Issue #35 — Deleted point keeps its highlight ring

**Root cause:** The highlight is an SVG ring drawn by `drawRingOverlay()` (`ChartDisplay.vue:33`), redrawn **only** by the `editingIndex` watcher (`:521`). Deleting a row (`useDataPoints.removeDataPoint`, `:18`) splices `dataPoints` but never resets `editingIndex`; the deep `dataPoints` watcher (`:503`) calls `updateChart()` but never `drawRingOverlay()`. So the ring stays at stale coordinates. Sentinel inconsistency: `useDataPoints` uses `null`, `App.vue`/prop default use `-1`, and the ring guard `props.editingIndex < 0` is true for `-1` but false for `null`.

**Fix:**

1. `useDataPoints.js` — unify the sentinel on `-1`, changing **init + guard + reset together** (a partial change makes the next add write `dataPoints[-1]`): initialise `editingIndex = ref(-1)`; in `addOrUpdatePoint`, guard `editingIndex.value >= 0` (not `!== null`) and reset to `-1`.
2. `useDataPoints.js` `removeDataPoint` — **index-aware** adjustment, not unconditional reset (codex finding #1). Given the removed `index` and current `editingIndex e`:
   - `e === index` (deleted the edited row) → `-1`;
   - `e > index` (deleted a row **above** the edited one) → `e - 1` (indices shifted down);
   - `e < index` (deleted a row **below**) → unchanged.
     This keeps the ring on the correct point when a _different_ row is deleted, and clears it when the edited row is deleted.
3. `ChartDisplay.vue` — call `drawRingOverlay()` from the deep `dataPoints` watcher (`:503`) so the ring repositions/clears on any data change. Guard `drawRingOverlay()` to bail when the selected point's `htlv` is not finite (an uncalculable row has `htlv: null`; `getPixelForValue(null)` would draw a bogus ring — codex #8). Clear the SVG overlay in `clearChart()` (`:444`).
4. Sweep every `editingIndex` read/write for the `-1` sentinel: `App.vue:85,103,356,423,520`, `DataTable.vue:24,103` (change the prop `default: null` → `default: -1`), `ChartDisplay.vue:24,43,289–294,522`.

**Tests:** `useDataPoints` unit test — after `removeDataPoint`, `editingIndex === -1`; after edit then remove, still `-1`.

**Verify:** add point, click row to highlight (ring appears), delete it → ring gone; with two points, highlight one and delete the other → ring stays on the correct point.

---

## Issue #36 — Lowest threshold line (T1) renders wrong

**Root cause:** The visible `Threshold 1` line dataset (`ChartDisplay.vue:254–264`) has `order: 5` — the highest order in the threshold group, so Chart.js draws it **first / furthest back**. Its two translucent fills (`T1 Above Fill` `order 4.5`, `T1 Below Fill` `order 4.6`) draw _on top of_ it, over-painting the ~2px stroke from both sides → the lowest line looks thin/dim/broken. T2–T4 carry their fill on the same dataset, so their strokes always sit above their own fill. (Contract confirmed by `Patient Data` `order: -1` = drawn on top.)

**Fix:** Lower only the **draw order** of the `Threshold 1` line dataset to below its fills — `order: 4.4` (any value `< 4.5`, still `> -1` so patient points stay on top). This changes z-order only: the dataset stays in the same array position and no `fill: '+1'/'-1'` adjacency changes, so invariant #3 (bands) is preserved.

**Verify (critical — visual):** render in-browser and compare the lowest line against T2–T4; it must be a crisp, continuous stroke of the same weight. Also eyeball T4 (its ceiling/polygon fills sit above its line at `order 2` vs `1`/`1.5`); if T4 also looks muted, apply the same treatment. Confirm the class bands (A/B/C/D/E shaded regions) are visually unchanged.

**Tests:** chart dataset construction is not unit-tested (canvas); rely on browser verification + a snapshot of dataset `order` values if a lightweight assertion is practical.

---

## Issue #37 — Drop height estimation; flag "could not calculate"

**Decision (maintainer):** Remove cohort-mean/`ASSUMED_HEIGHT_M` estimation. Rows that cannot be fully computed — missing/invalid **height, age, or TLV** — are **kept** and shown, **not plotted**, with **Class = `N/A`**, and the user is told how many could not be calculated. Missing age/TLV (today dropped silently) get the same visible treatment.

**Changes:**

- `useDataPersistence.js` `processRows` (`:77–140`):
  - Remove Pass-1 cohort accumulation (`:104–106`, `:110–111`) and `estimateHeight`.
  - Keep every row that has a usable **id** (id remains the one hard requirement to form a row). For each row, compute only when age, tlv, and a valid height are all present **and in range** (`AGE_MIN/MAX`, `TLV_MIN/MAX`, and — new — `HEIGHT_MIN/MAX`; today `parseHeight` only checks positivity, so an import height of 0.1 or 5 m is wrongly "measured" — codex #11); otherwise mark `uncalculable: true` with `htlv: null`, `class: null`, `lgr: 'N/A'`. Drop the `htlvEstimated`/`estimatedHtTLV`/`estimatedClass` fields.
  - Note (pre-existing, out of scope): duplicate non-blank IDs remain allowed and would collide on `:key="point.id"`; not introduced by this change. Add a composite `:key` only if it stays clean.
  - A row with an unusable/blank id is still dropped (can't key the table/`v-for`), and counted in the notice.
- `classification.js` is already null-safe (returns `NaN`/`null` on bad input) — no change.
- `config.js` — remove `MODEL.ASSUMED_HEIGHT_M` (`:9`).
- `DataTable.vue` — replace the `≈`-estimate branches (`:36–54`) with plain measured values; render `class`/`htlv` as `N/A` (via `formatClassLabel`/`formatHtTLV` null-handling or a fallback) when `uncalculable`. Replace the estimate footer note (`:88–91`) with an "N of M rows could not be calculated (missing height, age, or TLV)" notice driven by an `uncalculableCount` computed. Add a `title`/tooltip explaining why. Keep the red note styling.
- `useDataPersistence.js` export (`buildExportRows` `:143–159`, `EXPORT_COLUMNS` `:12–25`, Excel numFmt `:466`): drop `htTLV_estimated`/`estimatedHtTLV`/`estimatedClass`; keep uncalculable rows in the export with blank htTLV and `Class` = `N/A`. `normalizeImportRow` already ignores computed columns → round-trip safe.
- Replace the implicit `attempted - processed` skip count with one pure analysis boundary:
  `processRowsWithSummary(rawRows) -> { rows, malformedCount, missingIdCount }`. Preserve
  `processRows(rawRows) -> rows` as the public compatibility wrapper. `applyLoaded` uses the summary
  so `null`/primitive JSON entries are reported as malformed rather than as blank IDs.
- Add `prepareImport(rawRows) -> { rows, error, notice }` as the pure user-message boundary used by
  `applyLoaded`. This makes empty/all-invalid/mixed-file behavior unit-testable without FileReader or
  DOM mocks.
- `applyLoaded([])` is an error (`No rows found — nothing imported.`), leaves `loadedData` empty, and
  therefore preserves any existing table. A non-empty file whose rows are all unusable reports the
  exact malformed/missing-ID counts. Calculable and uncalculable rows otherwise replace the table as
  before.
- Interactive/query paths already require height → unaffected (kiosk `?...` without height simply plots nothing, already documented).

**Docs & invariants:** keep **AGENTS.md invariant #7**, `docs/data-formats.md`, the `processRows`
header comment, and `config.js` aligned with the "could not calculate" model. README and clinical
background contain no import-estimation claim and need no change.

**Tests:** update `useDataPersistence.test.js` and `classification.test.js` — a height-less import row is kept with `class: null`/`uncalculable: true`, not plotted (htlv null), and exported with `N/A`; add missing-age/missing-tlv kept-and-flagged cases.

**Verify:** import a CSV with a height-less row and a complete row → complete row plots + classes; height-less row appears in the table with `N/A`, not on the chart; notice states 1 could not be calculated; export contains both rows.

---

## Issue #38 — GitHub-native feedback (replace dead Google Form)

**Decision (maintainer):** Route open-ended feedback to **GitHub Discussions**; structured bugs to **GitHub Issues** (Issue Form); keep the contact email; relabel the footer link. Config-driven.

**Repo config (GitHub, via `gh`/files):**

- Enable Discussions: `gh api -X PATCH repos/halbritter-lab/ChIC -f has_discussions=true` (currently `false`). Enabling auto-creates default categories (General, Ideas, Q&A, …); feedback targets **Ideas** (`?category=ideas`). Renaming a category to "Feedback" is UI-only and left to the maintainer — the link uses the stable `ideas` slug.
- `.github/ISSUE_TEMPLATE/bug_report.yml` (new Issue **Form**, replacing the legacy `bug_report.md`): fields for description, steps to reproduce, expected/actual, plus version/page-URL inputs with **`id: version`** and **`id: page-url`** (GitHub prefills a form field by its `id`, which must match the query key exactly — codex #12), and the existing "no identifiable patient data" note. `labels: [bug]`. `buildBugReportUrl` appends `&version=<encoded>&page-url=<encoded>`.
- `.github/ISSUE_TEMPLATE/config.yml` (new): `blank_issues_enabled: false` + `contact_links` → Discussions ("Ideas") for questions/feedback and the docs README.

**App changes:**

- `src/config/links.js` (above) holds `feedbackDiscussions`, `bugReportTemplate`, `buildBugReportUrl`, `contactEmail`, `documentation`, `repo`.
- `AppFooter.vue` (`:38–43`): replace the Google Form `<a>` with two config-driven links, both `target="_blank" rel="noopener noreferrer"`:
  - **"Give feedback"** → `LINKS.feedbackDiscussions`.
  - **"Report a bug"** → `buildBugReportUrl({ version, url: location.href })`. The helper strips all
    patient/clinical query values before prefilling the public form. Version comes via a prop from
    `App.vue` (`packageInfo.version`, already available); `location.href` is read immediately before
    navigation so safe kiosk/display context is current.
  - Keep the existing "Documentation Page" link but source its href from `LINKS.documentation`.
- `disclaimerMixin.js:24` — source the contact mailto from `LINKS.contactEmail` (value already correct; just de-hardcode).
- `AppFooter.vue:50` — add `rel="noopener noreferrer"` to the existing footer **logo** links (currently `target="_blank"` with no `rel`) — boy-scout for Lighthouse Best Practices (codex #13).
- Add `loading="lazy"` and `decoding="async"` to below-the-fold institution logos. Their explicit
  dimensions remain unchanged, so this cannot introduce layout shift.
- Issue Form copy must request synthetic/minimal reproduction values and explicitly prohibit patient
  URLs, identifiers, exported rows, and real clinical inputs. The page URL description states that
  patient parameters are removed automatically.

**Tests:** unit-test URL construction and sanitization, including encoded patient values, unknown
parameters, safe toggles, invalid URLs, credentials, hash preservation, and the no-context case.
Component/Playwright smoke verifies the rendered link never contains a patient ID, age, height, or
TLV.

**Verify:** footer shows the two links; "Give feedback" opens the Discussions "Ideas" composer; "Report a bug" opens the prefilled Issue Form with version + page URL populated.

---

## Issue #42 — Redesign the og-image (borderless, logo-forward)

**Decision (maintainer):** Remove the green "L" border entirely; centre the new logo with a single subtitle; high-contrast, more whitespace.

**Source:** `scripts/og-image.html` (1200×630) is the editable source. New design:

- White background, **no border rects** (delete the two `#00bf7d` rects).
- **New logo** `public/ChICLogo_NoText_2026-07-02.png` (2392×1924, non-square) loaded by relative URL,
  **centred**, aspect-ratio preserved, and given visual emphasis.
- Title (dark, e.g. `#1a1a1a` or brand navy `#2c3e50`): "Charité Imaging Classification (ChIC)".
- **Single subtitle**: "Risk stratification for polycystic liver disease" (replaces the green clashing subtitle). Optional muted URL line `halbritter-lab.github.io/ChIC`.
- All content inside the **1080×600 safe zone**; generous whitespace; WCAG-contrast text. No green.

**Rasterisation (no new dep):** the HTML uses the relative source
`./ChICLogo_NoText_2026-07-02.png`. To regenerate, temporarily copy the HTML to
`public/og-render.html`, run `npm run dev` (fixed port 8137), open
`http://localhost:8137/og-render.html` at 1200×630 in Playwright/Chrome, capture `.og` to
`public/og-image.png`, and delete the temporary file. This works with Vite's development base `/`
and does not depend on the preview server's production `/ChIC/` base mapping. Keep the PNG 1200×630
and below 150 KB.

**Meta tags:** already correct (`index.html:81–83`, `:100`, absolute + base-path OK). Update `og:image:alt` (`:86`) and `twitter:image:alt` (`:103`) to match the new copy (drop "classes A–E" phrasing if the subtitle changed). No other meta changes.

**Verify:** render the new PNG; confirm 1200×630, file size, and legibility at small size; confirm the meta still points at it.

---

## Adversarial performance hardening

### Root causes

The production build currently emits a 347.9 kB entry chunk (124.0 kB gzip) and a 939.5 kB lazy
Excel chunk. `ChartDisplay.vue` registers `...registerables`, retaining Chart.js controllers, scales,
elements, and plugins the app never uses. More importantly, Workbox precaches every JS and public
PNG/SVG, so service-worker installation downloads 7.3 MiB: the lazy Excel chunk plus approximately
4.7 MiB of README/source artwork. This defeats the network benefit of Excel code splitting.

### Design

1. Register only `Chart`, `ScatterController`, `LineController`, `LineElement`, `PointElement`,
   `LinearScale`, `LogarithmicScale`, `Tooltip`, and `Filler`. Dataset array positions, fractional
   orders, fill references, labels, and the imperative API remain byte-for-byte unchanged.
2. Set `injectRegister: 'script-defer'` so `registerSW.js` is not parser-blocking.
3. Workbox precaches the app shell only: HTML, CSS, core JS, text/JSON/ICO/font files, the emitted
   `assets/logo-*.png`, and manifest icons. It excludes `assets/exceljs*.js`, OG/README/source
   artwork, and institution logos. A `CacheFirst` runtime rule named `chic-excel` stores the hashed
   Excel chunk after its first successful online use for one year (maximum two entries, responses
   0/200). First-session offline Excel is intentionally not guaranteed; subsequent offline Excel use
   is. The clinical calculator/chart and existing records remain available immediately offline.
4. No dependency, bundler, clinical-model, or broad CSS refactor is introduced.

### Performance acceptance

- `dist/sw.js` contains no Excel chunk and no `ChICLogo_*`, `ChIC_ApplicationComponents_*`,
  `logo_v2.svg`, or `og-image.png` precache entries.
- Total Workbox precache bytes fall by at least 70% from 7.3 MiB.
- Entry JS gzip size does not increase and should fall after selective Chart.js registration.
- Playwright confirms chart construction, all five bands, T1 stroke, patient plotting, tooltips,
  selection, deletion, theme switching, plot download, and CSV/JSON flows.
- Excel import/export is exercised online after the cache change; the second load is verified from
  the browser cache. No claim is made that Excel works on a first-ever offline session.

---

## Sequencing & verification

1. Privacy-safe links and Issue Form copy, test-first.
2. Query normalization/auto-calc guard, test-first.
3. Import summary and empty-file handling, test-first.
4. OG regeneration instructions and source-path correction.
5. Chart.js and PWA performance hardening with before/after artifact measurements.
6. Full unit/static/build gate, then production-like Playwright and Lighthouse verification.
7. Requirement-by-requirement audit of issues #35, #36, #37, #38, #42, #43 and all unresolved
   review threads. GitHub threads are not resolved or replied to unless the maintainer explicitly
   requests that external write.

## Risks

- **Chart z-order (#36):** hypothesis is strong but unverified against the screenshots — browser verification is the gate; if the glitch is not the fade-behind-fill effect, re-investigate before shipping.
- **Export schema change (#37):** dropping three columns changes exported files; documented, and re-import is unaffected (computed columns ignored).
- **Discussions enablement (#38):** requires the `gh` token to have admin rights on the repo; if it can't be enabled programmatically, fall back to linking `discussions` root and flag for the maintainer.
- **600-LOC cap:** touched files (`App.vue` ~554, `ChartDisplay.vue` ~545) stay under cap; new code goes into `links.js` and small edits, not into growing the god files.
- **PWA offline trade-off:** Excel is deliberately cache-on-first-use; the core calculator remains
  precached. Artifact inspection and offline Playwright distinguish these two guarantees.
- **Lighthouse variability:** performance scores depend on compression, cache headers, machine, and
  throttling. Compare like-for-like runs and report timings/transfer sizes alongside scores.
