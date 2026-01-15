<template>
  <!-- Citation policy sentences with links -->
  <div v-if="showCitation">
    <p>
      Please cite the following publication for this tool: <br>
      For ADPKD: 
      <a
        href="https://pubmed.ncbi.nlm.nih.gov/36246085/"
        target="_blank"
      >
        Irazabal MV, et al. Imaging Classification of Autosomal Dominant Polycystic Kidney Disease: A Simple Model for Selecting Patients for Clinical Trials. J Am Soc Nephrol. 2015.
      </a>
      <br>
      For ADPLD: 
      <a
        href="https://pubmed.ncbi.nlm.nih.gov/37086841/"
        target="_blank"
      >
        Schönauer R. & Sierks D, et al. Sex, genotype, and liver volume progression as risk of hospitalization determinants in autosomal dominant polycystic liver disease. Gastroenterology. 2023.
      </a>
    </p>
  </div>
</template>

<script setup>
import { defineProps } from 'vue';

// Define props received from the parent component (App.vue)
defineProps({
  showCitation: {
    type: Boolean,
    default: true, // Assume visible by default if not specified
  },
});
</script>

<style scoped>
/* No specific styles for citation section needed currently */
</style>
