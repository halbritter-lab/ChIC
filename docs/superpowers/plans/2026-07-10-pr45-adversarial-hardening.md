# PR #45 Adversarial Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every confirmed PR #45 review defect, prevent patient-data leakage, make imports honest and deterministic, and reduce entry/PWA cost while preserving ChIC's clinical and chart invariants.

**Architecture:** Keep clinical math and canonical row classification unchanged. Add pure boundaries for report-URL sanitization and import outcomes, narrow Chart.js registration to used modules, and split Workbox into an immediate app-shell precache plus cache-on-first-use Excel support. A production-subpath Playwright harness proves browser behavior and offline guarantees.

**Tech Stack:** Vue 3, Vite 6, Chart.js 4, vite-plugin-pwa/Workbox, Vitest 4, Playwright/Chromium, plain JavaScript.

## Global Constraints

- Preserve class letters `A`–`E`; `src/domain/classification.js` remains the only classifier.
- Do not reorder chart datasets or rename `Patient Data` / `Selected Point`.
- Preserve the `ChartDisplay` `defineExpose` contract and dataset-scoped `clearChart` behavior.
- Preserve query parameters `patientId`, `age`, `height`, `tlv`, `acknowledgeBanner`, and the four `show*=false` toggles.
- Never place patient ID, age, height, TLV, unknown query values, credentials, or fragments in a public bug-report URL.
- Keep every touched `.vue`, `.js`, and `.css` file below 600 lines.
- Add no runtime dependency. `@playwright/test` is development-only and is authorized by the requested Playwright verification.
- Keep Excel as a dynamic import. Core calculator/chart offline availability is immediate; Excel offline availability begins after one successful online Excel use.
- Do not reply to or resolve GitHub review threads unless the maintainer separately authorizes that external write.
- Every behavioral fix follows red-green-refactor; every task ends with a focused commit.

---

## File Structure

### New files

- `playwright.config.js` — production-subpath end-to-end configuration.
- `scripts/serve-dist.mjs` — small static test server that maps `/ChIC/` to `dist/` and serves correct content types/cache headers.
- `scripts/audit-precache.mjs` — deterministic Workbox manifest size/forbidden-entry audit.
- `tests/e2e/pr45-hardening.spec.js` — privacy, query, chart, import, download, and offline browser regressions.
- `scripts/__tests__/og-image-source.test.js` — executable contract for regenerating the OG image.
- `src/components/__tests__/ChartDisplay.source.test.js` — registration/invariant source guard.
- `src/config/__tests__/pwaConfig.test.js` — unit contract for Workbox strategy.

### Modified files

- `src/config/links.js` — sanitize report context and build the Issue Form URL from one template.
- `src/config/__tests__/links.test.js` — privacy boundary tests.
- `.github/ISSUE_TEMPLATE/bug_report.yml` — synthetic-data/no-PHI guidance.
- `src/components/AppFooter.vue` — use sanitized report URL and lazy-decode institution logos.
- `src/composables/useQueryParams.js` — normalize all numeric query fields before auto-calc.
- `src/composables/__tests__/useQueryParams.test.js` — whitespace/array/auto-calc regressions.
- `src/composables/useDataPersistence.js` — pure row summary and import outcome.
- `src/composables/__tests__/useDataPersistence.test.js` — exact malformed/empty/mixed outcomes.
- `scripts/og-image.html` — portable relative logo path and reproducible instructions.
- `src/components/ChartDisplay.vue` — register only used Chart.js modules.
- `vite.config.js` — exported Workbox policy, deferred registration, runtime Excel cache.
- `package.json`, `package-lock.json` — Playwright dev dependency and `test:e2e`/precache audit scripts.

---

### Task 1: Make public bug reports privacy-safe

**Files:**

- Modify: `src/config/links.js`
- Modify: `src/config/__tests__/links.test.js`
- Modify: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Modify: `src/components/AppFooter.vue`

**Interfaces:**

- Produces: `sanitizeBugReportPageUrl(rawUrl: unknown): string | undefined`
- Preserves: `buildBugReportUrl({ version?: string, url?: string }): string`
- Consumed by: `AppFooter.vue` through `buildBugReportUrl`; callers cannot bypass sanitization.

- [ ] **Step 1: Replace the unsafe URL expectation with failing privacy tests**

Add these cases to `src/config/__tests__/links.test.js`:

```js
import { LINKS, buildBugReportUrl, sanitizeBugReportPageUrl } from '../links.js';

describe('sanitizeBugReportPageUrl', () => {
  it('keeps only known non-clinical display toggles', () => {
    const input =
      'https://user:secret@example.test/ChIC/?patientId=SECRET-1&age=50&height=1.75&tlv=15000&showFooter=false&showCitation=true&unknown=private#patient-fragment';

    expect(sanitizeBugReportPageUrl(input)).toBe(
      'https://example.test/ChIC/?showFooter=false&showCitation=true'
    );
  });

  it.each([undefined, '', 'not a url', 'javascript:alert(1)', 'file:///tmp/private'])(
    'omits unsafe or unparseable context: %s',
    (input) => expect(sanitizeBugReportPageUrl(input)).toBeUndefined()
  );

  it('sanitizes inside buildBugReportUrl so callers cannot bypass the boundary', () => {
    const report = new URL(
      buildBugReportUrl({
        version: '1.2.3',
        url: 'https://example.test/ChIC/?patientId=P1&age=40&showControls=false',
      })
    );

    expect(report.searchParams.get('version')).toBe('1.2.3');
    expect(report.searchParams.get('page-url')).toBe(
      'https://example.test/ChIC/?showControls=false'
    );
    expect(report.href).not.toContain('patientId');
    expect(report.href).not.toContain('age%3D40');
  });
});
```

