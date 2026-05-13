/**
 * Vanilla Chocolate Doom 2.2.1 invariant: no visible interpolation in simulation.
 *
 * The DOOM simulation runs at exactly 35 Hz tic boundaries. Visible state
 * (mobj positions, sprite frames, sector heights, etc.) advances ONLY on tic
 * boundaries. Frame interpolation (Crispy Doom's `crispy_uncapped` / vanilla
 * speedups that interpolate visible state between tics) is explicitly rejected
 * at this layer.
 */

export const VANILLA_INTERPOLATION_INVARIANTS = Object.freeze([
  'NO_FRACTIONAL_TIC_VISIBLE_STATE',
  'NO_RENDER_TIME_DRIVEN_MOBJ_INTERPOLATION',
  'NO_RENDER_TIME_DRIVEN_VIEW_INTERPOLATION',
  'SIMULATION_ADVANCES_ON_INTEGER_TIC_BOUNDARIES_ONLY',
  'VISIBLE_FRAME_HASH_EQUALS_TIC_BOUNDARY_HASH',
] as const);

export type InterpolationInvariant = (typeof VANILLA_INTERPOLATION_INVARIANTS)[number];

export interface InterpolationCandidate {
  readonly name: string;
  readonly interpolatesVisibleState: boolean;
  readonly interpolatesMobjPosition: boolean;
  readonly interpolatesViewAngle: boolean;
  readonly emitsFractionalTicHash: boolean;
}

export interface InterpolationDecision {
  readonly accepted: boolean;
  readonly violations: readonly InterpolationInvariant[];
}

export function crossCheckInterpolationCandidate(candidate: InterpolationCandidate): InterpolationDecision {
  const violations: InterpolationInvariant[] = [];
  if (candidate.interpolatesVisibleState) {
    violations.push('SIMULATION_ADVANCES_ON_INTEGER_TIC_BOUNDARIES_ONLY');
  }
  if (candidate.interpolatesMobjPosition) {
    violations.push('NO_RENDER_TIME_DRIVEN_MOBJ_INTERPOLATION');
  }
  if (candidate.interpolatesViewAngle) {
    violations.push('NO_RENDER_TIME_DRIVEN_VIEW_INTERPOLATION');
  }
  if (candidate.emitsFractionalTicHash) {
    violations.push('NO_FRACTIONAL_TIC_VISIBLE_STATE');
    violations.push('VISIBLE_FRAME_HASH_EQUALS_TIC_BOUNDARY_HASH');
  }
  const uniqueSorted = [...new Set(violations)].sort();
  return Object.freeze({
    accepted: uniqueSorted.length === 0,
    violations: Object.freeze(uniqueSorted),
  });
}

/** A reference candidate that satisfies every invariant (rejects all interpolation). */
export const VANILLA_REJECTING_CANDIDATE: InterpolationCandidate = Object.freeze({
  name: 'vanilla-rejecting',
  interpolatesVisibleState: false,
  interpolatesMobjPosition: false,
  interpolatesViewAngle: false,
  emitsFractionalTicHash: false,
});
