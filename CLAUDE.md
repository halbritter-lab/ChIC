# CLAUDE.md

ChIC — Charité Imaging Classification: a Vue 3 + Vite SPA that classifies Polycystic Liver Disease progression.

**Read [AGENTS.md](./AGENTS.md) first.** It holds the architecture map, conventions, and the load-bearing invariants you must not break. This file only lists the few things worth repeating up front.

## Fast facts

- Stack: Vue 3 (mixed Options + Composition API), Vite 6, Chart.js 4, plain JavaScript. ESLint (flat config) + Prettier + Vitest.
- Install `npm ci` · dev `npm run dev` (port 8137) · build `npm run build` · test `npm test`.
- `npm run lint` is **check-only** (`eslint .`); `npm run lint:fix` auto-fixes. Also `npm run format:check` / `format`, and `npm run typecheck` (vue-tsc, advisory).
- Verify changes with `npm test` + `npm run build` + a manual check in the dev server. CI (`ci.yml`) runs lint + format:check + typecheck + test + build.

## Three things that will bite you (full list in AGENTS.md)

1. **`src/App.vue` (~550 ln) is still the hub** — root component and only route; most state lives in `src/composables/`. Most changes touch it; keep it under the 600-LOC cap.
2. **Classification lives in one place: `src/domain/classification.js`** (fed by `CONFIG`). Both the interactive and import paths call `classify()`. Change the model there only — don't fork a second copy (that was a fixed bug).
3. **Chart datasets are order- and label-sensitive.** `ChartDisplay.vue` paints class bands via dataset array order + fractional `order` + relative `fill:'+1'/'-1'`, and finds series by the magic labels `'Patient Data'` / `'Selected Point'`. Don't reorder datasets or rename those labels.

## Working agreement

Make the smallest change that fits the existing pattern. Don't add dependencies, formatters, or CI unless asked — the agreed roadmap is in `docs/RECOMMENDATIONS.md`.
