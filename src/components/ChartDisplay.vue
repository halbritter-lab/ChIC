<template>
  <div class="chart-container">
    <canvas ref="chartCanvas" />
    <svg ref="overlayCanvas" class="ring-overlay"></svg>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { Chart, registerables, Filler } from 'chart.js'; // Added Filler for background fills
import { formulas } from '@/config/formulasConfig'; // Import formulas
import { CONFIG } from '@/config/config'; // Import CONFIG for axis limits, ticks and class colors

// Register Chart.js components and plugins
Chart.register(...registerables);
Chart.register(Filler); // Register Filler for fills like '+1', 'origin'

// Props definition
const props = defineProps({
  dataPoints: { type: Array, required: true },
  enableGrouping: { type: Boolean, default: false },
  group: { type: String, default: '' },
  groupColor: { type: String, default: '' },
  editingIndex: { type: Number, default: -1 },
});

const chartCanvas = ref(null);
const overlayCanvas = ref(null);
let chartInstance = null;
let isInitialLoad = true; // Track if this is the first render

// Function to draw ring overlay around selected point
const drawRingOverlay = () => {
  const overlay = overlayCanvas.value;
  if (!overlay || !chartInstance) return;

  // Clear overlay
  while (overlay.firstChild) {
    overlay.removeChild(overlay.firstChild);
  }

  // If no editing index, nothing to draw
  if (props.editingIndex < 0 || props.editingIndex >= props.dataPoints.length) return;

  const point = props.dataPoints[props.editingIndex];
  // An uncalculable row (missing height/age/TLV — issue #37) has htlv: null and is not
  // plotted; getPixelForValue(null) would place the ring at a bogus coordinate, so skip.
  if (!point || !Number.isFinite(point.htlv)) return;
  const canvas = chartCanvas.value;
  const canvasRect = canvas.getBoundingClientRect();
  const containerRect = overlayCanvas.value.parentElement.getBoundingClientRect();

  // Get pixel coordinates from Chart.js
  const dataX = chartInstance.scales.x.getPixelForValue(point.age);
  const dataY = chartInstance.scales.y.getPixelForValue(point.htlv);

  // Set overlay canvas size and viewBox to match chart canvas exactly
  overlay.setAttribute('width', canvas.width);
  overlay.setAttribute('height', canvas.height);
  overlay.setAttribute('viewBox', `0 0 ${canvas.width} ${canvas.height}`);

  // Position SVG to match canvas position
  const offsetX = canvasRect.left - containerRect.left;
  const offsetY = canvasRect.top - containerRect.top;
  overlay.style.left = offsetX + 'px';
  overlay.style.top = offsetY + 'px';

  // Draw white ring
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', dataX);
  circle.setAttribute('cy', dataY);
  circle.setAttribute('r', '7');
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke', 'white');
  circle.setAttribute('stroke-width', '3');
  circle.setAttribute('pointer-events', 'none');

  overlay.appendChild(circle);
};

