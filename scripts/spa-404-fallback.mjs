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
