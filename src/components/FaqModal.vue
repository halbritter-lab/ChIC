<template>
  <div v-if="show" class="faq-modal-overlay" @click.self="$emit('close')">
    <div class="faq-modal">
      <div class="faq-header">
        <h2>How to Use & FAQ</h2>
        <button class="faq-close" @click="$emit('close')">×</button>
      </div>
      <div class="faq-content">
        <h3>How to Use</h3>
        <ol>
          <li><strong>Enter Patient ID:</strong> Provide a unique identifier for the patient.</li>
          <li>
            <strong>Enter Age:</strong> Input the patient's age ({{ CONFIG.AGE_MIN }}-{{
              CONFIG.AGE_MAX
            }}
            years).
          </li>
          <li><strong>Enter Total Liver Volume (TLV):</strong> Input the TLV in ml (0-20000).</li>
          <li><strong>Calculate:</strong> Click "Calculate" to add the data point to the chart.</li>
          <li>
            <strong>View Results:</strong> The height-adjusted TLV (htTLV), Charité Imaging Class
            (A–E) and LGR will be displayed.
          </li>
        </ol>

        <h3>Frequently Asked Questions</h3>
        <div class="faq-item">
          <h4>What is htTLV?</h4>
          <p>
            Height-adjusted Total Liver Volume (htTLV) is the TLV divided by the patient's height in
            meters, improving comparison across patients of different body sizes.
          </p>
        </div>
        <div class="faq-item">
          <h4>What is LGR?</h4>
          <p>
            LGR (liver growth rate) represents the percentage change in liver volume per year (%/y).
            It indicates how quickly the liver is growing or shrinking over time, with higher values
            suggesting more rapid disease progression.
          </p>
        </div>
        <div class="faq-item">
          <h4>What do the Charité Imaging Classes mean?</h4>
          <p>
            <strong>Class A:</strong> Very slow progression (&lt;1% growth/y)<br />
            <strong>Class B:</strong> Slow progression (1–2% growth/y)<br />
            <strong>Class C:</strong> Moderate progression (2–3% growth/y)<br />
            <strong>Class D:</strong> Rapid progression (3–4% growth/y)<br />
            <strong>Class E:</strong> Very rapid progression (&gt;4% growth/y)
          </p>
        </div>
        <div class="faq-item">
          <h4>What is the grouping feature?</h4>
          <p>
            Enable grouping to categorize multiple patients and assign different colors for
            visualization.
          </p>
        </div>
        <div class="faq-item">
          <h4>Can I edit data after entering it?</h4>
          <p>
            Yes! Click on any row in the data table below the chart to load it into the input fields
            for editing. The selected row will highlight in dark blue. You can also click the
            <button
              style="
                background-color: #4a90e2;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                padding: 2px 6px;
                font-size: 12px;
                vertical-align: middle;
              "
            >
              ✎
            </button>
            (edit) button in the Edit column. Modify any fields (ID, Age, TLV, Height, Group, or
            Color) and then click "Calculate" to save your changes to that row. The row will be
            updated with the new values. To remove a data point from the table, click the
            <button
              style="
                background-color: #ff4d4d;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                padding: 2px 6px;
                font-size: 12px;
                vertical-align: middle;
              "
            >
              −
            </button>
            (remove) button in the Remove column.
          </p>
        </div>
        <div class="faq-item">
          <h4>How does batch uploading work?</h4>
          <p>
            You can upload multiple patient records at once using a CSV, JSON, or Excel file. Each
            row should contain a patient's ID, age (years), total liver volume (ml), and height (m).
            Group and group color are optional fields for organizing and color-coding your data.
            Download a template to get started:
            <a href="#" @click.prevent="downloadTemplateAsJson" style="margin-right: 12px">JSON</a>
            <a href="#" @click.prevent="downloadTemplateAsCsv" style="margin-right: 12px">CSV</a>
            <a href="#" @click.prevent="downloadTemplateAsExcel">Excel</a>
          </p>
        </div>
        <div class="faq-item">
          <h4>Can I save my data?</h4>
          <p>
            Yes! Use the "Download Data" button to export as JSON, CSV, or Excel format. All files
            include the same columns as the data table: ID, Age (y), Height (m), TLV (ml), htTLV,
            Class, and LGR (%/y).
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// FAQ / Help modal. Owns the batch-upload template downloads triggered from its links.
import { CONFIG } from '@/config/config';

defineProps({
  show: { type: Boolean, default: false },
});
defineEmits(['close']);

// Download JSON template for batch upload
const downloadTemplateAsJson = () => {
  const templateData = [
    {
      id: '',
      age: '',
      tlv: '',
      height: '',
      group: '',
      groupColor: '',
    },
  ];
  const jsonContent = JSON.stringify(templateData, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonContent);
  const link = document.createElement('a');
  link.setAttribute('href', dataUri);
  link.setAttribute('download', 'batch_upload_template.json');
  link.click();
};

// Download CSV template for batch upload
const downloadTemplateAsCsv = () => {
  const csvContent = 'id,age,tlv,height,group,groupColor';
  const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', dataUri);
  link.setAttribute('download', 'batch_upload_template.csv');
  link.click();
};

// Download Excel template for batch upload
const downloadTemplateAsExcel = async () => {
  try {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Template');

    // Add headers only
    worksheet.columns = [
      { header: 'id', key: 'id' },
      { header: 'age', key: 'age' },
      { header: 'tlv', key: 'tlv' },
      { header: 'height', key: 'height' },
      { header: 'group', key: 'group' },
      { header: 'groupColor', key: 'groupColor' },
    ];

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'batch_upload_template.xlsx');
    link.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error creating Excel template:', err);
  }
};
</script>

<!-- Global (unscoped) styles preserved verbatim from App.vue so the .dark-theme selectors keep matching. -->
<style>
/* FAQ Modal styles */
.faq-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.faq-modal {
  background: white;
  border-radius: 12px;
  max-width: 600px;
  max-height: 80vh;
  width: 90%;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.dark-theme .faq-modal {
  background: #16213e;
  color: #e0e0e0;
}

.faq-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: #2c3e50;
  color: white;
}

.faq-header h2 {
  margin: 0;
  font-size: 1.3em;
}

.faq-close {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
  font-size: 24px;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.faq-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

.faq-content {
  padding: 20px;
  overflow-y: auto;
  max-height: calc(80vh - 80px);
}

.faq-content h3 {
  color: #2c3e50;
  margin-top: 20px;
  margin-bottom: 10px;
  border-bottom: 2px solid #3498db;
  padding-bottom: 5px;
}

.dark-theme .faq-content h3 {
  color: #3498db;
  border-bottom-color: #3498db;
}

.faq-content ol {
  padding-left: 20px;
}

.faq-content li {
  margin-bottom: 8px;
  line-height: 1.5;
}

.faq-item {
  margin-bottom: 15px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 8px;
}

.dark-theme .faq-item {
  background: #0f3460;
}

.faq-item h4 {
  margin: 0 0 8px 0;
  color: #2c3e50;
}

.dark-theme .faq-item h4 {
  color: #e0e0e0;
}

.faq-item p {
  margin: 0;
  line-height: 1.5;
  color: #555;
}

.dark-theme .faq-item p {
  color: #b0b0b0;
}
</style>