- [ ] **Step 2: Run the focused test and verify red**

Run: `npx vitest run src/config/__tests__/links.test.js`

Expected: FAIL because `sanitizeBugReportPageUrl` is not exported and the old build helper preserves patient parameters.

- [ ] **Step 3: Implement the sanitizer at the only report-URL boundary**

Add to `src/config/links.js` and make `buildBugReportUrl` consume `LINKS.bugReportTemplate` rather than reconstructing it:

```js
const SAFE_REPORT_PARAMS = new Set([
  'acknowledgeBanner',
  'showFooter',
  'showCitation',
  'showDocumentation',
  'showControls',
]);

export function sanitizeBugReportPageUrl(rawUrl) {
  if (rawUrl === undefined || rawUrl === null || String(rawUrl).trim() === '') return undefined;

  try {
    const page = new URL(String(rawUrl));
    if (page.protocol !== 'https:' && page.protocol !== 'http:') return undefined;

    page.username = '';
    page.password = '';
    page.hash = '';
    for (const key of [...page.searchParams.keys()]) {
      if (!SAFE_REPORT_PARAMS.has(key)) page.searchParams.delete(key);
    }
    return page.toString();
  } catch {
    return undefined;
  }
}

export function buildBugReportUrl({ version, url } = {}) {
  const report = new URL(LINKS.bugReportTemplate);
  if (version) report.searchParams.set('version', String(version));
  const safePageUrl = sanitizeBugReportPageUrl(url);
  if (safePageUrl) report.searchParams.set('page-url', safePageUrl);
  return report.toString();
}
```

- [ ] **Step 4: Harden the Issue Form copy and footer image loading**

In `.github/ISSUE_TEMPLATE/bug_report.yml`, replace wording that requests exact clinical inputs with:

```yaml
description: Use synthetic or minimal reproduction values only. Never paste a patient URL, identifier, exported row, or real clinical inputs.
placeholder: |
  1. Go to ...
  2. Enter synthetic age 50, height 1.75, TLV 15000
  3. See ...
```

Change the `page-url` description to:

```yaml
description: Prefilled from the app. Patient and unknown query parameters are removed automatically; verify the URL before submitting.
```

In the institution-logo `<img>` in `AppFooter.vue`, add:

```vue
loading="lazy" decoding="async"
```

Do not change `refreshBugHref`; its helper is now safe by construction.

- [ ] **Step 5: Run focused tests and file gates**

Run:

```bash
npx vitest run src/config/__tests__/links.test.js
npx eslint src/config/links.js src/config/__tests__/links.test.js src/components/AppFooter.vue
npx prettier --check src/config/links.js src/config/__tests__/links.test.js src/components/AppFooter.vue .github/ISSUE_TEMPLATE/bug_report.yml
```

Expected: all pass; `wc -l src/components/AppFooter.vue src/config/links.js` reports both below 600.

- [ ] **Step 6: Commit**

```bash
git add src/config/links.js src/config/__tests__/links.test.js src/components/AppFooter.vue .github/ISSUE_TEMPLATE/bug_report.yml
git commit -m "fix: remove patient context from bug reports"
```

---

### Task 2: Normalize query parameters before auto-calculation

**Files:**

- Modify: `src/composables/useQueryParams.js`
- Modify: `src/composables/__tests__/useQueryParams.test.js`

**Interfaces:**

- Preserves: `useQueryParams({...}) -> { showFooter, showCitation, showDocumentation, showControls, initFromQuery }`
- Internal rule: first repeated query value wins; whitespace means absent; finite numerics become numbers; other strings remain strings for validation.

- [ ] **Step 1: Add failing query timing/normalization tests**

Append to `src/composables/__tests__/useQueryParams.test.js`:

```js
it('does not auto-calculate for a whitespace-only TLV', async () => {
  const h = harness({ patientId: 'p1', age: '50', height: '1.75', tlv: '   ' });
  await h.initFromQuery();
  expect(h.totalLiverVolume.value).toBeNull();
  expect(h.calculateDataPoint).not.toHaveBeenCalled();
});

it('treats whitespace-only age and height as absent', async () => {
  const h = harness({ patientId: 'p1', age: ' ', height: ' ', tlv: '15000' });
  await h.initFromQuery();
  expect(h.age.value).toBeNull();
  expect(h.height.value).toBeNull();
  expect(h.calculateDataPoint).not.toHaveBeenCalled();
});

it('uses the first value for repeated numeric query keys', async () => {
  const h = harness({ patientId: 'p1', age: ['50', '60'], height: ['1.75'], tlv: ['15000'] });
  await h.initFromQuery();
  expect(h.age.value).toBe(50);
  expect(h.height.value).toBe(1.75);
  expect(h.totalLiverVolume.value).toBe(15000);
  expect(h.calculateDataPoint).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run focused tests and verify red**

Run: `npx vitest run src/composables/__tests__/useQueryParams.test.js`

Expected: whitespace-only TLV still calls `calculateDataPoint`; whitespace age clamps to 15; array values are mishandled.

- [ ] **Step 3: Implement one normalizer and base auto-calc on its results**

Inside `initFromQuery`, replace per-field coercion with:

```js
const firstQueryValue = (raw) => (Array.isArray(raw) ? raw[0] : raw);
const asNumber = (raw) => {
  const value = firstQueryValue(raw);
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (text === '') return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : value;
};

