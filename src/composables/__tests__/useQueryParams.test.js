import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { useQueryParams } from '../useQueryParams.js';

// Build a harness mirroring how App.vue wires the composable, with a fake router/route.
function harness(query) {
  const patientId = ref('');
  const age = ref(null);
  const height = ref(null);
  const totalLiverVolume = ref(null);
  const showModal = ref(true);
  const calculateDataPoint = vi.fn();
  const router = { isReady: () => Promise.resolve() };
  const route = { query };
  const api = useQueryParams({
    router,
    route,
    patientId,
    age,
    height,
    totalLiverVolume,
    calculateDataPoint,
    showModal,
  });
  return { patientId, age, height, totalLiverVolume, showModal, calculateDataPoint, ...api };
}

describe('useQueryParams — numeric coercion (issue #43)', () => {
  it('coerces tlv and height to Number so validation accepts them', async () => {
    const h = harness({ patientId: '12345', age: '50', height: '1.75', tlv: '15000' });
    await h.initFromQuery();
    expect(h.totalLiverVolume.value).toBe(15000);
    expect(typeof h.totalLiverVolume.value).toBe('number');
    expect(h.height.value).toBe(1.75);
    expect(typeof h.height.value).toBe('number');
    expect(h.age.value).toBe(50);
    // patientId + age + tlv present -> auto-calculate fired
    expect(h.calculateDataPoint).toHaveBeenCalledOnce();
  });

  it('keeps a genuinely non-numeric value verbatim so a real error still surfaces', async () => {
    const h = harness({ tlv: 'abc' });
    await h.initFromQuery();
    expect(h.totalLiverVolume.value).toBe('abc');
  });

  it('ignores a whitespace-only value instead of coercing it to 0', async () => {
    const h = harness({ tlv: '   ' });
    await h.initFromQuery();
    expect(h.totalLiverVolume.value).toBeNull();
  });

  it('still accepts tlv=0 (within TLV_MIN)', async () => {
    const h = harness({ tlv: '0' });
    await h.initFromQuery();
    expect(h.totalLiverVolume.value).toBe(0);
  });

  it('does not auto-calculate for a whitespace-only TLV', async () => {
    const h = harness({ patientId: 'p1', age: '50', height: '1.75', tlv: '   ' });
    await h.initFromQuery();
    expect(h.totalLiverVolume.value).toBeNull();
    expect(h.calculateDataPoint).not.toHaveBeenCalled();
  });

  it('treats whitespace-only age and height as absent', async () => {
    const h = harness({ patientId: 'p1', age: ' ', height: ' ', tlv: '15000' });
    await h.initFromQuery();
    expect(h.age.value).toBeNull();
    expect(h.height.value).toBeNull();
    expect(h.calculateDataPoint).not.toHaveBeenCalled();
  });

  it('uses the first value for repeated numeric query keys', async () => {
    const h = harness({ patientId: 'p1', age: ['50', '60'], height: ['1.75'], tlv: ['15000'] });
    await h.initFromQuery();
    expect(h.age.value).toBe(50);
    expect(h.height.value).toBe(1.75);
    expect(h.totalLiverVolume.value).toBe(15000);
    expect(h.calculateDataPoint).toHaveBeenCalledOnce();
  });
});
