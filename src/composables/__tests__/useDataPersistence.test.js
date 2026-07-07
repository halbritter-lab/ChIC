import { describe, it, expect } from 'vitest';
import { processRows, buildExportRows, parseCsv, toCsv } from '../useDataPersistence.js';
import { CONFIG } from '@/config/config.js';
import { heightAdjustedTLV, classify, formatHtTLV } from '@/domain/classification.js';

// Mirror the row-object assembly that loadDataFromCsv performs after parseCsv,
// so tests can exercise the import path down to processRows without the DOM.
// Cells are kept as strings (null for blank); processRows() does the coercion.
function csvToRowObjects(text) {
  const matrix = parseCsv(text);
  const headers = matrix[0].map((h) => h.trim());
  return matrix.slice(1).map((cells) => {
    const row = {};
    headers.forEach((header, i) => {
      const v = cells[i] === undefined ? '' : cells[i].trim();
      row[header] = v === '' ? null : v;
    });
    return row;
  });
}

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

  it('drops rows whose id is blank or whitespace-only', () => {
    const out = processRows([
      { id: 'ok', age: 40, tlv: 3400, height: 1.7 },
      { id: '', age: 40, tlv: 3400, height: 1.7 }, // empty id
      { id: '   ', age: 40, tlv: 3400, height: 1.7 }, // whitespace id
    ]);
    expect(out.map((r) => r.id)).toEqual(['ok']);
  });
});

describe('processRows — export/import header aliasing (round-trip)', () => {
  it('re-imports the app’s own export headers and preserves ids (incl. leading zeros)', () => {
    const first = processRows([
      { id: '007', age: 40, tlv: 3400, height: 1.7 }, // measured, leading-zero id
      { id: 'e1', age: 50, tlv: 3400 }, // height-less -> estimated
    ]);
    const reimported = processRows(buildExportRows(first)); // keys: ID, Age (y), Height (m)...
    expect(reimported.map((r) => r.id)).toEqual(['007', 'e1']);

    const m = reimported.find((r) => r.id === '007');
    expect(m.htlvEstimated).toBe(false);
    expect(m.class).toBe(first[0].class); // measured class stable across round-trip

    const e = reimported.find((r) => r.id === 'e1');
    expect(e.htlvEstimated).toBe(true); // height-less row stays an estimate
    expect(e.class).toBeNull();
  });

  it('accepts a lowercase-id string verbatim without numeric coercion', () => {
    const [r] = processRows(csvToRowObjects('id,age,tlv,height\n"00123",40,3400,1.7'));
    expect(r.id).toBe('00123');
  });

  it('falls back to a header alias when the canonical key is blank/whitespace', () => {
    const [r] = processRows([
      { id: '   ', ID: '007', 'Age (y)': 40, 'TLV (ml)': 3400, 'Height (m)': 1.7 },
    ]);
    expect(r.id).toBe('007');
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

describe('parseCsv — quote-aware parsing', () => {
  it('keeps a comma inside a quoted field as one cell', () => {
    expect(parseCsv('id,group\np1,"North, Ward"')).toEqual([
      ['id', 'group'],
      ['p1', 'North, Ward'],
    ]);
  });

  it('unescapes doubled quotes inside a quoted field', () => {
    expect(parseCsv('a\n"say ""hi"""')).toEqual([['a'], ['say "hi"']]);
  });

  it('tolerates CRLF line endings and a trailing newline', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('preserves a newline inside a quoted field', () => {
    expect(parseCsv('a\n"line1\nline2"')).toEqual([['a'], ['line1\nline2']]);
  });

  it('import path preserves a comma-containing group label end to end', () => {
    const rows = csvToRowObjects('id,age,tlv,height,group\np1,40,3400,1.7,"North, Ward"');
    const [r] = processRows(rows);
    expect(r.id).toBe('p1');
    expect(r.group).toBe('North, Ward');
    expect(r.htlvEstimated).toBe(false);
  });

  it('flushes a final empty quoted field with or without a trailing newline', () => {
    // EOF shape must not change the row count.
    expect(parseCsv('id\n""')).toEqual([['id'], ['']]);
    expect(parseCsv('id\n""\n')).toEqual([['id'], ['']]);
  });

  it('throws on an unterminated quoted field instead of importing garbage', () => {
    expect(() => parseCsv('id\n"abc')).toThrow(/unterminated/i);
  });

  it('strips a leading UTF-8 BOM so the first header is clean', () => {
    expect(parseCsv('\uFEFFid,age\np1,40')).toEqual([
      ['id', 'age'],
      ['p1', '40'],
    ]);
  });
});

describe('toCsv — correct quoting (symmetric with parseCsv)', () => {
  it('quotes only fields containing a comma, quote, or newline', () => {
    const csv = toCsv([{ ID: 'x', Group: 'A, B' }], ['ID', 'Group']);
    expect(csv).toBe('ID,Group\nx,"A, B"');
  });

  it('doubles interior quotes', () => {
    const csv = toCsv([{ ID: 'x', Group: 'a"b' }], ['ID', 'Group']);
    expect(csv).toBe('ID,Group\nx,"a""b"');
  });

  it('round-trips a comma-containing value through toCsv -> parseCsv', () => {
    const value = 'North, Ward';
    const csv = toCsv([{ Group: value }], ['Group']);
    expect(parseCsv(csv)[1][0]).toBe(value);
  });
});
