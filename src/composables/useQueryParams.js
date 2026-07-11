// useQueryParams.js — embed/kiosk query-param API (see AGENTS.md invariant #6).
// Reads ?patientId=&age=&height=&tlv= (auto-calculates when patientId+age+tlv present;
// a Charité Imaging Class is only produced when a valid height is also supplied, since
// the model classifies on height-adjusted TLV), ?acknowledgeBanner=true, and
// showFooter/showCitation/showDocumentation/showControls=false.
import { ref } from 'vue';
import { CONFIG } from '@/config/config';

export function useQueryParams({
  router,
  route,
  patientId,
  age,
  height,
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
    const firstQueryValue = (raw) => (Array.isArray(raw) ? raw[0] : raw);

    if (firstQueryValue(q.acknowledgeBanner) === 'true') {
      showModal.value = false;
    }
    const asNumber = (raw) => {
      const value = firstQueryValue(raw);
      if (value === undefined || value === null) return null;
      const text = String(value).trim();
      if (text === '') return null;
      const number = Number(text);
      return Number.isFinite(number) ? number : value;
    };

    const patientParam = firstQueryValue(q.patientId);
    const ageParam = asNumber(q.age);
    const heightParam = asNumber(q.height);
    const tlvParam = asNumber(q.tlv);

    if (patientParam !== undefined && patientParam !== null && String(patientParam).trim() !== '') {
      patientId.value = patientParam;
    }
    if (ageParam !== null) {
      age.value = Number.isFinite(ageParam)
        ? Math.min(Math.max(ageParam, CONFIG.AGE_MIN), CONFIG.AGE_MAX)
        : ageParam;
    }
    if (heightParam !== null) height.value = heightParam;
    if (tlvParam !== null) totalLiverVolume.value = tlvParam;

    if (
      patientParam !== undefined &&
      patientParam !== null &&
      String(patientParam).trim() !== '' &&
      ageParam !== null &&
      tlvParam !== null
    ) {
      calculateDataPoint();
    }

    showFooter.value = firstQueryValue(q.showFooter) !== 'false';
    showCitation.value = firstQueryValue(q.showCitation) !== 'false';
    showDocumentation.value = firstQueryValue(q.showDocumentation) !== 'false';
    showControls.value = firstQueryValue(q.showControls) !== 'false';
  };

  return { showFooter, showCitation, showDocumentation, showControls, initFromQuery };
}
