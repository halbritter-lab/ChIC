// useQueryParams.js — embed/kiosk query-param API (see AGENTS.md invariant #6).
// Reads ?patientId=&age=&tlv= (auto-calculates when all three present),
// ?acknowledgeBanner=true, and showFooter/showCitation/showDocumentation/showControls=false.
import { ref } from 'vue';
import { CONFIG } from '@/config/config';

export function useQueryParams({
  router,
  route,
  patientId,
  age,
  totalLiverVolume,
  calculateDataPoint,
  showModal,
}) {
  const showFooter = ref(true);
  const showCitation = ref(true);
  const showDocumentation = ref(true);
  const showControls = ref(true);

  const initFromQuery = async () => {
    await router.isReady();
    const q = route.query;

    if (q.acknowledgeBanner === 'true') {
      showModal.value = false;
    }
    if (q.patientId) patientId.value = q.patientId;
    if (q.age) {
      // Clamp a numeric age into the supported range; keep non-numeric input verbatim
      // so downstream validation can surface the error.
      const parsed = Number(q.age);
      age.value = Number.isFinite(parsed)
        ? Math.min(Math.max(parsed, CONFIG.AGE_MIN), CONFIG.AGE_MAX)
        : q.age;
    }
    if (q.tlv) totalLiverVolume.value = q.tlv;
    if (q.patientId && q.age && q.tlv) {
      calculateDataPoint();
    }

    showFooter.value = q.showFooter !== 'false';
    showCitation.value = q.showCitation !== 'false';
    showDocumentation.value = q.showDocumentation !== 'false';
    showControls.value = q.showControls !== 'false';
  };

  return { showFooter, showCitation, showDocumentation, showControls, initFromQuery };
}
