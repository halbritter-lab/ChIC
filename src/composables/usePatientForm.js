// usePatientForm.js — patient input refs, validation, and htTLV computeds.
// Validation ranges come from CONFIG. Classification (class / LGR) lives in App.vue,
// which reads the computeds exposed here.
import { ref, computed } from 'vue';
import { CONFIG } from '@/config/config';

export function usePatientForm() {
  // --- Input refs ---
  const patientId = ref('');
  const age = ref(null);
  const height = ref(null); // in meters
  const totalLiverVolume = ref(null);
  const group = ref('');
  const groupColor = ref('');

  // --- Validation state ---
  const idWarningMessage = ref('');
  const ageValidationMessage = ref('');
  const tlvValidationMessage = ref('');
  const heightValidationMessage = ref('');
  const showAgeValidation = ref(false); // Only show age range error after Calculate is pressed

  // --- Validators ---
  const isAgeValid = () => {
    const v = Number(age.value);
    return Number.isFinite(v) && v >= CONFIG.AGE_MIN && v <= CONFIG.AGE_MAX;
  };
  const isHeightValid = () => {
    const v = Number(height.value);
    return Number.isFinite(v) && v > 0 && v >= CONFIG.HEIGHT_MIN && v <= CONFIG.HEIGHT_MAX;
  };

  // --- Height-adjusted TLV (htTLV) ---
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
    // Height: numeric-only; show specific messages for non-numeric vs out-of-range
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
      }
    }
  };

  const isInvalidInput = computed(
    () =>
      ageValidationMessage.value !== '' ||
      tlvValidationMessage.value !== '' ||
      heightValidationMessage.value !== ''
  );

  return {
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
    isInvalidInput,
  };
}
