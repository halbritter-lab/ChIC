# CLAUDE.md

ChIC — Charité Imaging Classification: a Vue 3 + Vite SPA that classifies Polycystic Liver Disease progression.

**Read [AGENTS.md](./AGENTS.md) first.** It holds the architecture map, conventions, and the load-bearing invariants you must not break. This file only lists the few things worth repeating up front.

## Fast facts

- Stack: Vue 3 (mixed Options + Composition API), Vite 6, Chart.js 4, plain JavaScript, ESLint. No tests.
- Install `npm ci` · dev `npm run dev` (port 8080) · build `npm run build` · lint `npm run lint`.
- `npm run lint` **auto-fixes in place**. To check without changing files:
  `npx eslint . --ext .vue,.js,.jsx,.cjs,.mjs --ignore-path .gitignore`
- Verify changes with `npm run build` + manual check in the dev server. There are no tests to rely on.

## Three things that will bite you (full list in AGENTS.md)

1. **`src/App.vue` (~1020 ln) is the whole app** — root component and only route, holds nearly all state. Most changes touch it.
2. **Classification logic is duplicated and out of sync** between `App.vue` (5 classes) and `useDataPersistence.js` (3 classes). Fix both, or extract one shared classifier.
3. **`App.vue` calls `updatePointStyle()` and `clearChart()` on the chart — neither exists** (silent no-ops). Chart methods live in `defineExpose` in `ChartDisplay.vue`.

## Working agreement

Make the smallest change that fits the existing pattern. Don't add dependencies, formatters, or CI unless asked — the agreed roadmap is in `docs/RECOMMENDATIONS.md`.
