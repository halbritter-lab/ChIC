import { ref } from 'vue';
import ExcelJS from 'exceljs';
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
  'htTLV_estimated',
  'estimatedHtTLV',
  'estimatedClass',
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
 * - Rows missing id/age/tlv, or with out-of-range age/tlv, are dropped.
 * - Measured height  -> htTLV, class computed and flagged as validated.
 * - Missing height   -> htTLV estimated from the cohort mean height (over rows that
 *                        HAVE a height); if no row has a height, from the assumed
 *                        default. Estimates go to estimatedHtTLV/estimatedClass and
 *                        the row is flagged (class stays null — not a validated class).
 * - Any incoming legacy `pg`/`class` is mapped for information only; class is always
 *   recomputed from the data.
 */
export function processRows(rawRows) {
  if (!Array.isArray(rawRows)) return [];

  // Pass 1: validate + parse, accumulating the cohort mean over rows that have a height.
  const parsed = [];
  let heightSum = 0;
  let heightCount = 0;
  for (const rawRow of rawRows) {
    const row = normalizeImportRow(rawRow);
    if (row == null) continue;
    const id = row.id == null ? '' : String(row.id).trim();
    // Drop rows without a usable id, age, or tlv (a blank/whitespace id is not usable).
    if (id === '' || row.age == null || row.tlv == null) continue;
    const age = Number(row.age);
    const tlv = Number(row.tlv);
    if (
      !Number.isFinite(age) ||
      !Number.isFinite(tlv) ||
      age < CONFIG.AGE_MIN ||
      age > CONFIG.AGE_MAX ||
      tlv < CONFIG.TLV_MIN ||
      tlv > CONFIG.TLV_MAX
    ) {
      continue;
    }
    const height = parseHeight(row.height);
    if (height !== null) {
      heightSum += height;
      heightCount += 1;
    }
    parsed.push({ norm: row, id, age, tlv, height });
  }

  const cohortMeanHeight = heightCount > 0 ? heightSum / heightCount : null;
  const estimateHeight = cohortMeanHeight ?? CONFIG.MODEL.ASSUMED_HEIGHT_M;

  // Pass 2: classify each surviving row.
  return parsed.map(({ norm, id, age, tlv, height }) => {
    // Informational only — the file's own class label is never trusted for classification.
    const importedClass = legacyPgToLetter(norm.pg ?? norm.class ?? null);

    const measured = height !== null;
    const usedHeight = measured ? height : estimateHeight;
    const htlv = heightAdjustedTLV(tlv, usedHeight);
    const cls = classify(htlv, age);
    const lgrFraction = age >= CONFIG.AGE_MIN_LGR ? liverGrowthRate(age, htlv) : null;

    return {
      id,
      age,
      height,
      tlv,
      htlv: measured ? htlv : null,
      htlvEstimated: !measured,
      estimatedHtTLV: measured ? null : htlv,
      class: measured ? cls : null,
      estimatedClass: measured ? null : cls,
      lgr: lgrFraction !== null ? (lgrFraction * 100).toFixed(2) : 'N/A',
      importedClass,
      group: norm.group || '',
      groupColor: norm.groupColor || null,
    };
  });
}

/** Pure export transform: canonical rows -> export-shaped rows (one object per row). */
export function buildExportRows(points) {
  if (!Array.isArray(points)) return [];
  return points.map((p) => ({
    ID: p.id,
    'Age (y)': p.age,
    'Height (m)': p.height ?? '',
    'TLV (ml)': p.tlv,
    htTLV: p.htlv != null ? formatHtTLV(p.htlv) : '',
    Class: p.class ?? '',
    'LGR (%/y)': p.lgr,
    htTLV_estimated: !!p.htlvEstimated,
    estimatedHtTLV: p.estimatedHtTLV != null ? formatHtTLV(p.estimatedHtTLV) : '',
    estimatedClass: p.estimatedClass ?? '',
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

/** Quote a CSV field only when it contains a comma, double quote, or newline. */
function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
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

  // Apply parsed raw rows: classify via processRows and report how many were dropped.
  const applyLoaded = (rawRows) => {
    const rows = processRows(rawRows);
    const attempted = Array.isArray(rawRows) ? rawRows.length : 0;
    const skipped = attempted - rows.length;
    const skippedText = `${skipped} row${skipped === 1 ? '' : 's'} skipped (missing or out-of-range ID, age, or TLV)`;

    if (rows.length === 0 && attempted > 0) {
      // Every row was invalid. Report it as an error and keep the existing table —
      // don't silently wipe the user's data (the empty-array watcher would leave the
      // old rows visible, which would contradict a "N skipped" notice).
      errorLoading.value = `No valid rows found — nothing imported. ${skippedText}.`;
      loadedData.value = [];
      loadNotice.value = null;
      return;
    }

    loadedData.value = rows;
    loadNotice.value = skipped > 0 ? `${skippedText}.` : null;
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
        estimatedHtTLV: '0.00',
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
