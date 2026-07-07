<template>
  <div>
    <!-- Acknowledgment message displayed when disclaimer is accepted -->
    <div v-if="disclaimerAcknowledged && !showModal" class="acknowledgment-message">
      <button @click="reopenModal">Disclaimer</button> acknowledged on this device at:
      {{ acknowledgmentTime }}.
    </div>

    <!-- Modal for displaying the disclaimer -->
    <div v-if="showModal" class="modal">
      <div class="modal-content">
        <h2>Disclaimer for Charité Imaging Classification</h2>
        <section v-for="(section, index) in disclaimerSections" :key="index">
          <h3>{{ section.title }}</h3>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <p v-html="section.content" />
        </section>
        <button class="modal-action-button" @click="closeModal">I Acknowledge</button>
      </div>
    </div>
  </div>
</template>

<script setup>
// Define props received from the parent component (App.vue)
defineProps({
  showModal: {
    type: Boolean,
    default: true, // Default to showing modal initially if not passed
  },
  disclaimerAcknowledged: {
    type: Boolean,
    default: false,
  },
  acknowledgmentTime: {
    type: String,
    default: '',
  },
  disclaimerSections: {
    type: Array,
    default: () => [], // Default to an empty array
  },
});

// Define events emitted to the parent component
const emit = defineEmits(['close-modal', 'reopen-modal']);

// Method to emit the close-modal event
const closeModal = () => {
  emit('close-modal');
};

// Method to emit the reopen-modal event
const reopenModal = () => {
  emit('reopen-modal');
};
</script>

<style scoped>
/* Modal styles */
.modal {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1001; /* Ensure modal is above acknowledgment message */
}
.modal-content {
  background-color: #fff;
  padding: 20px;
  border-radius: 5px;
  width: 80%;
  max-width: 600px;
  max-height: 80vh; /* Limit modal height */
  overflow-y: auto; /* Enable scrolling if content overflows */
}
.modal-content h2 {
  margin-top: 0;
}
.modal-content h2 {
  margin-bottom: 16px; /* add empty line after main title */
  border-bottom: 2px solid #3498db; /* colored line under title (FAQ style) */
  padding-bottom: 6px;
}
.modal-content h3 {
  margin-bottom: 8px; /* spacing after section title */
}
.modal-content section {
  margin-bottom: 16px; /* spacing after each section */
  background: #f8f9fa; /* gray box around each subsection (FAQ style) */
  padding: 12px;
  border-radius: 8px;
}
.modal-content button {
  margin-top: 15px;
  padding: 10px 15px;
}

.modal-content .modal-action-button {
  background-color: var(--button-calc);
  color: #ffffff;
  border: none; /* remove outline to match Calculate button */
  border-radius: 5px;
  cursor: pointer;
  padding: 10px 15px;
  font-size: 14px;
}
.modal-content .modal-action-button:hover {
  background-color: var(--button-calc-hover);
}
.modal-content .modal-action-button:active {
  background-color: #0f2b5a;
}

/* Acknowledgment message styles */
.acknowledgment-message {
  font-size: 12px;
  background-color: #e0e0e0; /* changed to gray */
  color: #888;
  text-align: center;
  padding: 0px; /* Reduced padding */
  position: fixed; /* Keep it fixed at the bottom */
  bottom: 0;
  left: 0;
  width: 100%;
  z-index: 1000; /* Below the modal */
}
.acknowledgment-message button {
  background-color: white;
  color: #888;
  border: 1px solid #888;
  padding: 1px 6px; /* Reduced padding */
  font-size: 12px;
  cursor: pointer;
  margin: 2px 5px 2px 0; /* Adjusted margin */
  border-radius: 5px;
}
</style>
