import { describe, expect, test } from 'bun:test';

import { VANILLA_MAP_SETUP_PHASES, evaluateMapSetupOrder } from '../../../src/map/implement-map-setup-init-ordering.ts';

describe('vanilla P_SetupLevel ordering', () => {
  test('exactly 12 phases beginning with P_LoadBlockMap and ending with P_SpawnSpecials', () => {
    expect(VANILLA_MAP_SETUP_PHASES).toHaveLength(12);
    expect(VANILLA_MAP_SETUP_PHASES[0]).toBe('P_LoadBlockMap');
    expect(VANILLA_MAP_SETUP_PHASES[VANILLA_MAP_SETUP_PHASES.length - 1]).toBe('P_SpawnSpecials');
  });

  test('phase list is unique', () => {
    expect(new Set(VANILLA_MAP_SETUP_PHASES).size).toBe(VANILLA_MAP_SETUP_PHASES.length);
  });
});

describe('evaluateMapSetupOrder', () => {
  test('accepts the canonical phase order', () => {
    const decision = evaluateMapSetupOrder([...VANILLA_MAP_SETUP_PHASES]);
    expect(decision.accepted).toBe(true);
    expect(decision.violations).toEqual([]);
  });

  test('flags missing_phase when a phase is absent', () => {
    const partial = VANILLA_MAP_SETUP_PHASES.slice(0, -1);
    const decision = evaluateMapSetupOrder([...partial]);
    expect(decision.violations).toContain('missing_phase');
  });

  test('flags wrong_order when phases are swapped', () => {
    const swapped = [...VANILLA_MAP_SETUP_PHASES];
    [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
    const decision = evaluateMapSetupOrder(swapped);
    expect(decision.violations).toContain('wrong_order');
  });

  test('flags duplicate_phase when a phase repeats', () => {
    const duplicated = [...VANILLA_MAP_SETUP_PHASES, 'P_LoadVertexes' as const];
    const decision = evaluateMapSetupOrder(duplicated);
    expect(decision.violations).toContain('duplicate_phase');
  });
});