// Function to initialize the chart
const initChart = () => {
  if (chartCanvas.value) {
    const ctx = chartCanvas.value.getContext('2d', { willReadFrequently: true });
    // Detect dark theme and set grid/tick colors accordingly
    const isDark =
      typeof document !== 'undefined' && document.body.classList.contains('dark-theme');
    // Only override grid/tick colors in dark theme. Leave light theme to Chart.js defaults.
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : undefined;
    const tickColor = isDark ? '#dfeaf7' : undefined;

    // The chart keeps a fixed 5/3 aspect ratio on every device (issue #7), so on
    // phones the whole canvas is small; scale the axis typography with the canvas
    // width so titles/ticks don't crowd out the plot area.
    const axisTitleFont = (ctx) => ({ size: ctx.chart.width < 520 ? 12 : 16, weight: 'bold' });
    const axisTickFont = (ctx) => ({ size: ctx.chart.width < 520 ? 10 : 12 });

    // The rotated full y-title (~267px at 12px) is taller than the plot on small
    // canvases and gets truncated; fall back to the established abbreviation.
    const Y_TITLE_FULL = 'Height-Adjusted Total Liver Volume (htTLV)';
    const Y_TITLE_SHORT = 'htTLV';
    const yTitleFor = (width) => (width < 520 ? Y_TITLE_SHORT : Y_TITLE_FULL);

    // Generate data for background lines/areas based on formulas
    const lineLength = CONFIG.CHART_X_MAX - CONFIG.CHART_X_MIN + 1;
    const startAge = CONFIG.CHART_X_MIN;
    // Generate line data for each threshold curve (T1..T4)
    const lineDataT1 = Array.from({ length: lineLength }, (_, i) => {
      const a = startAge + i;
      return { x: a, y: formulas.calculateThreshold01(a) };
    });
    const lineDataT2 = Array.from({ length: lineLength }, (_, i) => {
      const a = startAge + i;
      return { x: a, y: formulas.calculateThreshold02(a) };
    });
    const lineDataT3 = Array.from({ length: lineLength }, (_, i) => {
      const a = startAge + i;
      return { x: a, y: formulas.calculateThreshold03(a) };
    });
    const lineDataT4 = Array.from({ length: lineLength }, (_, i) => {
      const a = startAge + i;
      return { x: a, y: formulas.calculateThreshold04(a) };
    });

    // Dataset for the absolute top of the chart area (used for filling down).
    // Use the chart's y-axis max so the ceiling sits above the threshold curves.
    const CEILING_Y = CONFIG.CHART_Y_MAX;
    const ceilingData = Array.from({ length: lineLength }, (_, i) => ({
      x: startAge + i,
      y: CEILING_Y,
    }));

    // Note: using a dataset for the left-side (T4->y-axis) fill so it animates with the chart.

    chartInstance = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          // (Thresholds, fills and baseline datasets are listed first so they render below patient points)
          // Ceiling for top fill (area above T4)
          {
            label: 'Ceiling',
            data: ceilingData,
            borderColor: 'transparent',
            borderWidth: 0,
            showLine: true,
            pointRadius: 0,
            fill: '+1', // fill down to T4
            backgroundColor: CONFIG.CLASS_COLORS.E.band, // Class E band (above T4)
            order: 1,
          },
          // Threshold T4 (highest) - visible line only (no fill)
          {
            label: 'Threshold 4',
            data: lineDataT4,
            borderColor: CONFIG.CLASS_COLORS.E.border,
            borderWidth: 3,
            showLine: true,
            pointRadius: 0,
            fill: false,
            order: 2,
          },
          // Animated polygon dataset to shade the area between T4 curve and the y-axis (CHART_X_MIN)
          {
            type: 'line',
            label: '',
            data: (function () {
              const leftX = CONFIG.CHART_X_MIN;
              const rightSide = lineDataT4.map((p) => ({ x: p.x, y: p.y }));
              const leftSide = lineDataT4.map((p) => ({ x: leftX, y: p.y })).reverse();
              return rightSide.concat(leftSide);
            })(),
            borderColor: 'transparent',
            borderWidth: 0,
            showLine: true,
            pointRadius: 0,
            pointHoverRadius: 0,
            tension: 0,
            spanGaps: true,
            fill: true,
            backgroundColor: CONFIG.CLASS_COLORS.E.band,
            isFill: true,
            order: 1.5,
          },

          // Threshold T3
          {
            label: 'Threshold 3',
            data: lineDataT3,
            borderColor: CONFIG.CLASS_COLORS.D.border,
            borderWidth: 2,
            showLine: true,
            pointRadius: 0,
            fill: '-1', // fill up to previous dataset (T4) — band between T3 and T4
            backgroundColor: CONFIG.CLASS_COLORS.D.band, // Class D band (sky blue translucent)
            order: 3,
          },
          // Threshold T2
          {
            label: 'Threshold 2',
            data: lineDataT2,
            borderColor: CONFIG.CLASS_COLORS.C.border,
            borderWidth: 2,
            showLine: true,
            pointRadius: 0,
            fill: '-1', // fill up to previous dataset (T3)
            backgroundColor: CONFIG.CLASS_COLORS.C.band, // Class C band (periwinkle translucent)
            order: 4,
          },
          // T1: two separate fill datasets to control above/below fills, plus baseline and visible line
          // Fill between T1 and T2 (PG2 color)
          {
            type: 'line',
            label: 'T1 Above Fill',
            data: lineDataT1,
            borderColor: 'transparent',
            borderWidth: 0,
            showLine: false,
            pointRadius: 0,
            spanGaps: true,
            tension: 0,
            fill: '-1', // fill up to previous dataset (T2)
            backgroundColor: CONFIG.CLASS_COLORS.B.band, // Class B band (between T1 and T2)
            order: 4.5,
          },
          // Fill between T1 and baseline (PG1 color)
          {
            type: 'line',
            label: 'T1 Below Fill',
            data: lineDataT1,
            borderColor: 'transparent',
            borderWidth: 0,
            showLine: false,
            pointRadius: 0,
            spanGaps: true,
            tension: 0,
            fill: '+1', // fill down to next dataset (baseline)
            backgroundColor: CONFIG.CLASS_COLORS.A.band, // Class A band (between T1 and baseline)
            order: 4.6,
          },
          // Baseline dataset used as fill target for T1 below-fill
          {
            type: 'line',
            label: 'Baseline',
            data: Array.from({ length: lineLength }, (_, i) => ({
              x: startAge + i,
              y: CONFIG.MODEL.CLASS_BASELINE_ML_PER_M,
            })),
            borderColor: 'transparent',
            borderWidth: 0,
            showLine: false,
            pointRadius: 0,
            fill: false,
            order: 4.7,
          },
          // Visible Threshold T1 line drawn on top of fills.
          // order must be BELOW its two fills (T1 Above Fill 4.5, T1 Below Fill 4.6) so the
          // stroke paints in front of them — a higher order draws first/behind and the
          // translucent fills then over-paint the line, making the lowest line look faded
          // and broken (issue #36). T2–T4 carry their fill on the same dataset, so their
          // strokes already sit above their fill; T1's line is a separate dataset and needs
          // this explicit lower order. 4.4 < 4.5 keeps it above the fills but still behind
          // the patient points (order -1). No array position or fill '+1'/'-1' target changes,
          // so the class bands (invariant #3) are unaffected.
          {
            type: 'line',
            label: 'Threshold 1',
            data: lineDataT1,
            borderColor: CONFIG.CLASS_COLORS.B.border,
            borderWidth: 2,
            showLine: true,
            pointRadius: 0,
            fill: false,
            order: 4.4,
          },
          // Patient Data: render this dataset last so points appear above fills and lines
          {
            label: 'Patient Data',
            data: props.dataPoints.map((p) => ({
              x: p.age,
              y: p.htlv,
              id: p.id,
              group: p.group,
              backgroundColor: p.groupColor || CONFIG.DEFAULT_POINT_COLOR,
            })),
            pointBackgroundColor: (context) =>
              context.raw ? context.raw.backgroundColor : CONFIG.DEFAULT_POINT_COLOR,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 0,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointStyle: 'circle',
            showLine: false,
            order: -1, // Lower order = drawn on top in Chart.js
          },
          // Highlighted point dataset
          {
            label: 'Selected Point',
            data:
              props.editingIndex >= 0 && props.editingIndex < props.dataPoints.length
                ? [
                    {
                      x: props.dataPoints[props.editingIndex].age,
                      y: props.dataPoints[props.editingIndex].htlv,
                      id: props.dataPoints[props.editingIndex].id,
                    },
                  ]
                : [],
            pointBackgroundColor: 'transparent',
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 4,
            pointRadius: 8,
            pointHoverRadius: 11,
            pointStyle: 'circle',
            showLine: false,
            order: -2, // Even lower order = drawn above other data points
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, // the container enforces the 5/3 ratio via CSS (issue #7)
        // Chart.js invokes onResize before its own update('resize'), so option
        // mutations here are picked up by the layout pass that follows.
        onResize: (chart, size) => {
          chart.options.scales.y.title.text = yTitleFor(size.width);
        },
        events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            grid: {
              color: gridColor,
            },
            title: {
              display: true,
              text: 'Age (years)',
              font: axisTitleFont,
            },
            ticks: {
              color: tickColor,
              font: axisTickFont,
            },
            min: CONFIG.CHART_X_MIN,
            max: CONFIG.CHART_X_MAX,
          },
          y: {
            type: 'logarithmic',
            position: 'left',
            grid: {
              color: gridColor,
            },
            title: {
              display: true,
              text: yTitleFor(chartCanvas.value.parentElement.clientWidth),
              font: axisTitleFont,
            },
            ticks: {
              color: tickColor,
              font: axisTickFont,
              autoSkip: false,
              callback: function (value) {
                return CONFIG.CHART_Y_TICKS.includes(value) ? value.toLocaleString() : '';
              },
            },
            min: CONFIG.CHART_Y_MIN,
            max: CONFIG.CHART_Y_MAX,
            // Force specific tick marks on the logarithmic axis
            afterBuildTicks: function (scale) {
              // Replace automatically generated ticks with our configured marks
              scale.ticks = CONFIG.CHART_Y_TICKS.map((v) => ({ value: v }));
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                // Hide fill-only datasets from the tooltip
                if (context.dataset && context.dataset.isFill) return null;
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.x !== null) label += context.parsed.x;
                if (context.parsed.y !== null) label += ', ' + context.parsed.y.toFixed(2);
                const dataPoint = context.raw;
                if (dataPoint && dataPoint.id) label += `; ID: ${dataPoint.id}`;
                return label;
              },
            },
          },
        },
      },
    });
  }
};

