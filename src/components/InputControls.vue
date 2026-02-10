<template>
  <div
    class="controls"
    :class="{ 'grouping-enabled': enableGrouping }"
  >
    <!-- ID Input -->
    <div class="input-group">
      <label for="idInput">ID:</label>
      <input
        id="idInput"
        :value="patientId"
        type="text"
        placeholder="Enter ID"
        @input="$emit('update:patientId', $event.target.value)"
        @focus="$emit('request-next-id'); $emit('field-touched', 'id')"
      >
    </div>
    <div
      v-if="idWarningMessage"
      class="validation-message"
    >
      {{ idWarningMessage }}
    </div>

    <!-- Age Input -->
    <div class="input-group">
      <label for="ageInput">Age [y]:</label>
      <input
        id="ageInput"
        :value="age"
        type="text"
        placeholder="15-80"
        @input="(e) => $emit('update:age', e.target.value === '' ? null : Number(e.target.value))"
        @focus="$emit('field-touched', 'age')"
      >
    </div>
    <div
      v-if="ageValidationMessage"
      class="validation-message"
    >
      {{ ageValidationMessage }}
    </div>

    <!-- Height Input -->
    <div class="input-group">
      <label for="heightInput">Height [m]:</label>
      <input
        id="heightInput"
        :value="height"
        type="text"
        placeholder="e.g. 1.75 or 1,75"
        @input="(e) => {
          const v = e.target.value.replace(',', '.');
          $emit('update:height', v === '' ? null : Number(v));
        }"
        @focus="$emit('field-touched', 'height')"
      >
    </div>
    <div
      v-if="heightValidationMessage"
      class="validation-message"
    >
      {{ heightValidationMessage }}
    </div>

    <!-- TLV Input -->
    <div class="input-group">
      <label for="liverInput">Total Liver Volume [ml]:</label>
      <input
        id="liverInput"
        :value="totalLiverVolume"
        type="text"
        placeholder="0-20,000"
        @input="(e) => $emit('update:totalLiverVolume', e.target.value === '' ? null : Number(e.target.value))"
        @focus="$emit('field-touched', 'tlv')"
      >
    </div>
    <div
      v-if="tlvValidationMessage"
      class="validation-message"
    >
      {{ tlvValidationMessage }}
    </div>

    <!-- Calculate (formerly "Plot Data") -->
    <div class="grouping-toggle-container">
      <button
        class="calculate-button"
        :class="{ 'button-disabled': isInvalidInput }"
        :disabled="isInvalidInput"
        @click="$emit('calculate-data-point')"
      >
        Calculate
      </button>
    </div>

    <div
      class="spacer"
      aria-hidden="true"
    />
    <!-- Extra Grouping Controls (Conditional) -->
    <template v-if="enableGrouping">
      <div class="grouping-controls">
        <div class="input-group">
          <label for="groupInput">Group:</label>
          <input
            id="groupInput"
            :value="group"
            type="text"
            placeholder="Enter group name"
            @input="$emit('update:group', $event.target.value)"
          >
        </div>
        <div class="input-group color-suggest">
          <label for="groupColorInput">Group Color:</label>
          <div class="color-suggest-wrapper">
            <input
              id="groupColorInput"
              :value="groupColor"
              type="text"
              placeholder="e.g. #000000"
              @input="$emit('update:groupColor', $event.target.value)"
            >
            <div
              class="color-suggestions"
              aria-hidden="true"
            >
              <button
                type="button"
                class="color-swatch"
                title="Black"
                @click="$emit('update:groupColor', '#000000')"
              >
                <span
                  class="swatch-dot"
                  style="background:#000000"
                />
                <span class="swatch-label">Black</span>
                <span class="swatch-hex">#000000</span>
              </button>
              <button
                type="button"
                class="color-swatch"
                title="Red"
                @click="$emit('update:groupColor', '#ff4d4d')"
              >
                <span
                  class="swatch-dot"
                  style="background:#ff4d4d"
                />
                <span class="swatch-label">Red</span>
                <span class="swatch-hex">#ff4d4d</span>
              </button>
              <button
                type="button"
                class="color-swatch"
                title="Blue"
                @click="$emit('update:groupColor', '#3498db')"
              >
                <span
                  class="swatch-dot"
                  style="background:#3498db"
                />
                <span class="swatch-label">Blue</span>
                <span class="swatch-hex">#3498db</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Output Display -->
    <div class="input-group output-group httlv-box">
      <label for="heightAdjustedTLV">Height-adjusted Total Liver Volume (htTLV):</label>
      <div class="output-fields">
        <output
          id="heightAdjustedTLV"
          :class="`output-field ${progressionGroup}`"
        >
          <template v-if="formattedHeightAdjustedTlv">
            {{ formattedHeightAdjustedTlv + ' ml/m' }}
          </template>
          <template v-else>
            <span class="httlv-placeholder">htTLV</span>
          </template>
        </output>
        <output
          id="progressionGroupOutput"
          :class="`progression-group-output ${progressionGroup}`"
        >
          <template v-if="progressionGroupLabel">
            {{ progressionGroupLabel }}
          </template>
          <template v-else>
            <span class="httlv-placeholder">Class</span>
          </template>
        </output>
        <output
          id="liverGrowthRateOutput"
          :class="`progression-group-output ${progressionGroup}`"
        >
          <template v-if="liverGrowthRate !== null && liverGrowthRate !== undefined">
            {{ liverGrowthRate.toFixed(2) + ' %/y (LGR)' }}
          </template>
          <template v-else>
            <span class="httlv-placeholder">growth rate</span>
          </template>
        </output>
      </div>
    </div>



    <div
      class="spacer"
      aria-hidden="true"
    />
    <!-- Action Buttons -->
    <div class="action-buttons">
      <button @click="$emit('toggle-grouping')">
        {{ enableGrouping ? 'Disable Grouping' : 'Enable Grouping' }}
      </button>
      <button @click="$emit('trigger-load')">
        Load
      </button>
      <button @click="$emit('print-page')">
        Print Page
      </button>
    </div>

    <!-- Save + Download actions on their own row -->
    <div
      class="action-buttons secondary-actions"
      style="margin-top:6px;"
    >
      <button
        :disabled="dataPointsLength === 0"
        @click="$emit('save-data-as-json')"
      >
        Save
      </button>
      <button
        :disabled="dataPointsLength === 0"
        @click="$emit('download-data-as-excel')"
      >
        Download (Excel)
      </button>
      <button
        :disabled="dataPointsLength === 0"
        @click="$emit('download-chart')"
      >
        Download Plot
      </button>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

