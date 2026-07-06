// src/domain/classification.js
// Pure ChIC classification domain per the manuscript (spec §2). No Vue reactivity.
// All model constants come from the central config — no magic numbers here.
import { CONFIG } from '@/config/config.js'

export const CLASS_BASELINE = CONFIG.MODEL.CLASS_BASELINE_ML_PER_M // 600 ml/m at age 0
export const GROWTH_RATES = CONFIG.MODEL.GROWTH_RATE_CUTOFFS // [0.01, 0.02, 0.03, 0.04]

// One class letter cleared once the i-th ascending cutoff is met (A is below all).
const CLASS_LETTERS = ['B', 'C', 'D', 'E']
const PG_TO_LETTER = { PG1: 'A', PG2: 'B', PG3: 'C', PG4: 'D', PG5: 'E' }

/** Height-adjusted total liver volume: TLV (ml) / height (m). NaN if height invalid. */
export function heightAdjustedTLV(tlv, height) {
  const t = Number(tlv)
  const h = Number(height)
  if (!Number.isFinite(t) || !Number.isFinite(h) || h <= 0) return NaN
  return t / h
}

/** Charité Imaging Class A–E from unrounded htTLV and age (>= thresholds). */
export function classify(htTLV, age) {
  const h = Number(htTLV)
  const a = Number(age)
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null
  const curveAt = (rate) => CLASS_BASELINE * Math.pow(1 + rate, a)
  for (let i = GROWTH_RATES.length - 1; i >= 0; i--) {
    if (h >= curveAt(GROWTH_RATES[i])) return CLASS_LETTERS[i]
  }
  return 'A'
}

/** Compound annual growth rate g where htTLV = 600·(1+g)^age. Fraction (×100 for %). */
export function liverGrowthRate(age, htTLV) {
  const a = Number(age)
  const h = Number(htTLV)
  if (!Number.isFinite(a) || a <= 0 || !Number.isFinite(h) || h <= 0) return null
  return Math.pow(h / CLASS_BASELINE, 1 / a) - 1
}

/** 'A' → 'Class A'. Empty string for null/empty. */
export function formatClassLabel(letter) {
  return letter ? `Class ${letter}` : ''
}

/** Legacy import shim: 'PG1'→'A' … 'PG5'→'E'; letters pass through. */
export function legacyPgToLetter(code) {
  if (code == null) return null
  return PG_TO_LETTER[code] ?? String(code)
}

/** Display-only rounding of htTLV to 2dp. Never used for classification. */
export function formatHtTLV(htTLV) {
  return Number.isFinite(Number(htTLV)) ? Number(htTLV).toFixed(2) : ''
}

/** Class letter → CSS token: 'A' → 'class-a'. */
export function classToCssClass(letter) {
  return letter ? `class-${String(letter).toLowerCase()}` : ''
}