// Function to update the chart data
const updateChart = (shouldAnimate = true) => {
  if (!chartInstance) return;
  const pdIndex = chartInstance.data.datasets.findIndex((d) => d.label === 'Patient Data');
  if (pdIndex === -1) return;
  chartInstance.data.datasets[pdIndex].data = props.dataPoints.map((p) => ({
    x: p.age,
    y: p.htlv,
    id: p.id,
    group: p.group,
    backgroundColor: p.groupColor || CONFIG.DEFAULT_POINT_COLOR,
  }));

  if (shouldAnimate) {
    // Animate point additions with fly-in effect from bottom
    chartInstance.update({
      animation: {
        duration: 750,
        easing: 'easeInOutQuart',
      },
    });
  } else {
    // No animation for certain updates
    chartInstance.update('none');
  }
};

// Function to update a specific point's appearance (e.g., color, group info for tooltips)
const updateChartPoint = (index, sample) => {
  if (!chartInstance) return;
  const pdIndex = chartInstance.data.datasets.findIndex((d) => d.label === 'Patient Data');
  if (pdIndex === -1 || !chartInstance.data.datasets[pdIndex].data[index]) return;

  const chartPoint = chartInstance.data.datasets[pdIndex].data[index];
  chartPoint.backgroundColor = sample.groupColor || CONFIG.DEFAULT_POINT_COLOR; // Update color (original default)
  chartPoint.group = sample.group; // Update group info for tooltip

  chartInstance.update(); // Update the chart to reflect changes
};

