import { ref } from 'vue';
import { CONFIG } from '@/config/config';
import {
  heightAdjustedTLV,
  classify,
  liverGrowthRate,
  legacyPgToLetter,
  formatHtTLV,
} from '@/domain/classification.js';

// Column order shared by every export format.
const EXPORT_COLUMNS = [
  'ID',
  'Age (y)',
  'Height (m)',
  'TLV (ml)',
  'htTLV',
  'Class',
  'LGR (%/y)',
  'Group',
  'GroupColor',
];

// Parse a height cell (may use a comma decimal separator). Returns a positive number or null.
function parseHeight(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const h = Number(String(raw).replace(',', '.'));
  return Number.isFinite(h) && h > 0 ? h : null;
}

// First present, non-blank value among the given keys (empty / whitespace-only counts
// as absent, so a blank canonical key falls back to a populated header alias).
function pick(row, keys) {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return undefined;
}

/**
 * Map a raw file row to the canonical lowercase shape, accepting BOTH the import
 * template headers (`id,age,tlv,height,group,groupColor`) AND the app's own export
 * headers (`ID`, `Age (y)`, `TLV (ml)`, `Height (m)`, `Group`, `GroupColor`, `Class`).
 * Without this, re-importing an exported JSON/CSV/Excel file drops every row because
 * the keys never match (issue #5, round-trip). Computed export columns (htTLV, LGR,
 * estimate flags) are intentionally ignored — class is always recomputed from the data.
 */
function normalizeImportRow(row) {
  if (row == null || typeof row !== 'object') return null;
  return {
    id: pick(row, ['id', 'ID']),
    age: pick(row, ['age', 'Age (y)', 'Age (years)']),
    height: pick(row, ['height', 'Height (m)']),
    tlv: pick(row, ['tlv', 'TLV (ml)', 'Total Liver Volume']),
    group: pick(row, ['group', 'Group']),
    groupColor: pick(row, ['groupColor', 'GroupColor']),
    pg: pick(row, ['pg', 'PG']),
    class: pick(row, ['class', 'Class']),
  };
}

/**
 * Pure import transform: raw file rows -> canonical data-point rows.
 * - A usable (non-blank) `id` is the one hard requirement; rows without it are dropped
 *   (an id keys the table and export). Everything else is kept.
 * - A row is CLASSIFIED only when age, TLV, and height are all present and in range
 *   (AGE_MIN/MAX, TLV_MIN/MAX, HEIGHT_MIN/MAX). ChIC classifies on height-adjusted TLV,
 *   so a missing or out-of-range height is treated exactly like a missing age or TLV.
 * - Otherwise the row is kept but flagged `uncalculable: true` with htlv/class null and
 *   lgr 'N/A'. It is shown in the table as "N/A" and is NOT plotted (issue #37 — height
 *   is no longer estimated from a cohort mean, because the plausible height range is too
 *   wide to guess).
 * - Any incoming legacy `pg`/`class` is mapped for information only; class is always
 *   recomputed from the data.
 */
