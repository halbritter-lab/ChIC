// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { PWA_INJECT_REGISTER, PWA_WORKBOX_CONFIG } from '../../../vite.config.js';

describe('PWA cache policy', () => {
  it('defers registration and precaches only the core shell', () => {
    expect(PWA_INJECT_REGISTER).toBe('script-defer');
    expect(PWA_WORKBOX_CONFIG.globPatterns).toEqual([
      '**/*.{js,css,html,ico,json,txt,woff2}',
      'assets/logo-*.png',
    ]);
    expect(PWA_WORKBOX_CONFIG.globIgnores).toContain('**/assets/exceljs*.js');
  });

  it('caches the Excel chunk only after first use', () => {
    const excelRule = PWA_WORKBOX_CONFIG.runtimeCaching.find(
      (rule) => rule.options.cacheName === 'chic-excel'
    );
    expect(excelRule.handler).toBe('CacheFirst');
    expect(excelRule.options.expiration).toEqual({
      maxEntries: 2,
      maxAgeSeconds: 60 * 60 * 24 * 365,
    });
    expect(
      excelRule.urlPattern({
        url: new URL('https://example.test/ChIC/assets/exceljs.min-a.js'),
      })
    ).toBe(true);
  });
});
