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
    const ceilingData = Array.from({ length: lineLength }, (_, i) => ({ x: startAge + i, y: CONFIG.CHART_Y_AXIS_MAX }));

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
          pointRadius: 5,
          pointHoverRadius: 7,
          showLine: false,
          order: 6 // Ensure patient data is drawn on top
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
          backgroundColor: '#BFE9FF33', // pastel blue
          order: 1
        },
        // Threshold T4 (highest) - defines fill between T4 and T3 (pastel sky blue)
        {
          label: 'Threshold 1.04 (PG5)',
          data: lineDataT4,
          borderColor: '#BFE9FF',
          borderWidth: 3,
          showLine: true,
          pointRadius: 0,
          fill: '+1', // fill down to T3
          backgroundColor: '#BFE9FF33', // pastel blue for above T4 (will be mostly covered by ceiling)
          order: 2
        },
        // Threshold T3
        {
          label: 'Threshold 1.03 (PG4)',
          data: lineDataT3,
          borderColor: '#64C8FF',
          borderWidth: 2,
          showLine: true,
          pointRadius: 0,
          fill: '+1', // fill down to T2
          backgroundColor: '#64C8FF33', // sky blue between T3 and T2
          order: 3
        },
        // Threshold T2
        {
          label: 'Threshold 1.02 (PG3)',
          data: lineDataT2,
          borderColor: '#8E9BFF',
          borderWidth: 2,
          showLine: true,
          pointRadius: 0,
          fill: '+1', // fill down to T1
          backgroundColor: '#8E9BFF33', // periwinkle between T2 and T3
          order: 4
        },
        // Threshold T1 (lowest)
        {
          label: 'Threshold 1.01 (PG2)',
          data: lineDataT1,
          borderColor: '#2B1B6F',
          borderWidth: 2,
          showLine: true,
          pointRadius: 0,
          fill: 'origin', // fill down to origin
          backgroundColor: '#E0E0E033', // gray fill under T1 to x-axis
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
            type: 'logarithmic',
            position: 'left',
            title: {
              display: true,
              text: 'Height-adjusted Total Liver Volume (htTLV)',
              font: {
                size: 16,
                weight: 'bold'
              }
            },
            min: 600,
            max: 10100,
            // Force specific tick marks on the logarithmic axis
            ticks: {
              autoSkip: false,
              callback: function(value) {
                const marks = [600, 800, 1000, 2000, 4000, 8000, 10000];
                // Show label only for specified marks
                return marks.includes(value) ? value.toLocaleString() : '';
              }
            },
            afterBuildTicks: function(scale) {
              const marks = [600, 800, 1000, 2000, 4000, 8000, 10000];
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
