<template>
  <!-- Documentation sentence with link -->
  <div v-if="showDocumentation">
    <p>
      For a detailed documentation of this tool and the methodology, please refer to the <a
        href="https://github.com/halbritter-lab/pld-progression-grouper/blob/main/docs/DOCUMENTATION.md"
        target="_blank"
      >Documentation Page</a> or our <a
        href="https://docs.google.com/forms/d/1MM4g1Ukjiy73ThWUMHARDcyQg-PwOWuI46kQV5HwXmY"
        target="_blank"
      >Feedback Form</a>.
    </p>
  </div>
</template>

<script setup>
import { defineProps } from 'vue';

// Define props received from the parent component (App.vue)
defineProps({
  showDocumentation: {
    type: Boolean,
    default: true, // Assume visible by default if not specified
  },
});
</script>

<style scoped>
/* No specific styles for documentation section needed currently */
</style>
