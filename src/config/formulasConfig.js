// formulasConfig.js
export const formulas = {
  // Four threshold curves as requested:
  // htTLV = 600 * (1.01)^age
  calculateThreshold01: (age) => 600 * Math.pow(1.01, age),
  // htTLV = 600 * (1.02)^age
  calculateThreshold02: (age) => 600 * Math.pow(1.02, age),
  // htTLV = 600 * (1.03)^age
  calculateThreshold03: (age) => 600 * Math.pow(1.03, age),
  // htTLV = 600 * (1.04)^age
  calculateThreshold04: (age) => 600 * Math.pow(1.04, age),

  // Backwards-compatible names used elsewhere in the app:
  calculatePG3Threshold: (age) => formulas.calculateThreshold04(age),
  calculatePG2Threshold: (age) => formulas.calculateThreshold03(age),

  generateLineData1: (length, startAge) => Array.from({ length }, (_, i) => {
    const age = startAge + i;
    return { x: age, y: formulas.calculateThreshold04(age) };
  }),
  generateLineData2: (length, startAge) => Array.from({ length }, (_, i) => {
    const age = startAge + i;
    return { x: age, y: formulas.calculateThreshold03(age) };
  }),

  // Updated liver growth rate formula per requested steps:
  // 1) divide htTLV by 600
  // 2) take the age-th root of that: (htTLV / 600)^(1/age)
  // 3) subtract 1
  // 4) divide by 100
  // LGR = ((htTLV / 600)^(1/age) - 1) / 100
  calculateLiverGrowthRate: (age, htlv) => {
    const a = Number(age);
    const h = Number(htlv);
    if (!Number.isFinite(a) || a <= 0) return null;
    if (!Number.isFinite(h) || h <= 0) return null;
    const ratio = h / 600;
    const root = Math.pow(ratio, 1 / a);
    // Return fractional annual growth rate (e.g., 0.03 for 3%/y)
    return root - 1;
  }
  // Add more formulas as needed
};
