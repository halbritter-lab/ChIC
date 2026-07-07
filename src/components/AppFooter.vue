<template>
  <!-- Footer section with institution and funder logos -->
  <footer v-if="showFooter" class="footer">
    <div class="footer-box">
      <div class="footer-text">
        <p><strong>Please cite the following publications for this tool:</strong></p>
        <p>
          <a
            href="https://pubmed.ncbi.nlm.nih.gov/36246085/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Sierks et al., JHEP Reports 2022 (PMID 36246085)
          </a>
        </p>
        <p>
          <a
            href="https://pubmed.ncbi.nlm.nih.gov/38101549/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Schönauer et al., Gastroenterology 2024 (PMID 38101549)
          </a>
        </p>
        <p class="footer-note">
          The primary ChIC manuscript is in preparation; citation details will be added once it is
          published.
        </p>
        <p class="footer-break" aria-hidden="true" />
        <p>
          <a
            href="https://github.com/halbritter-lab/ChIC/blob/main/README.md"
            target="_blank"
            rel="noopener noreferrer"
            ><strong>Documentation Page</strong></a
          >
          &nbsp;|&nbsp;
          <a
            href="https://docs.google.com/forms/d/1MM4g1Ukjiy73ThWUMHARDcyQg-PwOWuI46kQV5HwXmY/viewform?edit_requested=true"
            target="_blank"
            rel="noopener noreferrer"
            ><strong>Feedback Form</strong></a
          >
        </p>
      </div>

      <hr class="footer-divider" />

      <div class="footer-logos">
        <a v-for="link in footerLinks" :key="link.name" :href="link.url" target="_blank">
          <img :src="withBase(link.img)" :alt="link.alt" class="institution-logo" />
        </a>
      </div>
    </div>
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

// Resolve public/ asset filenames against the Vite base path (/ChIC/ in production)
// so footer logos load correctly on the GitHub Pages subpath. Absolute URLs pass through.
const withBase = (path) =>
  /^https?:\/\//.test(path) ? path : `${import.meta.env.BASE_URL}${path}`;
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

.institution-logo,
.funder-logo {
  max-width: 120px;
  margin: 0 20px;
  vertical-align: middle; /* Align logos nicely */
}

.footer-box {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 18px;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.footer-text {
  text-align: center;
  max-width: 980px;
}
.footer-text p {
  margin: 4px 0;
  color: #222;
  font-size: 13px;
  line-height: 1.3;
}
.footer-text a {
  color: inherit;
  text-decoration: none;
}
.footer-text a:hover {
  color: var(--banner-right);
  text-decoration: underline;
  text-underline-offset: 2px;
  transition:
    color 120ms ease-in-out,
    text-decoration-color 120ms ease-in-out;
}
.footer-logos {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24px;
  width: 100%;
}
.footer-divider {
  width: 90%;
  border: none;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
  margin: 6px 0;
}

.footer-break {
  margin: 6px 0;
  height: 6px;
}
</style>
