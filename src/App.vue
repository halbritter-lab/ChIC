<template>
  <!-- Main application container -->
  <div
    id="app"
    class="container"
    :class="{ 'dark-theme': isDark }"
  >
    <!-- Note: disclaimerSections prop is provided by the disclaimerMixin -->
    <!-- Use the DisclaimerModal component -->
    <DisclaimerModal
      :show-modal="showModal"
      :disclaimer-acknowledged="disclaimerAcknowledged"
      :acknowledgment-time="acknowledgmentTime"
      :disclaimer-sections="disclaimerSections"
      @close-modal="closeModal"
      @reopen-modal="reopenModal"
    />

    <!-- FAQ Modal -->
    <div
      v-if="showFAQ"
      class="faq-modal-overlay"
      @click.self="closeFAQ"
    >
      <div class="faq-modal">
        <div class="faq-header">
          <h2>How to Use & FAQ</h2>
          <button
            class="faq-close"
            @click="closeFAQ"
          >
            ×
          </button>
        </div>
        <div class="faq-content">
          <h3>How to Use</h3>
          <ol>
            <li><strong>Enter Patient ID:</strong> Provide a unique identifier for the patient.</li>
            <li><strong>Enter Age:</strong> Input the patient's age (15-80 years).</li>
            <li><strong>Enter Total Liver Volume (TLV):</strong> Input the TLV in milliliters (0-20000 ml).</li>
            <li><strong>Calculate:</strong> Click "Calculate" to add the data point to the chart.</li>
            <li><strong>View Results:</strong> The height-adjusted TLV (htTLV) and Charité Imaging Classes (A–E) will be displayed.</li>
          </ol>
          
          <h3>Frequently Asked Questions</h3>
          <div class="faq-item">
            <h4>What is htTLV?</h4>
            <p>Height-adjusted Total Liver Volume (htTLV) is the TLV divided by the patient's height in meters, improving comparison across patients of different body sizes.</p>
          </div>
          <div class="faq-item">
            <h4>What is LGR?</h4>
            <p>LGR (Liver Growth Rate) represents the percentage change in liver volume per year (%/y). It indicates how quickly the liver is growing or shrinking over time, with higher values suggesting more rapid disease progression.</p>
          </div>
          <div class="faq-item">
            <h4>What do the Charité Imaging Classes mean?</h4>
            <p>
              <strong>Class A:</strong> Very slow progression (&lt;1% growth/y)<br>
              <strong>Class B:</strong> Slow progression (1–2% growth/y)<br>
              <strong>Class C:</strong> Moderate progression (2–3% growth/y)<br>
              <strong>Class D:</strong> Rapid progression (3–4% growth/y)<br>
              <strong>Class E:</strong> Very rapid progression (&gt;4% growth/y)
            </p>
          </div>
          <div class="faq-item">
            <h4>What is the grouping feature?</h4>
            <p>Enable grouping to categorize multiple patients and assign different colors for visualization.</p>
          </div>
          <div class="faq-item">
            <h4>Can I edit data after entering it?</h4>
            <p>Yes! Click on any row in the data table below the chart to load it into the input fields for editing. The selected row will highlight in dark blue. You can also click the <button style="background-color: #4a90e2; color: white; border: none; border-radius: 5px; cursor: pointer; padding: 2px 6px; font-size: 12px; vertical-align: middle;">✎</button> (edit) button in the Edit column. Modify any fields (ID, Age, TLV, Height, Group, or Color) and then click "Calculate" to save your changes to that row. The row will be updated with the new values. To remove a data point from the table, click the <button style="background-color: #ff4d4d; color: white; border: none; border-radius: 5px; cursor: pointer; padding: 2px 6px; font-size: 12px; vertical-align: middle;">−</button> (remove) button in the Remove column.</p>
          </div>
          <div class="faq-item">
            <h4>How does batch uploading work?</h4>
            <p>You can upload multiple patient records at once using a CSV, JSON, or Excel file. Each row should contain a patient's ID, age (years), total liver volume (ml), and height (m). Group and group color are optional fields for organizing and color-coding your data. Download a template to get started:
            <a href="#" @click.prevent="downloadTemplateAsJson" style="margin-right: 12px;">JSON</a>
            <a href="#" @click.prevent="downloadTemplateAsCsv" style="margin-right: 12px;">CSV</a>
            <a href="#" @click.prevent="downloadTemplateAsExcel">Excel</a></p>
          </div>
          <div class="faq-item">
            <h4>Can I save my data?</h4>
            <p>Yes! Use the "Download Data" button to export as JSON, CSV, or Excel format. All files include the same columns as the data table: ID, Age (y), Height (m), TLV (ml), htTLV, Class, and LGR (%/y).</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Use the AppHeader component -->
    <AppHeader
      :version="version"
      :last-commit-hash="lastCommitHash"
      :fetch-error="fetchError"
      :is-dark="isDark"
      @reset-form="resetForm"
      @toggle-theme="toggleTheme"
      @open-faq="openFAQ"
      @print-page="printPage"
    />

    <!-- Main content area -->
    <div class="content">
      <!-- Two column layout -->
      <div class="two-column-layout">
        <!-- Left column: Input controls -->
        <div class="left-column">
          <!-- Use the InputControls component -->
          <InputControls
            v-if="showControls"
            v-model:patient-id="patientId"
            v-model:age="age"
            v-model:height="height"
            v-model:total-liver-volume="totalLiverVolume"
            v-model:group="group"
            v-model:group-color="groupColor"
            :enable-grouping="enableGrouping"
            :id-warning-message="idWarningMessage"
            :age-validation-message="ageValidationMessage"
            :tlv-validation-message="tlvValidationMessage"
            :formatted-height-adjusted-tlv="displayFormattedHTLV"
            :progression-group="displayProgressionGroup"
            :liver-growth-rate="displayLiverGrowthRate"
            :is-invalid-input="isInvalidInput"
            :data-points-length="dataPoints.length"
            :height-validation-message="heightValidationMessage"
            @toggle-grouping="toggleGrouping"
            @request-next-id="assignNextId"
            @calculate-data-point="calculateDataPoint"
            @field-touched="handleFieldTouched"
            @print-page="printPage"
            @download-chart="downloadChart"
            @download-data="() => saveDataAsJson(dataPoints)"
            @trigger-load="triggerLoad"
            @download-data-as-excel="() => downloadDataAsExcel(dataPoints)"
            @download-data-as-csv="() => downloadDataAsCsv(dataPoints)"
            :progression-group-label="formatPGLabel(displayProgressionGroup)"
          />

          <!-- Loading Error Display -->
          <div
            v-if="loadingError"
            class="validation-message"
          > 
            {{ loadingError }}
          </div>
        </div>

        <!-- Right column: Chart and progression groups -->
        <div class="right-column">
          <!-- Container for the chart visualization -->
          <ChartDisplay 
            ref="chartDisplayRef" 
            :data-points="dataPoints"
            :enable-grouping="enableGrouping"
            :group="group"
            :group-color="groupColor"
            :editing-index="editingIndex"
          />

          <!-- Charité Imaging Classes (A - E) -->
          <div class="progression-groups">
            <div class="progression-group PG1">
              <strong>Class A</strong><br>&lt;1%/y
            </div>
            <div class="progression-group PG2">
              <strong>Class B</strong><br>1-2%/y
            </div>
            <div class="progression-group PG3">
              <strong>Class C</strong><br>2-3%/y
            </div>
            <div class="progression-group PG4">
              <strong>Class D</strong><br>3-4%/y
            </div>
            <div class="progression-group PG5">
              <strong>Class E</strong><br>&gt;4%/y
            </div>
          </div>
        </div>
      </div>
  
      <!-- Table to display the data points -->
      <div
        v-if="dataPoints.length > 0"
        class="data-points-table-container"
      >
        <table class="data-points-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Age (y)</th>
              <th>Height (m)</th>
              <th>TLV (ml)</th>
              <th>htTLV</th>
              <th>Class</th>
              <th>LGR (%/y)</th>
              <th v-if="enableGrouping">
                Group
              </th>
              <th v-if="enableGrouping">
                Color
              </th>
              <th>Edit</th>
              <th>Remove</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(point, index) in dataPoints"
              :key="point.id"
              @click="editDataPoint(index)"
              :class="{ 'row-editing': editingIndex === index }"
              class="data-row"
            >
              <td>{{ point.id }}</td>
              <td>{{ point.age }}</td>
              <td>{{ point.height }}</td>
              <td>{{ point.tlv }}</td>
              <td>{{ point.htlv_formatted }}</td>
              <td>{{ formatPGLabel(point.pg) }}</td>
              <td>{{ point.lgr }}</td>
              <td v-if="enableGrouping">
                <input
                  v-model="point.group"
                  placeholder="Group"
                  @change="updateChartPoint(index)"
                >
              </td>
              <td v-if="enableGrouping">
                <input
                  v-model="point.groupColor"
                  placeholder="Color"
                  @change="updateChartPoint(index)"
                >
              </td>
              <td>
                <button 
                  @click.stop="editDataPoint(index)"
                  class="edit-button"
                  title="Edit this row"
                >
                  ✎
                </button>
              </td>
              <td>
                <button @click.stop="removeDataPoint(index)">
                  -
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Use the CitationSection component -->
      <CitationSection :show-citation="showCitation" />
      <!-- Use the DocumentationSection component -->
      <DocumentationSection :show-documentation="showDocumentation" />
    </div>
    
    <!-- Use the AppFooter component -->
    <!-- Note: footerLinks prop is provided by the footerMixin -->
    <AppFooter
      :show-footer="showFooter"
      :footer-links="footerLinks"
    />
  </div>
