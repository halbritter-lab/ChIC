<template>
  <div class="chart-container">
    <canvas ref="chartCanvas" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, defineProps, defineExpose } from 'vue';
import { Chart, registerables, Filler } from 'chart.js'; // Added Filler for background fills
import annotationPlugin from 'chartjs-plugin-annotation'; // Import annotation plugin
import { formulas } from '@/config/formulasConfig'; // Import formulas
import { CONFIG } from '@/config/config'; // Import CONFIG for axis limits
import html2canvas from 'html2canvas';

// Register Chart.js components and plugins
Chart.register(...registerables);
Chart.register(Filler); // Register Filler for fills like '+1', 'origin'
// Keep annotation plugin registered if other annotations might be used, otherwise remove.
// Chart.register(annotationPlugin); 

// Props definition
const props = defineProps({
  dataPoints: { type: Array, required: true },
  enableGrouping: { type: Boolean, default: false },
  group: { type: String, default: '' },
  groupColor: { type: String, default: '' }
});

const chartCanvas = ref(null);
let chartInstance = null;

// Function to initialize the chart
const initChart = () => {
  if (chartCanvas.value) {
    const ctx = chartCanvas.value.getContext('2d', { willReadFrequently: true });
    // Detect dark theme and set grid/tick colors accordingly
    const isDark = typeof document !== 'undefined' && document.body.classList.contains('dark-theme');
    // Only override grid/tick colors in dark theme. Leave light theme to Chart.js defaults.
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : undefined;
    const tickColor = isDark ? '#dfeaf7' : undefined;

    // Generate data for background lines/areas based on formulas
    const lineLength = CONFIG.CHART_X_AXIS_MAX - CONFIG.CHART_X_AXIS_MIN + 1;
    const startAge = CONFIG.CHART_X_AXIS_MIN;
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

    // Dataset for the absolute top of the chart area (used for filling down)
    // Use the chart's y-axis max (10100) so the ceiling sits above threshold curves
    const CEILING_Y = 10100;
    const ceilingData = Array.from({ length: lineLength }, (_, i) => ({ x: startAge + i, y: CEILING_Y }));

    // Note: using a dataset for the left-side (T4->y-axis) fill so it animates with the chart.

    chartInstance = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
        {
          label: 'Patient Data',
          data: props.dataPoints.map(p => ({
            x: p.age,
            y: p.htlv,
            id: p.id,
            group: p.group,
            backgroundColor: p.groupColor || '#180C0C'
          })),
          pointBackgroundColor: context => (context.raw ? context.raw.backgroundColor : '#180C0C'),
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1,
          pointRadius: 6,
          pointHoverRadius: 8,
          pointStyle: 'circle',
          showLine: false,
          order: 9999 // Force patient data to render above all threshold/fill datasets
        },
        // Ceiling for top fill (area above T4)
        {
          label: 'Ceiling',
          data: ceilingData,
          borderColor: 'transparent',
          borderWidth: 0,
          showLine: true,
          pointRadius: 0,
          fill: '+1', // fill down to T4
          backgroundColor: '#BFE9FF33', // pastel blue (unchanged)
          order: 1
        },
        // Threshold T4 (highest) - visible line only (no fill)
        {
          label: 'Threshold 4',
          data: lineDataT4,
          borderColor: '#BFE9FF',
          borderWidth: 3,
          showLine: true,
          pointRadius: 0,
          fill: false,
          order: 2
        },
        // Animated polygon dataset to shade the area between T4 curve and the y-axis (CHART_X_AXIS_MIN)
        {
          type: 'line',
          label: '',
          data: (function(){
            const leftX = CONFIG.CHART_X_AXIS_MIN;
            const rightSide = lineDataT4.map(p => ({ x: p.x, y: p.y }));
            const leftSide = lineDataT4.map(p => ({ x: leftX, y: p.y })).reverse();
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
          backgroundColor: '#BFE9FF33',
          isFill: true,
          order: 1.5
        },
        
        // Threshold T3
        {
          label: 'Threshold 3',
          data: lineDataT3,
          borderColor: '#64C8FF',
          borderWidth: 2,
          showLine: true,
          pointRadius: 0,
          fill: '-1', // fill up to previous dataset (T4) — band between T3 and T4
          backgroundColor: '#64C8FF33', // match PG4 box shading (sky blue translucent)
          order: 3
        },
        // Threshold T2
        {
          label: 'Threshold 2',
          data: lineDataT2,
          borderColor: '#8E9BFF',
          borderWidth: 2,
          showLine: true,
          pointRadius: 0,
          fill: '-1', // fill up to previous dataset (T3)
          backgroundColor: '#8E9BFF33', // match PG3 box shading (periwinkle translucent)
          order: 4
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
          backgroundColor: 'rgba(43,27,111,0.20)', // PG2 box shading (slightly darker to match PG2 box)
          order: 4.5
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
          backgroundColor: 'rgba(60,60,60,0.24)', // PG1 translucent (match .PG1 color, darker)
          order: 4.6
        },
        // Baseline dataset used as fill target for T1 below-fill
        {
          type: 'line',
          label: 'Baseline',
          data: Array.from({ length: lineLength }, (_, i) => ({ x: startAge + i, y: 600 })),
          borderColor: 'transparent',
          borderWidth: 0,
          showLine: false,
          pointRadius: 0,
          fill: false,
          order: 4.7
        },
        // Visible Threshold T1 line drawn on top of fills
        {
          type: 'line',
          label: 'Threshold 1',
          data: lineDataT1,
          borderColor: '#2B1B6F',
          borderWidth: 2,
          showLine: true,
          pointRadius: 0,
          fill: false,
          order: 5
        }
       ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, // Set back to false to allow explicit CSS height
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
              font: {
                size: 16,
                weight: 'bold'
              }
            },
            ticks: {
              color: tickColor
            },
            min: CONFIG.CHART_X_AXIS_MIN, // Use config value
            max: CONFIG.CHART_X_AXIS_MAX  // Use config value
          },
          y: {
            type: 'logarithmic',
            position: 'left',
            grid: {
              color: gridColor,
            },
            title: {
              display: true,
              text: 'Height-Adjusted Total Liver Volume (htTLV)',
              font: {
                size: 16,
                weight: 'bold'
              }
            },
            ticks: {
              color: tickColor,
              autoSkip: false,
              callback: function(value) {
                const marks = [600, 800, 1000, 2000, 4000, 6000, 8000, 10000];
                return marks.includes(value) ? value.toLocaleString() : '';
              }
            },
            min: 600,
            max: 10100,
            // Force specific tick marks on the logarithmic axis
            afterBuildTicks: function(scale) {
                const marks = [600, 800, 1000, 2000, 4000, 6000, 8000, 10000];
              // Replace automatically generated ticks with our marks
              scale.ticks = marks.map(v => ({ value: v }));
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                    // Hide fill-only datasets from the tooltip
                    if (context.dataset && context.dataset.isFill) return null;
                    let label = context.dataset.label || '';
                    if (label) label += ': ';
                    if (context.parsed.x !== null) label += context.parsed.x;
                    if (context.parsed.y !== null) label += ', ' + context.parsed.y.toFixed(2);
                    const dataPoint = context.raw;
                    if (dataPoint && dataPoint.id) label += `; ID: ${dataPoint.id}`;
                    return label;
                  }
            }
          }
        }
      }
    });
  }
};

