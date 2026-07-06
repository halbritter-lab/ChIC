// src/config/formulasConfig.js — thin compatibility layer over the domain module.
// Threshold constants come from CONFIG (no hardcoded 600 / 1.01–1.04); LGR delegates
// to the single domain implementation. Existing callers (App.vue, ChartDisplay.vue,
// useDataPersistence.js) keep working until they are migrated to the domain module.
import { CONFIG } from '@/config/config.js'
import { liverGrowthRate } from '@/domain/classification.js'

const BASE = CONFIG.MODEL.CLASS_BASELINE_ML_PER_M
const [R1, R2, R3, R4] = CONFIG.MODEL.GROWTH_RATE_CUTOFFS
const curveAt = (rate, age) => BASE * Math.pow(1 + rate, age)

export const formulas = {
  // Four threshold curves (config-driven).
  calculateThreshold01: (age) => curveAt(R1, age),
  calculateThreshold02: (age) => curveAt(R2, age),
  calculateThreshold03: (age) => curveAt(R3, age),
  calculateThreshold04: (age) => curveAt(R4, age),

  // Backwards-compatible aliases still used by the (soon-migrated) import path.
  calculatePG3Threshold: (age) => curveAt(R4, age),
  calculatePG2Threshold: (age) => curveAt(R3, age),

  // Config-driven helpers for new callers.
  thresholdFor: (rate, age) => curveAt(rate, age),
  curves: CONFIG.MODEL.GROWTH_RATE_CUTOFFS.map((r) => (age) => curveAt(r, age)),

  // Single source of truth for LGR (domain module).
  calculateLiverGrowthRate: liverGrowthRate,
}
