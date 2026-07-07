# Chart Y-Origin & Mount-Flash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the chart y-origin to the model baseline (15, 600) and stop the first-load
GitHub-page flash, without adding dependencies.

**Architecture:** Two independent, small changes. (1) A one-line `CONFIG` change makes the log
y-axis floor equal the class-A baseline (600), removing the dead-zone below it. (2) `index.html`
hides the existing no-JS SEO shell from JS users and shows a minimal, dependency-free branded splash
inside `#app` that Vue's mount replaces automatically; a `<noscript>` override keeps the shell for
crawlers/no-JS.

**Tech Stack:** Vue 3, Vite 6, Chart.js 4, Vitest (jsdom), plain HTML/CSS. No new deps.

## Global Constraints

- No new dependencies (AGENTS.md / CLAUDE.md working agreement).
- `src/config/config.js` is the single source of truth for chart limits; `ChartDisplay.vue` already
  reads `CONFIG.CHART_Y_MIN/MAX` — do not hardcode elsewhere.
- The SEO shell content inside `#app` must remain in the DOM (no-JS crawlers depend on it).
- `App.vue` must stay < 600 LOC (untouched here).
- Verify with `npm run lint`, `npm run format:check`, `npm test`, `npm run build` (all green).

---

### Task 1: Y-axis origin at the model baseline

**Files:**

- Modify: `src/config/config.js:24`
- Test: `src/config/__tests__/config.test.js` (create)

**Interfaces:**

- Consumes: `CONFIG.MODEL.CLASS_BASELINE_ML_PER_M` (600), `CONFIG.CHART_Y_MIN`, `CONFIG.CHART_Y_TICKS`.
- Produces: `CONFIG.CHART_Y_MIN === 600` — the invariant "chart origin sits at the class-A baseline".

- [ ] **Step 1: Write the failing test**

Create `src/config/__tests__/config.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { CONFIG } from '@/config/config.js';

describe('chart y-axis origin', () => {
  it('floors the log y-axis at the model baseline so the origin is (15, 600)', () => {
    // Reported issue: origin looked like (15, 0). The clinical model has nothing
    // below the class-A baseline (600 ml/m), so the axis must start there.
    expect(CONFIG.CHART_Y_MIN).toBe(CONFIG.MODEL.CLASS_BASELINE_ML_PER_M);
    expect(CONFIG.CHART_Y_MIN).toBe(600);
  });

  it('keeps the first labelled tick equal to the axis floor (no dead-zone below it)', () => {
    expect(Math.min(...CONFIG.CHART_Y_TICKS)).toBe(CONFIG.CHART_Y_MIN);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/config/__tests__/config.test.js`
Expected: FAIL — `CHART_Y_MIN` is 100, not 600.

- [ ] **Step 3: Make the change**

In `src/config/config.js`, change line 24 from:

```js
  CHART_Y_MIN: 100, // log floor; must not clip small htTLV (<600)
```

to:

```js
  CHART_Y_MIN: 600, // log floor = class-A baseline (CLASS_BASELINE_ML_PER_M); origin sits at (15, 600)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/config/__tests__/config.test.js`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/config/config.js src/config/__tests__/config.test.js
git commit -m "fix(chart): floor y-axis at 600 baseline so origin is (15, 600)"
```

---

### Task 2: Kill the first-load GitHub-page flash

**Files:**

- Modify: `index.html` (add head `<style>`/`<noscript>` before `</head>` at line 284; add splash div
  inside `#app` after the shell closes at line 469)
- Test: `src/__tests__/indexHtml.test.js` (create)

**Interfaces:**

- Consumes: existing `.chic-seo-shell` element and `#app` container in `index.html`.
- Produces: `.chic-seo-shell { display: none }` default rule, a `<noscript>` override showing the
  shell + hiding the splash, and a `.chic-app-splash` element inside `#app`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/indexHtml.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8');

