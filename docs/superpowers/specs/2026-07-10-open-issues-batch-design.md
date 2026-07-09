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
- **All new external links, labels, and repo coordinates are config-driven** (single source of truth), per the maintainer directive and AGENTS.md invariant #7.
- Every fix is verified in a running build via headless Chrome, and the final production build scores **Lighthouse 100** across Performance, Accessibility, Best Practices, and SEO.

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
export function buildBugReportUrl({ version, url } = {}) { /* appends &version=&page-url= URL-encoded */ }
```

`AppFooter.vue` and `disclaimerMixin.js` (and anywhere else touched) import from here instead of hardcoding. The two citation PMID links in the footer are content, not touched.

---

## Issue #43 — URL-param TLV rejected as "not a number"

**Root cause:** `useQueryParams.js:41` assigns `tlv` as a raw string (`totalLiverVolume.value = q.tlv`); the validator `usePatientForm.js:75` uses `Number.isFinite`, which is `false` for the string `"15000"`, so `tlvValidationMessage` fires. `age` (lines 32–39) is coerced correctly; `tlv` and `height` (line 40) are not. `15000` is within range (`TLV_MAX = 20000`) — the value is valid; only the type is wrong.

**Fix:** In `useQueryParams.js`, coerce `tlv` and `height` with the exact `age` pattern (numeric → Number, else keep raw string so a genuinely non-numeric param still surfaces a real error):

```js
if (q.height) { const p = Number(q.height); height.value = Number.isFinite(p) ? p : q.height; }
if (q.tlv)    { const p = Number(q.tlv);    totalLiverVolume.value = Number.isFinite(p) ? p : q.tlv; }
```

**Docs:** `docs/url-parameters.md` — the "Set all inputs" example (line 40–44) and the auto-calc note (line 18) must state that **`height` is required to plot a class** (the auto-calc guard returns early without a valid height). Add `&height=1.75` to that example so following it actually plots.

**Tests:** add a `useQueryParams` unit test asserting `tlv`/`height` become numbers and validation stays clean (new `src/composables/__tests__/useQueryParams.test.js`).

**Verify:** load `/ChIC/?patientId=12345&age=50&tlv=15000&height=1.75&acknowledgeBanner=true` in-browser → no TLV error, point plotted.

---

## Issue #35 — Deleted point keeps its highlight ring

**Root cause:** The highlight is an SVG ring drawn by `drawRingOverlay()` (`ChartDisplay.vue:33`), redrawn **only** by the `editingIndex` watcher (`:521`). Deleting a row (`useDataPoints.removeDataPoint`, `:18`) splices `dataPoints` but never resets `editingIndex`; the deep `dataPoints` watcher (`:503`) calls `updateChart()` but never `drawRingOverlay()`. So the ring stays at stale coordinates. Sentinel inconsistency: `useDataPoints` uses `null`, `App.vue`/prop default use `-1`, and the ring guard `props.editingIndex < 0` is true for `-1` but false for `null`.

**Fix:**

1. `useDataPoints.js` — unify the sentinel on `-1`: initialise `editingIndex = ref(-1)`; in `addOrUpdatePoint`, guard `editingIndex.value >= 0` and reset to `-1`. Reset `editingIndex = -1` inside `removeDataPoint` (and clamp/adjust so a stale index can't point past the array). This makes delete clear the highlight and keeps the ring guard correct.
2. `ChartDisplay.vue` — call `drawRingOverlay()` from the deep `dataPoints` watcher (`:503`) so the ring repositions/clears on any data change (covers deleting a *different* row while one is highlighted, and index shifts). Also clear the SVG overlay in `clearChart()` (`:444`) so reset/clear removes a stale ring.
3. Sweep `App.vue` for `editingIndex` assignments (`:356`, `:423`) — already `-1`/index; confirm consistency with the unified sentinel.

**Tests:** `useDataPoints` unit test — after `removeDataPoint`, `editingIndex === -1`; after edit then remove, still `-1`.

**Verify:** add point, click row to highlight (ring appears), delete it → ring gone; with two points, highlight one and delete the other → ring stays on the correct point.

---

## Issue #36 — Lowest threshold line (T1) renders wrong

**Root cause:** The visible `Threshold 1` line dataset (`ChartDisplay.vue:254–264`) has `order: 5` — the highest order in the threshold group, so Chart.js draws it **first / furthest back**. Its two translucent fills (`T1 Above Fill` `order 4.5`, `T1 Below Fill` `order 4.6`) draw *on top of* it, over-painting the ~2px stroke from both sides → the lowest line looks thin/dim/broken. T2–T4 carry their fill on the same dataset, so their strokes always sit above their own fill. (Contract confirmed by `Patient Data` `order: -1` = drawn on top.)

**Fix:** Lower only the **draw order** of the `Threshold 1` line dataset to below its fills — `order: 4.4` (any value `< 4.5`, still `> -1` so patient points stay on top). This changes z-order only: the dataset stays in the same array position and no `fill: '+1'/'-1'` adjacency changes, so invariant #3 (bands) is preserved.

**Verify (critical — visual):** render in-browser and compare the lowest line against T2–T4; it must be a crisp, continuous stroke of the same weight. Also eyeball T4 (its ceiling/polygon fills sit above its line at `order 2` vs `1`/`1.5`); if T4 also looks muted, apply the same treatment. Confirm the class bands (A/B/C/D/E shaded regions) are visually unchanged.

**Tests:** chart dataset construction is not unit-tested (canvas); rely on browser verification + a snapshot of dataset `order` values if a lightweight assertion is practical.

---

## Issue #37 — Drop height estimation; flag "could not calculate"

**Decision (maintainer):** Remove cohort-mean/`ASSUMED_HEIGHT_M` estimation. Rows that cannot be fully computed — missing/invalid **height, age, or TLV** — are **kept** and shown, **not plotted**, with **Class = `N/A`**, and the user is told how many could not be calculated. Missing age/TLV (today dropped silently) get the same visible treatment.

**Changes:**

- `useDataPersistence.js` `processRows` (`:77–140`):
  - Remove Pass-1 cohort accumulation (`:104–106`, `:110–111`) and `estimateHeight`.
  - Keep every row that has a usable **id** (id remains the one hard requirement to form a row). For each row, compute only when age, tlv, and a valid height are all present/in-range; otherwise mark `uncalculable: true` with `htlv: null`, `class: null`, `lgr: 'N/A'`. Drop the `htlvEstimated`/`estimatedHtTLV`/`estimatedClass` fields.
  - A row with an unusable/blank id is still dropped (can't key the table/`v-for`), and counted in the notice.
- `classification.js` is already null-safe (returns `NaN`/`null` on bad input) — no change.
- `config.js` — remove `MODEL.ASSUMED_HEIGHT_M` (`:9`).
- `DataTable.vue` — replace the `≈`-estimate branches (`:36–54`) with plain measured values; render `class`/`htlv` as `N/A` (via `formatClassLabel`/`formatHtTLV` null-handling or a fallback) when `uncalculable`. Replace the estimate footer note (`:88–91`) with an "N of M rows could not be calculated (missing height, age, or TLV)" notice driven by an `uncalculableCount` computed. Add a `title`/tooltip explaining why. Keep the red note styling.
- `useDataPersistence.js` export (`buildExportRows` `:143–159`, `EXPORT_COLUMNS` `:12–25`, Excel numFmt `:466`): drop `htTLV_estimated`/`estimatedHtTLV`/`estimatedClass`; keep uncalculable rows in the export with blank htTLV and `Class` = `N/A`. `normalizeImportRow` already ignores computed columns → round-trip safe.
- `applyLoaded` skipped-notice text (`:254`) — since uncalculable rows are now *kept* not dropped, the "N skipped" wording only covers unusable-id rows; add the uncalculable count to the user-facing message (or surface it from the table). Keep the two notices distinct and honest.
- Interactive/query paths already require height → unaffected (kiosk `?...` without height simply plots nothing, already documented).

**Docs & invariants:** rewrite **AGENTS.md invariant #7** (drop the estimation sentence; document the "could not calculate" model). Update `README.md`, `docs/data-formats.md`, `docs/clinical-background.md`, and the `processRows` header comment (`:66–76`) and `config.js:9` comment.

**Tests:** update `useDataPersistence.test.js` and `classification.test.js` — a height-less import row is kept with `class: null`/`uncalculable: true`, not plotted (htlv null), and exported with `N/A`; add missing-age/missing-tlv kept-and-flagged cases.

**Verify:** import a CSV with a height-less row and a complete row → complete row plots + classes; height-less row appears in the table with `N/A`, not on the chart; notice states 1 could not be calculated; export contains both rows.

---

## Issue #38 — GitHub-native feedback (replace dead Google Form)

**Decision (maintainer):** Route open-ended feedback to **GitHub Discussions**; structured bugs to **GitHub Issues** (Issue Form); keep the contact email; relabel the footer link. Config-driven.

**Repo config (GitHub, via `gh`/files):**

- Enable Discussions: `gh api -X PATCH repos/halbritter-lab/ChIC -f has_discussions=true` (currently `false`). Enabling auto-creates default categories (General, Ideas, Q&A, …); feedback targets **Ideas** (`?category=ideas`). Renaming a category to "Feedback" is UI-only and left to the maintainer — the link uses the stable `ideas` slug.
- `.github/ISSUE_TEMPLATE/bug_report.yml` (new Issue **Form**, replacing the legacy `bug_report.md`): fields for description, steps to reproduce, expected/actual, plus **App version** and **Page URL** inputs (prefillable via query param), and the existing "no identifiable patient data" note. `labels: [bug]`.
- `.github/ISSUE_TEMPLATE/config.yml` (new): `blank_issues_enabled: false` + `contact_links` → Discussions ("Ideas") for questions/feedback and the docs README.

**App changes:**

- `src/config/links.js` (above) holds `feedbackDiscussions`, `bugReportTemplate`, `buildBugReportUrl`, `contactEmail`, `documentation`, `repo`.
- `AppFooter.vue` (`:38–43`): replace the Google Form `<a>` with two config-driven links, both `target="_blank" rel="noopener noreferrer"`:
  - **"Give feedback"** → `LINKS.feedbackDiscussions`.
  - **"Report a bug"** → `buildBugReportUrl({ version, url: location.href })` (page URL + app version prefilled). Version comes via a prop from `App.vue` (`packageInfo.version`, already available) to keep the component pure/testable; `location.href` read in a tiny click handler.
  - Keep the existing "Documentation Page" link but source its href from `LINKS.documentation`.
- `disclaimerMixin.js:24` — source the contact mailto from `LINKS.contactEmail` (value already correct; just de-hardcode).

**Tests:** unit-test `buildBugReportUrl` (encodes version + page-url params, correct base). Component smoke: footer renders "Give feedback" + "Report a bug" with expected hrefs.

**Verify:** footer shows the two links; "Give feedback" opens the Discussions "Ideas" composer; "Report a bug" opens the prefilled Issue Form with version + page URL populated.

---

## Issue #42 — Redesign the og-image (borderless, logo-forward)

**Decision (maintainer):** Remove the green "L" border entirely; centre the new logo with a single subtitle; high-contrast, more whitespace.

**Source:** `scripts/og-image.svg` (1200×630) is regenerated fresh (its logo is embedded base64). New design:

- White background, **no border rects** (delete the two `#00bf7d` rects).
- **New logo** `public/ChICLogo_NoText_2026-07-02.png` (2392×1924, non-square) embedded base64, **centred**, aspect-ratio preserved (fit within a box via `preserveAspectRatio`), given visual emphasis.
- Title (dark, e.g. `#1a1a1a` or brand navy `#2c3e50`): "Charité Imaging Classification (ChIC)".
- **Single subtitle**: "Risk stratification for polycystic liver disease" (replaces the green clashing subtitle). Optional muted URL line `halbritter-lab.github.io/ChIC`.
- All content inside the **1080×600 safe zone**; generous whitespace; WCAG-contrast text. No green.

