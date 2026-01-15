import { ref } from 'vue';
import * as XLSX from 'xlsx';
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


    const computedNTLV = (tlvValue / CONFIG.NORMALIZATION_FACTOR); // Keep as number for calculations
    let computedPG = null;
    if (computedNTLV > formulas.calculatePG3Threshold(ageValue)) {
      computedPG = 'PG3';
    } else if (computedNTLV > formulas.calculatePG2Threshold(ageValue) &&
               computedNTLV <= formulas.calculatePG3Threshold(ageValue)) {
      computedPG = 'PG2';
    } else {
      computedPG = 'PG1';
    }
    // LGR calculation needs check for age > CONFIG.AGE_MIN_LGR (assuming 20 from original)
    const computedLGR = ageValue > CONFIG.AGE_MIN_LGR ? formulas.calculateLiverGrowthRate(ageValue, computedNTLV) : null;

    return {
        id: String(row.id), // Ensure ID is a string
        age: ageValue,
        tlv: tlvValue,
        ntlv: computedNTLV.toFixed(3), // Format for display consistency
        pg: computedPG,
        lgr: computedLGR !== null ? computedLGR.toFixed(2) : 'N/A',
        group: row.group || '', // Preserve grouping info if present
        groupColor: row.groupColor || null,
        // Note: backgroundColor is handled in App.vue when adding to chart
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

  const loadDataFromExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error('Excel file contains no sheets.');
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null }); // Use null for empty cells
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
     reader.onerror = (err) => {
        console.error('FileReader error:', err);
        errorLoading.value = 'Error reading file.';
        loadedData.value = [];
    };
    reader.readAsArrayBuffer(file);
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

  const downloadDataAsExcel = (dataToSave) => {
     if (!Array.isArray(dataToSave)) {
        console.error('Data to save is not an array');
        return;
    }
    // Prepare data for saving (e.g., select/rename columns if needed)
    const worksheetData = dataToSave.map(point => ({
        ID: point.id,
        Age: point.age,
        TLV: point.tlv,
        nTLV: point.ntlv,
        PG: point.pg,
        LGR: point.lgr,
        Group: point.group,
        GroupColor: point.groupColor
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(wb, ws, "PLD_Data");
    const fileName = `pld_data_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
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
