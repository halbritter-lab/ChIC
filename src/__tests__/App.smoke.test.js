import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import { nextTick } from 'vue';
import App from '@/App.vue';

// ChartDisplay renders a real <canvas> + Chart.js, which jsdom cannot back.
// Stub it so we can smoke-test the rest of App at the component level.
// App uses the router (useQueryParams awaits router.isReady()), so provide a
// memory-history router in the test.
const makeRouter = () =>
  createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'Home', component: App }],
  });

const mountApp = async () => {
  const router = makeRouter();
  router.push('/');
  await router.isReady();
  return mount(App, {
    global: {
      plugins: [router],
      stubs: {
        ChartDisplay: {
          template: '<div data-test="chart-stub" />',
          methods: { clearChart() {} },
        },
      },
    },
  });
};

describe('App smoke', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('mounts without throwing', async () => {
    const wrapper = await mountApp();
    expect(wrapper.exists()).toBe(true);
  });

  it('shows the disclaimer gate when not acknowledged', async () => {
    localStorage.removeItem('disclaimerAcknowledged');
    const wrapper = await mountApp();
    // DisclaimerModal is rendered with showModal=true; its acknowledgment UI is present.
    expect(wrapper.findComponent({ name: 'DisclaimerModal' }).exists()).toBe(true);
    expect(wrapper.html()).toMatch(/disclaimer|acknowledge/i);
  });

  it('renders the main tool (input controls) once the disclaimer is acknowledged', async () => {
    localStorage.setItem('disclaimerAcknowledged', 'true');
    const wrapper = await mountApp();
    expect(wrapper.findComponent({ name: 'InputControls' }).exists()).toBe(true);
    // Chart area is present (stubbed).
    expect(wrapper.find('[data-test="chart-stub"]').exists()).toBe(true);
  });

  it('resets the edit cursor before calculating a new row', async () => {
    localStorage.setItem('disclaimerAcknowledged', 'true');
    const wrapper = await mountApp();
    wrapper.vm.dataPoints = [
      { id: 'first', age: 40, height: 1.7, tlv: 3400 },
      { id: 'second', age: 50, height: 1.8, tlv: 3600 },
    ];
    await nextTick();

    wrapper.vm.editDataPoint(1);
    wrapper.vm.resetForm();
    wrapper.vm.patientId = 'new';
    wrapper.vm.age = 45;
    wrapper.vm.height = 1.75;
    wrapper.vm.totalLiverVolume = 3500;
    await nextTick();
    wrapper.vm.calculateDataPoint();

    expect(wrapper.vm.editingIndex).toBe(-1);
    expect(wrapper.vm.dataPoints).toHaveLength(1);
    expect(wrapper.vm.dataPoints.map((point) => point.id)).toEqual(['new']);
    expect(wrapper.vm.dataPoints.every((point) => point !== undefined)).toBe(true);
  });
});
