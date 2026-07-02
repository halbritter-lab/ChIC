<template>
  <!-- Ribbon/Navbar header -->
  <nav class="ribbon">
    <div class="ribbon-left">
      <img
        src="@/assets/logo.png" 
        alt="Charité Imaging Classification Logo"
        class="app-logo"
      >
      <div class="title-container">
        <h1 class="app-title">
          Charité Imaging Classification
        </h1>
        <span class="app-version">
          v{{ version }}
        </span>
      </div>
    </div>
    
    <div class="ribbon-right">
      <!-- Reset Button -->
      <button 
        class="ribbon-btn" 
        title="Reset Form"
        @click="$emit('reset-form')"
      >
        <svg
          class="btn-icon"
          viewBox="0 0 24 24"
        >
          <path
            fill="currentColor"
            d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"
          />
        </svg>
      </button>
      
      <!-- Theme Toggle Button -->
      <button 
        class="ribbon-btn" 
        :title="isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'"
        @click="$emit('toggle-theme')"
      >
        <svg
          v-if="isDark"
          class="btn-icon"
          viewBox="0 0 24 24"
        >
          <path
            fill="currentColor"
            d="M17.75,4.09L15.22,6.03L16.13,9.09L13.5,7.28L10.87,9.09L11.78,6.03L9.25,4.09L12.44,4L13.5,1L14.56,4L17.75,4.09M21.25,11L19.61,12.25L20.2,14.23L18.5,13.06L16.8,14.23L17.39,12.25L15.75,11L17.81,10.95L18.5,9L19.19,10.95L21.25,11M18.97,15.95C19.8,15.87 20.69,17.05 20.16,17.8C19.84,18.25 19.5,18.67 19.08,19.07C15.17,23 8.84,23 4.94,19.07C1.03,15.17 1.03,8.83 4.94,4.93C5.34,4.53 5.76,4.17 6.21,3.85C6.96,3.32 8.14,4.21 8.06,5.04C7.79,7.9 8.75,10.87 10.95,13.06C13.14,15.26 16.1,16.22 18.97,15.95M17.33,17.97C14.5,17.81 11.7,16.64 9.53,14.5C7.36,12.31 6.2,9.5 6.04,6.68C3.23,9.82 3.34,14.64 6.35,17.66C9.37,20.67 14.19,20.78 17.33,17.97Z"
          />
        </svg>
        <svg
          v-else
          class="btn-icon"
          viewBox="0 0 24 24"
        >
          <path
            fill="currentColor"
            d="M3.55,18.54L4.96,19.95L6.76,18.16L5.34,16.74M11,22.45C11.32,22.45 13,22.45 13,22.45V19.5H11M12,5.5A6,6 0 0,0 6,11.5A6,6 0 0,0 12,17.5A6,6 0 0,0 18,11.5C18,8.18 15.31,5.5 12,5.5M20,12.5H23V10.5H20M17.24,18.16L19.04,19.95L20.45,18.54L18.66,16.74M20.45,4.46L19.04,3.05L17.24,4.84L18.66,6.26M13,0.55H11V3.5H13M4,10.5H1V12.5H4M6.76,4.84L4.96,3.05L3.55,4.46L5.34,6.26L6.76,4.84Z"
          />
        </svg>
      </button>
      
      <!-- Print Button -->
      <button 
        class="ribbon-btn" 
        title="Print Page"
        @click="$emit('print-page')"
      >
        <svg
          class="btn-icon"
          viewBox="0 0 24 24"
        >
          <path
            fill="currentColor"
            d="M18,3H6V7H18M19,12A1,1 0 0,1 18,11A1,1 0 0,1 19,10A1,1 0 0,1 20,11A1,1 0 0,1 19,12M16,19H8V14H16M19,8H5A3,3 0 0,0 2,11V17H6V21H18V17H22V11A3,3 0 0,0 19,8Z"
          />
        </svg>
      </button>
      
      <!-- FAQ/Help Button -->
      <button 
        class="ribbon-btn" 
        title="How to Use & FAQ"
        @click="$emit('open-faq')"
      >
        <svg
          class="btn-icon"
          viewBox="0 0 24 24"
        >
          <path
            fill="currentColor"
            d="M15.07,11.25L14.17,12.17C13.45,12.89 13,13.5 13,15H11V14.5C11,13.39 11.45,12.39 12.17,11.67L13.41,10.41C13.78,10.05 14,9.55 14,9C14,7.89 13.1,7 12,7A2,2 0 0,0 10,9H8A4,4 0 0,1 12,5A4,4 0 0,1 16,9C16,9.88 15.64,10.67 15.07,11.25M13,19H11V17H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12C22,6.47 17.5,2 12,2Z"
          />
        </svg>
      </button>
    </div>
  </nav>
</template>

<script setup>
// Define props received from the parent component (App.vue)
const props = defineProps({
  version: {
    type: String,
    required: true,
  },
  isDark: {
    type: Boolean,
    default: false,
  },
});

// Define emits
defineEmits(['reset-form', 'toggle-theme', 'open-faq', 'print-page']);
</script>

<style scoped>
.ribbon {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #2c3e50;
  padding: 10px 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  position: sticky;
  top: 0;
  z-index: 1000;
  /* Break out of container to full width */
  width: 100vw;
  margin-left: calc(-50vw + 50%);
  box-sizing: border-box;
}

.ribbon-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.title-container {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.app-logo {
  max-width: 48px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  animation: fadeIn 2s ease-out forwards;
}

.app-logo:hover {
  animation: pulse 2s infinite;
}

.app-title {
  font-size: 24px;
  font-weight: bold;
  margin: 0;
  color: #ffffff;
  line-height: 1.2;
  text-align: left;
}

.app-version {
  font-size: 11px;
  color: #e0e0e0;
  font-weight: normal;
  text-align: left;
  margin-top: 2px;
}

.app-commit {
  color: #e0e0e0;
}

.offline-indicator {
  color: #ff6b6b;
  background-color: rgba(255, 255, 255, 0.2);
  padding: 0 5px;
  border-radius: 3px;
  font-size: 11px;
}

.ribbon-right {
  display: flex;
  align-items: center;
  gap: 5px;
}

.ribbon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ribbon-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.ribbon-btn:active {
  background: rgba(255, 255, 255, 0.25);
}

.btn-icon {
  width: 29px !important;
  height: 29px !important;
  min-width: 29px;
  min-height: 29px;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .ribbon {
    padding: 8px 10px;
  }
  
  .ribbon-left {
    gap: 10px;
  }
  
  .app-title {
    font-size: 16px;
  }
  
  .ribbon-btn {
    width: 36px;
    height: 36px;
  }
  
  .btn-icon {
    font-size: 18px;
  }
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
