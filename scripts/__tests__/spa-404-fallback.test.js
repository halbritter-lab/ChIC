import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve(process.cwd(), 'scripts/spa-404-fallback.mjs');

describe('spa-404-fallback script', () => {
  it('copies dist/index.html to dist/404.html byte-for-byte', () => {
    const dir = mkdtempSync(join(tmpdir(), 'chic-404-'));
    try {
      mkdirSync(join(dir, 'dist'));
      const html = '<!doctype html><title>ChIC</title><script src="/ChIC/assets/x.js"></script>';
      writeFileSync(join(dir, 'dist', 'index.html'), html);
      execFileSync('node', [script], { cwd: dir, stdio: 'pipe' });
      expect(readFileSync(join(dir, 'dist', '404.html'), 'utf8')).toBe(html);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('exits non-zero when dist/index.html is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'chic-404-'));
    try {
      expect(() => execFileSync('node', [script], { cwd: dir, stdio: 'pipe' })).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
