<template>
  <div class="controls">
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

    <!-- Extra Grouping Controls (Conditional) -->
    <template v-if="enableGrouping">
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
      <div class="input-group">
        <label for="groupColorInput">Group Color:</label>
        <input
          id="groupColorInput"
          :value="groupColor"
          type="text"
          placeholder="e.g. #000000"
          @input="$emit('update:groupColor', $event.target.value)"
        >
      </div>
    </template>

    <!-- Output Display -->
    <div class="input-group output-group httlv-box">
      <label for="heightAdjustedTLV">Height-adjusted Total Liver Volume (htTLV):</label>
      <div class="output-fields">
        <output
          id="heightAdjustedTLV"
          class="output-field"
        >
          <template v-if="formattedHeightAdjustedTLV">
            {{ formattedHeightAdjustedTLV }}
          </template>
          <template v-else>
            <span class="httlv-placeholder">htTLV</span>
          </template>
        </output>
        <output
          id="progressionGroupOutput"
          :class="`progression-group-output ${progressionGroup}`"
        >
          <template v-if="progressionGroup">
            {{ progressionGroup }}
          </template>
          <template v-else>
            <span class="httlv-placeholder">PG</span>
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

    <!-- Action Buttons -->
    <div class="action-buttons">
      <button @click="$emit('toggle-grouping')">
        {{ enableGrouping ? 'Disable Grouping' : 'Enable Grouping' }}
      </button>
      <button @click="$emit('print-page')">
        Print Page
      </button>
      <button
        :disabled="dataPointsLength === 0"
        @click="$emit('download-chart')"
      >
        Download Plot
      </button>
      <button
        :disabled="dataPointsLength === 0"
        @click="$emit('save-data-as-json')"
      >
        Save
      </button>
      <button @click="$emit('trigger-load')">
        Load
      </button>
      <button
        :disabled="dataPointsLength === 0"
        @click="$emit('download-data-as-excel')"
      >
        Download (Excel)
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
  formattedHeightAdjustedTLV: { type: String, default: '' },
  heightValidationMessage: { type: String, default: '' },
  progressionGroup: { type: String, default: '' },
  liverGrowthRate: { type: Number, default: null },
  isInvalidInput: { type: Boolean, default: true },
  dataPointsLength: { type: Number, default: 0 },
});

// Events emitted to App.vue
defineEmits([
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

</style>
