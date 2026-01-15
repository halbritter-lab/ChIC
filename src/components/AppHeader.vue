<template>
  <!-- Header section with logo and application title -->
  <div class="header">
    <img
      src="@/assets/logo.webp" 
      alt="PLD-Progression Grouper Logo"
      class="app-logo"
    >
    <h1 class="app-title">
      PLD-Progression Grouper <span class="app-version">v{{ version }}-</span>
      <span
        v-if="!fetchError"
        class="app-commit"
      >{{ lastCommitHash }}</span>
      <span
        v-else
        class="offline-indicator"
      >offline</span>
    </h1>
  </div>
</template>

<script setup>
import { defineProps } from 'vue';

// Define props received from the parent component (App.vue)
defineProps({
  version: {
    type: String,
    required: true,
  },
  lastCommitHash: {
    type: String,
    required: true,
  },
  fetchError: {
    type: Boolean,
    required: true,
  },
});
</script>

<style scoped> /* Applied original styles */
.header {
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  width: 100%;
}

.app-logo {
  max-width: 92px;
  margin-right: 20px;
  animation: fadeIn 2s ease-out forwards;
}

.app-logo:hover {
  animation: pulse 2s infinite;
}

.app-title {
  font-size: 24px;
  font-weight: bold;
  margin: 0;
}

.app-version {
  font-size: 0.8em;
  color: #666;
  font-weight: normal;
  padding-left: 10px;
}

.app-commit {
  font-size: 0.8em;
  color: #666;
  font-weight: normal;
  padding-left: 0px;
}

.offline-indicator {
  color: red;
  background-color: lightgray;
  /* border: 3px; /* Original ambiguous rule omitted, using border-radius */
  padding-left: 0px;
  text-align: center;
  border-radius: 3px;
  font-size: 16px;
}

/* Keyframes for logo animation */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}
</style>