// Props received from App.vue
defineProps({
  patientId: { type: [String, Number], default: '' },
  age: { type: [String, Number], default: null }, // Allow string for empty input
  height: { type: [String, Number], default: null }, // Height in meters
  totalLiverVolume: { type: [String, Number], default: null }, // Allow string for empty input
  group: { type: String, default: '' },
  groupColor: { type: String, default: '' },
  enableGrouping: { type: Boolean, default: false },
  idWarningMessage: { type: String, default: '' },
  ageValidationMessage: { type: String, default: '' },
  tlvValidationMessage: { type: String, default: '' },
  formattedHeightAdjustedTlv: { type: String, default: '' },
  heightValidationMessage: { type: String, default: '' },
  progressionGroup: { type: String, default: '' },
  progressionGroupLabel: { type: String, default: '' },
  liverGrowthRate: { type: Number, default: null },
  isInvalidInput: { type: Boolean, default: true },
  dataPointsLength: { type: Number, default: 0 },
});

// Events emitted to App.vue
const emit = defineEmits([
  'update:patientId',
  'update:age',
  'update:height',
  'update:totalLiverVolume',
  'update:group',
  'update:groupColor',
  'toggle-grouping',
  'calculate-data-point',
  'print-page',
  'download-chart',
  'save-data-as-json',
  'trigger-load', // Renamed from trigger-file-input for clarity
  'download-data-as-excel',
  'field-touched',
  'request-next-id',
]);

// `progressionGroupLabel` prop is provided by the parent (App.vue)

// (Dropdown visibility handled via CSS hover)
</script>

<style scoped>
/* Styles for controls are now in the global app.css */
/* This style block can be removed if no component-specific styles are needed */
.validation-message { /* Style specifically for this component if needed */
  margin-top: -5px; /* Example adjustment */
  margin-bottom: 10px;
}

.grouping-toggle-container {
  display: flex;
  justify-content: center;
  width: 100%;
  margin: 10px 0;
}

.httlv-placeholder {
  color: #888;
  font-style: italic;
}

/* Color suggestion dropdown for Group Color input */
.color-suggest .color-suggest-wrapper {
  position: relative;
  display: inline-block;
}
.color-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  display: none;
  flex-direction: column; /* stacked vertically */
  gap: 4px;
  padding: 6px 8px;
  width: 100%; /* match the input width via the wrapper */
  box-sizing: border-box;
  align-items: stretch;
  background: #ffffff;
  border: 1px solid rgba(0,0,0,0.12);
  box-shadow: 0 6px 18px rgba(0,0,0,0.12);
  border-radius: 6px;
  z-index: 50;
}
.color-swatch {
  padding: 8px 10px;
  border: none;
  cursor: pointer;
  background: transparent; /* no box around each option */
  color: inherit;
  border-radius: 0px;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: flex-start; /* left align content */
  width: 100%;
}
.color-swatch {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  outline: none;
  -webkit-tap-highlight-color: transparent;
}
.color-swatch:focus {
  outline: none !important;
  box-shadow: none !important;
}
.color-swatch::-moz-focus-inner {
  border: 0;
}
.color-swatch .swatch-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  margin-right: 8px;
  vertical-align: middle;
  border: 1px solid rgba(0,0,0,0.12);
}
.color-swatch:hover {
  background: rgba(0,0,0,0.06); /* light gray on hover */
}
.color-swatch:focus-visible {
  outline: none !important;
  box-shadow: none !important;
  background: rgba(0,0,0,0.06); /* same visual as hover */
}

/* Force remove any browser default button background/focus styling for color options */
.color-suggest .color-suggestions .color-swatch {
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  -webkit-appearance: none !important;
  appearance: none !important;
}
.color-suggest .color-suggestions .color-swatch:active {
  background-color: rgba(0,0,0,0.06) !important;
}
:deep(.dark-theme) .color-suggest .color-suggestions .color-swatch:active {
  background-color: rgba(255,255,255,0.03) !important;
}
.swatch-label {
  margin-right: 8px;
}
.swatch-hex {
  color: rgba(0,0,0,0.54);
  font-size: 12px;
}
.color-suggest:hover .color-suggestions,
.color-suggest .color-suggest-wrapper:focus-within .color-suggestions {
  display: flex;
}

/* Dark mode adjustments for the suggestion box */
:deep(.dark-theme) .color-suggestions {
  background: #0f2138;
  border: 1px solid rgba(255,255,255,0.06);
  box-shadow: none;
}
/* Dark mode: make swatch dot borders lighter for contrast */
:deep(.dark-theme) .swatch-dot {
  border: 1px solid rgba(255,255,255,0.12);
}
/* Dark-mode: neutral hover for color options */
:deep(.dark-theme) .color-swatch:hover,
:deep(.dark-theme) .color-swatch:focus-visible {
  background: rgba(255,255,255,0.03);
}


</style>
