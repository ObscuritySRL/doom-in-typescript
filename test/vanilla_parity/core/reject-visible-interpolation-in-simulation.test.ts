import { describe, expect, test } from 'bun:test';

import { VANILLA_INTERPOLATION_INVARIANTS, VANILLA_REJECTING_CANDIDATE, crossCheckInterpolationCandidate } from '../../../src/core/reject-visible-interpolation-in-simulation.ts';

describe('vanilla no-interpolation invariants', () => {
  test('five invariants, sorted, unique', () => {
    expect(VANILLA_INTERPOLATION_INVARIANTS).toHaveLength(5);
    expect([...VANILLA_INTERPOLATION_INVARIANTS].sort()).toEqual([...VANILLA_INTERPOLATION_INVARIANTS]);
    expect(new Set(VANILLA_INTERPOLATION_INVARIANTS).size).toBe(VANILLA_INTERPOLATION_INVARIANTS.length);
  });

  test('vanilla rejecting candidate accepts and reports no violations', () => {
    const decision = crossCheckInterpolationCandidate(VANILLA_REJECTING_CANDIDATE);
    expect(decision.accepted).toBe(true);
    expect(decision.violations).toEqual([]);
  });
});

describe('crossCheckInterpolationCandidate violations', () => {
  test('flags SIMULATION_ADVANCES_ON_INTEGER_TIC_BOUNDARIES_ONLY when visible state interpolates', () => {
    const decision = crossCheckInterpolationCandidate({ ...VANILLA_REJECTING_CANDIDATE, interpolatesVisibleState: true });
    expect(decision.accepted).toBe(false);
    expect(decision.violations).toContain('SIMULATION_ADVANCES_ON_INTEGER_TIC_BOUNDARIES_ONLY');
  });

  test('flags NO_RENDER_TIME_DRIVEN_MOBJ_INTERPOLATION when mobj position interpolates', () => {
    const decision = crossCheckInterpolationCandidate({ ...VANILLA_REJECTING_CANDIDATE, interpolatesMobjPosition: true });
    expect(decision.violations).toContain('NO_RENDER_TIME_DRIVEN_MOBJ_INTERPOLATION');
  });

  test('flags NO_RENDER_TIME_DRIVEN_VIEW_INTERPOLATION when view angle interpolates', () => {
    const decision = crossCheckInterpolationCandidate({ ...VANILLA_REJECTING_CANDIDATE, interpolatesViewAngle: true });
    expect(decision.violations).toContain('NO_RENDER_TIME_DRIVEN_VIEW_INTERPOLATION');
  });

  test('flags both NO_FRACTIONAL_TIC_VISIBLE_STATE and VISIBLE_FRAME_HASH_EQUALS_TIC_BOUNDARY_HASH on fractional-tic hash', () => {
    const decision = crossCheckInterpolationCandidate({ ...VANILLA_REJECTING_CANDIDATE, emitsFractionalTicHash: true });
    expect(decision.violations).toContain('NO_FRACTIONAL_TIC_VISIBLE_STATE');
    expect(decision.violations).toContain('VISIBLE_FRAME_HASH_EQUALS_TIC_BOUNDARY_HASH');
  });
});
