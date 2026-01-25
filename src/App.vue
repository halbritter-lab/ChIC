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
    <div v-if="showFAQ" class="faq-modal-overlay" @click.self="closeFAQ">
      <div class="faq-modal">
        <div class="faq-header">
          <h2>How to Use & FAQ</h2>
          <button class="faq-close" @click="closeFAQ">×</button>
        </div>
        <div class="faq-content">
          <h3>How to Use</h3>
          <ol>
            <li><strong>Enter Patient ID:</strong> Provide a unique identifier for the patient.</li>
            <li><strong>Enter Age:</strong> Input the patient's age (20-80 years).</li>
            <li><strong>Enter Total Liver Volume (TLV):</strong> Input the TLV in milliliters (0-20000 ml).</li>
            <li><strong>Plot Data:</strong> Click "Plot Data" to add the data point to the chart.</li>
            <li><strong>View Results:</strong> The normalized TLV and progression group (PG1-PG3) will be displayed.</li>
          </ol>
          
          <h3>Frequently Asked Questions</h3>
          <div class="faq-item">
            <h4>What is nTLV?</h4>
            <p>Normalized Total Liver Volume (nTLV) is the TLV divided by a normalization factor, allowing comparison across patients.</p>
          </div>
          <div class="faq-item">
            <h4>What do the progression groups mean?</h4>
            <p><strong>PG1:</strong> Low progression (&lt;3.3%/year)<br>
               <strong>PG2:</strong> Intermediate progression (3.3-6.6%/year)<br>
               <strong>PG3:</strong> High progression (&gt;6.6%/year)</p>
          </div>
          <div class="faq-item">
            <h4>Can I save my data?</h4>
            <p>Yes! Use the "Save" button to export your data as JSON, or "Download (Excel)" to export as an Excel file.</p>
          </div>
          <div class="faq-item">
            <h4>What is the grouping feature?</h4>
            <p>Enable grouping to categorize multiple patients and assign different colors for visualization.</p>
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
            v-model:total-liver-volume="totalLiverVolume"
            v-model:group="group"
            v-model:group-color="groupColor"
            :enable-grouping="enableGrouping"
            :id-warning-message="idWarningMessage"
            :age-validation-message="ageValidationMessage"
            :tlv-validation-message="tlvValidationMessage"
            :formatted-normalized-t-l-v="formattedNormalizedTLV"
            :progression-group="progressionGroup"
            :liver-growth-rate="liverGrowthRate"
            :is-invalid-input="isInvalidInput"
            :data-points-length="dataPoints.length"
            @toggle-grouping="toggleGrouping"
            @add-data-point="addDataPoint"
            @print-page="printPage"
            @download-chart="downloadChart"
            @save-data-as-json="() => saveDataAsJson(dataPoints)"
            @trigger-load="triggerLoad"
            @download-data-as-excel="() => downloadDataAsExcel(dataPoints)"
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
          />

          <!-- Progression Group Squares -->
          <div class="progression-groups">
            <div class="progression-group PG1">
              <strong>PG1</strong><br>&lt;3.3%/y
            </div>
            <div class="progression-group PG2">
              <strong>PG2</strong><br>3.3-6.6%/y
            </div>
            <div class="progression-group PG3">
              <strong>PG3</strong><br>&gt;6.6%/y
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
              <th>Age [y]</th>
              <th>TLV [ml]</th>
              <th>nTLV</th>
              <th>PG</th>
              <th>LGR [%/y]</th>
              <th v-if="enableGrouping">
                Group
              </th>
              <th v-if="enableGrouping">
                Color
              </th>
              <th>Remove</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(point, index) in dataPoints"
              :key="point.id"
            >
              <td>{{ point.id }}</td>
              <td>{{ point.age }}</td>
              <td>{{ point.tlv }}</td>
              <td>{{ point.ntlv }}</td>
              <td>{{ point.pg }}</td>
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
                <button @click="removeDataPoint(index)">
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
        addDataPoint();
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
    const age = ref(CONFIG.AGE_MIN);
    const totalLiverVolume = ref(CONFIG.TLV_MIN);
    const chartDisplayRef = ref(null); // Ref for the ChartDisplay component instance

    // New reactive properties for grouping
    const enableGrouping = ref(false);
    const group = ref('');
    const groupColor = ref('');

    // Computed properties for normalized values
    const normalizedTLV = computed(() => totalLiverVolume.value / CONFIG.NORMALIZATION_FACTOR);
    const formattedNormalizedTLV = computed(() => {
      if (
        age.value < CONFIG.AGE_MIN || age.value > CONFIG.AGE_MAX ||
        totalLiverVolume.value < CONFIG.TLV_MIN || totalLiverVolume.value > CONFIG.TLV_MAX
      ) {
        return null;
      }
      return (totalLiverVolume.value / CONFIG.NORMALIZATION_FACTOR).toFixed(3);
    });
    const progressionGroup = computed(() => {
      if (
        age.value < CONFIG.AGE_MIN || age.value > CONFIG.AGE_MAX ||
        totalLiverVolume.value < CONFIG.TLV_MIN || totalLiverVolume.value > CONFIG.TLV_MAX
      ) {
        return null;
      }
      const nTLV = normalizedTLV.value;
      const patientAge = age.value;
      if (nTLV > formulas.calculatePG3Threshold(patientAge)) return 'PG3';
      if (nTLV > formulas.calculatePG2Threshold(patientAge) && nTLV <= formulas.calculatePG3Threshold(patientAge)) return 'PG2';
      return 'PG1';
    });
    const liverGrowthRate = computed(() => {
      if (
        age.value < CONFIG.AGE_MIN || age.value > CONFIG.AGE_MAX ||
        totalLiverVolume.value < CONFIG.TLV_MIN || totalLiverVolume.value > CONFIG.TLV_MAX
      ) {
        return null;
      }
      return formulas.calculateLiverGrowthRate(age.value, normalizedTLV.value);
    });

    // Data points array now supports group and groupColor properties.
    const dataPoints = ref([]);

    const addDataPoint = () => {
      if (isInvalidInput.value) {
        idWarningMessage.value = 'Please correct the errors before plotting.';
        return;
      }
      if (!patientId.value.trim()) {
        idWarningMessage.value = "Please enter an ID before plotting a point.";
        return;
      }
      const newData = {
        id: patientId.value,
        age: age.value,
        tlv: totalLiverVolume.value,
        ntlv: formattedNormalizedTLV.value,
        pg: progressionGroup.value,
        lgr: liverGrowthRate.value !== null ? liverGrowthRate.value.toFixed(2) : 'N/A',
        group: enableGrouping.value ? group.value : '',
        groupColor: enableGrouping.value ? groupColor.value : null
      };
      if (enableGrouping.value && groupColor.value) {
        newData.backgroundColor = groupColor.value;
      }
      dataPoints.value.push(newData);
      idWarningMessage.value = '';
    };

    const validateInput = () => {
      ageValidationMessage.value = '';
      tlvValidationMessage.value = '';
      if (age.value < CONFIG.AGE_MIN || age.value > CONFIG.AGE_MAX) {
        ageValidationMessage.value = `Age must be between ${CONFIG.AGE_MIN} and ${CONFIG.AGE_MAX} years.`;
      }
      if (totalLiverVolume.value < CONFIG.TLV_MIN || totalLiverVolume.value > CONFIG.TLV_MAX) {
        tlvValidationMessage.value = `Total Liver Volume must be between 0 and ${CONFIG.TLV_MAX} ml.`;
      }
    };

    const isInvalidInput = computed(() => ageValidationMessage.value !== '' || tlvValidationMessage.value !== '');

    watch(age, validateInput);
    watch(totalLiverVolume, validateInput);

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
        // Replace existing data points
        dataPoints.value = [...newDataArray]; // Create new array to trigger reactivity
        // Clear and update the chart
        chartDisplayRef.value?.clearChart();
        newDataArray.forEach(point => {
          chartDisplayRef.value?.addPoint({
            x: point.age,
            y: parseFloat(point.ntlv),
            id: point.id,
            group: point.group,
            groupColor: point.groupColor, // Pass raw color
            backgroundColor: point.groupColor || null // Set background color for the point
          });
        });
        // Clear the loaded data in the composable after processing
        // to allow loading the same file again if needed
        loadedData.value = []; 
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

    // Toggle dark/light theme
    const toggleTheme = () => {
      isDark.value = !isDark.value;
      document.body.classList.toggle('dark-theme', isDark.value);
    };

    // Reset form to initial state
    const resetForm = () => {
      patientId.value = '';
      age.value = CONFIG.AGE_MIN;
      totalLiverVolume.value = CONFIG.TLV_MIN;
      group.value = '';
      groupColor.value = '';
      dataPoints.value = [];
      idWarningMessage.value = '';
      ageValidationMessage.value = '';
      tlvValidationMessage.value = '';
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

    onMounted(async () => { // Make onMounted async if using await inside
      // Ensure DOM is updated and refs are available before accessing URL params that might interact with refs
      await nextTick(); 
      getUrlQueryParams(); 
      document.documentElement.style.setProperty('--modal-max-width', CONFIG.MODAL_MAX_WIDTH);
      document.documentElement.style.setProperty('--modal-max-height', CONFIG.MODAL_MAX_HEIGHT);
      fetchLastCommit(); // Call fetchLastCommit here
      document.title = 'Charité Imaging Classification';
      updateMetaTag('description', 'Charité Imaging Classification is a Vue.js web application, based on extensive research, offering insights into Polycystic Liver Disease (PLD) progression. Developed by Bernt Popp, Ria Schönauer, Dana Sierks, and Jan Halbritter, this tool facilitates understanding of PLD for both educational and research purposes.');
      updateMetaTag('keywords', 'PLD, Polycystic Liver Disease, Liver Health, Medical Research, Data Visualization, Vue.js, Web Application, Liver Disease Progression, Medical Education, Healthcare Technology');
      updateMetaTag('author', 'Bernt Popp, Ria Schönauer, Dana Sierks, Jan Halbritter');
      updateMetaTag('creator', 'Bernt Popp, Ria Schönauer, Dana Sierks, Jan Halbritter');
    });

    onUnmounted(() => {
      // No longer need to remove resize listener here
    });

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
      normalizedTLV,
      formattedNormalizedTLV,
      progressionGroup,
      liverGrowthRate,
      addDataPoint,
      removeDataPoint,
      printPage,
      downloadChart,
      triggerLoad,
      saveDataAsJson,
      downloadDataAsExcel,
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
      chartDisplayRef, // Return the ref for the ChartDisplay component
      // Theme and UI
      isDark,
      toggleTheme,
      resetForm,
      showFAQ,
      openFAQ,
      closeFAQ
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
  background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
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
