import { describe, it, expect } from 'vitest';
import { CONFIG } from '@/config/config.js';

describe('chart y-axis origin', () => {
  it('floors the log y-axis at the model baseline so the origin is (15, 600)', () => {
    // Reported issue: origin looked like (15, 0). The clinical model has nothing
    // below the class-A baseline (600 ml/m), so the axis must start there.
    expect(CONFIG.CHART_Y_MIN).toBe(CONFIG.MODEL.CLASS_BASELINE_ML_PER_M);
    expect(CONFIG.CHART_Y_MIN).toBe(600);
  });

  it('keeps the first labelled tick equal to the axis floor (no dead-zone below it)', () => {
    expect(Math.min(...CONFIG.CHART_Y_TICKS)).toBe(CONFIG.CHART_Y_MIN);
  });
});
