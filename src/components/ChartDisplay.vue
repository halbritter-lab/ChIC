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
    // Generate data for background lines/areas based on formulas
    const lineLength = CONFIG.CHART_X_AXIS_MAX - CONFIG.CHART_X_AXIS_MIN + 1;
    const startAge = CONFIG.CHART_X_AXIS_MIN;
    const lineDataPG3 = formulas.generateLineData1(lineLength, startAge); // PG3 Threshold Data
    const lineDataPG2 = formulas.generateLineData2(lineLength, startAge); // PG2 Threshold Data

    // Dataset for the absolute top of the chart area (used for filling down)
    const ceilingData = Array.from({ length: (CONFIG.CHART_X_AXIS_MAX - CONFIG.CHART_X_AXIS_MIN) + 1 }, (_, i) => ({ x: CONFIG.CHART_X_AXIS_MIN + i, y: CONFIG.CHART_Y_AXIS_MAX }));

    chartInstance = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
        {
          label: 'Patient Data',
          data: props.dataPoints.map(p => ({
            x: p.age,
            y: p.ntlv,
            id: p.id,
            group: p.group,
            backgroundColor: p.groupColor || '#180C0C' // Original default color
          })),
          pointBackgroundColor: context => (context.raw ? context.raw.backgroundColor : '#180C0C'), // Use original default
          pointRadius: 5,
          pointHoverRadius: 7,
          showLine: false,
          order: 4 // Ensure patient data is drawn on top
        },
        // Replicating original background shading using datasets and simpler fills
        {
          label: 'Ceiling Line (for PG3 fill)', // Top boundary
          data: ceilingData,
          borderColor: 'transparent',
          borderWidth: 0,
          showLine: true,
          pointRadius: 0,
          fill: '+1', // Fill down to next dataset (PG3 Line)
          backgroundColor: '#B2241C33', // PG3 Area Color
          order: 1 // Draw first
        },
        {
          label: 'PG3 Threshold Line',
          data: lineDataPG3,
          borderColor: '#B2241C', // Original color for PG3 line
          borderWidth: 3, // Original width
          showLine: true,
          pointRadius: 0,
          fill: '+1', // Fill down to next dataset (PG2 Line)
          backgroundColor: '#F64C4633', // PG2 Area Color
          order: 2 // Draw second
        },
        {
          label: 'PG2 Threshold Line',
          data: lineDataPG2,
          borderColor: '#F64C46', // Original color for PG2 line
          borderWidth: 2, // Original width
          showLine: true,
          pointRadius: 0,
          fill: 'origin', // Fill down to origin (0)
          backgroundColor: '#FDA3A133', // PG1 Area Color
          order: 3 // Draw third
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
            title: {
              display: true,
              text: 'Age (years)',
              font: {
                size: 16,
                weight: 'bold'
              }
            },
            min: CONFIG.CHART_X_AXIS_MIN, // Use config value
            max: CONFIG.CHART_X_AXIS_MAX  // Use config value
          },
          y: {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: 'Normalized Total Liver Volume (nTLV)',
              font: {
                size: 16,
                weight: 'bold'
              }
            },
            min: 0, // Original used beginAtZero: true
            max: CONFIG.CHART_Y_AXIS_MAX // Use config value
          }
        },
        plugins: {
          legend: {
            display: false // Hide dataset label legend
          },
          tooltip: {
            callbacks: {
              label: function(context) {
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
    y: p.ntlv,
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
