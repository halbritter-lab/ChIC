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

  // New liver growth rate formula per your specification:
  // LGR = ((((htTLV)^(1/age))/600)-1)*100
  calculateLiverGrowthRate: (age, htlv) => {
    const a = Number(age);
    const h = Number(htlv);
    if (!Number.isFinite(a) || a <= 0) return null;
    if (!Number.isFinite(h) || h <= 0) return null;
    const root = Math.pow(h, 1 / a);
    return ((root / 600) - 1) * 100;
  }
  // Add more formulas as needed
};