export function processRowsWithSummary(rawRows) {
  const summary = { rows: [], malformedCount: 0, missingIdCount: 0 };
  if (!Array.isArray(rawRows)) return summary;

  for (const rawRow of rawRows) {
    const row = normalizeImportRow(rawRow);
    if (row == null) {
      summary.malformedCount += 1;
      continue;
    }
    const id = row.id == null ? '' : String(row.id).trim();
    if (id === '') {
      summary.missingIdCount += 1;
      continue;
    }

    // Informational only — the file's own class label is never trusted for classification.
    const importedClass = legacyPgToLetter(row.pg ?? row.class ?? null);

    const age = row.age == null ? NaN : Number(row.age);
    const tlv = row.tlv == null ? NaN : Number(row.tlv);
    const height = parseHeight(row.height); // positive number or null

    const ageOk = Number.isFinite(age) && age >= CONFIG.AGE_MIN && age <= CONFIG.AGE_MAX;
    const tlvOk = Number.isFinite(tlv) && tlv >= CONFIG.TLV_MIN && tlv <= CONFIG.TLV_MAX;
    const heightOk = height !== null && height >= CONFIG.HEIGHT_MIN && height <= CONFIG.HEIGHT_MAX;

    const base = {
      id,
      // Keep finite values for display (incl. out-of-range, so the user sees the offending
      // number); drop non-numeric to null (blank cell).
      age: Number.isFinite(age) ? age : null,
      height, // number (may be out of range) or null
      tlv: Number.isFinite(tlv) ? tlv : null,
      importedClass,
      group: row.group || '',
      groupColor: row.groupColor || null,
    };

    if (!(ageOk && tlvOk && heightOk)) {
      summary.rows.push({ ...base, htlv: null, class: null, lgr: 'N/A', uncalculable: true });
      continue;
    }

    const htlv = heightAdjustedTLV(tlv, height);
    const cls = classify(htlv, age);
    const lgrFraction = age >= CONFIG.AGE_MIN_LGR ? liverGrowthRate(age, htlv) : null;
    summary.rows.push({
      ...base,
      htlv,
      class: cls,
      lgr: lgrFraction !== null ? (lgrFraction * 100).toFixed(2) : 'N/A',
      uncalculable: false,
    });
  }
  return summary;
}

export function processRows(rawRows) {
  return processRowsWithSummary(rawRows).rows;
}

const plural = (count) => (count === 1 ? '' : 's');

export function prepareImport(rawRows) {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return { rows: [], error: 'No rows found — nothing imported.', notice: null };
  }

  const { rows, malformedCount, missingIdCount } = processRowsWithSummary(rawRows);
  const skipped = [];
  if (missingIdCount > 0) {
    skipped.push(`${missingIdCount} row${plural(missingIdCount)} skipped (missing or blank ID)`);
  }
  if (malformedCount > 0) {
    skipped.push(`${malformedCount} malformed row${plural(malformedCount)} skipped`);
  }

  if (rows.length === 0) {
    return {
      rows: [],
      error: `No usable rows found — nothing imported. ${skipped.join('. ')}.`,
      notice: null,
    };
  }

  const uncalculableCount = rows.filter((row) => row.uncalculable).length;
  const notices = [...skipped];
  if (uncalculableCount > 0) {
    notices.push(
      `${uncalculableCount} row${plural(uncalculableCount)} could not be calculated ` +
        `(missing or out-of-range height, age and TLV) — shown as N/A in table and not plotted`
    );
  }

  return {
    rows,
    error: null,
    notice: notices.length > 0 ? `${notices.join('. ')}.` : null,
  };
}

/** Pure export transform: canonical rows -> export-shaped rows (one object per row). */
export function buildExportRows(points) {
  if (!Array.isArray(points)) return [];
  return points.map((p) => ({
    ID: p.id,
    'Age (y)': p.age ?? '',
    'Height (m)': p.height ?? '',
    'TLV (ml)': p.tlv ?? '',
    htTLV: p.htlv != null ? formatHtTLV(p.htlv) : '',
    // Uncalculable rows carry an explicit 'N/A' so an exported file shows they could not
    // be classified (rather than a blank that reads like "not filled in").
    Class: p.uncalculable ? 'N/A' : (p.class ?? ''),
    'LGR (%/y)': p.lgr,
    Group: p.group || '',
    GroupColor: p.groupColor || '',
  }));
}