const patientParam = firstQueryValue(q.patientId);
const ageParam = asNumber(q.age);
const heightParam = asNumber(q.height);
const tlvParam = asNumber(q.tlv);

if (patientParam !== undefined && patientParam !== null && String(patientParam).trim() !== '') {
  patientId.value = patientParam;
}
if (ageParam !== null) {
  age.value = Number.isFinite(ageParam)
    ? Math.min(Math.max(ageParam, CONFIG.AGE_MIN), CONFIG.AGE_MAX)
    : ageParam;
}
if (heightParam !== null) height.value = heightParam;
if (tlvParam !== null) totalLiverVolume.value = tlvParam;

if (
  patientParam !== undefined &&
  patientParam !== null &&
  String(patientParam).trim() !== '' &&
  ageParam !== null &&
  tlvParam !== null
) {
  calculateDataPoint();
}
```

Keep banner/toggle handling unchanged. Remove the superseded inline `asNumber` and raw `q.*` auto-calc guard.

- [ ] **Step 4: Run tests and static gates**

Run:

```bash
npx vitest run src/composables/__tests__/useQueryParams.test.js src/__tests__/App.smoke.test.js
npx eslint src/composables/useQueryParams.js src/composables/__tests__/useQueryParams.test.js
npx prettier --check src/composables/useQueryParams.js src/composables/__tests__/useQueryParams.test.js
```

Expected: all pass; no query API toggle changes.

- [ ] **Step 5: Commit**

```bash
git add src/composables/useQueryParams.js src/composables/__tests__/useQueryParams.test.js
git commit -m "fix: guard query auto-calculation after normalization"
```

---

### Task 3: Make import outcomes exact and testable

**Files:**

- Modify: `src/composables/useDataPersistence.js`
- Modify: `src/composables/__tests__/useDataPersistence.test.js`

**Interfaces:**

- Produces: `processRowsWithSummary(rawRows): { rows: Array, malformedCount: number, missingIdCount: number }`
- Produces: `prepareImport(rawRows): { rows: Array, error: string | null, notice: string | null }`
- Preserves: `processRows(rawRows): Array` and every canonical row field.

- [ ] **Step 1: Add failing pure outcome tests**

Import the two new helpers and add:

```js
describe('prepareImport — honest row accounting', () => {
  it('separates malformed rows from rows with a missing ID', () => {
    const outcome = prepareImport([
      { id: 'ok', age: 40, height: 1.7, tlv: 3400 },
      null,
      'junk',
      { age: 40, height: 1.7, tlv: 3400 },
      { id: 'missing-height', age: 40, tlv: 3400 },
    ]);

    expect(outcome.rows.map((row) => row.id)).toEqual(['ok', 'missing-height']);
    expect(outcome.error).toBeNull();
    expect(outcome.notice).toBe(
      '1 row skipped (missing or blank ID). 2 malformed rows skipped. 1 row could not be calculated (missing or out-of-range height, age, or TLV) — shown as N/A and not plotted.'
    );
  });

  it('rejects an empty array without replacing existing application data', () => {
    expect(prepareImport([])).toEqual({
      rows: [],
      error: 'No rows found — nothing imported.',
      notice: null,
    });
  });

  it('reports exact reasons when every row is unusable', () => {
    expect(prepareImport([null, { id: ' ' }])).toEqual({
      rows: [],
      error:
        'No usable rows found — nothing imported. 1 row skipped (missing or blank ID). 1 malformed row skipped.',
      notice: null,
    });
  });
});
```

- [ ] **Step 2: Run the focused suite and verify red**

Run: `npx vitest run src/composables/__tests__/useDataPersistence.test.js`

Expected: FAIL because `prepareImport` and `processRowsWithSummary` do not exist.

- [ ] **Step 3: Refactor row processing into a counted single pass**

Rename the existing `processRows` body to `processRowsWithSummary`, initialize counts, and increment at the two drop boundaries:

```js
export function processRowsWithSummary(rawRows) {
  const summary = { rows: [], malformedCount: 0, missingIdCount: 0 };
  if (!Array.isArray(rawRows)) return summary;

  for (const rawRow of rawRows) {
    const row = normalizeImportRow(rawRow);
    if (row == null) {
      summary.malformedCount += 1;
      continue;
    }

    const id = row.id == null ? '' : String(row.id).trim();
    if (id === '') {
      summary.missingIdCount += 1;
      continue;
    }

    const importedClass = legacyPgToLetter(row.pg ?? row.class ?? null);
    const age = row.age == null ? NaN : Number(row.age);
    const tlv = row.tlv == null ? NaN : Number(row.tlv);
    const height = parseHeight(row.height);
    const ageOk = Number.isFinite(age) && age >= CONFIG.AGE_MIN && age <= CONFIG.AGE_MAX;
    const tlvOk = Number.isFinite(tlv) && tlv >= CONFIG.TLV_MIN && tlv <= CONFIG.TLV_MAX;
    const heightOk = height !== null && height >= CONFIG.HEIGHT_MIN && height <= CONFIG.HEIGHT_MAX;
    const base = {
      id,
      age: Number.isFinite(age) ? age : null,
      height,
      tlv: Number.isFinite(tlv) ? tlv : null,
      importedClass,
      group: row.group || '',
      groupColor: row.groupColor || null,
    };

    if (!(ageOk && tlvOk && heightOk)) {
      summary.rows.push({
        ...base,
        htlv: null,
        class: null,
        lgr: 'N/A',
        uncalculable: true,
      });
      continue;
    }

    const htlv = heightAdjustedTLV(tlv, height);
    const cls = classify(htlv, age);
    const lgrFraction = age >= CONFIG.AGE_MIN_LGR ? liverGrowthRate(age, htlv) : null;
    summary.rows.push({
      ...base,
      htlv,
      class: cls,
      lgr: lgrFraction !== null ? (lgrFraction * 100).toFixed(2) : 'N/A',
      uncalculable: false,
    });
  }

  return summary;
}

