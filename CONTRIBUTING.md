# Contributing to ChIC

Thanks for your interest in improving the Charité Imaging Classification app.

## Development setup

```bash
npm ci            # install (Node 20 — see .nvmrc)
npm run dev       # dev server on http://localhost:8137
npm run build     # production build
npm run preview   # serve the production build
```

## Quality gates (all must pass before a PR is merged; CI enforces them)

```bash
npm run lint         # ESLint 9 flat config, check-only
npm run format:check # Prettier
npm run typecheck    # vue-tsc
npm test             # Vitest
npm run build
```

Use `npm run lint:fix` and `npm run format` to auto-fix.

## Code conventions (see AGENTS.md for the full list)

- **600 LOC hard cap** per `.vue`/`.js`/`.css` file. Any file you touch that is over
  cap must be split as part of your change.
- **Boy-Scout rule:** leave touched code DRY, KISS, SOLID, and modular.
- Child components use `<script setup>` with explicit `defineProps`/`defineEmits`.
- **No hardcoded clinical/display constants** — everything lives in `src/config/config.js`;
  the classifier lives in `src/domain/classification.js`.
- Do not change validated clinical behavior without a corresponding manuscript reference.

## Commits & PRs

- Conventional commit messages (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`).
- Keep PRs focused; ensure the quality gates above are green.
- The default branch is `main`; deploys happen automatically on push to `main`.
