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

    <!-- FAQ / Help modal -->
    <FaqModal
      :show="showFAQ"
      @close="closeFAQ"
    />

    <!-- Use the AppHeader component -->
    <AppHeader
      :version="version"
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
      <DataTable
        :data-points="dataPoints"
        :enable-grouping="enableGrouping"
        :editing-index="editingIndex"
        :format-label="formatPGLabel"
        @edit-point="editDataPoint"
        @remove-point="removeDataPoint"
        @update-chart-point="updateChartPoint"
      />

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
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import packageInfo from '../package.json';
import { CONFIG } from '@/config/config';
import disclaimerMixin from './mixins/disclaimerMixin';
import footerMixin from './mixins/footerMixin';
import { formulas } from '@/config/formulasConfig';
import { useDataPersistence } from '@/composables/useDataPersistence';
import { useTheme } from '@/composables/useTheme';
import { useQueryParams } from '@/composables/useQueryParams';
import { usePatientForm } from '@/composables/usePatientForm';
import { useDataPoints } from '@/composables/useDataPoints';
import DisclaimerModal from './components/DisclaimerModal.vue';
import AppHeader from './components/AppHeader.vue';
import DocumentationSection from './components/DocumentationSection.vue';
import CitationSection from './components/CitationSection.vue';
import AppFooter from './components/AppFooter.vue';
import InputControls from './components/InputControls.vue';
import ChartDisplay from './components/ChartDisplay.vue';
import FaqModal from './components/FaqModal.vue';
import DataTable from './components/DataTable.vue';
import '@/styles/index.css'; // Import the global/app styles (barrel)

export default {
  components: {
    DisclaimerModal,
    AppHeader,
    DocumentationSection,
    CitationSection,
    AppFooter,
    InputControls,
    ChartDisplay,
    FaqModal,
    DataTable
  },
  mixins: [disclaimerMixin, footerMixin],
  setup() {
    // Router and route references
    const router = useRouter();
    const route = useRoute();

    // --- Data persistence composable (file import/export) ---
    const {
      triggerLoad,
      saveDataAsJson,
      downloadDataAsExcel,
      downloadDataAsCsv,
      loadedData,
      errorLoading: loadingError // Rename for template clarity
    } = useDataPersistence();

    const version = packageInfo.version;
    const showFAQ = ref(false);

    // --- Theme ---
    const { isDark, toggleTheme, applyTheme } = useTheme();

    // --- Patient input form + validation ---
    const {
      patientId,
      age,
      height,
      totalLiverVolume,
      group,
      groupColor,
      idWarningMessage,
      ageValidationMessage,
      tlvValidationMessage,
      heightValidationMessage,
      showAgeValidation,
      isAgeValid,
      isHeightValid,
      heightAdjustedTLV,
      formattedHeightAdjustedTLV,
      validateInput,
      isInvalidInput
    } = usePatientForm();

    // --- Data points collection ---
    const {
      dataPoints,
      editingIndex,
      addOrUpdatePoint,
      removeDataPoint,
      computeNextId,
      padId
    } = useDataPoints();

    // --- Disclaimer gate ---
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

    const chartDisplayRef = ref(null); // Ref for the ChartDisplay component instance

    // Grouping state
    const enableGrouping = ref(false);

    // Touched flags for field-level validation timing
    const patientIdTouched = ref(false);
    const ageTouched = ref(false);
    const heightTouched = ref(false);
    const tlvTouched = ref(false);

    // Classification of the current inputs (five progression groups PG1..PG5 = Class A..E).
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
    const displayProgressionGroup = ref(null); // 'PG1'..'PG5' or null
    const displayLiverGrowthRate = ref(null); // number or null
    const suppressClearOnNextInput = ref(false);

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
        // Defer showing the range error until after Calculate is pressed
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
      // formulas.calculateLiverGrowthRate returns a fraction (e.g. 0.01); ×100 for %/y display.
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

      addOrUpdatePoint(newData);

      idWarningMessage.value = '';
      // Clear the ID so focusing the ID input will assign the next sequential ID.
      // Suppress the input-change watcher once so clearing the ID doesn't clear the calculated display.
      suppressClearOnNextInput.value = true;
      patientId.value = '';
    };

    // --- Query-param init (embed/kiosk mode) ---
    const { showFooter, showCitation, showDocumentation, showControls, initFromQuery } = useQueryParams({
      router,
      route,
      patientId,
      age,
      totalLiverVolume,
      calculateDataPoint,
      showModal
    });

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

    const assignNextId = () => {
      if (!patientId.value || String(patientId.value).trim() === '') {
        patientId.value = padId(computeNextId());
      }
    };

    watch(age, () => { validateInput(); });
    watch(totalLiverVolume, () => { validateInput(); });
    watch(height, () => { validateInput(); });
    watch(patientId, () => { validateInput(); });

    // Clear the displayed calculated results if any input changes after a calculation.
    // Suppress the very next clear when calculateDataPoint intentionally clears the ID.
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

    const printPage = () => {
      window.print();
    };

    const downloadChart = async () => {
      await nextTick(); // Wait for potential updates
      if (chartDisplayRef.value) {
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
        dataPoints.value = [...newDataArray];
        // Clear the loaded data in the composable so the same file can be loaded again
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
    }

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

    // Open/close FAQ modal
    const openFAQ = () => { showFAQ.value = true; };
    const closeFAQ = () => { showFAQ.value = false; };

    onMounted(async () => {
      // Ensure DOM is updated and refs are available before interacting with them
      await nextTick();
      applyTheme(); // reflect any persisted theme onto <body>
      initFromQuery();
      document.documentElement.style.setProperty('--modal-max-width', CONFIG.MODAL_MAX_WIDTH);
      document.documentElement.style.setProperty('--modal-max-height', CONFIG.MODAL_MAX_HEIGHT);
      document.title = 'Charité Imaging Classification';
      updateMetaTag('description', 'Charité Imaging Classification is a Vue.js web application, based on extensive research, offering insights into Polycystic Liver Disease (PLD) progression. Developed by Bernt Popp, Ria Schönauer, Dana Sierks, and Jan Halbritter, this tool facilitates understanding of PLD for both educational and research purposes.');
      updateMetaTag('keywords', 'PLD, Polycystic Liver Disease, Liver Health, Medical Research, Data Visualization, Vue.js, Web Application, Liver Disease Progression, Medical Education, Healthcare Technology');
      updateMetaTag('author', 'Bernt Popp, Ria Schönauer, Dana Sierks, Jan Halbritter');
      updateMetaTag('creator', 'Bernt Popp, Ria Schönauer, Dana Sierks, Jan Halbritter');
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
      chartDisplayRef,
      assignNextId,
      handleFieldTouched,
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