/**
 * Minimal RFC-4180-ish CSV parser (dependency-free). Handles double-quoted
 * fields, escaped quotes (`""` -> `"`), commas and newlines inside quotes, a
 * leading UTF-8 BOM, and CRLF / CR / LF line endings. Returns an array of rows,
 * each an array of raw string cells. Replaces naive `split('\n')`/`split(',')`,
 * which corrupted any field containing a comma (e.g. a group label).
 *
 * `started` tracks whether the current record has begun, so a final record is
 * flushed even when its only cell is an empty quoted string (`""`) and a trailing
 * newline does not change the row count. Throws on an unterminated quote rather
 * than silently importing a malformed field.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let started = false; // current record has any field/quote/comma yet?
  const s = String(text ?? '').replace(/^\uFEFF/, ''); // strip leading BOM
  const endRow = () => {
    row.push(field);
    rows.push(row);
    row = [];
    field = '';
    started = false;
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++; // consume the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      started = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
      started = true;
    } else if (c === '\n' || c === '\r') {
      endRow();
      if (c === '\r' && s[i + 1] === '\n') i++; // treat CRLF as one line break
    } else {
      field += c;
      started = true;
    }
  }
  if (inQuotes) throw new Error('Malformed CSV: unterminated quoted field.');
  // Flush a final record that had content but no trailing line break.
  if (started || field !== '' || row.length > 0) endRow();
  return rows;
}

/**
 * Quote a CSV field only when it contains a comma, double quote, or newline.
 * A leading `=`, `+`, `-`, `@`, tab, or CR is prefixed with an apostrophe so
 * spreadsheets treat the cell as text, not a formula (CWE-1236 — user-controlled
 * ID/Group/GroupColor round-trip through import unchecked). Plain numbers are
 * exempt: a negative LGR like `-1.23` is inert and must stay numeric.
 */