export function processRows(rawRows) {
  return processRowsWithSummary(rawRows).rows;
}
```

- [ ] **Step 4: Add the pure message boundary and reduce `applyLoaded` to assignments**

Add:

```js
const plural = (count) => (count === 1 ? '' : 's');

export function prepareImport(rawRows) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return { rows: [], error: 'No rows found — nothing imported.', notice: null };
  }

  const { rows, malformedCount, missingIdCount } = processRowsWithSummary(rawRows);
  const skipped = [];
  if (missingIdCount > 0) {
    skipped.push(`${missingIdCount} row${plural(missingIdCount)} skipped (missing or blank ID)`);
  }
  if (malformedCount > 0) {
    skipped.push(`${malformedCount} malformed row${plural(malformedCount)} skipped`);
  }

  if (rows.length === 0) {
    return {
      rows: [],
      error: `No usable rows found — nothing imported. ${skipped.join('. ')}.`,
      notice: null,
    };
  }

  const uncalculableCount = rows.filter((row) => row.uncalculable).length;
  const notices = [...skipped];
  if (uncalculableCount > 0) {
    notices.push(
      `${uncalculableCount} row${plural(uncalculableCount)} could not be calculated ` +
        `(missing or out-of-range height, age, or TLV) — shown as N/A and not plotted`
    );
  }

  return {
    rows,
    error: null,
    notice: notices.length > 0 ? `${notices.join('. ')}.` : null,
  };
}
```

Replace `applyLoaded` with:

```js
const applyLoaded = (rawRows) => {
  const outcome = prepareImport(rawRows);
  loadedData.value = outcome.rows;
  errorLoading.value = outcome.error;
  loadNotice.value = outcome.notice;
};
```

- [ ] **Step 5: Run persistence and regression suites**

Run:

```bash
npx vitest run src/composables/__tests__/useDataPersistence.test.js src/__tests__/App.smoke.test.js
npx eslint src/composables/useDataPersistence.js src/composables/__tests__/useDataPersistence.test.js
npx prettier --check src/composables/useDataPersistence.js src/composables/__tests__/useDataPersistence.test.js
wc -l src/composables/useDataPersistence.js
```

Expected: all tests/gates pass and the composable remains below 600 lines.

- [ ] **Step 6: Commit**

```bash
git add src/composables/useDataPersistence.js src/composables/__tests__/useDataPersistence.test.js
git commit -m "fix: report malformed and empty imports accurately"
```

---

### Task 4: Make OG-image regeneration reproducible

**Files:**

- Create: `scripts/__tests__/og-image-source.test.js`
- Modify: `scripts/og-image.html`

**Interfaces:**

- Produces: a source file that renders after temporary copy to `public/og-render.html` under Vite dev base `/`.

- [ ] **Step 1: Add a failing source-contract test**

Create `scripts/__tests__/og-image-source.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('scripts/og-image.html'), 'utf8');

