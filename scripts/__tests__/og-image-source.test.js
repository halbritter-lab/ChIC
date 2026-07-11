import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('scripts/og-image.html'), 'utf8');

describe('OG image source', () => {
  it('uses the documented dev server and a portable relative logo path', () => {
    expect(source).toContain('http://localhost:8137/og-render.html');
    // og-logo.png is the background-stripped, transparent derivative of ChICLogo_NoText so the
    // logo reads cleanly on the white card (issue #42 review) — still a portable relative path.
    expect(source).toContain('src="./og-logo.png"');
    expect(source).not.toContain('localhost:8138');
    expect(source).not.toContain('src="/ChIC/');
  });

  it('uses the approved complete product title', () => {
    expect(source).toContain('<h1>Charité Imaging Classification (ChIC)</h1>');
  });
});
