// useDataPoints.js — the editable collection of calculated / imported data points.
import { ref } from 'vue';

export function useDataPoints() {
  const dataPoints = ref([]);
  const editingIndex = ref(null); // Track which row is being edited

  // Add a new row, or overwrite the row currently being edited.
  const addOrUpdatePoint = (row) => {
    if (editingIndex.value !== null) {
      dataPoints.value[editingIndex.value] = row;
      editingIndex.value = null;
    } else {
      dataPoints.value.push(row);
    }
  };

  const removeDataPoint = (index) => {
    dataPoints.value.splice(index, 1);
  };

  // Next numeric ID based on existing rows (ignores leading zeros).
  const computeNextId = () => {
    let max = 0;
    for (const p of dataPoints.value) {
      const n = parseInt(String(p.id).replace(/^0+/, ''), 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
    return max + 1;
  };

  const padId = (n) => String(n).padStart(3, '0');

  return { dataPoints, editingIndex, addOrUpdatePoint, removeDataPoint, computeNextId, padId };
}