describe('OG image source', () => {
  it('uses the documented dev server and a portable relative logo path', () => {
    expect(source).toContain('http://localhost:8137/og-render.html');
    expect(source).toContain('src="./ChICLogo_NoText_2026-07-02.png"');
    expect(source).not.toContain('localhost:8138');
    expect(source).not.toContain('src="/ChIC/');
  });
});
```

- [ ] **Step 2: Run the test and verify red**

Run: `npx vitest run scripts/__tests__/og-image-source.test.js`

Expected: FAIL on the 8138 and `/ChIC/` assertions.

- [ ] **Step 3: Correct source and instructions**

In `scripts/og-image.html`:

```html
1. Copy this file to public/og-render.html. 2. Run npm run dev. 3. Open
http://localhost:8137/og-render.html in headless Chrome at a 1200×630 viewport. 4. Screenshot the
.og element to public/og-image.png. 5. Delete public/og-render.html.
```

Change the image element to:

```html
<img src="./ChICLogo_NoText_2026-07-02.png" alt="ChIC logo" />
```

- [ ] **Step 4: Verify source and existing raster**

Run:

```bash
npx vitest run scripts/__tests__/og-image-source.test.js
file public/og-image.png
stat -c '%s bytes' public/og-image.png
```

Expected: test passes; PNG is 1200×630 and below 153600 bytes. Do not regenerate the already-correct raster unless the rendered source differs visually.

- [ ] **Step 5: Commit**

```bash
git add scripts/og-image.html scripts/__tests__/og-image-source.test.js
git commit -m "docs: make OG image regeneration reproducible"
```

---

### Task 5: Tree-shake unused Chart.js modules

**Files:**

- Create: `src/components/__tests__/ChartDisplay.source.test.js`
- Modify: `src/components/ChartDisplay.vue`

**Interfaces:**

- Preserves all props, dataset array positions/orders/fill references, magic labels, watchers, and exposed methods.

- [ ] **Step 1: Add a failing registration/invariant guard**

Create `src/components/__tests__/ChartDisplay.source.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/components/ChartDisplay.vue'), 'utf8');

describe('ChartDisplay module registration', () => {
  it('does not retain all Chart.js registerables', () => {
    expect(source).not.toContain('registerables');
    for (const name of [
      'ScatterController',
      'LineController',
      'LineElement',
      'PointElement',
      'LinearScale',
      'LogarithmicScale',
      'Tooltip',
      'Filler',
    ]) {
      expect(source).toContain(name);
    }
  });

  it('preserves order-sensitive labels and fill targets', () => {
    expect(source).toContain("label: 'Patient Data'");
    expect(source).toContain("label: 'Selected Point'");
    expect(source).toContain("fill: '+1'");
    expect(source).toContain("fill: '-1'");
    expect(source).toContain('order: 4.4');
  });
});
```

- [ ] **Step 2: Run the test and verify red**

Run: `npx vitest run src/components/__tests__/ChartDisplay.source.test.js`

Expected: FAIL because the component imports/registers `registerables`.

- [ ] **Step 3: Replace broad registration with the exact used set**

Use:

```js
import {
  Chart,
  ScatterController,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  LogarithmicScale,
  Tooltip,
  Filler,
} from 'chart.js';

Chart.register(
  ScatterController,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  LogarithmicScale,
  Tooltip,
  Filler
);
```

Delete `Chart.register(...registerables)` and the duplicate `Chart.register(Filler)`. Change nothing below the registration block.

- [ ] **Step 4: Verify unit, build, and size delta**

Run:

```bash
npx vitest run src/components/__tests__/ChartDisplay.source.test.js src/__tests__/App.smoke.test.js
npm run build
find dist/assets -name 'index-*.js' -printf '%s %p\n'
```

Expected: build succeeds, chart test passes, and entry JS is below the 347919-byte baseline. If the chart throws an unregistered-component error, identify the exact missing component from the stack trace, add only that component, and extend the test list.

- [ ] **Step 5: Commit**

```bash
git add src/components/ChartDisplay.vue src/components/__tests__/ChartDisplay.source.test.js
git commit -m "perf: register only used Chart.js modules"
```

---

### Task 6: Reduce PWA precache and cache Excel on first use

**Files:**

- Modify: `vite.config.js`
- Create: `src/config/__tests__/pwaConfig.test.js`
- Create: `scripts/audit-precache.mjs`
- Modify: `package.json`

**Interfaces:**

- Produces: `PWA_INJECT_REGISTER = 'script-defer'`
- Produces: `PWA_WORKBOX_CONFIG` consumed directly by `VitePWA({ workbox })` and tests.
- Produces: `npm run audit:precache`, which exits non-zero on forbidden entries or >2.19 MiB unique precache bytes.

- [ ] **Step 1: Add failing policy tests**

Create `src/config/__tests__/pwaConfig.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { PWA_INJECT_REGISTER, PWA_WORKBOX_CONFIG } from '../../../vite.config.js';

