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

  it('uses the approved complete product title', () => {
    expect(source).toContain('<h1>Charité Imaging Classification (ChIC)</h1>');
  });
});
