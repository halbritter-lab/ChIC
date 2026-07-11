// useDataPoints.js — the editable collection of calculated / imported data points.
import { ref } from 'vue';

export function useDataPoints() {
  const dataPoints = ref([]);
  // Track which row is being edited. -1 means "none" — the same sentinel the chart
  // highlight uses (ChartDisplay guards with `editingIndex < 0`), so the whole app
  // shares one value. (Using null broke that guard: `null < 0` is false.)
  const editingIndex = ref(-1);

  // Add a new row, or overwrite the row currently being edited.
  const addOrUpdatePoint = (row) => {
    if (editingIndex.value >= 0) {
      dataPoints.value[editingIndex.value] = row;
      editingIndex.value = -1;
    } else {
      dataPoints.value.push(row);
    }
  };

  // Remove a row and keep editingIndex pointing at the SAME logical row so the
  // highlight ring stays correct (issue #35):
  //   - removing the edited row itself  -> clear the highlight (-1);
  //   - removing a row ABOVE it         -> shift the index down by one;
  //   - removing a row BELOW it         -> leave it unchanged.
  const removeDataPoint = (index) => {
    dataPoints.value.splice(index, 1);
    const e = editingIndex.value;
    if (e === index) editingIndex.value = -1;
    else if (e > index) editingIndex.value = e - 1;
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
