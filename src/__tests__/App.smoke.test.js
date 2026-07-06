import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '@/App.vue'

// ChartDisplay renders a real <canvas> + Chart.js, which jsdom cannot back.
// Stub it so we can smoke-test the rest of App at the component level.
const mountApp = () =>
  mount(App, {
    global: {
      stubs: {
        ChartDisplay: { template: '<div data-test="chart-stub" />' },
      },
    },
  })

describe('App smoke', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('mounts without throwing', () => {
    const wrapper = mountApp()
    expect(wrapper.exists()).toBe(true)
  })

  it('shows the disclaimer gate when not acknowledged', () => {
    localStorage.removeItem('disclaimerAcknowledged')
    const wrapper = mountApp()
    // DisclaimerModal is rendered with showModal=true; its acknowledgment UI is present.
    expect(wrapper.findComponent({ name: 'DisclaimerModal' }).exists()).toBe(true)
    expect(wrapper.html()).toMatch(/disclaimer|acknowledge/i)
  })

  it('renders the main tool (input controls) once the disclaimer is acknowledged', async () => {
    localStorage.setItem('disclaimerAcknowledged', 'true')
    const wrapper = mountApp()
    expect(wrapper.findComponent({ name: 'InputControls' }).exists()).toBe(true)
    // Chart area is present (stubbed).
    expect(wrapper.find('[data-test="chart-stub"]').exists()).toBe(true)
  })
})
