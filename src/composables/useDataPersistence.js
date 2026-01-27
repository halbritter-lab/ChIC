import { ref } from 'vue';
import ExcelJS from 'exceljs';
import { formulas } from '@/config/formulasConfig';
import { CONFIG } from '@/config/config';

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
    } else {
      console.error('Unsupported file type.');
      errorLoading.value = 'Unsupported file type. Please select a .json or .xlsx file.';
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
    fileInput.accept = '.json, .xlsx, .xls, application/json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', handleFileSelected);
    document.body.appendChild(fileInput); // Add to body to ensure it's clickable
    fileInput.click();
  };

  // --- Data Loading Logic (adapted from App.vue) ---

  const processLoadedRow = (row) => {
     // Basic validation
    if (row.id == null || row.age == null || row.tlv == null) {
        console.warn('Skipping row due to missing id, age, or tlv:', row);
        return null;
    }

    const ageValue = Number(row.age);
    const tlvValue = Number(row.tlv);

    if (isNaN(ageValue) || isNaN(tlvValue) || ageValue < CONFIG.AGE_MIN || ageValue > CONFIG.AGE_MAX || tlvValue < CONFIG.TLV_MIN || tlvValue > CONFIG.TLV_MAX ) {
         console.warn('Skipping row due to invalid age or tlv:', row);
         return null; // Skip invalid rows silently for now, maybe add user feedback later
    }


    // Compute height-adjusted TLV (htLV). If no height provided in row, fall back to normalization factor.
    const heightValue = row.height !== undefined && row.height !== null ? Number(String(row.height).replace(',', '.')) : null;
    const computedHTLV = heightValue && !Number.isNaN(heightValue) && heightValue > 0 ? (tlvValue / heightValue) : (tlvValue / CONFIG.NORMALIZATION_FACTOR);
    let computedPG = null;
    if (computedHTLV > formulas.calculatePG3Threshold(ageValue)) {
      computedPG = 'PG3';
    } else if (computedHTLV > formulas.calculatePG2Threshold(ageValue) &&
               computedHTLV <= formulas.calculatePG3Threshold(ageValue)) {
      computedPG = 'PG2';
    } else {
      computedPG = 'PG1';
    }
    const computedLGR = ageValue > CONFIG.AGE_MIN_LGR ? formulas.calculateLiverGrowthRate(ageValue, computedHTLV) : null;

    return {
        id: String(row.id), // Ensure ID is a string
        age: ageValue,
        tlv: tlvValue,
        htlv: computedHTLV, // numeric value for charting
        htlv_formatted: computedHTLV.toFixed(3), // formatted string for display
        pg: computedPG,
        lgr: computedLGR !== null ? computedLGR.toFixed(2) : 'N/A',
        group: row.group || '', // Preserve grouping info if present
        groupColor: row.groupColor || null,
    };
  };


  const loadDataFromJson = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileData = JSON.parse(e.target.result);
        if (!Array.isArray(fileData)) {
          throw new Error('JSON file does not contain an array.');
        }
        const processedData = fileData.map(processLoadedRow).filter(p => p !== null); // Process and filter invalid rows
        loadedData.value = processedData;
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
      
      // Convert worksheet to JSON
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
      
      if (!Array.isArray(jsonData)) {
        throw new Error('Could not parse sheet data into an array.');
      }
      const processedData = jsonData.map(processLoadedRow).filter(p => p !== null); // Process and filter invalid rows
      loadedData.value = processedData;
    } catch (err) {
      console.error('Error reading Excel data:', err);
      errorLoading.value = `Error loading Excel: ${err.message}`;
      loadedData.value = [];
    }
  };


  // --- Data Saving Logic (adapted from App.vue) ---

  const saveDataAsJson = (dataToSave) => {
    if (!Array.isArray(dataToSave)) {
        console.error('Data to save is not an array');
        return;
    }
    // Prepare data for saving (e.g., remove internal properties if any)
    const dataStr = JSON.stringify(dataToSave, null, 2); // Pretty print JSON
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
      // Prepare data for saving (e.g., select/rename columns if needed)
        const worksheetData = dataToSave.map(point => ({
          ID: point.id,
          Age: point.age,
          TLV: point.tlv,
          htTLV: point.htlv_formatted || (point.htlv ? Number(point.htlv).toFixed(3) : ''),
          PG: point.pg,
          LGR: point.lgr,
          Group: point.group,
          GroupColor: point.groupColor
        }));

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('PLD_Data');
      
      // Add headers
      worksheet.columns = [
        { header: 'ID', key: 'ID' },
        { header: 'Age', key: 'Age' },
        { header: 'TLV', key: 'TLV' },
        { header: 'htTLV', key: 'htTLV' },
        { header: 'PG', key: 'PG' },
        { header: 'LGR', key: 'LGR' },
        { header: 'Group', key: 'Group' },
        { header: 'GroupColor', key: 'GroupColor' }
      ];
      
      // Add data rows
      worksheet.addRows(worksheetData);
      
      // Generate buffer and download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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

  // --- Return public API ---
  return {
    triggerLoad,
    saveDataAsJson,
    downloadDataAsExcel,
    loadedData, // The reactive ref containing successfully loaded data
    errorLoading // Reactive ref for displaying loading errors
  };
}