**Rasterisation (no new dep):** render the SVG/an HTML wrapper at a 1200×630 viewport in headless Chrome (the same browser used for verification) and screenshot to `public/og-image.png`; keep it 1200×630 and < 150 KB. (Fallback: one-off `npx @resvg/resvg-js-cli` — not committed.)

**Meta tags:** already correct (`index.html:81–83`, `:100`, absolute + base-path OK). Update `og:image:alt` (`:86`) and `twitter:image:alt` (`:103`) to match the new copy (drop "classes A–E" phrasing if the subtitle changed). No other meta changes.

**Verify:** render the new PNG; confirm 1200×630, file size, and legibility at small size; confirm the meta still points at it.

---

## Sequencing & verification

1. **Config module** (`links.js`) first — everything else consumes it.
2. Low-risk bug fixes: **#43** → **#36** → **#35** (each: code + unit test + browser check + atomic commit).
3. **#37** (largest surface: persistence, table, export, docs, tests).
4. **#38** (repo files + `gh` enable Discussions + footer/mixin + tests).
5. **#42** (edit SVG → rasterise via headless Chrome → verify).
6. Update **AGENTS.md** (invariant #7) and docs.
7. **Adversarial review with codex** on the spec (now) and again on the full diff before finalising.
8. Full gate: `npm test` + `npm run lint` + `npm run format:check` + `npm run typecheck` + `npm run build`, then **Lighthouse 100** on the production build across all four categories, and a manual pass of each fixed flow.

## Risks

- **Chart z-order (#36):** hypothesis is strong but unverified against the screenshots — browser verification is the gate; if the glitch is not the fade-behind-fill effect, re-investigate before shipping.
- **Export schema change (#37):** dropping three columns changes exported files; documented, and re-import is unaffected (computed columns ignored).
- **Discussions enablement (#38):** requires the `gh` token to have admin rights on the repo; if it can't be enabled programmatically, fall back to linking `discussions` root and flag for the maintainer.
- **600-LOC cap:** touched files (`App.vue` ~554, `ChartDisplay.vue` ~545) stay under cap; new code goes into `links.js` and small edits, not into growing the god files.
- **Lighthouse 100:** the og-image and any added markup must not regress Performance/SEO; verify the final build, not dev.