describe('PWA cache policy', () => {
  it('defers registration and precaches only the core shell', () => {
    expect(PWA_INJECT_REGISTER).toBe('script-defer');
    expect(PWA_WORKBOX_CONFIG.globPatterns).toEqual([
      '**/*.{js,css,html,ico,json,txt,woff2}',
      'assets/logo-*.png',
    ]);
    expect(PWA_WORKBOX_CONFIG.globIgnores).toContain('**/assets/exceljs*.js');
  });

  it('caches the Excel chunk only after first use', () => {
    const excelRule = PWA_WORKBOX_CONFIG.runtimeCaching.find(
      (rule) => rule.options.cacheName === 'chic-excel'
    );
    expect(excelRule.handler).toBe('CacheFirst');
    expect(excelRule.options.expiration).toEqual({
      maxEntries: 2,
      maxAgeSeconds: 60 * 60 * 24 * 365,
    });
    expect(
      excelRule.urlPattern({
        url: new URL('https://example.test/ChIC/assets/exceljs.min-a.js'),
      })
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and verify red**

Run: `npx vitest run src/config/__tests__/pwaConfig.test.js`

Expected: FAIL because the named exports do not exist.

- [ ] **Step 3: Export and consume the narrow policy**

Add above `defineConfig` in `vite.config.js`:

```js
export const PWA_INJECT_REGISTER = 'script-defer';

export const PWA_WORKBOX_CONFIG = {
  globPatterns: ['**/*.{js,css,html,ico,json,txt,woff2}', 'assets/logo-*.png'],
  globIgnores: ['**/assets/exceljs*.js'],
  runtimeCaching: [
    {
      urlPattern: ({ url }) => /\/assets\/exceljs\.min-[^/]+\.js$/.test(url.pathname),
      handler: 'CacheFirst',
      options: {
        cacheName: 'chic-excel',
        expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 365 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
  ],
};
```

Inside `VitePWA` use:

```js
injectRegister: PWA_INJECT_REGISTER,
workbox: PWA_WORKBOX_CONFIG,
```

Note: Workbox serializes function `urlPattern` callbacks. The unit test invokes it directly; the build is the serialization gate.

- [ ] **Step 4: Add a deterministic generated-artifact audit**

Create `scripts/audit-precache.mjs`:

```js
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve('dist');
const swPath = resolve(dist, 'sw.js');
if (!existsSync(swPath)) throw new Error('dist/sw.js missing; run npm run build first.');

const sw = readFileSync(swPath, 'utf8');
const urls = [...new Set([...sw.matchAll(/\burl:"([^"]+)"/g)].map((match) => match[1]))];
const forbidden = [
  /exceljs/i,
  /ChICLogo_/,
  /ChIC_ApplicationComponents_/,
  /logo_v2\.svg$/,
  /og-image\.png$/,
];
const violations = urls.filter((url) => forbidden.some((pattern) => pattern.test(url)));
if (violations.length > 0) throw new Error(`Forbidden precache entries: ${violations.join(', ')}`);

const bytes = urls.reduce((total, url) => {
  const path = resolve(dist, url.replace(/^\//, ''));
  return existsSync(path) ? total + statSync(path).size : total;
}, 0);
const limit = 2_190_000;
console.log(JSON.stringify({ entries: urls.length, bytes, limit }));
if (bytes > limit) throw new Error(`Precache ${bytes} bytes exceeds ${limit}-byte limit.`);
```

Add to `package.json` scripts:

```json
"audit:precache": "node scripts/audit-precache.mjs"
```

- [ ] **Step 5: Verify policy and generated artifacts**

Run:

```bash
npx vitest run src/config/__tests__/pwaConfig.test.js
npm run build
npm run audit:precache
rg -n "register-sw.*defer|defer.*registerSW" dist/index.html
```

Expected: tests/build/audit pass; audit reports at most 2190000 bytes (≥70% below 7.3 MiB); `dist/sw.js` contains the `chic-excel` runtime rule but not the Excel URL in the precache manifest; registration script is deferred.

- [ ] **Step 6: Commit**

```bash
git add vite.config.js src/config/__tests__/pwaConfig.test.js scripts/audit-precache.mjs package.json
git commit -m "perf: narrow PWA precache and defer Excel caching"
```

---

### Task 7: Add and run production-subpath Playwright verification

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `playwright.config.js`
- Create: `scripts/serve-dist.mjs`
- Create: `tests/e2e/pr45-hardening.spec.js`

**Interfaces:**

- Produces: `npm run test:e2e`
- Test base URL: `http://127.0.0.1:8139/ChIC/`
- Server guarantee: requests such as `/ChIC/assets/index-hash.js` map inside `dist/`; traversal and missing files return 404; unknown SPA paths return `dist/404.html` only for HTML navigation.

- [ ] **Step 1: Add Playwright as requested development tooling**

Run:

```bash
npm install --save-dev @playwright/test@^1.61.1
npx playwright install chromium
```

Add to `package.json`:

```json
"test:e2e": "playwright test"
```

Expected: only `package.json`/`package-lock.json` change; production dependencies and runtime bundle are unchanged.

- [ ] **Step 2: Create the production-subpath static server**

Create `scripts/serve-dist.mjs`:

```js
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const HOST = '127.0.0.1';
const PORT = Number(process.env.CHIC_E2E_PORT) || 8139;
const PREFIX = '/ChIC/';
const ROOT = resolve('dist');
const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml'],
  ['.ico', 'image/x-icon'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.woff2', 'font/woff2'],
]);

const resolveRequest = (pathname) => {
  if (!pathname.startsWith(PREFIX)) return null;
  const relative =
    pathname === PREFIX ? 'index.html' : decodeURIComponent(pathname.slice(PREFIX.length));
  const file = resolve(ROOT, relative);
  return file === ROOT || file.startsWith(`${ROOT}${sep}`) ? file : null;
};

createServer((request, response) => {
  let pathname;
  try {
    pathname = new URL(request.url, `http://${HOST}`).pathname;
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }

  let file;
  try {
    file = resolveRequest(pathname);
  } catch {
    response.writeHead(400).end('Bad path');
    return;
  }

  const acceptsHtml = request.headers.accept?.includes('text/html');
  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    const fallback = resolve(ROOT, '404.html');
    if (pathname.startsWith(PREFIX) && acceptsHtml && existsSync(fallback)) file = fallback;
    else {
      response.writeHead(404).end('Not found');
      return;
    }
  }

  const contentType = MIME.get(extname(file).toLowerCase()) ?? 'application/octet-stream';
  const immutable = file.startsWith(resolve(ROOT, 'assets') + sep);
  response.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': statSync(file).size,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(response);
}).listen(PORT, HOST, () => {
  console.log(`ChIC test server: http://${HOST}:${PORT}${PREFIX}`);
});
```

The HTML-only fallback prevents a missing JS/CSS/image request from receiving the SPA document with a misleading 200.

- [ ] **Step 3: Configure Playwright**

Create `playwright.config.js`:

```js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8139/ChIC/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && node scripts/serve-dist.mjs',
    url: 'http://127.0.0.1:8139/ChIC/',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
```

- [ ] **Step 4: Write the failing privacy/query/chart/import browser tests**

Create `tests/e2e/pr45-hardening.spec.js` with these exact scenarios:

```js
import { expect, test } from '@playwright/test';
import { statSync } from 'node:fs';

test('query inputs calculate and public report URL contains no patient context', async ({
  page,
}) => {
  await page.goto(
    '?patientId=SECRET-123&age=50&height=1.75&tlv=15000&acknowledgeBanner=true&showCitation=false'
  );
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('SECRET-123');
  const report = await page.getByRole('link', { name: 'Report a bug' }).getAttribute('href');
  expect(report).toContain('version=0.5.5');
  expect(report).toContain('showCitation%3Dfalse');
  expect(report).not.toMatch(/SECRET-123|patientId|age%3D50|height%3D1\.75|tlv%3D15000/);
});

test('whitespace TLV does not calculate or show a spurious error', async ({ page }) => {
  await page.goto('?patientId=p1&age=50&height=1.75&tlv=%20%20&acknowledgeBanner=true');
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await expect(page.locator('#liverInput')).toHaveValue('');
  await expect(page.getByText('Please correct the errors before calculating')).toHaveCount(0);
});

test('selected-point ring follows logical rows and clears on deletion', async ({ page }) => {
  await page.goto('?acknowledgeBanner=true');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Load Data', exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: 'points.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify([
        { id: 'a', age: 40, height: 1.7, tlv: 3400 },
        { id: 'b', age: 50, height: 1.8, tlv: 3600 },
        { id: 'c', age: 60, height: 1.9, tlv: 3800 },
      ])
    ),
  });
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(3);
  await rows.nth(2).click();
  await expect(page.locator('.ring-overlay circle')).toHaveCount(1);
  await rows.nth(0).locator('button[aria-label="Remove data point"]').click();
  await expect(page.locator('tbody tr.row-editing')).toContainText('c');
  await page.locator('tbody tr.row-editing button[aria-label="Remove data point"]').click();
  await expect(page.locator('.ring-overlay circle')).toHaveCount(0);
});

