<template>
  <!-- Citations are displayed in the footer; this component intentionally renders nothing. -->
  <div aria-hidden="true" />
</template>

<script setup>
import { defineProps } from 'vue';

// Define props received from the parent component (App.vue)
defineProps({
  showCitation: {
    type: Boolean,
    default: false,
  },
});
</script>

<style scoped>
/* No specific styles for citation section needed currently */
</style>
