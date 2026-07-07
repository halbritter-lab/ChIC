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
});