// Function to update the chart data
const updateChart = () => {
  if (!chartInstance) return;
  chartInstance.data.datasets[0].data = props.dataPoints.map(p => ({
    x: p.age,
    y: p.htlv,
    id: p.id,
    group: p.group,
    backgroundColor: p.groupColor || '#180C0C' // Use group color or default
  }));
  chartInstance.update();
};

// Function to update a specific point's appearance (e.g., color, group info for tooltips)
const updateChartPoint = (index, sample) => {
  if (!chartInstance || !chartInstance.data.datasets[0].data[index]) return;

  const chartPoint = chartInstance.data.datasets[0].data[index];
  chartPoint.backgroundColor = sample.groupColor || '#180C0C'; // Update color (original default)
  chartPoint.group = sample.group; // Update group info for tooltip

  chartInstance.update(); // Update the chart to reflect changes
};

// Function to download the chart as PNG
const downloadChart = async () => {
  // Ensure the ref is available and chart instance exists
  if (!chartCanvas.value || !chartInstance) {
    console.error('Canvas element or chart instance not available for download.');
    return;
  }

  // Create PNG
  const canvas = await html2canvas(chartCanvas.value);
  const pngUrl = canvas.toDataURL('image/png');
  let downloadLink = document.createElement('a');
  downloadLink.href = pngUrl;
  downloadLink.download = 'pld-progression-chart.png';
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
};

// Expose downloadChart and updateChartPoint functions so they can be called from parent if needed
defineExpose({ downloadChart, updateChartPoint });

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
watch([
  () => props.dataPoints,
  () => props.enableGrouping,
  () => props.group,
  () => props.groupColor
], updateChart, { deep: true });

</script>

<style scoped>
.chart-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 20px;
}
canvas {
  max-width: 100%;
  height: auto;
}
</style>
