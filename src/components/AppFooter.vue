<template>
  <!-- Footer section with institution and funder logos -->
  <footer
    v-if="showFooter"
    class="footer"
  >
    <a
      v-for="link in footerLinks"
      :key="link.name"
      :href="link.url"
      target="_blank"
    >
      <img
        :src="link.img"
        :alt="link.alt"
        class="institution-logo"
      >
    </a>
  </footer>
</template>

<script setup>
import { defineProps } from 'vue';

// Define props received from the parent component (App.vue)
// footerLinks are expected to be provided by a mixin or parent state
defineProps({
  showFooter: {
    type: Boolean,
    default: true,
  },
  footerLinks: {
    type: Array,
    default: () => [], // Default to an empty array
  },
});
</script>

<style scoped>
/* Footer styles */
.footer {
  padding: 10px 0;
  background-color: #f5f5f5;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 20px; /* Add some space above the footer */
}

.institution-logo, .funder-logo {
  max-width: 120px;
  margin: 0 20px;
  vertical-align: middle; /* Align logos nicely */
}
</style>
