import { describe, expect, test } from 'bun:test';

import { VANILLA_ROUND_TRIP_PLANS, VANILLA_ROUND_TRIP_VARIANTS, vanillaRoundTripPlanFor } from '../../../src/save/compare-save-load-roundtrip-oracle.ts';

describe('vanilla DOOM 1.9 save/load round-trip oracle contract', () => {
  test('pins the three round-trip variants', () => {
    expect(VANILLA_ROUND_TRIP_VARIANTS).toEqual(['write-read-write', 'read-write-read', 'state-save-load-state']);
  });

  test('write-read-write plan exercises byte equality after a second write', () => {
    const plan = vanillaRoundTripPlanFor('write-read-write');
    expect(plan.steps).toEqual(['writeFromState1', 'readToState2', 'writeFromState2', 'compareBuffers']);
  });

  test('read-write-read plan exercises state equality after a second read', () => {
    const plan = vanillaRoundTripPlanFor('read-write-read');
    expect(plan.steps).toEqual(['readToState1', 'writeFromState1', 'readToState2', 'compareStates']);
  });

  test('state-save-load-state plan is the strongest gate for encoder+decoder losslessness', () => {
    const plan = vanillaRoundTripPlanFor('state-save-load-state');
    expect(plan.steps).toEqual(['buildState1', 'writeFromState1', 'readToState2', 'compareStates']);
  });

  test('vanillaRoundTripPlanFor rejects unknown variants', () => {
    expect(() => {
      const unknown = 'unknown' as 'write-read-write';
      vanillaRoundTripPlanFor(unknown);
    }).toThrow(RangeError);
  });

  test('every variant has a registered plan in VANILLA_ROUND_TRIP_PLANS', () => {
    for (const variant of VANILLA_ROUND_TRIP_VARIANTS) {
      expect(VANILLA_ROUND_TRIP_PLANS.has(variant)).toBe(true);
    }
  });
});
