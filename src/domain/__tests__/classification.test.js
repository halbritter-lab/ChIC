import { describe, it, expect } from 'vitest'
import {
  heightAdjustedTLV,
  classify,
  liverGrowthRate,
  formatClassLabel,
  legacyPgToLetter,
  formatHtTLV,
  classToCssClass,
  CLASS_BASELINE,
  GROWTH_RATES,
} from '../classification.js'

const curve = (rate, age) => CLASS_BASELINE * Math.pow(1 + rate, age)
const EPS = 1e-6

describe('heightAdjustedTLV', () => {
  it('divides TLV by height in metres', () => {
    expect(heightAdjustedTLV(3400, 1.7)).toBeCloseTo(2000, 6)
  })
  it('returns NaN for non-positive or invalid height', () => {
    expect(Number.isNaN(heightAdjustedTLV(3400, 0))).toBe(true)
    expect(Number.isNaN(heightAdjustedTLV(3400, -1))).toBe(true)
    expect(Number.isNaN(heightAdjustedTLV(3400, null))).toBe(true)
  })
})

describe('classify — full boundary + epsilon for every cutoff', () => {
  for (const age of [15, 50, 85]) {
    it(`A just below the 1% curve (age ${age})`, () => {
      expect(classify(curve(0.01, age) - EPS, age)).toBe('A')
    })
    it(`B at the 1% curve and just below 2% (age ${age})`, () => {
      expect(classify(curve(0.01, age), age)).toBe('B')
      expect(classify(curve(0.02, age) - EPS, age)).toBe('B')
    })
    it(`C at the 2% curve and just below 3% (age ${age})`, () => {
      expect(classify(curve(0.02, age), age)).toBe('C')
      expect(classify(curve(0.03, age) - EPS, age)).toBe('C')
    })
    it(`D at the 3% curve and just below 4% (age ${age})`, () => {
      expect(classify(curve(0.03, age), age)).toBe('D')
      expect(classify(curve(0.04, age) - EPS, age)).toBe('D')
    })
    it(`E at/above the 4% curve (age ${age})`, () => {
      expect(classify(curve(0.04, age), age)).toBe('E')
      expect(classify(curve(0.04, age) + EPS, age)).toBe('E')
    })
  }
  it('returns null for invalid inputs', () => {
    expect(classify(NaN, 50)).toBeNull()
    expect(classify(2000, NaN)).toBeNull()
  })
  it('CLASS letters match the number of growth cutoffs', () => {
    expect(GROWTH_RATES.length).toBe(4)
  })
})

describe('liverGrowthRate', () => {
  it('recovers the compound annual growth rate', () => {
    const age = 40
    const g = 0.025
    const htTLV = CLASS_BASELINE * Math.pow(1 + g, age)
    expect(liverGrowthRate(age, htTLV)).toBeCloseTo(g, 10)
  })
  it('returns null for non-positive age or htTLV', () => {
    expect(liverGrowthRate(0, 1000)).toBeNull()
    expect(liverGrowthRate(40, 0)).toBeNull()
  })
})

describe('labels, legacy shim, display rounding, css', () => {
  it('formats class labels', () => {
    expect(formatClassLabel('C')).toBe('Class C')
    expect(formatClassLabel(null)).toBe('')
  })
  it('maps legacy PG codes to letters, passes letters through', () => {
    expect(legacyPgToLetter('PG1')).toBe('A')
    expect(legacyPgToLetter('PG5')).toBe('E')
    expect(legacyPgToLetter('B')).toBe('B')
    expect(legacyPgToLetter(null)).toBeNull()
  })
  it('display rounding is independent of classification', () => {
    expect(formatHtTLV(1999.996)).toBe('2000.00')
    expect(formatHtTLV(632)).toBe('632.00')
    expect(formatHtTLV('x')).toBe('')
  })
  it('maps class letter to a css class token', () => {
    expect(classToCssClass('A')).toBe('class-a')
    expect(classToCssClass('E')).toBe('class-e')
    expect(classToCssClass(null)).toBe('')
  })
})
