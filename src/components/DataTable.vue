<template>
  <div
    v-if="dataPoints.length > 0"
    class="data-points-table-container"
  >
    <table class="data-points-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Age (y)</th>
          <th>Height (m)</th>
          <th>TLV (ml)</th>
          <th>htTLV</th>
          <th>Class</th>
          <th>LGR (%/y)</th>
          <th v-if="enableGrouping">
            Group
          </th>
          <th v-if="enableGrouping">
            Color
          </th>
          <th>Edit</th>
          <th>Remove</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(point, index) in dataPoints"
          :key="point.id"
          @click="$emit('edit-point', index)"
          :class="{ 'row-editing': editingIndex === index }"
          class="data-row"
        >
          <td>{{ point.id }}</td>
          <td>{{ point.age }}</td>
          <td>{{ point.height }}</td>
          <td>{{ point.tlv }}</td>
          <td>{{ point.htlv_formatted }}</td>
          <td>{{ formatLabel(point.pg) }}</td>
          <td>{{ point.lgr }}</td>
          <td v-if="enableGrouping">
            <input
              v-model="point.group"
              placeholder="Group"
              @change="$emit('update-chart-point', index)"
            >
          </td>
          <td v-if="enableGrouping">
            <input
              v-model="point.groupColor"
              placeholder="Color"
              @change="$emit('update-chart-point', index)"
            >
          </td>
          <td>
            <button
              @click.stop="$emit('edit-point', index)"
              class="edit-button"
              title="Edit this row"
            >
              ✎
            </button>
          </td>
          <td>
            <button @click.stop="$emit('remove-point', index)">
              -
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
// Results table for calculated / imported data points.
defineProps({
  dataPoints: { type: Array, required: true },
  enableGrouping: { type: Boolean, default: false },
  editingIndex: { type: Number, default: null },
  formatLabel: { type: Function, default: (v) => v },
});
defineEmits(['edit-point', 'remove-point', 'update-chart-point']);
</script>
