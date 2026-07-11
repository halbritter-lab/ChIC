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
          <!-- htTLV: value, or N/A when the row could not be calculated (issue #37) -->
          <td>
            <span
              v-if="point.uncalculable"
              class="uncalculable"
              title="Could not calculate — missing or out-of-range height, age and TLV"
              >N/A</span
            >
            <template v-else>{{ formatHtTLV(point.htlv) }}</template>
          </td>
          <!-- Charité Imaging Class: value, or N/A when the row could not be calculated -->
          <td>
            <span
              v-if="point.uncalculable"
              class="uncalculable"
              title="Could not calculate — missing or out-of-range height, age and TLV"
              >N/A</span
            >
            <template v-else>{{ formatClassLabel(point.class) }}</template>
          </td>
          <!-- LGR: value, or N/A when the row could not be calculated (issue #37), styled
               like htTLV/Class so all calculated outputs read the same -->
          <td>
            <span
              v-if="point.uncalculable"
              class="uncalculable"
              title="Could not calculate — missing or out-of-range height, age and TLV"
              >N/A</span
            >
            <template v-else>{{ point.lgr }}</template>
          </td>
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

    <p v-if="uncalculableCount > 0" class="uncalculable-note">
      {{ uncalculableCount }} of {{ dataPoints.length }} rows could not be calculated (missing or
      out-of-range height, age and TLV) — shown as N/A in table and not plotted
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
  editingIndex: { type: Number, default: -1 },
});
defineEmits(['edit-point', 'remove-point', 'update-chart-point']);

const uncalculableCount = computed(() => props.dataPoints.filter((p) => p.uncalculable).length);
</script>

<style scoped>
/* N/A cell value: red — signals the missing datum inside the table. */
.uncalculable {
  font-style: italic;
  color: #a94442;
}
/* Advisory note below the table: amber, matching the import notice (.load-notice) so both
   "some rows could not be calculated" messages read as one advisory voice — distinct from
   the red used for errors and for N/A cell values (issue #37, reviewer note). */
.uncalculable-note {
  margin: -10px 0 20px;
  font-style: italic;
  color: #8a6d3b;
}
</style>
