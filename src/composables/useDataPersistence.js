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
  for (const row of rawRows) {
    if (row == null || row.id == null || row.age == null || row.tlv == null) continue;
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
    parsed.push({ raw: row, id: String(row.id), age, tlv, height });
  }

  const cohortMeanHeight = heightCount > 0 ? heightSum / heightCount : null;
  const estimateHeight = cohortMeanHeight ?? CONFIG.MODEL.ASSUMED_HEIGHT_M;

  // Pass 2: classify each surviving row.
  return parsed.map(({ raw, id, age, tlv, height }) => {
    // Informational only — the file's own class label is never trusted for classification.
    const importedClass = legacyPgToLetter(raw.pg ?? raw.class ?? null);

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
      group: raw.group || '',
      groupColor: raw.groupColor || null,
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

export function useDataPersistence() {
  const loadedData = ref([]); // Ref to hold data loaded from files
  const errorLoading = ref(null); // Ref to hold any loading errors

  // --- Internal File Input Handling ---
  let fileInput = null;

  const handleFileSelected = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    errorLoading.value = null; // Reset error on new attempt
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
        loadedData.value = processRows(fileData);
      } catch (err) {
        console.error('Error loading JSON data:', err);
        errorLoading.value = `Error loading JSON: ${err.message}`;
        loadedData.value = [];
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

      loadedData.value = processRows(jsonData);
    } catch (err) {
      console.error('Error reading Excel data:', err);
      errorLoading.value = `Error loading Excel: ${err.message}`;
      loadedData.value = [];
    }
  };

  const loadDataFromCsv = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target.result;
        const lines = csv.split('\n');
        if (lines.length < 2) {
          throw new Error('CSV file is empty or contains only headers.');
        }

        // Parse header row
        const headers = lines[0].split(',').map((h) => h.trim());
        const jsonData = [];

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue; // Skip empty lines

          const values = line.split(',').map((v) => v.trim());
          const rowData = {};

          headers.forEach((header, index) => {
            const value = values[index];
            // Try to convert to number if it looks like one
            if (value === '' || value === undefined) {
              rowData[header] = null;
            } else if (!isNaN(value)) {
              rowData[header] = Number(value);
            } else {
              rowData[header] = value;
            }
          });

          jsonData.push(rowData);
        }

        loadedData.value = processRows(jsonData);
      } catch (err) {
        console.error('Error loading CSV data:', err);
        errorLoading.value = `Error loading CSV: ${err.message}`;
        loadedData.value = [];
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
      const rows = buildExportRows(dataToSave).map((row) => EXPORT_COLUMNS.map((col) => row[col]));

      // Create CSV string with headers and rows
      const csvContent = [EXPORT_COLUMNS.join(','), ...rows.map((row) => row.join(','))].join('\n');

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
  };
}