</template>

<script>
// Import necessary Vue APIs and libraries
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import packageInfo from '../package.json';
import { CONFIG } from '@/config/config';
import disclaimerMixin from './mixins/disclaimerMixin';
import footerMixin from './mixins/footerMixin';
import { formulas } from '@/config/formulasConfig';
import { useDataPersistence } from '@/composables/useDataPersistence'; // Import the composable
import DisclaimerModal from './components/DisclaimerModal.vue'; // Import the component
import AppHeader from './components/AppHeader.vue'; // Import the AppHeader component
import DocumentationSection from './components/DocumentationSection.vue'; // Import the DocumentationSection component
import CitationSection from './components/CitationSection.vue'; // Import the CitationSection component
import AppFooter from './components/AppFooter.vue'; // Import the AppFooter component
import InputControls from './components/InputControls.vue'; // Import the InputControls component
import ChartDisplay from './components/ChartDisplay.vue'; // Import the ChartDisplay component
import '@/styles/app.css'; // Import the global/app styles

export default {
  components: {
    DisclaimerModal,
    AppHeader,
    DocumentationSection,
    CitationSection,
    AppFooter,
    InputControls,
    ChartDisplay
  },
  mixins: [disclaimerMixin, footerMixin],
  setup() {
    // Router and route references
    const router = useRouter();
    const route = useRoute();

    // --- Use the Data Persistence Composable ---
    const { 
      triggerLoad, 
      saveDataAsJson, 
      downloadDataAsExcel, 
      downloadDataAsCsv,
      loadedData, 
      errorLoading: loadingError // Rename for template clarity
    } = useDataPersistence();

    const version = packageInfo.version;
    const lastCommitHash = ref('loading...');
    const fetchError = ref(false);
    const showFooter = ref(true);
    const showCitation = ref(true);
    const showDocumentation = ref(true);
    const showControls = ref(true);
    const isDark = ref(false);
    const showFAQ = ref(false);

    const getUrlQueryParams = async () => {
      await router.isReady();
      if (route.query.acknowledgeBanner === "true") {
        showModal.value = false;
      }
      if (route.query.patientId) patientId.value = route.query.patientId;
      if (route.query.age) age.value = route.query.age;
      if (route.query.tlv) totalLiverVolume.value = route.query.tlv;
      if (route.query.patientId && route.query.age && route.query.tlv) {
        calculateDataPoint();
      }
      showFooter.value = route.query.showFooter !== 'false';
      showCitation.value = route.query.showCitation !== 'false';
      showDocumentation.value = route.query.showDocumentation !== 'false';
      showControls.value = route.query.showControls !== 'false';
    };

    const fetchLastCommit = async () => {
      try {
        const response = await fetch('https://api.github.com/repos/halbritter-lab/pld-progression-grouper/commits?per_page=1');
        if (!response.ok) throw new Error('Network response was not ok.');
        const commits = await response.json();
        if (commits.length) {
          lastCommitHash.value = commits[0].sha.substring(0, 7);
        }
      } catch (error) {
        console.error('Error fetching last commit:', error);
        fetchError.value = true;
        lastCommitHash.value = 'offline';
      }
    };

    const idWarningMessage = ref('');
    const ageValidationMessage = ref('');
    const tlvValidationMessage = ref('');
    const patientIdTouched = ref(false);
    const ageTouched = ref(false);
    const heightTouched = ref(false);
    const tlvTouched = ref(false);
    const showAgeValidation = ref(false); // Only show age range error after Calculate is pressed

    const disclaimerAcknowledged = ref(localStorage.getItem('disclaimerAcknowledged') === 'true');
    const acknowledgmentTime = ref(localStorage.getItem('acknowledgmentTime'));
    const showModal = ref(!disclaimerAcknowledged.value);

    const closeModal = () => {
      const currentTime = new Date().toLocaleString();
      showModal.value = false;
      disclaimerAcknowledged.value = true;
      acknowledgmentTime.value = currentTime;
      localStorage.setItem('disclaimerAcknowledged', 'true');
      localStorage.setItem('acknowledgmentTime', currentTime);
    };

    const reopenModal = () => {
      showModal.value = true;
    };

    const patientId = ref('');
    const age = ref(null);
    const height = ref(null); // in meters
    const heightValidationMessage = ref('');
    const totalLiverVolume = ref(null);
    const chartDisplayRef = ref(null); // Ref for the ChartDisplay component instance

    // New reactive properties for grouping
    const enableGrouping = ref(false);
    const group = ref('');
    const groupColor = ref('');

    // Validators
    const isAgeValid = () => {
      const v = Number(age.value);
      return Number.isFinite(v) && v >= CONFIG.AGE_MIN && v <= CONFIG.AGE_MAX;
    };
    const isHeightValid = () => {
      const v = Number(height.value);
      return Number.isFinite(v) && v > 0 && v >= CONFIG.HEIGHT_MIN && v <= CONFIG.HEIGHT_MAX;
    };

    // Computed properties for height-adjusted TLV (htTLV)
    const heightAdjustedTLV = computed(() => {
      const h = height.value;
      if (!h || Number.isNaN(Number(h)) || Number(h) <= 0) return NaN;
      return totalLiverVolume.value / Number(h);
    });
    const formattedHeightAdjustedTLV = computed(() => {
      if (
        !isAgeValid() ||
        totalLiverVolume.value < CONFIG.TLV_MIN || totalLiverVolume.value > CONFIG.TLV_MAX ||
        !isHeightValid()
      ) {
        return null;
      }
      return (totalLiverVolume.value / Number(height.value)).toFixed(2);
    });
    const progressionGroup = computed(() => {
      if (
        !isAgeValid() ||
        totalLiverVolume.value < CONFIG.TLV_MIN || totalLiverVolume.value > CONFIG.TLV_MAX ||
        !isHeightValid()
      ) {
        return null;
      }
      const htlv = heightAdjustedTLV.value;
      const patientAge = age.value;
      // Use the four configured thresholds to derive five progression groups (PG1..PG5)
      const t1 = formulas.calculateThreshold01(patientAge);
      const t2 = formulas.calculateThreshold02(patientAge);
      const t3 = formulas.calculateThreshold03(patientAge);
      const t4 = formulas.calculateThreshold04(patientAge);
      if (htlv >= t4) return 'PG5';
      if (htlv >= t3) return 'PG4';
      if (htlv >= t2) return 'PG3';
      if (htlv >= t1) return 'PG2';
      return 'PG1';
    });
    const liverGrowthRate = computed(() => {
      if (
        !isAgeValid() ||
        totalLiverVolume.value < CONFIG.TLV_MIN || totalLiverVolume.value > CONFIG.TLV_MAX ||
        !isHeightValid()
      ) {
        return null;
      }
      return formulas.calculateLiverGrowthRate(age.value, heightAdjustedTLV.value);
    });

    // Display values updated only when Calculate is clicked
    const displayFormattedHTLV = ref(null); // string or null
    const displayProgressionGroup = ref(null); // 'PG1'|'PG2'|'PG3' or null
    const displayLiverGrowthRate = ref(null); // number or null
    const suppressClearOnNextInput = ref(false);

    // Data points array now supports group and groupColor properties.
    const dataPoints = ref([]);
    const editingIndex = ref(null); // Track which row is being edited

    const calculateDataPoint = () => {
      if (isInvalidInput.value) {
        idWarningMessage.value = 'Please correct the errors before calculating';
        return;
      }
      if (!patientId.value.trim()) {
        idWarningMessage.value = "Please enter an ID before calculating";
        return;
      }
      // Ensure required numeric inputs are present and valid
      if (!isAgeValid()) {
        // Defer showing the range error until after Calculate is pressed (similar to ID missing behavior)
        showAgeValidation.value = true;
        validateInput();
        return;
      }
      if (!isHeightValid()) {
        heightValidationMessage.value = `Height must be between ${CONFIG.HEIGHT_MIN} and ${CONFIG.HEIGHT_MAX} m`;
        return;
      }
      if (totalLiverVolume.value === null || !Number.isFinite(Number(totalLiverVolume.value)) || totalLiverVolume.value < CONFIG.TLV_MIN || totalLiverVolume.value > CONFIG.TLV_MAX) {
        tlvValidationMessage.value = `Total Liver Volume must be between ${CONFIG.TLV_MIN} and ${CONFIG.TLV_MAX} ml`;
        return;
      }
      // Update display values (only on Calculate click)
      displayFormattedHTLV.value = formattedHeightAdjustedTLV.value;
      displayProgressionGroup.value = progressionGroup.value;
      // formulas.calculateLiverGrowthRate now returns fractional value (e.g., 0.01);
      // convert to percent for display: 0.01 -> 1.00 %/y
      displayLiverGrowthRate.value = liverGrowthRate.value !== null ? (liverGrowthRate.value * 100) : null;

      const newData = {
        id: patientId.value,
        age: age.value,
        height: height.value,
        tlv: totalLiverVolume.value,
        htlv: heightAdjustedTLV.value, // numeric for chart
        htlv_formatted: formattedHeightAdjustedTLV.value, // formatted string for display
        pg: progressionGroup.value,
        lgr: liverGrowthRate.value !== null ? (liverGrowthRate.value * 100).toFixed(2) : 'N/A',
        group: enableGrouping.value ? group.value : '',
        groupColor: enableGrouping.value ? groupColor.value : null
      };
      if (enableGrouping.value && groupColor.value) {
        newData.backgroundColor = groupColor.value;
      }
      
      // If editing, update the existing row; otherwise add a new one
      if (editingIndex.value !== null) {
        dataPoints.value[editingIndex.value] = newData;
        editingIndex.value = null;
      } else {
        dataPoints.value.push(newData);
      }
      
      idWarningMessage.value = '';
      // Clear the ID so focusing the ID input will assign the next sequential ID
      // Suppress the input-change watcher once so clearing the ID doesn't immediately clear the calculated display
      suppressClearOnNextInput.value = true;
      patientId.value = '';
    };

    // Load a data point into the input fields for editing
    const editDataPoint = (index) => {
      const point = dataPoints.value[index];
      patientId.value = point.id;
      age.value = point.age;
      height.value = point.height || null;
      totalLiverVolume.value = point.tlv;
      group.value = point.group || '';
      groupColor.value = point.groupColor || '';
      editingIndex.value = index;
    };

    // Compute next numeric ID (based on existing data points)
    const computeNextId = () => {
      let max = 0;
      for (const p of dataPoints.value) {
        const n = parseInt(String(p.id).replace(/^0+/, ''), 10);
        if (!Number.isNaN(n) && n > max) max = n;
      }
      return max + 1;
    };

    const padId = (n) => String(n).padStart(3, '0');

    const assignNextId = () => {
      if (!patientId.value || String(patientId.value).trim() === '') {
        const next = computeNextId();
        patientId.value = padId(next);
      }
    };

    const validateInput = () => {
      ageValidationMessage.value = '';
      tlvValidationMessage.value = '';
      heightValidationMessage.value = '';
      // Age: numeric-only; InputControls emits numbers or NaN or null
      if (age.value !== null) {
        if (!Number.isFinite(age.value)) {
          ageValidationMessage.value = 'Age must be a number';
        } else if (!isAgeValid()) {
          // Only show the range error after Calculate was pressed
          if (showAgeValidation.value) {
            ageValidationMessage.value = `Age must be between ${CONFIG.AGE_MIN} and ${CONFIG.AGE_MAX} years`;
          } else {
            ageValidationMessage.value = '';
          }
        }
      }
      // Height: numeric-only, allow comma/dot converted to Number; show specific messages for non-numeric vs out-of-range
      if (height.value !== null) {
        if (!Number.isFinite(height.value)) {
          heightValidationMessage.value = 'Height must be a number';
        } else if (height.value < CONFIG.HEIGHT_MIN || height.value > CONFIG.HEIGHT_MAX) {
          heightValidationMessage.value = `Height must be between ${CONFIG.HEIGHT_MIN} and ${CONFIG.HEIGHT_MAX} m`;
        }
      }
      // TLV: numeric-only
      if (totalLiverVolume.value !== null) {
        if (!Number.isFinite(totalLiverVolume.value)) {
          tlvValidationMessage.value = 'Total Liver Volume must be a number';
        } else if (totalLiverVolume.value < CONFIG.TLV_MIN || totalLiverVolume.value > CONFIG.TLV_MAX) {
          tlvValidationMessage.value = `Total Liver Volume must be between ${CONFIG.TLV_MIN} and ${CONFIG.TLV_MAX} ml`;
          // tlvValidationMessage set
        }
      }
      // validation messages updated
    };

    const isInvalidInput = computed(() => ageValidationMessage.value !== '' || tlvValidationMessage.value !== '' || heightValidationMessage.value !== '');

    watch(age, (v) => { validateInput(); });
    watch(totalLiverVolume, (v) => { validateInput(); });
    watch(height, (v) => { validateInput(); });
    watch(patientId, (v) => { validateInput(); });

    // Clear the displayed calculated results if any input changes after a calculation.
    // We suppress the very next clear when calculateDataPoint intentionally clears the ID.
    watch([patientId, age, height, totalLiverVolume, group, groupColor], () => {
      if (suppressClearOnNextInput.value) {
        suppressClearOnNextInput.value = false;
        return;
      }
      if (displayFormattedHTLV.value !== null || displayProgressionGroup.value !== null || displayLiverGrowthRate.value !== null) {
        displayFormattedHTLV.value = null;
        displayProgressionGroup.value = null;
        displayLiverGrowthRate.value = null;
      }
    });

    const removeDataPoint = (index) => {
      dataPoints.value.splice(index, 1);
    };

    const printPage = () => {
      window.print();
    };

    const downloadChart = async () => {
      await nextTick(); // Wait for potential updates
 
      if (chartDisplayRef.value) {
        // Check type again before calling
        if (typeof chartDisplayRef.value.downloadChart === 'function') {
          chartDisplayRef.value.downloadChart();
        } else {
          console.error('Error: downloadChart method not found on ChartDisplay component instance.');
        }
      } else {
        console.error('Error: chartDisplayRef is null.');
      }
    };

    // Watch for data loaded by the composable
    watch(loadedData, (newDataArray) => {
      if (newDataArray && newDataArray.length > 0) {
        // Replace existing data points - this triggers the ChartDisplay watcher automatically
        dataPoints.value = [...newDataArray]; // Create new array to trigger reactivity
        // Clear the loaded data in the composable after processing
        // to allow loading the same file again if needed
        loadedData.value = []; 
        // Reset editing state when loading new data
        editingIndex.value = -1;
      }
    });

    // Helper function to update or create meta tags
    function updateMetaTag(name, content) {
      let tag = document.querySelector(`meta[name="${name}"]`);
      if (tag) {
        tag.setAttribute('content', content);
      } else {
        tag = document.createElement('meta');
        tag.setAttribute('name', name);
        tag.setAttribute('content', content);
        document.head.appendChild(tag);
      }
    };

    const updateChartPoint = (index) => {
      const sample = dataPoints.value[index];
      // Update the corresponding chart point backgroundColor based on groupColor.
      chartDisplayRef.value?.updatePointStyle(index, sample.groupColor ? sample.groupColor : null, sample.group);
    };

    // Toggle grouping mode
    const toggleGrouping = () => {
      enableGrouping.value = !enableGrouping.value;
    };

    // Handle field touched events from InputControls
    const handleFieldTouched = (field) => {
      if (field === 'age') ageTouched.value = true;
      if (field === 'height') heightTouched.value = true;
      if (field === 'id') patientIdTouched.value = true;
      if (field === 'tlv') tlvTouched.value = true;
      // Run validation once after a field is marked touched so the message appears immediately
      validateInput();
    };

    // Toggle dark/light theme
    const toggleTheme = () => {
      isDark.value = !isDark.value;
      document.body.classList.toggle('dark-theme', isDark.value);
    };

    // Reset form to initial state (clear all inputs and UI state)
    const resetForm = () => {
      patientId.value = '';
      age.value = null;
      height.value = null;
      totalLiverVolume.value = null;
      group.value = '';
      groupColor.value = '';
      dataPoints.value = [];
      idWarningMessage.value = '';
      ageValidationMessage.value = '';
      tlvValidationMessage.value = '';
      heightValidationMessage.value = '';
      // Clear displayed/calculated outputs
      displayFormattedHTLV.value = null;
      displayProgressionGroup.value = null;
      displayLiverGrowthRate.value = null;
      // Reset touched flags so validation behaves like first load
      patientIdTouched.value = false;
      ageTouched.value = false;
      heightTouched.value = false;
      tlvTouched.value = false;
      suppressClearOnNextInput.value = false;
      showAgeValidation.value = false;
      chartDisplayRef.value?.clearChart();
    };

    // Open FAQ/Help modal
    const openFAQ = () => {
      showFAQ.value = true;
    };

    // Close FAQ modal
    const closeFAQ = () => {
      showFAQ.value = false;
    };

    // Download CSV template for batch upload
    const downloadCSVTemplate = () => {
      const csvContent = `id,age,tlv,height,group,groupColor`;
      
      const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', dataUri);
      link.setAttribute('download', 'batch_upload_template.csv');
      link.click();
    };

    // Download JSON template for batch upload
    const downloadTemplateAsJson = () => {
      const templateData = [
        {
          id: '',
          age: '',
          tlv: '',
          height: '',
          group: '',
          groupColor: ''
        }
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
          { header: 'groupColor', key: 'groupColor' }
        ];
        
        // Generate and download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
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

    onMounted(async () => { // Make onMounted async if using await inside
      // Ensure DOM is updated and refs are available before accessing URL params that might interact with refs
      await nextTick(); 
      getUrlQueryParams(); 
      document.documentElement.style.setProperty('--modal-max-width', CONFIG.MODAL_MAX_WIDTH);
      document.documentElement.style.setProperty('--modal-max-height', CONFIG.MODAL_MAX_HEIGHT);
      fetchLastCommit(); // Call fetchLastCommit here
      document.title = 'Charité Imaging Classification';
      // Do not auto-run validation on mount; validation messages appear after the user focuses a field.
      updateMetaTag('description', 'Charité Imaging Classification is a Vue.js web application, based on extensive research, offering insights into Polycystic Liver Disease (PLD) progression. Developed by Bernt Popp, Ria Schönauer, Dana Sierks, and Jan Halbritter, this tool facilitates understanding of PLD for both educational and research purposes.');
      updateMetaTag('keywords', 'PLD, Polycystic Liver Disease, Liver Health, Medical Research, Data Visualization, Vue.js, Web Application, Liver Disease Progression, Medical Education, Healthcare Technology');
      updateMetaTag('author', 'Bernt Popp, Ria Schönauer, Dana Sierks, Jan Halbritter');
      updateMetaTag('creator', 'Bernt Popp, Ria Schönauer, Dana Sierks, Jan Halbritter');
    });

    onUnmounted(() => {
      // No longer need to remove resize listener here
    });

    // Map internal PG codes to display labels (Class A..E)
    const pgLabelMap = {
      PG1: 'Class A',
      PG2: 'Class B',
      PG3: 'Class C',
      PG4: 'Class D',
      PG5: 'Class E'
    };
    const formatPGLabel = (pg) => {
      if (!pg) return '';
      return pgLabelMap[pg] || pg;
    };

    return {
      version,
      lastCommitHash,
      idWarningMessage,
      ageValidationMessage,
      tlvValidationMessage,
      isInvalidInput,
      showModal,
      closeModal,
      acknowledgmentTime,
      disclaimerAcknowledged,
      reopenModal,
      dataPoints,
      patientId,
      age,
      totalLiverVolume,
      heightValidationMessage,
      height,
      heightAdjustedTLV,
      formattedHeightAdjustedTLV,
      progressionGroup,
      liverGrowthRate,
      displayFormattedHTLV,
      displayProgressionGroup,
      displayLiverGrowthRate,
      calculateDataPoint,
      editDataPoint,
      editingIndex,
      removeDataPoint,
      printPage,
      downloadChart,
      triggerLoad,
      saveDataAsJson,
      downloadDataAsExcel,
      downloadDataAsCsv,
      fetchError,
      showFooter,
      showCitation,
      showDocumentation,
      showControls,
      loadingError,
      // Grouping
      enableGrouping,
      group,
      groupColor,
      toggleGrouping,
      updateChartPoint,
      formatPGLabel,
      chartDisplayRef, // Return the ref for the ChartDisplay component
      assignNextId,
      handleFieldTouched,
      // Theme and UI
      isDark,
      toggleTheme,
      resetForm,
      showFAQ,
      openFAQ,
      closeFAQ,
      downloadCSVTemplate,
      downloadTemplateAsJson,
      downloadTemplateAsCsv,
      downloadTemplateAsExcel
    };
  }
};
</script>

<style>
/* Dark theme styles */
.dark-theme {
  background-color: #1a1a2e;
  color: #e0e0e0;
}

.dark-theme .controls,
.dark-theme .data-points-table,
.dark-theme .progression-group {
  background-color: #16213e;
  color: #e0e0e0;
}

.dark-theme .data-points-table th {
  background-color: #0f3460;
}

.dark-theme .data-points-table td {
  background-color: #1a1a2e;
}

.dark-theme input {
  background-color: #16213e;
  color: #e0e0e0;
  border-color: #0f3460;
}

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