test('mixed and empty JSON imports report exact outcomes without stale replacement', async ({
  page,
}) => {
  await page.goto('?acknowledgeBanner=true');
  const load = async (name, data) => {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Load Data', exact: true }).click();
    await (
      await chooser
    ).setFiles({
      name,
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(data)),
    });
  };
  await load('mixed.json', [
    { id: 'ok', age: 40, height: 1.7, tlv: 3400 },
    { id: 'missing-height', age: 40, tlv: 3400 },
    null,
    'junk',
    { age: 40, height: 1.7, tlv: 3400 },
  ]);
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('.load-notice')).toContainText('2 malformed rows skipped');
  await expect(page.locator('.load-notice')).toContainText('1 row skipped (missing or blank ID)');
  await load('empty.json', []);
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('.validation-message')).toContainText(
    'No rows found — nothing imported.'
  );
});
```

- [ ] **Step 5: Add chart/download/offline coverage**

In the same file add:

```js
test('chart, downloads, core offline, and Excel cache-on-first-use work', async ({
  page,
  context,
}, testInfo) => {
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));

  await page.goto('?patientId=visual&age=50&height=1.75&tlv=15000&acknowledgeBanner=true');
  const canvas = page.locator('.chart-container canvas');
  await expect(canvas).toBeVisible();
  const dimensions = await canvas.evaluate((element) => ({
    width: element.width,
    height: element.height,
  }));
  expect(dimensions.width).toBeGreaterThan(0);
  expect(dimensions.height).toBeGreaterThan(0);
  await testInfo.attach('chart', {
    body: await page.locator('.chart-container').screenshot(),
    contentType: 'image/png',
  });

  await page.getByTitle('Switch to Dark Theme').click();
  await expect(page.locator('body')).toHaveClass(/dark-theme/);

  const plotDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Plot' }).click();
  const plot = await plotDownload;
  expect(plot.suggestedFilename()).toMatch(/\.png$/);
  const plotPath = testInfo.outputPath(plot.suggestedFilename());
  await plot.saveAs(plotPath);
  expect(statSync(plotPath).size).toBeGreaterThan(0);

  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByTitle('How to Use & FAQ').click();
  const onlineExcelDownload = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Excel', exact: true }).click();
  expect((await onlineExcelDownload).suggestedFilename()).toBe('batch_upload_template.xlsx');
  await expect
    .poll(() => page.evaluate(async () => (await caches.keys()).includes('chic-excel')), {
      timeout: 10000,
    })
    .toBe(true);

  await context.setOffline(true);
  const offlinePage = await context.newPage();
  await offlinePage.goto('?acknowledgeBanner=true', { waitUntil: 'domcontentloaded' });
  await expect(offlinePage).toHaveTitle(/ChIC/);
  await expect(offlinePage.getByRole('button', { name: 'Calculate' })).toBeVisible();
  await expect(offlinePage.locator('.chart-container canvas')).toBeVisible();
  await expect(offlinePage.getByRole('link', { name: 'Report a bug' })).toBeVisible();

  await offlinePage.getByTitle('How to Use & FAQ').click();
  const offlineExcelDownload = offlinePage.waitForEvent('download');
  await offlinePage.getByRole('link', { name: 'Excel', exact: true }).click();
  expect((await offlineExcelDownload).suggestedFilename()).toBe('batch_upload_template.xlsx');
  expect(runtimeErrors).toEqual([]);
});
```

The `expect.poll` is the only service-worker wait; do not replace it with a fixed sleep.

- [ ] **Step 6: Run Playwright and inspect artifacts**

Run:

```bash
npm run test:e2e
npm run audit:precache
```

Expected: all Chromium tests pass; no page errors or failed core asset requests; chart attachment visibly retains all bands and a continuous T1 stroke; offline core and post-first-use Excel pass.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json playwright.config.js scripts/serve-dist.mjs tests/e2e/pr45-hardening.spec.js
git commit -m "test: cover PR 45 flows with Playwright"
```

