import { describe, expect, test } from 'bun:test';

import { VANILLA_S_NULL, applyVanillaSetMobjState } from '../../../src/ai/implement-mobj-state-transitions.ts';

const stateTable = [
  { stateIndex: 0, tics: -1, nextStateIndex: 0 }, // S_NULL (placeholder)
  { stateIndex: 1, tics: 0, nextStateIndex: 2 }, // tics=0 chains forward
  { stateIndex: 2, tics: 5, nextStateIndex: 3 }, // tics>0 terminates loop
  { stateIndex: 3, tics: 10, nextStateIndex: 1 },
  { stateIndex: 4, tics: 0, nextStateIndex: 0 }, // tics=0 to S_NULL: removal
  { stateIndex: 5, tics: 0, nextStateIndex: 5 }, // tics=0 self-loop (safety cap)
];

describe('vanilla P_SetMobjState contract', () => {
  test('S_NULL sentinel is 0', () => {
    expect(VANILLA_S_NULL).toBe(0);
  });

  test('terminates at first tics>0 state', () => {
    const result = applyVanillaSetMobjState(stateTable, 2);
    expect(result.removed).toBe(false);
    expect(result.resolvedStateIndex).toBe(2);
    expect([...result.traversedStateIndices]).toEqual([2]);
  });

  test('tics=0 chain advances through nextstate until tics>0', () => {
    const result = applyVanillaSetMobjState(stateTable, 1);
    expect(result.removed).toBe(false);
    expect(result.resolvedStateIndex).toBe(2);
    expect([...result.traversedStateIndices]).toEqual([1, 2]);
  });

  test('S_NULL transition triggers removal (P_RemoveMobj)', () => {
    const result = applyVanillaSetMobjState(stateTable, 0);
    expect(result.removed).toBe(true);
  });

  test('chain into S_NULL also triggers removal', () => {
    const result = applyVanillaSetMobjState(stateTable, 4);
    expect(result.removed).toBe(true);
  });

  test('safety cap bounds infinite tics=0 self-loops', () => {
    const result = applyVanillaSetMobjState(stateTable, 5, 16);
    expect(result.removed).toBe(false);
    expect(result.traversedStateIndices.length).toBe(16);
  });
});
