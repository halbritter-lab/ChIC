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
      >
    </div>
    <div
      v-if="idWarningMessage"
      class="id-warning-message"
    >
      {{ idWarningMessage }}
    </div>

    <!-- Age Input -->
    <div class="input-group">
      <label for="ageInput">Age [y]:</label>
      <input
        id="ageInput"
        :value="age"
        type="number"
        placeholder="20-80"
        @input="$emit('update:age', $event.target.valueAsNumber)"
      >
    </div>
    <div
      v-if="ageValidationMessage"
      class="validation-message"
    >
      {{ ageValidationMessage }}
    </div>

    <!-- TLV Input -->
    <div class="input-group">
      <label for="liverInput">Total Liver Volume (TLV) [ml] :</label>
      <input
        id="liverInput"
        :value="totalLiverVolume"
        type="number"
        placeholder="0-20000"
        @input="$emit('update:totalLiverVolume', $event.target.valueAsNumber)"
      >
    </div>
    <div
      v-if="tlvValidationMessage"
      class="validation-message"
    >
      {{ tlvValidationMessage }}
    </div>

    <!-- Grouping Toggle -->
    <button @click="$emit('toggle-grouping')">
      {{ enableGrouping ? 'Disable Grouping' : 'Enable Grouping' }}
    </button>

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
    <div class="input-group output-group">
      <label for="normalizedTLV">Normalized Total Liver Volume (nTLV):</label>
      <div class="output-fields">
        <output
          id="normalizedTLV"
          class="output-field"
        >
          {{ formattedNormalizedTLV }}
        </output>
        <output
          id="progressionGroupOutput"
          :class="`progression-group-output ${progressionGroup}`"
        >
          {{ progressionGroup }}
        </output>
        <output
          id="liverGrowthRateOutput"
          :class="`progression-group-output ${progressionGroup}`"
        >
          {{ liverGrowthRate !== null ? liverGrowthRate.toFixed(2) + ' %/y (LGR)' : '' }}
        </output>
      </div>
    </div>

    <!-- Action Buttons -->
    <button
      class="plot-point"
      :class="{ 'button-disabled': isInvalidInput }"
      :disabled="isInvalidInput"
      @click="$emit('add-data-point')"
    >
      Plot Data
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
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

// Props received from App.vue
defineProps({
  patientId: { type: [String, Number], default: '' },
  age: { type: [String, Number], default: null }, // Allow string for empty input
  totalLiverVolume: { type: [String, Number], default: null }, // Allow string for empty input
  group: { type: String, default: '' },
  groupColor: { type: String, default: '' },
  enableGrouping: { type: Boolean, default: false },
  idWarningMessage: { type: String, default: '' },
  ageValidationMessage: { type: String, default: '' },
  tlvValidationMessage: { type: String, default: '' },
  formattedNormalizedTLV: { type: String, default: '' },
  progressionGroup: { type: String, default: '' },
  liverGrowthRate: { type: Number, default: null },
  isInvalidInput: { type: Boolean, default: true },
  dataPointsLength: { type: Number, default: 0 },
});

// Events emitted to App.vue
defineEmits([
  'update:patientId',
  'update:age',
  'update:totalLiverVolume',
  'update:group',
  'update:groupColor',
  'toggle-grouping',
  'add-data-point',
  'print-page',
  'download-chart',
  'save-data-as-json',
  'trigger-load', // Renamed from trigger-file-input for clarity
  'download-data-as-excel',
]);
</script>

<style scoped>
/* Styles for controls are now in the global app.css */
/* This style block can be removed if no component-specific styles are needed */
.id-warning-message { /* Style specifically for this component if needed */
  color: red;
  margin-bottom: 10px; /* Example adjustment */
}
.validation-message { /* Style specifically for this component if needed */
   margin-top: -5px; /* Example adjustment */
   margin-bottom: 10px;
}

</style>
