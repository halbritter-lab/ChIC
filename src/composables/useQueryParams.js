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
    // Coerce numeric params to Number so validation (Number.isFinite) accepts them —
    // a raw string like "15000" fails Number.isFinite and would surface a spurious
    // "must be a number" error (issue #43). Trim first so a whitespace-only value is
    // not silently coerced to 0; keep a genuinely non-numeric value verbatim so real
    // validation errors still surface.
    const asNumber = (raw) => {
      const t = String(raw).trim();
      if (t === '') return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : raw;
    };
    if (q.height) {
      const v = asNumber(q.height);
      if (v !== null) height.value = v;
    }
    if (q.tlv) {
      const v = asNumber(q.tlv);
      if (v !== null) totalLiverVolume.value = v;
    }
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
