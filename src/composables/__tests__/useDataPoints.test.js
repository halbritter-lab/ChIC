import { describe, it, expect } from 'vitest';
import { useDataPoints } from '../useDataPoints.js';

const row = (id) => ({ id, age: 40, tlv: 3400, height: 1.7, class: 'B', uncalculable: false });

describe('useDataPoints — editingIndex sentinel', () => {
  it('starts at -1 (none) and pushes when not editing', () => {
    const { dataPoints, editingIndex, addOrUpdatePoint } = useDataPoints();
    expect(editingIndex.value).toBe(-1);
    addOrUpdatePoint(row('a'));
    addOrUpdatePoint(row('b'));
    expect(dataPoints.value.map((p) => p.id)).toEqual(['a', 'b']);
    expect(editingIndex.value).toBe(-1);
  });

  it('overwrites the edited row and resets to -1', () => {
    const { dataPoints, editingIndex, addOrUpdatePoint } = useDataPoints();
    addOrUpdatePoint(row('a'));
    addOrUpdatePoint(row('b'));
    editingIndex.value = 0;
    addOrUpdatePoint({ ...row('a2') });
    expect(dataPoints.value.map((p) => p.id)).toEqual(['a2', 'b']);
    expect(editingIndex.value).toBe(-1); // never left as index 0 (would mis-highlight)
  });
});

describe('useDataPoints — index-aware removeDataPoint (issue #35)', () => {
  const seed = () => {
    const api = useDataPoints();
    api.addOrUpdatePoint(row('a')); // 0
    api.addOrUpdatePoint(row('b')); // 1
    api.addOrUpdatePoint(row('c')); // 2
    return api;
  };

  it('clears the highlight when the edited row itself is removed', () => {
    const { editingIndex, removeDataPoint } = seed();
    editingIndex.value = 1; // editing 'b'
    removeDataPoint(1);
    expect(editingIndex.value).toBe(-1);
  });

  it('shifts the highlight down when a row ABOVE the edited row is removed', () => {
    const { dataPoints, editingIndex, removeDataPoint } = seed();
    editingIndex.value = 2; // editing 'c'
    removeDataPoint(0); // remove 'a'
    // 'c' is now at index 1
    expect(editingIndex.value).toBe(1);
    expect(dataPoints.value[editingIndex.value].id).toBe('c');
  });

  it('leaves the highlight unchanged when a row BELOW the edited row is removed', () => {
    const { dataPoints, editingIndex, removeDataPoint } = seed();
    editingIndex.value = 0; // editing 'a'
    removeDataPoint(2); // remove 'c'
    expect(editingIndex.value).toBe(0);
    expect(dataPoints.value[editingIndex.value].id).toBe('a');
  });

  it('does nothing to a cleared highlight (-1) on remove', () => {
    const { editingIndex, removeDataPoint } = seed();
    expect(editingIndex.value).toBe(-1);
    removeDataPoint(1);
    expect(editingIndex.value).toBe(-1);
  });
});
