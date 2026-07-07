import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Vitest runs with the project root as cwd; index.html lives there.
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

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

  it('delays the splash so fast/warm loads never flash it', () => {
    // The splash starts hidden and only fades in after a delay, so a fast mount
    // (which removes #app before the delay elapses) never shows it.
    expect(html).toMatch(/\.chic-app-splash\s*\{[^}]*opacity:\s*0/);
    expect(html).toMatch(/animation:\s*chic-splash-in[^;]*0\.3s/);
  });

  it('sets the pre-mount theme background before first paint (no white-on-dark flash)', () => {
    // Inline, render-blocking script keyed to the same localStorage 'theme' as useTheme.js.
    expect(html).toMatch(/getItem\(\s*['"]theme['"]\s*\)\s*===\s*['"]dark['"]/);
    expect(html).toMatch(/setAttribute\(\s*['"]data-chic-theme['"]\s*,\s*['"]dark['"]\s*\)/);
    // Dark base background matches the app's .dark-theme colour (#1a1a2e).
    expect(html).toMatch(
      /html\[data-chic-theme=['"]dark['"]\]\s*\{\s*background-color:\s*#1a1a2e/i
    );
  });

  it('uses base-relative favicon refs so the 404 fallback renders on deep paths', () => {
    // Served as 404.html at /ChIC/a/b, a "./favicon.png" resolves to /ChIC/a/favicon.png
    // (404). The %BASE_URL% token resolves to /ChIC/favicon.png at any depth.
    expect(html).not.toContain('src="./favicon.png"');
    const baseRefs = html.match(/src="%BASE_URL%favicon\.png"/g) ?? [];
    expect(baseRefs.length).toBe(2); // SEO shell <img> + splash <img>
  });
});