// Update a single patient point's colour + group label from (index, color, group).
// Called imperatively by App.vue when a row's group/colour is edited in the table.
const updatePointStyle = (index, color, group) => {
  if (!chartInstance) return;
  const pdIndex = chartInstance.data.datasets.findIndex((d) => d.label === 'Patient Data');
  if (pdIndex === -1) return;
  const chartPoint = chartInstance.data.datasets[pdIndex].data[index];
  if (!chartPoint) return;
  chartPoint.backgroundColor = color || CONFIG.DEFAULT_POINT_COLOR;
  chartPoint.group = group;
  chartInstance.update();
};

// Clear ONLY the patient/selected points — never the threshold-curve or class-fill datasets.
const clearChart = () => {
  if (!chartInstance) return;
  for (const label of ['Patient Data', 'Selected Point']) {
    const i = chartInstance.data.datasets.findIndex((d) => d.label === label);
    if (i !== -1) chartInstance.data.datasets[i].data = [];
  }
  chartInstance.update();
  // Also remove any highlight ring so a reset/clear leaves no stale overlay (issue #35).
  drawRingOverlay();
};

// Function to download the chart as PNG
const downloadChart = () => {
  // Ensure the ref is available and chart instance exists
  if (!chartCanvas.value || !chartInstance) {
    console.error('Canvas element or chart instance not available for download.');
    return;
  }

  // Temporarily hide the "Selected Point" dataset
  const spIndex = chartInstance.data.datasets.findIndex((d) => d.label === 'Selected Point');
  let originalData = null;
  if (spIndex !== -1) {
    originalData = chartInstance.data.datasets[spIndex].data;
    chartInstance.data.datasets[spIndex].data = [];
  }

  // Pure draw() - zero shudder
  chartInstance.draw();

  // Read pixels directly from the canvas
  const pngUrl = chartCanvas.value.toDataURL('image/png');

  // Restore the "Selected Point" dataset immediately
  if (spIndex !== -1 && originalData !== null) {
    chartInstance.data.datasets[spIndex].data = originalData;
    chartInstance.draw();
  }

  // Trigger download
  const link = document.createElement('a');
  link.href = pngUrl;
  link.download = 'pld-progression-chart.png';
  link.click();
};

// Expose imperative chart operations to the parent (App.vue) via its template ref.
defineExpose({ downloadChart, updateChartPoint, updatePointStyle, clearChart });

onMounted(() => {
  initChart();
});

onUnmounted(() => {
  // Destroy chart instance
  if (chartInstance) {
    chartInstance.destroy();
  }
});

// Watch for changes in data points or grouping to update the chart
watch(
  [() => props.dataPoints, () => props.enableGrouping, () => props.group, () => props.groupColor],
  () => {
    if (!isInitialLoad) {
      // After initial load, always animate data changes
      updateChart(true);
    } else {
      // On initial load, mark it as done and animate if there's data
      isInitialLoad = false;
      // Animate on initial load if data is present
      updateChart(props.dataPoints.length > 0);
    }
    // Reposition or clear the highlight ring on any data change. Deleting a point only
    // changes dataPoints (not editingIndex-by-value when a different row is removed), so
    // the editingIndex watcher alone would leave a stale ring at old coordinates (issue #35).
    drawRingOverlay();
  },
  { deep: true }
);

// Separate watcher for editingIndex to only update the selected point without re-rendering patient data
// Uses pure SVG overlay - no chart modifications, no shudder
watch(
  () => props.editingIndex,
  () => {
    drawRingOverlay();
  }
);
</script>

<style scoped>
.chart-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 20px;
  /* No width/height here: sizing (fixed 5/3 aspect ratio, issue #7) lives solely in
     styles/controls.css — a scoped rule would out-specify it and re-fork the cascade. */
  position: relative;
}

.ring-overlay {
  position: absolute;
  pointer-events: none;
  display: block;
}
</style>
