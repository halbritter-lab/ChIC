# Issue #29 — Bundle Code-Split + Pages 404 Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the main JS entry chunk under Vite's 500 kB warning by lazy-loading exceljs, and make the GitHub-Pages SPA 404 fallback a property of the build rather than the deploy workflow.

**Architecture:** Two independent changes, delivered as one PR with two atomic commits. (1) Replace the static `import ExcelJS from 'exceljs'` in the persistence composable with a per-call `await import('exceljs')`, mirroring the pattern already used in `FaqModal.vue`. (2) Add a tiny Node `postbuild` script that copies `dist/index.html` → `dist/404.html`, remove the now-redundant `cp` from `deploy.yml`, and switch two deep-path-breaking `./favicon.png` refs to the `%BASE_URL%` token.

**Tech Stack:** Vue 3 + Vite 6, Chart.js 4, exceljs, `vite-plugin-pwa`, Vitest, Node 20, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-07-07-issue-29-code-split-and-404-design.md` (read it first — it holds the measured evidence behind these choices).

## Global Constraints

- **No new runtime dependencies.** exceljs/chart.js stay as-is in `package.json`; the new script is plain Node (`node:fs`), zero deps. (AGENTS.md rule.)
- **Zero behaviour change.** Import/export semantics, root-path rendering, and the PWA precache footprint must be unchanged.
- **600 LOC cap per file.** New files born under the cap; no touched file grows toward it.
- **Do NOT touch** `ChartDisplay.vue`, `src/domain/classification.js`, or `CONFIG`. Do NOT reorder Chart.js datasets or rename the magic labels `'Patient Data'` / `'Selected Point'`.
- **Base path is `/ChIC/`** in build, `/` in dev (`vite.config.js:7`). Reuse the existing `%BASE_URL%` idiom; do not hardcode `/ChIC/`.
- **Node 20** (`.nvmrc`). ESM scripts (`.mjs`), matching `scripts/pack-favicon-ico.mjs`.
- **`vite-plugin-pwa` workbox config stays unchanged** — the spec's precache analysis (§3.3) concluded no change is needed and that changing it would break offline xlsx (a behaviour change).
- **Full CI gate** must pass for each commit: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`.

---

## File Structure

