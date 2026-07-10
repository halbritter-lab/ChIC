import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('src/components/ChartDisplay.vue'), 'utf8');

describe('ChartDisplay module registration', () => {
  it('does not retain all Chart.js registerables', () => {
    expect(source).not.toContain('registerables');
    for (const name of [
      'ScatterController',
      'LineController',
      'LineElement',
      'PointElement',
      'LinearScale',
      'LogarithmicScale',
      'Tooltip',
      'Filler',
    ]) {
      expect(source).toContain(name);
    }
  });

  it('preserves order-sensitive labels and fill targets', () => {
    expect(source).toContain("label: 'Patient Data'");
    expect(source).toContain("label: 'Selected Point'");
    expect(source).toContain("fill: '+1'");
    expect(source).toContain("fill: '-1'");
    expect(source).toContain('order: 4.4');
  });

  it('clears the SVG overlay without redrawing selected props from clearChart', () => {
    expect(source).toContain('const clearRingOverlay = () =>');
    const clearChart = source.match(/const clearChart = \(\) => \{([\s\S]*?)\n\};/)?.[1];
    expect(clearChart).toContain('clearRingOverlay();');
    expect(clearChart).not.toContain('drawRingOverlay();');
  });
});
