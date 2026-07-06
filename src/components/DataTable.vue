<template>
  <div v-if="dataPoints.length > 0" class="data-points-table-container">
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
          <th v-if="enableGrouping">Group</th>
          <th v-if="enableGrouping">Color</th>
          <th>Edit</th>
          <th>Remove</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(point, index) in dataPoints"
          :key="point.id"
          class="data-row"
          :class="{ 'row-editing': editingIndex === index }"
          role="button"
          tabindex="0"
          @click="$emit('edit-point', index)"
          @keydown.enter.prevent="$emit('edit-point', index)"
          @keydown.space.prevent="$emit('edit-point', index)"
        >
          <td>{{ point.id }}</td>
          <td>{{ point.age }}</td>
          <td>{{ point.height }}</td>
          <td>{{ point.tlv }}</td>
          <!-- htTLV: measured value, or an unvalidated estimate when height was missing -->
          <td>
            <span
              v-if="point.htlvEstimated"
              class="estimated"
              title="Unvalidated estimate — measured height missing"
              >≈ {{ formatHtTLV(point.estimatedHtTLV) }}</span
            >
            <template v-else>{{ formatHtTLV(point.htlv) }}</template>
          </td>
          <!-- Charité Imaging Class: measured, or estimated (not a validated ChIC class) -->
          <td>
            <span
              v-if="point.htlvEstimated"
              class="estimated"
              title="Unvalidated estimate — measured height missing"
              >≈ {{ formatClassLabel(point.estimatedClass) }}</span
            >
            <template v-else>{{ formatClassLabel(point.class) }}</template>
          </td>
          <td>{{ point.lgr }}</td>
          <td v-if="enableGrouping">
            <input
              v-model="point.group"
              placeholder="Group"
              @change="$emit('update-chart-point', index)"
            />
          </td>
          <td v-if="enableGrouping">
            <input
              v-model="point.groupColor"
              placeholder="Color"
              @change="$emit('update-chart-point', index)"
            />
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
            <button @click.stop="$emit('remove-point', index)" aria-label="Remove data point">
              -
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-if="estimatedCount > 0" class="estimate-note">
      {{ estimatedCount }} of {{ dataPoints.length }} rows used an estimated height — not a
      validated ChIC class
    </p>
  </div>
</template>

<script setup>
// Results table for calculated / imported data points.
import { computed } from 'vue';
import { formatClassLabel, formatHtTLV } from '@/domain/classification.js';

const props = defineProps({
  dataPoints: { type: Array, required: true },
  enableGrouping: { type: Boolean, default: false },
  editingIndex: { type: Number, default: null },
});
defineEmits(['edit-point', 'remove-point', 'update-chart-point']);

const estimatedCount = computed(() => props.dataPoints.filter((p) => p.htlvEstimated).length);
</script>

<style scoped>
.estimated {
  font-style: italic;
}
.estimate-note {
  margin: -10px 0 20px;
  font-style: italic;
  color: #a94442;
}
</style>
