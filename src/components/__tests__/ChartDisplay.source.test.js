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

  it('hides threshold fill datasets from the tooltip (issue #36)', () => {
    // The two T1 fills share Threshold 1's points, so a 'nearest' tooltip over T1 ties on all
    // three; isFill + the tooltip filter drop the fills so only the line shows.
    expect(source).toContain('filter: (item) => !(item.dataset && item.dataset.isFill)');
    // Left polygon fill + the two T1 band fills.
    expect((source.match(/isFill: true/g) || []).length).toBeGreaterThanOrEqual(3);
  });

  it('clears the SVG overlay without redrawing selected props from clearChart', () => {
    expect(source).toContain('const clearRingOverlay = () =>');
    const clearChart = source.match(/const clearChart = \(\) => \{([\s\S]*?)\n\};/)?.[1];
    expect(clearChart).toContain('clearRingOverlay();');
    expect(clearChart).not.toContain('drawRingOverlay();');
  });
});
