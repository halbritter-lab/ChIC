<template>
  <!-- Documentation content has been moved to the footer; this component intentionally renders nothing -->
  <div aria-hidden="true" />
</template>

<script setup>
// Keep the prop for compatibility but default to hidden
defineProps({
  showDocumentation: {
    type: Boolean,
    default: false,
  },
});
</script>

<style scoped>
/* intentionally empty */
</style>