| File                                                   | Change                      | Responsibility                                                                                       |
| ------------------------------------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/composables/useDataPersistence.js`                | Modify (3 edits)            | Remove static exceljs import; `await import('exceljs')` inside the two Excel functions               |
| `src/composables/__tests__/useDataPersistence.test.js` | Modify (add describe block) | Assert the module has no static exceljs import and lazy-loads it at both sites                       |
| `scripts/spa-404-fallback.mjs`                         | Create                      | Copy `dist/index.html` → `dist/404.html` (fail loudly if the source is missing)                      |
| `scripts/__tests__/spa-404-fallback.test.js`           | Create                      | Exercise the script against a temp `dist/` fixture (copy + missing-source cases)                     |
| `package.json`                                         | Modify (scripts)            | Add `"postbuild": "node scripts/spa-404-fallback.mjs"`                                               |
| `.github/workflows/deploy.yml`                         | Modify (remove step)        | Drop the redundant `cp dist/index.html dist/404.html` step                                           |
| `index.html`                                           | Modify (2 lines)            | `./favicon.png` → `%BASE_URL%favicon.png` (SEO shell + splash) so the fallback renders on deep paths |
| `src/__tests__/indexHtml.test.js`                      | Modify (add test)           | Assert the two body favicon refs use `%BASE_URL%` and no `./favicon.png` remains                     |

Two commits: **Commit 1** = rows 1–2 (Part 1). **Commit 2** = rows 3–8 (Part 2).

---

## Task 1: Lazy-load exceljs (Part 1 → Commit 1)

**Files:**

- Modify: `src/composables/useDataPersistence.js` (remove line 2; edit `loadDataFromExcel` ~`:341`, `downloadDataAsExcel` ~`:452`)
- Test: `src/composables/__tests__/useDataPersistence.test.js` (add a describe block)

**Interfaces:**

- Consumes: nothing from other tasks.
- Produces: no new exported symbol. The public API of `useDataPersistence()` (`triggerLoad`, `saveDataAsJson`, `downloadDataAsExcel`, `downloadDataAsCsv`, `loadedData`, `errorLoading`, `loadNotice`) is unchanged. `downloadDataAsExcel` and `loadDataFromExcel` remain `async` with identical signatures and side effects; only the point at which exceljs is resolved moves inside them.

- [ ] **Step 1: Write the failing test**

Add this describe block to the end of `src/composables/__tests__/useDataPersistence.test.js` (the file already imports `describe, it, expect` from `vitest`; add the two Node imports at the top of the block as shown):

```javascript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('useDataPersistence — exceljs is code-split (issue #29)', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/composables/useDataPersistence.js'),
    'utf8'
  );

  it('has no top-level static exceljs import (keeps it out of the entry chunk)', () => {
    expect(source).not.toMatch(/^\s*import\s+ExcelJS\s+from\s+['"]exceljs['"]/m);
  });

  it('dynamically imports exceljs at both Excel call sites', () => {
    const dynamicImports = source.match(/await import\(['"]exceljs['"]\)/g) ?? [];
    expect(dynamicImports.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/composables/__tests__/useDataPersistence.test.js -t "code-split"`
Expected: FAIL — the first assertion fails because line 2 is `import ExcelJS from 'exceljs';`, and the second fails because there are 0 dynamic imports.

- [ ] **Step 3: Remove the static import**

In `src/composables/useDataPersistence.js`, delete line 2 so the header goes from:

```javascript
import { ref } from 'vue';
import ExcelJS from 'exceljs';
import { CONFIG } from '@/config/config';
```

to:

```javascript
import { ref } from 'vue';
import { CONFIG } from '@/config/config';
```

- [ ] **Step 4: Lazy-load exceljs in `loadDataFromExcel`**

Change the start of the `try` block in `loadDataFromExcel` (currently ~`:340`) from:

```javascript
  const loadDataFromExcel = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
```

to:

```javascript
  const loadDataFromExcel = async (file) => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
```

- [ ] **Step 5: Lazy-load exceljs in `downloadDataAsExcel`**

Change the start of the `try` block in `downloadDataAsExcel` (currently ~`:452`) from:

```javascript
    try {
      const worksheetData = buildExportRows(dataToSave);

      const workbook = new ExcelJS.Workbook();
```

to:

```javascript
    try {
      const ExcelJS = (await import('exceljs')).default;
      const worksheetData = buildExportRows(dataToSave);

      const workbook = new ExcelJS.Workbook();
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/composables/__tests__/useDataPersistence.test.js`
Expected: PASS — all existing tests in the file plus the two new assertions.

- [ ] **Step 7: Build and verify the bundle gate**

Run: `npm run build`
Expected:

- The entry chunk `dist/assets/index-*.js` is ≈ **347 kB (123 kB gzip)** (down from 1,287 kB / 395 kB) — under the 500 kB threshold.
- Vite's `(!) Some chunks are larger than 500 kB` warning **still prints, but now for the on-demand `exceljs` chunk only** (939 kB), not the entry. That is the expected end state and satisfies the issue's "split out and loaded on demand" acceptance. Do **not** raise `chunkSizeWarningLimit` to hide it.
- A separate `dist/assets/exceljs.min-*.js` chunk (≈ 939 kB / 271 kB gzip) exists and is **not** referenced by a `<script>` or `modulepreload` in `dist/index.html` (it loads on demand). Verify with:

  `grep -o 'exceljs[^"]*' dist/index.html || echo 'exceljs not in entry HTML (correct)'`

  Expected: `exceljs not in entry HTML (correct)`.

- [ ] **Step 8: Verify the Lighthouse gate (measurement, not a committed test)**

Serve the production build at base `/ChIC/` (NOT `vite preview` — its chunks 404 under headless Chromium; see the `browser-verify-prod-build` memory):

```bash
mkdir -p /tmp/chic-lh/ChIC && cp -r dist/* /tmp/chic-lh/ChIC/
(cd /tmp/chic-lh && python3 -m http.server 8710 >/dev/null 2>&1 &)
sleep 1
npx --yes lighthouse http://localhost:8710/ChIC/ --only-categories=performance \
  --chrome-flags="--headless=new" --quiet --output=json --output-path=/tmp/chic-lh/after.json
node -e 'const r=require("/tmp/chic-lh/after.json"),a=r.audits;console.log("perf",Math.round(r.categories.performance.score*100),"FCP",a["first-contentful-paint"].displayValue,"LCP",a["largest-contentful-paint"].displayValue)'
pkill -f "http.server 8710"
```

Expected (mobile throttle): **perf ≈ 88, FCP ≈ 3.0 s, LCP ≈ 3.1 s** — materially better than the baseline (perf 58, FCP 7.5 s, LCP 8.1 s recorded in the spec §2.4). Record the numbers in the PR description.

- [ ] **Step 9: Manually exercise xlsx export + import (zero-behaviour-change check)**

Run `npm run dev`, open `http://localhost:8137/`, acknowledge the disclaimer, then:

1. Enter a patient (e.g. ID `001`, age `45`, height `1.75`, TLV `3000`), calculate, and click the Excel **export** — confirm an `.xlsx` downloads and opens with the expected columns.
2. Use the FAQ/upload flow to **import** that `.xlsx` back — confirm rows load and classify.

Expected: identical behaviour to before; the network panel shows `exceljs` fetched only on the first export/import click, not at page load.

- [ ] **Step 10: Run the full CI gate**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
Expected: all green (Vitest 72 passed — the prior 70 plus the 2 new assertions).

- [ ] **Step 11: Commit**

```bash
git add src/composables/useDataPersistence.js src/composables/__tests__/useDataPersistence.test.js
git commit -m "perf: lazy-load exceljs to shrink the initial bundle (#29)

exceljs (52% of the 1.28 MB entry) is only needed on Excel import/export.
Replace the static import with a per-call await import('exceljs'), matching
the pattern already in FaqModal.vue. Entry chunk 395->123 kB gzip, under
Vite's 500 kB warning; Lighthouse mobile perf 58->88 (FCP 7.5->3.0 s).
Both consumers are already async, so behaviour is unchanged.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: Formalize the Pages 404 fallback in the build (Part 2 → Commit 2)

**Files:**

- Create: `scripts/spa-404-fallback.mjs`
- Create: `scripts/__tests__/spa-404-fallback.test.js`
- Modify: `package.json` (add `postbuild` script)
- Modify: `.github/workflows/deploy.yml` (remove the `cp` step, lines ~30–31)
- Modify: `index.html` (lines 475 + 574: `./favicon.png` → `%BASE_URL%favicon.png`)
- Modify: `src/__tests__/indexHtml.test.js` (add one test)

**Interfaces:**

- Consumes: nothing from Task 1 (independent).
- Produces: `scripts/spa-404-fallback.mjs`, invoked as `node scripts/spa-404-fallback.mjs` from the project root (cwd = repo root). It reads `dist/index.html` and writes `dist/404.html`; exits non-zero if `dist/index.html` is absent. No exported JS symbols — it is a runnable script (matching `scripts/pack-favicon-ico.mjs`), tested via child-process invocation against a temp cwd.

- [ ] **Step 1: Write the failing test for the copy script**

Create `scripts/__tests__/spa-404-fallback.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve(process.cwd(), 'scripts/spa-404-fallback.mjs');

describe('spa-404-fallback script', () => {
  it('copies dist/index.html to dist/404.html byte-for-byte', () => {
    const dir = mkdtempSync(join(tmpdir(), 'chic-404-'));
    try {
      mkdirSync(join(dir, 'dist'));
      const html = '<!doctype html><title>ChIC</title><script src="/ChIC/assets/x.js"></script>';
      writeFileSync(join(dir, 'dist', 'index.html'), html);
      execFileSync('node', [script], { cwd: dir, stdio: 'pipe' });
      expect(readFileSync(join(dir, 'dist', '404.html'), 'utf8')).toBe(html);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exits non-zero when dist/index.html is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'chic-404-'));
    try {
      expect(() => execFileSync('node', [script], { cwd: dir, stdio: 'pipe' })).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/__tests__/spa-404-fallback.test.js`
Expected: FAIL — `scripts/spa-404-fallback.mjs` does not exist yet (both cases error).

- [ ] **Step 3: Create the copy script**

Create `scripts/spa-404-fallback.mjs` (ESM, `node:fs`, cwd-relative — same style as `scripts/pack-favicon-ico.mjs`):

```javascript
// Emit dist/404.html as a byte-for-byte copy of dist/index.html so a GitHub
// Pages deep-link / refresh on a sub-path (base /ChIC/) falls back to the SPA
// instead of a 404. Runs as `npm run build`'s postbuild step, so local builds
// and CI are self-sufficient (no cp in the deploy workflow). See issue #29.
import { copyFileSync, existsSync } from 'node:fs';

const src = 'dist/index.html';
const dest = 'dist/404.html';

if (!existsSync(src)) {
  console.error(`spa-404-fallback: ${src} not found — run \`vite build\` first.`);
  process.exit(1);
}

copyFileSync(src, dest);
console.log(`spa-404-fallback: wrote ${dest} (copy of ${src}).`);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/__tests__/spa-404-fallback.test.js`
Expected: PASS — both cases (copy succeeds; missing source exits non-zero).

- [ ] **Step 5: Wire the postbuild script into package.json**

In `package.json`, add a `postbuild` entry immediately after `"build"` (npm runs `postbuild` automatically after `build`; the `build` string itself is unchanged):

```json
    "build": "vite build",
    "postbuild": "node scripts/spa-404-fallback.mjs",
    "preview": "vite preview",
```

- [ ] **Step 6: Remove the redundant cp step from deploy.yml**

In `.github/workflows/deploy.yml`, delete these two lines (the build now produces `dist/404.html`, which `upload-pages-artifact` already uploads):

```yaml
- name: SPA 404 fallback
  run: cp dist/index.html dist/404.html
```

So the `build` job goes straight from the `Build` step to the `Upload Pages artifact` step.

- [ ] **Step 7: Write the failing test for the favicon fix**

Add this test to `src/__tests__/indexHtml.test.js` inside the existing `describe('index.html no-flash boot', …)` block:

```javascript
it('uses base-relative favicon refs so the 404 fallback renders on deep paths', () => {
  // Served as 404.html at /ChIC/a/b, a "./favicon.png" resolves to /ChIC/a/favicon.png
  // (404). The %BASE_URL% token resolves to /ChIC/favicon.png at any depth.
  expect(html).not.toContain('src="./favicon.png"');
  const baseRefs = html.match(/src="%BASE_URL%favicon\.png"/g) ?? [];
  expect(baseRefs.length).toBe(2); // SEO shell <img> + splash <img>
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/indexHtml.test.js -t "deep paths"`
Expected: FAIL — `index.html` still contains `src="./favicon.png"` (lines 475 and 574) and zero `%BASE_URL%favicon.png` `src` refs.

- [ ] **Step 9: Fix the two favicon refs in index.html**

In `index.html`, change line 475 (SEO shell) from:

```html
<img src="./favicon.png" alt="Charité Imaging Classification logo" width="96" />
```

to:

```html
<img src="%BASE_URL%favicon.png" alt="Charité Imaging Classification logo" width="96" />
```

and line 574 (splash) from:

```html
<img src="./favicon.png" alt="" width="72" />
```

to:

```html
<img src="%BASE_URL%favicon.png" alt="" width="72" />
```

- [ ] **Step 10: Run the favicon test to verify it passes**

Run: `npx vitest run src/__tests__/indexHtml.test.js`
Expected: PASS — all `indexHtml` tests including the new deep-path assertion.

- [ ] **Step 11: Build and verify the 404 artifact**

Run: `npm run build`
Expected: the build finishes with `spa-404-fallback: wrote dist/404.html (copy of dist/index.html).` Then verify byte-identity and that the favicon resolved to an absolute base path:

```bash
diff dist/index.html dist/404.html && echo '404.html == index.html (correct)'
grep -o 'src="/ChIC/favicon.png"' dist/index.html | head -1   # %BASE_URL% -> /ChIC/ at build
```

Expected: `diff` reports no differences; the `grep` prints `src="/ChIC/favicon.png"`.

- [ ] **Step 12: Verify a deep-link boots the app (browser gate)**

Emulate GitHub Pages (serve the requested file, else `404.html` with a 404 status) and load a deep path in headless Chrome:

```bash
cat > /tmp/chic-gh.mjs <<'EOF'
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const root = process.argv[2], port = Number(process.argv[3]);
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.ico':'image/x-icon'};
createServer((req, res) => {
  let p = join(root, decodeURIComponent(req.url.split('?')[0].replace(/^\/ChIC/, '')));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (existsSync(p) && statSync(p).isFile()) { res.writeHead(200, {'content-type': types[extname(p)] || 'application/octet-stream'}); res.end(readFileSync(p)); }
  else { res.writeHead(404, {'content-type': 'text/html'}); res.end(readFileSync(join(root, '404.html'))); }
}).listen(port);
EOF
(node /tmp/chic-gh.mjs "$(pwd)/dist" 8712 &) ; sleep 1
google-chrome --headless=new --disable-gpu --virtual-time-budget=8000 \
  --dump-dom http://localhost:8712/ChIC/some/deep/path 2>/dev/null > /tmp/chic-deep.html
grep -c 'data-v-' /tmp/chic-deep.html   # >0 means Vue mounted (scoped-style attrs present)
grep -o 'Heisenberg-Programm\|institution-logo' /tmp/chic-deep.html | head -1
pkill -f 'chic-gh.mjs'
```

Expected: `grep -c 'data-v-'` prints a number well above 0 (the prototype produced ~100), and the footer marker line prints — i.e. the full app mounted on the deep path, not a bare 404. The DOM should match a root-path load.

- [ ] **Step 13: Run the full CI gate**

Run: `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`
Expected: all green (Vitest now includes the exceljs, spa-404-fallback, and indexHtml additions).

- [ ] **Step 14: Commit**

```bash
git add scripts/spa-404-fallback.mjs scripts/__tests__/spa-404-fallback.test.js \
  package.json .github/workflows/deploy.yml index.html src/__tests__/indexHtml.test.js
git commit -m "build: emit dist/404.html as a Pages SPA fallback (#29)

Move the SPA 404 fallback from a deploy.yml cp into a postbuild script so
local builds and CI are self-sufficient and correctness is decoupled from
the deploy workflow. Switch the two body favicon refs from ./favicon.png to
%BASE_URL%favicon.png so the fallback renders on deep paths (a relative ref
resolves wrong when 404.html is served under /ChIC/a/b).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: Open the PR

- [ ] **Step 1: Push the branch and open the PR**

```bash
git push -u origin docs/issue-29-perf-and-404-plan
gh pr create --title "Perf + deploy: code-split exceljs, formalize Pages 404 fallback (closes #29)" \
  --body "$(cat <<'EOF'
Closes #29. Two independent commits.

**1. Code-split (`perf: lazy-load exceljs`)** — exceljs (52% of the 1.28 MB
entry) now loads on demand. Entry chunk 395 → 123 kB gzip (under Vite's
500 kB warning); Lighthouse mobile perf 58 → 88, FCP 7.5 → 3.0 s, LCP
8.1 → 3.1 s. Both consumers were already async → zero behaviour change.
Workbox precache left unchanged (see spec §3.3: changing it would break
offline xlsx).

**2. 404 fallback (`build: emit dist/404.html`)** — the SPA fallback is now
produced by `npm run build` (postbuild script), not the deploy workflow;
the redundant `deploy.yml` cp is removed. Two `./favicon.png` refs → the
`%BASE_URL%` token so the fallback renders correctly on deep paths.

Spec: `docs/superpowers/specs/2026-07-07-issue-29-code-split-and-404-design.md`
Plan: `docs/superpowers/plans/2026-07-07-issue-29-code-split-and-404.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR opens against `main`, CI (`ci.yml`) runs the full gate green.

---

## Self-Review — spec coverage

| Spec requirement                              | Task/step                                             |
| --------------------------------------------- | ----------------------------------------------------- |
| §3 exceljs dynamic import (3 edits, one file) | Task 1, Steps 3–5                                     |
| §3.4 entry < 500 kB, exceljs chunk separate   | Task 1, Step 7                                        |
| §3.4 FCP/LCP improve (measured)               | Task 1, Step 8                                        |
| §3.4 xlsx export/import still work            | Task 1, Step 9                                        |
| §3.3 workbox precache **unchanged**           | Global Constraints (no task touches `vite.config.js`) |
| §4.4 postbuild copy script                    | Task 2, Steps 1–5                                     |
| §4.4 remove deploy.yml cp                     | Task 2, Step 6                                        |
| §4.4 favicon `%BASE_URL%` fix                 | Task 2, Steps 7–9                                     |
| §4.5 `dist/404.html` == `dist/index.html`     | Task 2, Step 11                                       |
| §4.5 deep path mounts the app                 | Task 2, Step 12                                       |
| §3.4 / §4.5 full CI gate green                | Task 1 Step 10, Task 2 Step 13                        |
| §6 one PR, two atomic commits                 | Task 1 Step 11, Task 2 Step 14, Task 3                |

**Placeholder scan:** none — every code/edit step shows the exact before/after content and exact commands with expected output.

**Type/name consistency:** `spa-404-fallback.mjs` (script name), `writeSpaFallback`-style helper deliberately avoided (the script is a plain runnable, tested via child process — no exported symbol to keep consistent). `postbuild` script name matches npm's lifecycle hook exactly. The two favicon `src="%BASE_URL%favicon.png"` refs match the assertion count (2) in the indexHtml test.

**Coverage honesty:** Part 1 is guarded by a source-shape test (no static import + 2 dynamic imports) plus the existing 70 behaviour tests; the runtime export/import flow is verified manually (Step 9), not by a new integration test. Part 2's copy logic has real unit tests (child-process against a temp dir); the `package.json`/`deploy.yml` wiring is verified by the actual build artifact (Step 11) and the browser gate (Step 12), not a unit test.