describe('index.html no-flash boot', () => {
  it('hides the SEO shell by default so it never flashes for JS users', () => {
    expect(html).toMatch(/\.chic-seo-shell\s*\{\s*display:\s*none/);
  });

  it('re-shows the SEO shell for no-JS via a <noscript> override', () => {
    const noscript = html.match(/<noscript>[\s\S]*?<\/noscript>/g)?.join('\n') ?? '';
    expect(noscript).toMatch(/\.chic-seo-shell\s*\{\s*display:\s*block/);
    expect(noscript).toMatch(/\.chic-app-splash\s*\{\s*display:\s*none/);
  });

  it('keeps the SEO shell content in the DOM for crawlers', () => {
    expect(html).toContain('chic-seo-shell');
    expect(html).toContain('Source code on GitHub');
  });

  it('renders a branded splash inside #app for JS users', () => {
    expect(html).toContain('chic-app-splash');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/indexHtml.test.js`
Expected: FAIL — no `.chic-seo-shell { display: none }` and no `chic-app-splash` yet.

- [ ] **Step 3a: Add the no-flash CSS in `<head>`**

In `index.html`, immediately before `</head>` (line 284), insert:

```html
<!-- No-flash boot. The SEO shell inside #app exists for no-JS crawlers and link scrapers.
         For JS users we hide it immediately and show a minimal branded splash instead, so the
         crawler shell (which reads like a GitHub/README page) never flashes before Vue mounts.
         Vue replaces all of #app on mount, which removes the splash automatically. -->
<style>
  .chic-seo-shell {
    display: none;
  }
  .chic-app-splash {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    gap: 16px;
    background: #ffffff;
    font-family:
      system-ui,
      -apple-system,
      'Segoe UI',
      Roboto,
      sans-serif;
    color: #2c3e50;
  }
  .chic-app-splash img {
    width: 72px;
    height: auto;
    animation: chic-splash-pulse 1.4s ease-in-out infinite;
  }
  .chic-app-splash .chic-splash-label {
    font-size: 0.95rem;
    color: #5a6b7b;
    letter-spacing: 0.02em;
  }
  @keyframes chic-splash-pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.55;
      transform: scale(0.94);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .chic-app-splash img {
      animation: none;
    }
  }
</style>
<noscript>
  <style>
    /* No JS (and non-rendering crawlers): show the SEO shell, hide the splash. */
    .chic-seo-shell {
      display: block;
    }
    .chic-app-splash {
      display: none;
    }
  </style>
</noscript>
```

- [ ] **Step 3b: Add the splash element inside `#app`**

In `index.html`, immediately after the shell's closing `</div>` (the one that closes
`<div class="chic-seo-shell">`, line 469) and before the `</div>` that closes `#app` (line 470),
insert:

```html
<!-- JS-only branded splash. Sits inside #app so Vue's mount removes it automatically.
           Hidden for no-JS via the <noscript> override above. -->
<div class="chic-app-splash" aria-hidden="true">
  <img src="./favicon.png" alt="" width="72" />
  <span class="chic-splash-label">Loading ChIC…</span>
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/indexHtml.test.js`
Expected: PASS (all four tests).

- [ ] **Step 5: Commit**

```bash
git add index.html src/__tests__/indexHtml.test.js
git commit -m "fix(boot): hide SEO shell from JS users + branded splash to kill first-load flash"
```

---

### Task 3: Full verification gate

**Files:** none (verification only).

- [ ] **Step 1: Lint, format, unit tests, build**

Run:

```bash
npm run lint
npm run format:check
npm test
npm run build
```

Expected: all green. (If `format:check` flags `index.html`, run `npm run format` and re-commit.)

- [ ] **Step 2: Browser verification (Playwright, scratchpad harness — not committed)**

Re-capture the "after" state against the dev server and confirm:

- Chart origin corner is (15, 600); the class-A band bottoms at the axis floor; no dead-zone.
- First paint shows the branded splash (logo + "Loading ChIC…"), never the GitHub-style shell;
  the no-JS render still shows the full SEO shell.

- [ ] **Step 3: Commit any format fixups**

```bash
git add -A && git commit -m "chore: prettier format for no-flash boot markup"
```

## Self-Review

- **Spec coverage:** Fix 1 (y-origin) → Task 1. Fix 2 (shell hide + splash + noscript) → Task 2.
  Verification (unit + browser) → Tasks 1–3. Out-of-scope 404.html explicitly deferred. ✅
- **Placeholders:** none — every step has exact code/commands. ✅
- **Type/name consistency:** `.chic-seo-shell`, `.chic-app-splash`, `chic-splash-pulse`,
  `chic-splash-label`, `CHART_Y_MIN`, `CLASS_BASELINE_ML_PER_M` used identically across tasks/tests. ✅
