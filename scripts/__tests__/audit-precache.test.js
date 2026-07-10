// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryDirectories = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('precache audit', () => {
  it('fails when a manifest URL has no local artifact', () => {
    const directory = mkdtempSync(resolve(tmpdir(), 'chic-precache-'));
    temporaryDirectories.push(directory);
    mkdirSync(resolve(directory, 'dist'));
    writeFileSync(
      resolve(directory, 'dist/sw.js'),
      'precacheAndRoute([{url:"assets/missing.js"}]);'
    );

    const result = spawnSync(
      process.execPath,
      [resolve(process.cwd(), 'scripts/audit-precache.mjs')],
      {
        cwd: directory,
        encoding: 'utf8',
      }
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Missing precache artifacts: assets/missing.js');
  });
});
