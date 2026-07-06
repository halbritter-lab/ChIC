// src/config/config.js — single source of truth for all ChIC parameters.
// Clinical model per the ChIC manuscript (spec §2). No magic numbers elsewhere:
// the domain module and chart import their constants from here.
export const CONFIG = {
  // --- Clinical model (manuscript) ---
  MODEL: {
    CLASS_BASELINE_ML_PER_M: 600, // htTLV baseline at age 0
    GROWTH_RATE_CUTOFFS: [0.01, 0.02, 0.03, 0.04], // A/B, B/C, C/D, D/E boundaries
    ASSUMED_HEIGHT_M: 1.7, // fallback for height-less imports (flagged as estimate)
  },

  // --- Input validation ranges (D8: 15–85, fits manuscript + README) ---
  AGE_MIN: 15,
  AGE_MAX: 85,
  AGE_MIN_LGR: 0,
  TLV_MIN: 0,
  TLV_MAX: 20000,
  HEIGHT_MIN: 0.5,
  HEIGHT_MAX: 2.5,

  // --- Chart domain ---
  CHART_X_MIN: 15,
  CHART_X_MAX: 85,
  CHART_Y_MIN: 100, // log floor; must not clip small htTLV (<600)
  CHART_Y_MAX: 10500, // above cohort max htTLV 10344 (Table S1)
  CHART_Y_TICKS: [600, 800, 1000, 2000, 4000, 6000, 8000, 10000],

  // --- Class band colors (exact current values, migrated from .PG1–.PG5) ---
  CLASS_COLORS: {
    A: { band: 'rgba(60,60,60,0.24)', border: '#000000' },
    B: { band: 'rgba(43,27,111,0.20)', border: '#2B1B6F' },
    C: { band: '#8E9BFF33', border: '#8E9BFF' },
    D: { band: '#64C8FF33', border: '#64C8FF' },
    E: { band: '#BFE9FF33', border: '#BFE9FF' },
  },
  DEFAULT_POINT_COLOR: '#180C0C',

  // --- UI ---
  MODAL_MAX_WIDTH: '500px',
  MODAL_MAX_HEIGHT: '90%',
}