function csvEscape(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(?:\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a well-formed CSV string from export rows keyed by `columns`. */
export function toCsv(rows, columns) {
  const header = columns.map(csvEscape).join(',');
  const body = rows.map((row) => columns.map((col) => csvEscape(row[col])).join(','));
  return [header, ...body].join('\n');
}

export function useDataPersistence() {
  const loadedData = ref([]); // Ref to hold data loaded from files
  const errorLoading = ref(null); // Ref to hold any loading errors
  // Non-error notice, e.g. "N rows skipped" — surfaced separately from errorLoading.
  const loadNotice = ref(null);

  const applyLoaded = (rawRows) => {
    const outcome = prepareImport(rawRows);
    loadedData.value = outcome.rows;
    errorLoading.value = outcome.error;
    loadNotice.value = outcome.notice;
  };

  // --- Internal File Input Handling ---
  let fileInput = null;

  const handleFileSelected = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    errorLoading.value = null; // Reset error on new attempt
    loadNotice.value = null; // Reset skipped-row notice on new attempt
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.json')) {
      loadDataFromJson(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      loadDataFromExcel(file);
    } else if (fileName.endsWith('.csv')) {
      loadDataFromCsv(file);
    } else {
      console.error('Unsupported file type.');
      errorLoading.value = 'Unsupported file type. Please select a .json, .csv, or .xlsx file.';
      loadedData.value = []; // Clear data on error
    }

    // Clean up the temporary input element
    if (fileInput && fileInput.parentNode) {
      fileInput.parentNode.removeChild(fileInput);
    }
    fileInput = null;
  };

  const triggerLoad = () => {
    // Create a temporary file input element
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept =
      '.json, .xlsx, .xls, .csv, application/json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', handleFileSelected);
    document.body.appendChild(fileInput); // Add to body to ensure it's clickable
    fileInput.click();
  };

  // --- Data Loading Logic ---

  const loadDataFromJson = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileData = JSON.parse(e.target.result);
        if (!Array.isArray(fileData)) {
          throw new Error('JSON file does not contain an array.');
        }
        applyLoaded(fileData);
      } catch (err) {
        console.error('Error loading JSON data:', err);
        errorLoading.value = `Error loading JSON: ${err.message}`;
        loadedData.value = [];
        loadNotice.value = null;
      }
    };
    reader.onerror = (err) => {
      console.error('FileReader error:', err);
      errorLoading.value = 'Error reading file.';
      loadedData.value = [];
    };
    reader.readAsText(file);
  };

  const loadDataFromExcel = async (file) => {
    try {
      const ExcelJS = (await import('exceljs')).default;
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error('Excel file contains no sheets.');
      }

      // Convert worksheet to an array of row objects keyed by header.
      const jsonData = [];
      const headerRow = worksheet.getRow(1);
      const headers = [];
      headerRow.eachCell((cell, colNumber) => {
        headers[colNumber] = cell.value;
      });

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row
        const rowData = {};
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber];
          if (header) {
            rowData[header] = cell.value;
          }
        });
        jsonData.push(rowData);
      });

      applyLoaded(jsonData);
    } catch (err) {
      console.error('Error reading Excel data:', err);
      errorLoading.value = `Error loading Excel: ${err.message}`;
      loadedData.value = [];
      loadNotice.value = null;
    }
  };

  const loadDataFromCsv = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const matrix = parseCsv(e.target.result);
        if (matrix.length < 2) {
          throw new Error('CSV file is empty or contains only headers.');
        }

        // Parse header row
        const headers = matrix[0].map((h) => h.trim());
        const jsonData = [];

        // Parse data rows
        for (let r = 1; r < matrix.length; r++) {
          const cells = matrix[r];
          if (cells.every((v) => v.trim() === '')) continue; // Skip blank lines

          const rowData = {};
          headers.forEach((header, index) => {
            const raw = cells[index];
            const value = raw === undefined ? '' : raw.trim();
            // Keep cells as strings (null for blank). processRows() does the numeric
            // coercion for age/tlv/height and preserves ids verbatim, so a leading-zero
            // id like "00123" is not corrupted into a number.
            rowData[header] = value === '' ? null : value;
          });

          jsonData.push(rowData);
        }

        if (jsonData.length === 0) {
          throw new Error('CSV contains no data rows.');
        }

        applyLoaded(jsonData);
      } catch (err) {
        console.error('Error loading CSV data:', err);
        errorLoading.value = `Error loading CSV: ${err.message}`;
        loadedData.value = [];
        loadNotice.value = null;
      }
    };
    reader.onerror = (err) => {
      console.error('FileReader error:', err);
      errorLoading.value = 'Error reading file.';
      loadedData.value = [];
    };
    reader.readAsText(file);
  };

  // --- Data Saving Logic ---

  const saveDataAsJson = (dataToSave) => {
    if (!Array.isArray(dataToSave)) {
      console.error('Data to save is not an array');
      return;
    }
    const dataStr = JSON.stringify(buildExportRows(dataToSave), null, 2); // Pretty print JSON
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `pld_data_${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const downloadDataAsExcel = async (dataToSave) => {
    if (!Array.isArray(dataToSave)) {
      console.error('Data to save is not an array');
      return;
    }
    try {
      const ExcelJS = (await import('exceljs')).default;
      const worksheetData = buildExportRows(dataToSave);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('PLD_Data');

      // Number formats keyed by column header.
      const numFmts = {
        'Age (y)': '0',
        'Height (m)': '0.00',
        'TLV (ml)': '0',
        htTLV: '0.00',
        'LGR (%/y)': '0.00',
      };
      worksheet.columns = EXPORT_COLUMNS.map((col) =>
        numFmts[col] ? { header: col, key: col, numFmt: numFmts[col] } : { header: col, key: col }
      );

      worksheet.addRows(worksheetData);

      // Generate buffer and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const fileName = `pld_data_${new Date().toISOString().split('T')[0]}.xlsx`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', url);
      linkElement.setAttribute('download', fileName);
      linkElement.click();

      // Clean up
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error writing Excel file:', err);
    }
  };

  const downloadDataAsCsv = (dataToSave) => {
    if (!Array.isArray(dataToSave)) {
      console.error('Data to save is not an array');
      return;
    }
    try {
      // Build a well-formed CSV: fields containing a comma/quote/newline are quoted
      // so a group label with a comma cannot corrupt the file (symmetric with parseCsv).
      const csvContent = toCsv(buildExportRows(dataToSave), EXPORT_COLUMNS);

      // Use the same approach as JSON - data URI
      const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
      const exportFileDefaultName = `pld_data_${new Date().toISOString().split('T')[0]}.csv`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      document.body.appendChild(linkElement);
      linkElement.click();
      document.body.removeChild(linkElement);
    } catch (err) {
      console.error('Error writing CSV file:', err);
    }
  };

  // --- Return public API ---
  return {
    triggerLoad,
    saveDataAsJson,
    downloadDataAsExcel,
    downloadDataAsCsv,
    loadedData, // The reactive ref containing successfully loaded data
    errorLoading, // Reactive ref for displaying loading errors
    loadNotice, // Reactive ref for non-error notices (e.g. N rows skipped)
  };
}
