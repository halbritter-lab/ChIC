import { describe, it, expect } from 'vitest';
import { processRows, buildExportRows } from '../useDataPersistence.js';
import { CONFIG } from '@/config/config.js';
import { heightAdjustedTLV, classify, formatHtTLV } from '@/domain/classification.js';

const ASSUMED = CONFIG.MODEL.ASSUMED_HEIGHT_M; // 1.70

describe('processRows — measured height', () => {
  it('matches the manual domain classify path and flags as validated', () => {
    const [r] = processRows([{ id: 'p1', age: 40, tlv: 3400, height: 1.7 }]);
    const expectedHtlv = heightAdjustedTLV(3400, 1.7); // 2000
    expect(r.htlv).toBeCloseTo(expectedHtlv, 6);
    expect(r.htlvEstimated).toBe(false);
    expect(r.class).toBe(classify(expectedHtlv, 40));
    expect(r.estimatedHtTLV).toBeNull();
    expect(r.estimatedClass).toBeNull();
  });

  it('parses comma-decimal heights', () => {
    const [r] = processRows([{ id: 'p1', age: 40, tlv: 3400, height: '1,7' }]);
    expect(r.htlvEstimated).toBe(false);
    expect(r.htlv).toBeCloseTo(2000, 6);
  });
});

describe('processRows — cohort-mean estimate before global fallback', () => {
  it('uses the mean of present heights (1.6 & 1.8 -> 1.7) for a height-less row', () => {
    const out = processRows([
      { id: 'a', age: 50, tlv: 3200, height: 1.6 },
      { id: 'b', age: 50, tlv: 3600, height: 1.8 },
      { id: 'c', age: 50, tlv: 3400 }, // no height
    ]);
    const c = out.find((r) => r.id === 'c');
    const expected = heightAdjustedTLV(3400, 1.7);
    expect(c.htlvEstimated).toBe(true);
    expect(c.estimatedHtTLV).toBeCloseTo(expected, 6);
    expect(c.estimatedClass).toBe(classify(expected, 50));
  });

  it('prefers the cohort mean over the assumed fallback (asymmetric mean 1.8)', () => {
    const c = processRows([
      { id: 'a', age: 50, tlv: 3000, height: 1.6 },
      { id: 'b', age: 50, tlv: 3000, height: 2.0 }, // mean = 1.8
      { id: 'c', age: 50, tlv: 3400 },
    ]).find((r) => r.id === 'c');
    expect(c.estimatedHtTLV).toBeCloseTo(heightAdjustedTLV(3400, 1.8), 6);
    // and NOT the assumed-height fallback
    expect(c.estimatedHtTLV).not.toBeCloseTo(heightAdjustedTLV(3400, ASSUMED), 3);
  });

  it('falls back to the assumed height when no row has a height', () => {
    const [r] = processRows([{ id: 'c', age: 50, tlv: 3400 }]);
    expect(r.htlvEstimated).toBe(true);
    expect(r.estimatedHtTLV).toBeCloseTo(heightAdjustedTLV(3400, ASSUMED), 6);
  });
});

describe('processRows — estimated rows carry no validated class', () => {
  it('leaves class null and sets estimatedClass', () => {
    const [r] = processRows([{ id: 'x', age: 30, tlv: 5000 }]);
    expect(r.class).toBeNull();
    expect(r.estimatedClass).toBe(classify(heightAdjustedTLV(5000, ASSUMED), 30));
    expect(typeof r.estimatedClass).toBe('string');
  });
});

describe('processRows — validation', () => {
  it('drops malformed / out-of-range rows', () => {
    const out = processRows([
      { id: 'ok', age: 40, tlv: 3400, height: 1.7 },
      { age: 40, tlv: 3400 }, // missing id
      { id: 'noage', tlv: 3400 }, // missing age
      { id: 'notlv', age: 40 }, // missing tlv
      { id: 'badage', age: 5, tlv: 3400 }, // age below AGE_MIN
      { id: 'bigtlv', age: 40, tlv: 999999 }, // tlv above TLV_MAX
      { id: 'nan', age: 'abc', tlv: 3400 }, // non-numeric age
      null, // junk
    ]);
    expect(out.map((r) => r.id)).toEqual(['ok']);
  });

  it('returns [] for non-array input', () => {
    expect(processRows(null)).toEqual([]);
    expect(processRows(undefined)).toEqual([]);
  });
});

describe('processRows — legacy pg is informational, class is recomputed', () => {
  it('maps an incoming legacy pg but does not trust it for classification', () => {
    const [r] = processRows([{ id: 'p', age: 40, tlv: 1100, height: 1.7, pg: 'PG5' }]);
    expect(r.importedClass).toBe('E'); // legacyPgToLetter('PG5')
    expect(r.class).toBe(classify(heightAdjustedTLV(1100, 1.7), 40)); // recomputed from data
    expect(r.class).not.toBe(r.importedClass); // file label not trusted
  });

  it('passes a letter class column through the legacy shim', () => {
    const [r] = processRows([{ id: 'p', age: 40, tlv: 3400, height: 1.7, class: 'C' }]);
    expect(r.importedClass).toBe('C');
  });
});

describe('buildExportRows', () => {
  it('includes the three estimate columns and separates measured vs estimated rows', () => {
    const points = processRows([
      { id: 'm', age: 40, tlv: 3400, height: 1.7 },
      { id: 'e', age: 40, tlv: 3400 }, // height-less -> estimated
    ]);
    const ex = buildExportRows(points);

    expect(Object.keys(ex[0])).toEqual(
      expect.arrayContaining(['htTLV_estimated', 'estimatedHtTLV', 'estimatedClass'])
    );

    const m = ex.find((r) => r.ID === 'm');
    expect(m.htTLV_estimated).toBe(false);
    expect(m.Class).toBe(classify(heightAdjustedTLV(3400, 1.7), 40));
    expect(m.estimatedHtTLV).toBe('');
    expect(m.estimatedClass).toBe('');

    const e = ex.find((r) => r.ID === 'e');
    expect(e.htTLV_estimated).toBe(true);
    expect(e.Class).toBe('');
    expect(e.estimatedHtTLV).toBe(formatHtTLV(heightAdjustedTLV(3400, ASSUMED)));
    expect(e.estimatedClass).toBe(classify(heightAdjustedTLV(3400, ASSUMED), 40));
  });

  it('returns [] for non-array input', () => {
    expect(buildExportRows(null)).toEqual([]);
  });
});