---

### Task 8: Full verification and requirement audit

**Files:**

- Modify only if verification exposes a concrete defect.

**Interfaces:**

- Consumes every prior task; produces final evidence, not new behavior.

- [ ] **Step 1: Run the complete repository gate**

Run sequentially so failures are attributable:

```bash
npm test
npm run lint
npm run format:check
npm run typecheck
npm run build
npm run audit:precache
npm run test:e2e
```

Expected: every command exits 0. Record exact test counts, entry/Excel chunk raw+gzip sizes, precache entries/bytes, and Playwright test count.

- [ ] **Step 2: Run Lighthouse under documented serving conditions**

Start the built subpath server:

```bash
node scripts/serve-dist.mjs
```

In another shell run:

```bash
npx lighthouse 'http://127.0.0.1:8139/ChIC/?acknowledgeBanner=true' \
  --only-categories=performance,accessibility,best-practices,seo \
  --output=json --output-path=/tmp/chic-pr45-lighthouse.json \
  --chrome-flags='--headless --no-sandbox --disable-dev-shm-usage' --quiet
```

Report scores plus FCP, LCP, Speed Index, TBT, CLS, transferred bytes, and serving cache/compression conditions. Accessibility, Best Practices, and SEO must remain 100. Compare Performance like-for-like with the recorded baseline of 84; do not claim a cache-header production score from the no-compression local server.

- [ ] **Step 3: Audit every issue and review thread against authoritative evidence**

Create a local checklist in the final handoff (no new file required):

- #35: ring appears, follows logical row after deletion above, disappears when selected row is deleted/cleared.
- #36: T1 order remains 4.4, screenshot shows continuous line, dataset array/fill targets unchanged.
- #37: missing/out-of-range age/height/TLV rows remain N/A and unplotted; no estimation columns/config remain; round-trip passes.
- #38: Discussions category exists; footer links work; public report URL contains no patient context; Issue Form warns against real data.
- #42: PNG 1200×630/<150 KiB, source regeneration test passes, alt text matches.
- #43: numeric query example plots with no error; whitespace does not auto-calc; invalid values remain visible for validation.
- Review thread 1: malformed vs missing-ID counts are distinct.
- Review thread 2: raw whitespace TLV no longer triggers calculation.
- Review thread 3: patient-bearing query values are removed.
- Review thread 4: OG instructions use port 8137 and portable path.
- Performance: entry JS below baseline; precache ≥70% smaller; core offline; Excel offline after first use.

Any unchecked item means the task is incomplete; investigate and fix root cause before proceeding.

- [ ] **Step 4: Review the final diff for scope and caps**

Run:

```bash
git diff main...HEAD --check
git diff main...HEAD --stat
find src scripts -type f \( -name '*.vue' -o -name '*.js' -o -name '*.css' \) -print0 \
  | xargs -0 wc -l | awk '$1 > 600 { print; failed=1 } END { exit failed }'
rg -n "patientId|age|height|tlv" src/config/links.js src/components/AppFooter.vue
rg -n "registerables|ASSUMED_HEIGHT_M|NORMALIZATION_FACTOR|estimatedHtTLV|estimatedClass" src --glob '!**/__tests__/**'
```

Expected: no whitespace errors or over-cap files; sensitive names appear only in the sanitizer allow-deny logic/tests, not generated report context; removed estimation internals are absent.

- [ ] **Step 5: Close verification without an empty or external write**

If every gate passes, create no commit. If a gate exposed a defect, return to the task that owns that
behavior, add a failing regression there, implement the smallest root-cause fix, rerun Task 8 from
Step 1, and use that task's exact `git add` file list and commit message. Do not push, resolve threads,
or edit the PR without explicit authorization.
